import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok } from "src/lib/api";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
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
  });

  return ok("Users fetched", { users });
}
