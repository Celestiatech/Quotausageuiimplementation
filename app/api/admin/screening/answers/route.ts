import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";

const saveAdminAnswerSchema = z.object({
  userId: z.string().trim().min(1),
  questionKey: z.string().trim().min(1).max(160),
  questionLabel: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const payload = saveAdminAnswerSchema.parse(await req.json());

    // Store screening answers in audit logs (same as user saves) so the extension can pick them up from the site.
    // We attribute the action to the target user for compatibility with existing "pending/resolved" logic.
    await writeAuditLog({
      actorUserId: payload.userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: payload.questionKey,
      metadataJson: {
        ...payload,
        adminActorUserId: authResult.auth.user.id,
      },
    });

    return ok("Admin screening answer saved", { answer: payload });
  } catch (error) {
    return handleApiError(error, "Failed to save admin screening answer");
  }
}

