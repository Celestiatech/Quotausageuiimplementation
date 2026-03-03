import { ok, handleApiError } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { getWalletSummary } from "src/lib/hires";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const summary = await getWalletSummary(authResult.auth.user.id);
    return ok("Wallet fetched", {
      plan: summary.user.plan,
      hireBalance: summary.user.hireBalance,
      hireSpent: summary.user.hireSpent,
      hirePurchased: summary.user.hirePurchased,
      freeRemaining: summary.freeRemaining,
      dailyUsed: summary.user.dailyHireUsed,
      dailyCap: summary.user.dailyHireCap,
      dailyRemaining: summary.dailyRemaining,
      spendable: summary.spendable,
      dailyResetTime: summary.user.dailyHireResetTime.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch wallet");
  }
}
