import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";

const PLAN_PRICE_MONTHLY: Record<"free" | "pro" | "coach", number> = {
  free: 0,
  pro: 999,
  coach: 2999,
};

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [subsByStatus, usersByPlan, activeSubs, activeSubsTotal, hiresPurchased] = await Promise.all([
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["plan"],
        _count: { _all: true },
      }),
      prisma.subscription.findMany({
        where: { status: "active" },
        select: { id: true, plan: true, userId: true, currentPeriodEnd: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.hireTransaction.aggregate({
        where: { type: "credit_purchase", status: "posted" },
        _sum: { amount: true },
      }),
    ]);

    const statusCounts = {
      trialing: 0,
      active: 0,
      past_due: 0,
      cancelled: 0,
      expired: 0,
    };
    for (const row of subsByStatus) {
      statusCounts[row.status] = row._count._all;
    }

    const planCounts = {
      free: 0,
      pro: 0,
      coach: 0,
    };
    for (const row of usersByPlan) {
      planCounts[row.plan] = row._count._all;
    }

    const mrr = activeSubs.reduce((sum, sub) => sum + PLAN_PRICE_MONTHLY[sub.plan], 0);
    const arr = mrr * 12;
    const hireRevenue = Math.max(0, hiresPurchased._sum.amount || 0);

    return ok("Revenue data fetched", {
      statusCounts,
      planCounts,
      mrr,
      arr,
      currency: "INR",
      hiresRevenueInr: hireRevenue,
      activeSubscriptions: activeSubs,
      pagination: {
        page,
        limit,
        total: activeSubsTotal,
        totalPages: Math.ceil(activeSubsTotal / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch revenue data");
  }
}
