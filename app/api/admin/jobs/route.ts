import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, parsePagination } from "src/lib/api";

export async function GET(req: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

  const [jobs, total] = await Promise.all([
    prisma.autoApplyJob.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, email: true, name: true, plan: true },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    }),
    prisma.autoApplyJob.count(),
  ]);

  return ok("Jobs fetched", {
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
