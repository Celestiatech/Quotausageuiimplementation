import { ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { getWalletSummary } from "src/lib/hires";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const summary = await getWalletSummary(authResult.auth.user.id);
  return ok("Hires wallet fetched", {
    quotaUsed: summary.user.dailyHireUsed,
    quotaTotal: summary.user.dailyHireCap,
    quotaResetTime: summary.user.dailyHireResetTime.toISOString(),
    plan: summary.user.plan,
    hireBalance: summary.user.hireBalance,
    freeRemaining: summary.freeRemaining,
    dailyRemaining: summary.dailyRemaining,
    spendable: summary.spendable,
  });
}
