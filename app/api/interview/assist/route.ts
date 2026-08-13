import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "src/lib/guards";
import { enforceRateLimit } from "src/lib/rate-limit";
import { fail, handleApiError, ok } from "src/lib/api";
import { buildResumeContext, loadUserContext } from "src/lib/resume-context";

type Tone = "concise" | "detailed" | "star";
type Mode = "assist" | "score";

const VALID_TONES: Tone[] = ["concise", "detailed", "star"];
const VALID_MODES: Mode[] = ["assist", "score"];

const TONE_GUIDE: Record<Tone, string> = {
  concise:
    "Keep it direct and tight — roughly 100-180 words (under 90 seconds when spoken). No filler, one clear point at a time.",
  detailed:
    "Give a thorough answer with context, reasoning, and a concrete takeaway — roughly 300-500 words (2-3 minutes when spoken).",
  star: "Use the STAR method (Situation, Task, Action, Result) with clear short headers for each section.",
};

function getEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function isEnabled() {
  return getEnv("INTERVIEW_ASSIST_ENABLED").toLowerCase() !== "false";
}

function getProviderConfig() {
  const provider = (getEnv("INTERVIEW_ASSIST_PROVIDER") || "groq").toLowerCase();
  const explicitKey = getEnv("INTERVIEW_ASSIST_API_KEY");
  const baseUrl = getEnv("INTERVIEW_ASSIST_BASE_URL");
  if (provider === "openai") {
    return {
      provider: "openai" as const,
      apiKey: explicitKey || getEnv("OPENAI_API_KEY"),
      baseUrl: baseUrl || "https://api.openai.com/v1/responses",
      model: getEnv("INTERVIEW_ASSIST_MODEL") || getEnv("OPENAI_MODEL") || "gpt-4.1-mini",
    };
  }
  if (provider === "custom") {
    return {
      provider: "custom" as const,
      apiKey: explicitKey || getEnv("GROQ_API_KEY"),
      baseUrl: baseUrl || "https://api.groq.com/openai/v1/chat/completions",
      model: getEnv("INTERVIEW_ASSIST_MODEL") || "llama-3.3-70b-versatile",
    };
  }
  return {
    provider: "groq" as const,
    apiKey: explicitKey || getEnv("GROQ_API_KEY"),
    baseUrl: baseUrl || "https://api.groq.com/openai/v1/chat/completions",
    model: getEnv("INTERVIEW_ASSIST_MODEL") || "llama-3.3-70b-versatile",
  };
}

