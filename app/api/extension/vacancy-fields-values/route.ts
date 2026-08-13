import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import {
  resolveVacancyFields,
  type ScreeningAnswersMap,
  type VacancyAnswer,
  type VacancyFieldSpec,
} from "src/lib/vacancy-field-resolver";

const fieldSchema = z.object({
  label: z.string().trim().min(1).max(500).optional(),
  type: z.string().trim().max(80).optional(),
  required: z.union([z.boolean(), z.string()]).optional(),
  options: z.array(z.union([z.string(), z.object({ label: z.string().optional() })])).optional(),
});

const requestSchema = z.object({
  url: z.string().trim().max(2000).optional().default(""),
  fields: z.array(fieldSchema).max(120).default([]),
  company: z.string().trim().max(300).optional().default(""),
  role: z.string().trim().max(300).optional().default(""),
  description: z.string().trim().max(30000).optional().default(""),
});

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function loadScreeningAnswers(userId: string): Promise<ScreeningAnswersMap> {
  const logs = await prisma.auditLog.findMany({
    where: {
      actorUserId: userId,
      action: "user.screening_answer_saved",
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const map: ScreeningAnswersMap = {};
  for (const log of logs) {
    const meta = asObject(log.metadataJson);
    if (!meta) continue;
    const questionKey = String(meta.questionKey || "").trim();
    const questionLabel = String(meta.questionLabel || "").trim();
    const answer = String(meta.answer || "").trim();
    if (!questionKey || !questionLabel || !answer) continue;
    if (map[questionKey] === undefined) map[questionKey] = answer;
    if (map[questionLabel] === undefined) map[questionLabel] = answer;
  }
  return map;
}

async function loadProfile(userId: string) {
  const [user, resume] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        currentCity: true,
        linkedinUrl: true,
        portfolioUrl: true,
      },
    }),
    prisma.userResume.findUnique({ where: { userId } }),
  ]);

  const parsed = asObject(resume?.parsedData) || {};
  const skills = Array.isArray(parsed.skills) ? parsed.skills.map((s) => String(s)) : [];
  const jobTitles = Array.isArray(parsed.jobTitles) ? parsed.jobTitles.map((s) => String(s)) : [];
  const experience = Array.isArray(parsed.experience) ? (parsed.experience as unknown[]) : [];

  return {
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentCity: user?.currentCity || "",
    linkedinUrl: user?.linkedinUrl || "",
    portfolioUrl: user?.portfolioUrl || "",
    skills,
    jobTitles,
    yearsOfExperience: parsed.yearsOfExperience ? String(parsed.yearsOfExperience) : "",
    workAuthorization: parsed.workAuthorization ? String(parsed.workAuthorization) : "",
    summary: parsed.summary ? String(parsed.summary) : "",
    experience,
  };
}

function profileContextForAi(profile: Awaited<ReturnType<typeof loadProfile>>): string {
  const lines: string[] = [];
  if (profile.name) lines.push(`Name: ${profile.name}`);
  if (profile.email) lines.push(`Email: ${profile.email}`);
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.currentCity) lines.push(`Location: ${profile.currentCity}`);
  if (profile.yearsOfExperience) lines.push(`Years of experience: ${profile.yearsOfExperience}`);
  if (profile.jobTitles.length) lines.push(`Job titles: ${profile.jobTitles.join(", ")}`);
  if (profile.skills.length) lines.push(`Skills: ${profile.skills.slice(0, 60).join(", ")}`);
  if (profile.workAuthorization) lines.push(`Work authorization: ${profile.workAuthorization}`);
  if (profile.summary) lines.push(`Summary: ${profile.summary}`);
  if (profile.linkedinUrl) lines.push(`LinkedIn: ${profile.linkedinUrl}`);
  if (profile.portfolioUrl) lines.push(`Portfolio: ${profile.portfolioUrl}`);
  return lines.join("\n");
}

async function answerWithGroq(
  unresolved: VacancyFieldSpec[],
  context: {
    url: string;
    company: string;
    role: string;
    description: string;
    profileText: string;
  },
): Promise<VacancyAnswer[]> {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) return [];

  const fieldsJson = JSON.stringify(
    unresolved.map((f) => ({
      label: f.label,
      type: f.type,
      required: f.required,
      options: Array.isArray(f.options)
        ? f.options.map((o) => (typeof o === "string" ? o : o?.label || ""))
        : undefined,
    })),
  );

  const systemPrompt = `You are an expert application-assistant. You are given a list of job-application form fields (in JSON array), plus a job context and a candidate profile. For each field choose the most accurate answer from the candidate's saved data when possible. Rules:
- Answer MUST be a JSON object: {"answers": [{"label":"<exact field label>","value":"<answer>"}, ...]}
- Only include fields that you can answer with confidence from the given profile/context. If you cannot determine an answer for a field, omit it (do NOT invent data).
- If a field has "options", pick one of those options verbatim.
- If a field looks like a boolean/yes-no question, answer "Yes" or "No" accordingly (default "Yes" for acknowledgements/agreements).
- Keep answers concise. Return ONLY the JSON object, no other text.`;

  const userPrompt = [
    `Job URL: ${context.url}`,
    `Company: ${context.company}`,
    `Role: ${context.role}`,
    `Job description: ${context.description.slice(0, 12000) || "(empty)"}`,
    ``,
    `Candidate profile:`,
    context.profileText || "(no profile data)",
    ``,
    `Fields to answer (JSON): ${fieldsJson}`,
  ].join("\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  let items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.answers)) items = obj.answers;
    else if (Array.isArray(obj.fields)) items = obj.fields;
  }

  return items
    .map((item): VacancyAnswer | null => {
      const it = asObject(item);
      if (!it) return null;
      const label = String(it.label || "").trim();
      const value = String(it.value ?? "").trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((a): a is VacancyAnswer => a !== null);
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const payload = requestSchema.parse(await req.json());
    if (!payload.fields.length) return fail("No fields to answer", 400, "NO_FIELDS");

    const [answersMap, profile] = await Promise.all([
      loadScreeningAnswers(userId),
      loadProfile(userId),
    ]);

    const { answers, unresolved } = resolveVacancyFields(
      payload.fields,
      answersMap,
      profile,
    );

    let aiAnswers: VacancyAnswer[] = [];
    if (unresolved.length) {
      aiAnswers = await answerWithGroq(unresolved, {
        url: payload.url,
        company: payload.company,
        role: payload.role,
        description: payload.description,
        profileText: profileContextForAi(profile),
      });
    }

    const merged: VacancyAnswer[] = [...answers, ...aiAnswers];

    return ok("Vacancy fields answered", {
      answers: merged,
      resolvedFromSaved: answers.length,
      resolvedFromAi: aiAnswers.length,
      unresolved: unresolved.map((f) => f.label || ""),
      total: payload.fields.length,
    });
  } catch (error) {
    return handleApiError(error, "Failed to answer vacancy fields");
  }
}
