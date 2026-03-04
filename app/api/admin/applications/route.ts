import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [applications, summary, total] = await Promise.all([
      prisma.application.findMany({
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, plan: true },
          },
          job: {
            select: { id: true, status: true, createdAt: true },
          },
        },
      }),
      prisma.application.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.application.count(),
    ]);

    const counts = {
      submitted: 0,
      skipped: 0,
      failed: 0,
      total,
    };

    for (const row of summary) {
      if (row.status === "submitted") counts.submitted = row._count._all;
      if (row.status === "skipped") counts.skipped = row._count._all;
      if (row.status === "failed") counts.failed = row._count._all;
    }

    return ok("Applications fetched", {
      applications,
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch applications");
  }
}

