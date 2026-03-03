import { requireAuth } from "src/lib/guards";
import { ok } from "src/lib/api";

export async function POST() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  // Razorpay doesn't provide a generic hosted customer portal like Stripe.
  // Return support/management hint for frontend.
  return ok("Portal link generated", {
    provider: "razorpay",
    redirectUrl: process.env.BILLING_PORTAL_URL || "mailto:billing@careerpilot.com",
  });
}
