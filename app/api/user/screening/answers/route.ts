import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";

const answerTypeSchema = z.enum(["text", "boolean", "number", "choice", "multiselect"]);
const sourceSchema = z.enum(["manual", "linkedin_import", "resume_parse", "extension_capture", "system"]);

const saveAnswerSchema = z.object({
  questionKey: z.string().trim().min(1).max(160),
  questionLabel: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(1000),
  answerType: answerTypeSchema.optional().default("text"),
  source: sourceSchema.optional().default("manual"),
  lastUsed: z.string().trim().max(80).optional(),
});

type AnswerType = z.infer<typeof answerTypeSchema>;
type SourceType = z.infer<typeof sourceSchema>;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseAnswerType(value: unknown): AnswerType {
  const parsed = answerTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : "text";
}

function parseSource(value: unknown): SourceType {
  const parsed = sourceSchema.safeParse(value);
  return parsed.success ? parsed.data : "manual";
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const url = new URL(req.url);
    const scanLimitRaw = Number(url.searchParams.get("scanLimit") || 1000);
    const scanLimit = Number.isFinite(scanLimitRaw)
      ? Math.max(200, Math.min(5000, Math.floor(scanLimitRaw)))
      : 1000;

    const logs = await prisma.auditLog.findMany({
      where: {
        actorUserId: authResult.auth.user.id,
        action: "user.screening_answer_saved",
      },
      orderBy: { createdAt: "desc" },
      take: scanLimit,
    });

    const latestByKey = new Map<
      string,
      {
        questionKey: string;
        questionLabel: string;
        answer: string;
        answerType: AnswerType;
        source: SourceType;
        lastUsed: string;
        updatedAt: string;
      }
    >();

    for (const log of logs) {
      const meta = asObject(log.metadataJson);
      if (!meta) continue;
      const questionKey = String(meta.questionKey || "").trim();
      const questionLabel = String(meta.questionLabel || "").trim();
      const answer = String(meta.answer || "").trim();
      if (!questionKey || !questionLabel || !answer) continue;
      const source = parseSource(meta.source);
      const candidate = {
        questionKey,
        questionLabel,
        answer,
        answerType: parseAnswerType(meta.answerType),
        source,
        lastUsed: String(meta.lastUsed || "").trim() || log.createdAt.toISOString(),
        updatedAt: log.createdAt.toISOString(),
      };
      const existing = latestByKey.get(questionKey);
      // Never let an auto-captured answer (source "extension_capture") override a higher-priority
      // value for the same key. Captures can be stale values the bot picked up from a form (e.g.
      // a captured "Mohali") and would otherwise clobber manually saved answers. Mirror the
      // extension's own read guard in background.js.
      if (!existing) {
        latestByKey.set(questionKey, candidate);
      } else if (existing.source === "extension_capture" && source !== "extension_capture") {
        latestByKey.set(questionKey, candidate);
      }
    }

    const allAnswers = Array.from(latestByKey.values());
    const answers = allAnswers.slice(skip, skip + limit);
    return ok("Screening answers fetched", {
      answers,
      pagination: {
        page,
        limit,
        total: allAnswers.length,
        totalPages: Math.ceil(allAnswers.length / limit),
      },
      scanLimit,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch screening answers");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const rawBody = await req.json();
    const items = Array.isArray(rawBody) ? rawBody : [rawBody];

    const parsed: Array<z.infer<typeof saveAnswerSchema>> = [];
    for (const item of items) {
      const result = saveAnswerSchema.safeParse(item);
      if (result.success) parsed.push(result.data);
    }
    if (!parsed.length) {
      return handleApiError(new Error("No valid answers provided"), "Failed to save screening answer");
    }

    for (const payload of parsed) {
      await writeAuditLog({
        actorUserId: authResult.auth.user.id,
        action: "user.screening_answer_saved",
        targetType: "screening_answer",
        targetId: payload.questionKey,
        metadataJson: {
          ...payload,
          lastUsed: payload.lastUsed || new Date().toISOString(),
        },
      });
    }

    return ok("Screening answers saved", { answers: parsed });
  } catch (error) {
    return handleApiError(error, "Failed to save screening answer");
  }
}
