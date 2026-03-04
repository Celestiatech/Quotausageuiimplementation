import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

    const [totals, txnsByType, topBalances, topSpent, usersTotal] = await Promise.all([
      prisma.user.aggregate({
        _sum: {
          hireBalance: true,
          hireSpent: true,
          hirePurchased: true,
        },
      }),
      prisma.hireTransaction.groupBy({
        by: ["type"],
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.user.findMany({
        where: { role: "user" },
        orderBy: { hireBalance: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          hireBalance: true,
          hireSpent: true,
          hirePurchased: true,
        },
      }),
      prisma.user.findMany({
        where: { role: "user" },
        orderBy: { hireSpent: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          hireBalance: true,
          hireSpent: true,
          hirePurchased: true,
        },
      }),
      prisma.user.count({ where: { role: "user" } }),
    ]);

    const estimatedRevenueInr = Math.max(0, totals._sum.hirePurchased || 0);

    return ok("Wallet metrics fetched", {
      totals: {
        hireBalance: totals._sum.hireBalance || 0,
        hireSpent: totals._sum.hireSpent || 0,
        hirePurchased: totals._sum.hirePurchased || 0,
      },
      txnsByType,
      estimatedRevenueInr,
      topBalances,
      topSpent,
      pagination: {
        page,
        limit,
        total: usersTotal,
        totalPages: Math.ceil(usersTotal / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch wallet metrics");
  }
}