function clampInt(raw: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseConcurrency() {
  return clampInt(getEnv("INTERVIEW_ASSIST_CONCURRENCY"), 2, 5, 2);
}

function parseRateLimit() {
  return clampInt(getEnv("INTERVIEW_ASSIST_RATE_LIMIT"), 1, 60, 10);
}

// ---- In-memory concurrency limiter (semaphore). Single Node process.
let active = 0;
const waiters: Array<() => void> = [];
let MAX_CONCURRENCY = parseConcurrency();

async function acquireSlot(): Promise<() => void> {
  if (active < MAX_CONCURRENCY) {
    active += 1;
    return () => {
      active -= 1;
      const next = waiters.shift();
      if (next) next();
    };
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  return acquireSlot();
}

// ---- In-memory per-user rate limiter (fallback when Redis is not configured)
const userHits = new Map<string, { count: number; resetAt: number }>();
const IN_MEMORY_LIMIT = 10;

function inMemoryRateLimit(userId: string, limit: number, windowMs: number): number {
  const now = Date.now();
  const entry = userHits.get(userId);
  if (!entry || entry.resetAt <= now) {
    userHits.set(userId, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  entry.count += 1;
  return entry.count > limit ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) : 0;
}

async function callProvider(cfg: ReturnType<typeof getProviderConfig>, system: string, user: string, maxTokens: number) {
  if (!cfg.apiKey) {
    throw new ProviderMissingError();
  }

  if (cfg.provider === "openai") {
    const res = await fetch(cfg.baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        instructions: system,
        input: [{ role: "user", content: [{ type: "input_text", text: user }] }],
        max_output_tokens: maxTokens,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(res.status, body);
    }
    const json = (await res.json()) as { output_text?: string };
    return String(json.output_text || "").trim();
  }

  // Groq / custom OpenAI-compatible chat completions
  const res = await fetch(cfg.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError(res.status, body);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError(502, "Empty provider response");
  return String(content).trim();
}

class ProviderMissingError extends Error {}
class ProviderError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`AI provider error (${status}): ${body.slice(0, 400)}`);
    this.status = status;
  }
}

function offlineAssist(question: string, tone: Tone, resumeContext: string) {
  const skillLine = resumeContext.split("\n").find((l) => l.startsWith("Skills:"))?.replace("Skills: ", "") || "relevant skills";
  const projectLine = resumeContext.split("\n").find((l) => l.startsWith("Projects:"))?.replace("Projects: ", "") || "";

  const parts: string[] = [
    "Here's a draft answer you can refine and make your own:",
    "",
    projectLine
      ? `One project I'm proud of is ${projectLine.split(",")[0]}. I owned it end to end — from understanding the requirement and choosing the approach, to shipping it and measuring the outcome.`
      : "I've worked on real projects where I owned the end-to-end process: scoping the requirement, picking the right approach, building it, and shipping a measurable result.",
    `Along the way I used ${skillLine}, and what I learned is to start from the user's problem, validate assumptions early, and keep the solution simple.`,
    "",
    "Tip: plug in a specific number or result from your experience to make this answer memorable.",
  ];

  if (tone === "star") {
    return [
      "Here's a draft answer in STAR format:",
      "",
      "Situation — Describe the background of a specific situation or task.",
      "Task — Explain the challenge and your responsibility.",
      "Action — Walk through the concrete steps you took, using " + skillLine + ".",
      "Result — Share the outcome and what it taught you.",
      "",
      "Replace each line with your real example, then keep it under 90 seconds when spoken.",
    ].join("\n");
  }

  return parts.join("\n");
}

function offlineScore(question: string) {
  return {
    score: 5,
    strengths: [
      "You gave a complete, structured answer.",
      "You covered the question directly.",
    ],
    improvements: [
      "Add a concrete, specific example instead of speaking in generalities.",
      "Include a measurable result or number to make the impact clear.",
      "Tighten the opening — answer in the first sentence, then justify.",
    ],
    modelAnswer:
      "Answer with a specific story: name the situation, your role, the action you took, and the measurable result. " +
      "For example, instead of 'I'm good at solving problems,' say 'When our payment flow failed for 12% of users, I traced it to a race condition, shipped a fix in a day, and recoveries dropped to under 1%.'",
  };
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    "access-control-max-age": "86400",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const res = await handlePost(req);
  for (const [key, value] of Object.entries(corsHeaders())) {
    res.headers.set(key, value);
  }
  return res;
}

async function handlePost(req: NextRequest) {
  if (!isEnabled()) {
    return fail("Interview assistant is disabled", 503, "FEATURE_DISABLED");
  }

  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    // Per-user rate limit (requests per minute)
    const rateLimit = parseRateLimit();
    const redisRetry = await enforceRateLimit({
      key: `interview-assist:${userId}`,
      limit: rateLimit,
      windowMs: 60_000,
    });
    if (redisRetry) {
      const retryAfter = inMemoryRateLimit(userId, rateLimit, 60_000);
      if (retryAfter > 0) {
        const res = fail("Rate limit exceeded. Try again shortly.", 429, "RATE_LIMITED");
        res.headers.set("Retry-After", String(retryAfter));
        return res;
      }
      void redisRetry;
    } else {
      const retryAfter = inMemoryRateLimit(userId, rateLimit, 60_000);
      if (retryAfter > 0) {
        const res = fail("Rate limit exceeded. Try again shortly.", 429, "RATE_LIMITED");
        res.headers.set("Retry-After", String(retryAfter));
        return res;
      }
    }

    const body = (await req.json()) as {
      question?: string;
      mode?: Mode;
      tone?: Tone;
      userAnswer?: string;
    };

    const mode: Mode = VALID_MODES.includes(body.mode as Mode) ? (body.mode as Mode) : "assist";
    const tone: Tone = VALID_TONES.includes(body.tone as Tone) ? (body.tone as Tone) : "detailed";
    const question = String(body.question || "").trim().slice(0, 4000);
    const userAnswer = String(body.userAnswer || "").trim().slice(0, 8000);

    if (!question) return fail("Question is required", 400, "VALIDATION_ERROR");
    if (mode === "score" && !userAnswer) return fail("Your answer is required for scoring", 400, "VALIDATION_ERROR");

    const { parsed, profile } = await loadUserContext(userId);
    const resumeContext = buildResumeContext(parsed, profile);
    const cfg = getProviderConfig();
    const concurrency = parseConcurrency();

    const systemPrompt = [
      "You are an expert interview coach and business communication advisor.",
      "The user is preparing answers to live client and job-interview questions.",
      "Write in first person as if the user is speaking, confident and natural.",
      "",
      "User background (from their profile/resume):",
      resumeContext ? `\n${resumeContext}\n` : "\n(no resume uploaded yet — keep answers generic and honest)\n",
      "",
      "Ground every claim in the user background above. Never invent experience, employers, skills, or numbers that are not listed. If the background lacks relevant evidence, say the answer should be framed around transferable skills instead of fabricating details.",
    ].join("\n");

    if (mode === "assist") {
      const userPrompt = [
        `Question: ${question}`,
        "",
        `Response style: ${TONE_GUIDE[tone]}`,
        "",
        "Write the full answer the user can say aloud. Do not include meta commentary like 'Here is your answer'. Just the answer.",
      ].join("\n");

      const release = await acquireSlot();
      try {
        try {
          const draft = await callProvider(cfg, systemPrompt, userPrompt, 1200);
          return ok("Answer drafted", { draft, provider: cfg.provider, model: cfg.model });
        } catch (error) {
          if (error instanceof ProviderMissingError) {
            return ok("Answer drafted (offline template)", {
              draft: offlineAssist(question, tone, resumeContext),
              provider: "offline",
              model: "",
            });
          }
          if (error instanceof ProviderError) {
            return NextResponse.json(
              { success: false, message: error.message },
              { status: error.status === 429 ? 429 : 502 }
            );
          }
          throw error;
        }
      } finally {
        release();
      }
    }

    // mode === "score"
    const userPrompt = [
      `Interview/client question: ${question}`,
      "",
      `Candidate's actual answer:`,
      userAnswer,
      "",
      "Evaluate this answer and return ONLY a JSON object with exactly these keys:",
      '{ "score": number 0-10, "strengths": string[3], "improvements": string[3], "modelAnswer": string }',
      "Score how well the answer is structured, specific, honest, and compelling. Be constructive, not harsh. The modelAnswer should be a short, strong rework of the answer.",
    ].join("\n");

    const release = await acquireSlot();
    try {
      try {
        const raw = await callProvider(cfg, systemPrompt, userPrompt, 1600);
        const parsedCard = parseScoreCard(raw);
        return ok("Answer scored", { scorecard: parsedCard, provider: cfg.provider, model: cfg.model });
      } catch (error) {
        if (error instanceof ProviderMissingError) {
          return ok("Answer scored (offline)", { scorecard: offlineScore(question), provider: "offline", model: "" });
        }
        if (error instanceof ProviderError) {
          return NextResponse.json(
            { success: false, message: error.message },
            { status: error.status === 429 ? 429 : 502 }
          );
        }
        throw error;
      }
    } finally {
      release();
    }
  } catch (error) {
    return handleApiError(error, "Failed to run interview assistant");
  }
}

function parseScoreCard(raw: string) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : raw;
  try {
    const data = JSON.parse(jsonText) as {
      score?: unknown;
      strengths?: unknown;
      improvements?: unknown;
      modelAnswer?: unknown;
    };
    const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).slice(0, 5) : []);
    const scoreNum = Number(data.score);
    return {
      score: Number.isFinite(scoreNum) ? Math.min(10, Math.max(0, Math.round(scoreNum))) : 5,
      strengths: arr(data.strengths),
      improvements: arr(data.improvements),
      modelAnswer: String(data.modelAnswer || "").trim(),
    };
  } catch {
    return {
      score: 5,
      strengths: [],
      improvements: [],
      modelAnswer: raw,
    };
  }
}
