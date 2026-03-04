import { ok, handleApiError, parsePagination } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { prisma } from "src/lib/prisma";

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [transactions, total] = await Promise.all([
      prisma.hireTransaction.findMany({
        where: { userId: authResult.auth.user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.hireTransaction.count({
        where: { userId: authResult.auth.user.id },
      }),
    ]);

    return ok("Wallet transactions fetched", {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch wallet transactions");
  }
}
