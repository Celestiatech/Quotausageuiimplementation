import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleApiError, ok } from "src/lib/api";
import { requireAdmin } from "src/lib/guards";
import { adjustHiresByAdmin } from "src/lib/hires";

const adjustSchema = z.object({
  userId: z.string().min(1),
  delta: z.number().int().refine((v) => v !== 0, "delta must be non-zero"),
  note: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const body = adjustSchema.parse(await req.json());
    const actorId = authResult.auth.user.id;
    const referenceId = `${actorId}:${Date.now()}`;

    const txn = await adjustHiresByAdmin({
      userId: body.userId,
      delta: body.delta,
      referenceId,
      metadataJson: {
        actorUserId: actorId,
        note: body.note || "",
      },
    });

    return ok("Wallet adjusted", { transaction: txn });
  } catch (error) {
    if (error instanceof Error && /insufficient hires/i.test(error.message)) {
      return fail(error.message, 400, "INSUFFICIENT_HIRES");
    }
    return handleApiError(error, "Failed to adjust wallet");
  }
}
