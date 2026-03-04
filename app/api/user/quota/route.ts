import { ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { getWalletSummary } from "src/lib/hires";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const summary = await getWalletSummary(authResult.auth.user.id);
  const quotaTotal = Math.max(1, Number(summary.user.dailyHireCap || 3));
  const quotaUsedRaw = Math.max(0, Number(summary.user.dailyHireUsed || 0));
  const quotaUsed = Math.min(quotaTotal, quotaUsedRaw);
  return ok("Hires wallet fetched", {
    quotaUsed,
    quotaUsedRaw,
    quotaTotal,
    quotaResetTime: summary.user.dailyHireResetTime.toISOString(),
    plan: summary.user.plan,
    hireBalance: summary.user.hireBalance,
    freeRemaining: summary.freeRemaining,
    dailyRemaining: summary.dailyRemaining,
    spendable: summary.spendable,
  });
}
