import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { DiscountValidationError, evaluateDiscountForOrder } from "src/lib/discounts";
import { hiresFromRupees, MIN_TOPUP_RUPEES } from "src/lib/hires";

const previewSchema = z.object({
  rupees: z.number().int().min(MIN_TOPUP_RUPEES).max(200000),
  discountCode: z.string().trim().min(3).max(32),
});

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot preview top-up discounts", 400, "INVALID_ACTOR");
    }

    const body = previewSchema.parse(await req.json());
    const applied = await evaluateDiscountForOrder({
      codeInput: body.discountCode,
      userId: authResult.auth.user.id,
      context: "wallet_topup",
      baseRupees: body.rupees,
    });
    if (!applied) {
      return fail("Discount code is required", 400, "DISCOUNT_REQUIRED");
    }

    return ok("Discount applied", {
      code: applied.code,
      description: applied.description,
      type: applied.type,
      percentOff: applied.percentOff,
      flatAmountRupees: applied.flatAmountRupees,
      baseRupees: applied.baseRupees,
      discountRupees: applied.discountRupees,
      finalRupees: applied.finalRupees,
      hires: hiresFromRupees(applied.baseRupees),
      minTopupRupees: MIN_TOPUP_RUPEES,
    });
  } catch (error) {
    if (error instanceof DiscountValidationError) {
      return fail(error.message, error.status, error.errorCode);
    }
    return handleApiError(error, "Failed to preview discount");
  }
}
