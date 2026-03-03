import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";

const saveAnswerSchema = z.object({
  questionKey: z.string().trim().min(1).max(160),
  questionLabel: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(1000),
});

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const logs = await prisma.auditLog.findMany({
      where: {
        actorUserId: authResult.auth.user.id,
        action: "user.screening_answer_saved",
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const latestByKey = new Map<string, { questionKey: string; questionLabel: string; answer: string; updatedAt: string }>();
    for (const log of logs) {
      const meta = asObject(log.metadataJson);
      if (!meta) continue;
      const questionKey = String(meta.questionKey || "").trim();
      const questionLabel = String(meta.questionLabel || "").trim();
      const answer = String(meta.answer || "").trim();
      if (!questionKey || !questionLabel || !answer) continue;
      if (!latestByKey.has(questionKey)) {
        latestByKey.set(questionKey, {
          questionKey,
          questionLabel,
          answer,
          updatedAt: log.createdAt.toISOString(),
        });
      }
    }

    const answers = Array.from(latestByKey.values());
    return ok("Screening answers fetched", { answers });
  } catch (error) {
    return handleApiError(error, "Failed to fetch screening answers");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = saveAnswerSchema.parse(await req.json());

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: payload.questionKey,
      metadataJson: payload,
    });

    return ok("Screening answer saved", { answer: payload });
  } catch (error) {
    return handleApiError(error, "Failed to save screening answer");
  }
}

