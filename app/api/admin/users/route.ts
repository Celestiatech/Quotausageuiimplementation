import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, parsePagination } from "src/lib/api";

export async function GET(req: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        plan: true,
        quotaUsed: true,
        quotaTotal: true,
        quotaResetTime: true,
        hireBalance: true,
        hireSpent: true,
        hirePurchased: true,
        dailyHireUsed: true,
        dailyHireCap: true,
        dailyHireResetTime: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok("Users fetched", {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
