import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, handleApiError } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";

const reportIssueSchema = z.object({
  questionKey: z.string().trim().min(1).max(160),
  questionLabel: z.string().trim().min(1).max(500),
  validationMessage: z.string().trim().max(500).optional().default(""),
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
        action: { in: ["user.screening_issue_detected", "user.screening_answer_saved"] },
      },
      orderBy: { createdAt: "desc" },
      take: 800,
    });

    const latestStateByKey = new Map<
      string,
      {
        questionKey: string;
        questionLabel: string;
        status: "pending" | "resolved";
        validationMessage: string;
        updatedAt: string;
      }
    >();

    for (const log of logs) {
      const meta = asObject(log.metadataJson);
      if (!meta) continue;
      const questionKey = String(meta.questionKey || "").trim();
      if (!questionKey || latestStateByKey.has(questionKey)) continue;
      const questionLabel = String(meta.questionLabel || "").trim() || questionKey;
      const validationMessage = String(meta.validationMessage || "").trim();
      latestStateByKey.set(questionKey, {
        questionKey,
        questionLabel,
        status: log.action === "user.screening_issue_detected" ? "pending" : "resolved",
        validationMessage,
        updatedAt: log.createdAt.toISOString(),
      });
    }

    const pending = Array.from(latestStateByKey.values()).filter((i) => i.status === "pending");
    const resolved = Array.from(latestStateByKey.values()).filter((i) => i.status === "resolved");
    return ok("Screening issues fetched", {
      pending,
      resolved,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch screening issues");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = reportIssueSchema.parse(await req.json());

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "user.screening_issue_detected",
      targetType: "screening_issue",
      targetId: payload.questionKey,
      metadataJson: payload,
    });

    return ok("Screening issue recorded", { issue: payload });
  } catch (error) {
    return handleApiError(error, "Failed to record screening issue");
  }
}

