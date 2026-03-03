import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError } from "src/lib/api";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const [applications, summary] = await Promise.all([
      prisma.application.findMany({
        orderBy: { submittedAt: "desc" },
        take: 200,
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
    ]);

    const counts = {
      submitted: 0,
      skipped: 0,
      failed: 0,
      total: applications.length,
    };

    for (const row of summary) {
      if (row.status === "submitted") counts.submitted = row._count._all;
      if (row.status === "skipped") counts.skipped = row._count._all;
      if (row.status === "failed") counts.failed = row._count._all;
    }

    return ok("Applications fetched", { applications, counts });
  } catch (error) {
    return handleApiError(error, "Failed to fetch applications");
  }
}

