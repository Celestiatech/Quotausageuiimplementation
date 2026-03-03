import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok } from "src/lib/api";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const jobs = await prisma.autoApplyJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: {
        select: { id: true, email: true, name: true, plan: true },
      },
      logs: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  return ok("Jobs fetched", { jobs });
}
