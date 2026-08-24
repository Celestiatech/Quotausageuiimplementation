import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";

const requestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  questionType: z.string().trim().optional().default("text"),
  options: z.array(z.string()).optional().default([]),
  validationMessage: z.string().trim().optional().default(""),
  jobContext: z
    .object({
      title: z.string().optional().default(""),
      company: z.string().optional().default(""),
      workLocation: z.string().optional().default(""),
      description: z.string().optional().default(""),
    })
    .optional()
    .default({ title: "", company: "", workLocation: "", description: "" }),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid JSON payload", 400);
    }

    const payload = requestSchema.parse(body);
    const apiKey = process.env.GROQ_API_KEY || "";
    if (!apiKey) {
      return fail("GROQ_API_KEY is not configured", 500);
    }

    // Load applicant profile and resume from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        currentCity: true,
        linkedinUrl: true,
        portfolioUrl: true,
        resumeText: true,
        resume: {
          select: {
            resumeText: true,
            parsedData: true,
          },
        },
      },
    });

    const resumeContent =
      user?.resume?.resumeText ||
      user?.resumeText ||
      (user?.resume?.parsedData ? JSON.stringify(user.resume.parsedData, null, 2) : "") ||
      "Experienced Software and Web Developer with skills in modern web development frameworks, databases, and full-stack applications.";

    const profileContext = `
Applicant Profile:
Name: ${user?.name || ""}
Email: ${user?.email || ""}
Phone: ${user?.phone || ""}
City/Location: ${user?.currentCity || "Mohali, India"}
LinkedIn: ${user?.linkedinUrl || ""}
Portfolio: ${user?.portfolioUrl || ""}

Applicant Resume & Experience:
${resumeContent.slice(0, 12000)}
`;

    const jobInfo = `
Target Job Context:
Job Title: ${payload.jobContext.title || "Job"}
Company: ${payload.jobContext.company || "Company"}
Location: ${payload.jobContext.workLocation || "Remote / Hybrid"}
Job Description Snippet: ${payload.jobContext.description.slice(0, 1500)}
`;

    const isChoice = payload.options.length > 0;
    const optionsText = isChoice
      ? `Available Options (MUST select one exactly as written):\n${payload.options.map((o) => `- "${o}"`).join("\n")}`
      : "";

    const systemPrompt = `You are an AI career copilot answering a job application screening question on behalf of the applicant.
Use the applicant's resume, skills, and background details to provide the most accurate, realistic, and positive answer.

${profileContext}
${jobInfo}

Instructions:
1. For numeric or years-of-experience questions: Return just the number (e.g. 5) or numeric range.
2. For yes/no or multiple choice questions: You MUST select the single best option from the provided options list.
3. For text/textarea questions: Write a direct, professional, first-person response based on the candidate's actual resume (1-3 sentences max).
4. For salary or compensation: Provide a standard competitive expectation or "Negotiable".
5. Return strictly a JSON object: { "answer": "exact answer string" }`;

    const userPrompt = `Screening Question: "${payload.question}"
Question Type: ${payload.questionType}
${optionsText}
${payload.validationMessage ? `Validation Constraint: ${payload.validationMessage}` : ""}

Provide the best answer JSON:`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      return fail(`Groq AI request failed: ${errText}`, 502);
    }

    const groqData = await groqRes.json();
    const rawContent = groqData?.choices?.[0]?.message?.content || "";
    let answer = "";
    try {
      const parsedJson = JSON.parse(rawContent);
      answer = String(
        parsedJson.answer ||
        parsedJson.response ||
        parsedJson.result ||
        parsedJson.value ||
        parsedJson.text ||
        parsedJson.description ||
        ""
      ).trim();
      if (!answer && typeof parsedJson === "object" && parsedJson !== null) {
        const values = Object.values(parsedJson).filter((v) => typeof v === "string" && (v as string).trim().length > 0);
        if (values.length > 0) answer = String(values[0]).trim();
      }
    } catch {
      answer = rawContent.trim();
    }

    if (!answer) {
      return fail("AI did not generate a valid answer", 502);
    }

    // Auto-save the generated answer to audit log so future identical questions are instant
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: payload.question.slice(0, 100),
      metadataJson: {
        questionKey: payload.question.slice(0, 100).toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        questionLabel: payload.question,
        answer,
        answerType: isChoice ? "choice" : payload.questionType,
        source: "system",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);

    return ok("AI screening answer generated", {
      answer,
      source: "ai_resume",
    });
  } catch (error) {
    return handleApiError(error, "Failed to generate AI screening answer");
  }
}
