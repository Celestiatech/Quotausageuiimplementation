import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok } from "src/lib/api";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const [users, activeSubscriptions, jobsTotal, jobsSucceeded, jobsFailed, otpSentFailures, hiresAgg] =
    await Promise.all([
      prisma.user.count({ where: { role: "user" } }),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.autoApplyJob.count(),
      prisma.autoApplyJob.count({ where: { status: "succeeded" } }),
      prisma.autoApplyJob.count({ where: { status: { in: ["failed", "dead_letter"] } } }),
      prisma.emailLog.count({ where: { status: "failed", template: "otp_verification" } }),
      prisma.user.aggregate({
        _sum: {
          hireBalance: true,
          hireSpent: true,
          hirePurchased: true,
        },
      }),
    ]);

  const successRate = jobsTotal === 0 ? 0 : Math.round((jobsSucceeded / jobsTotal) * 100);

  return ok("Metrics fetched", {
    users,
    activeSubscriptions,
    jobsTotal,
    jobsSucceeded,
    jobsFailed,
    successRatePercent: successRate,
    otpSendFailures: otpSentFailures,
    hires: {
      totalBalance: hiresAgg._sum.hireBalance || 0,
      totalSpent: hiresAgg._sum.hireSpent || 0,
      totalPurchased: hiresAgg._sum.hirePurchased || 0,
    },
  });
}
