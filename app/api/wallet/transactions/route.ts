import { ok, handleApiError } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { prisma } from "src/lib/prisma";

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;

    const transactions = await prisma.hireTransaction.findMany({
      where: { userId: authResult.auth.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return ok("Wallet transactions fetched", { transactions });
  } catch (error) {
    return handleApiError(error, "Failed to fetch wallet transactions");
  }
}
