import { ok, handleApiError, parsePagination } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { prisma } from "src/lib/prisma";

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    const userId = authResult.auth.user.id;

    const [hireTxns, subscription, total] = await Promise.all([
      prisma.hireTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.subscription.findUnique({ where: { userId } }),
      prisma.hireTransaction.count({ where: { userId } }),
    ]);

    const planTxns = [];
    if (subscription) {
      planTxns.push({
        id: `sub_${subscription.id}`,
        type: "subscription",
        status: subscription.status === "active" ? "posted" : subscription.status === "cancelled" ? "voided" : "posted",
        amount: subscription.plan === "pro" ? 99 : subscription.plan === "coach" ? 299 : 0,
        balanceAfter: 0,
        plan: subscription.plan,
        providerSubscriptionId: subscription.providerSubscriptionId,
        providerPlanId: subscription.providerPlanId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt,
      });
    }

    const allTxns = [...planTxns, ...hireTxns].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return ok("Transactions fetched", {
      transactions: allTxns,
      hireTransactions: hireTxns,
      subscription: subscription ? {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        providerSubscriptionId: subscription.providerSubscriptionId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt,
      } : null,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch transactions");
  }
}
