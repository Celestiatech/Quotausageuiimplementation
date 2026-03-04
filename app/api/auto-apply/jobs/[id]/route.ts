import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok, parsePagination } from "src/lib/api";
import { requireAuth } from "src/lib/guards";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const { id } = await params;
    const [job, logsTotal, applicationsTotal] = await Promise.all([
      prisma.autoApplyJob.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: "asc" },
          skip,
          take: limit,
        },
        applications: {
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        },
      },
      }),
      prisma.autoApplyJobLog.count({ where: { jobId: id } }),
      prisma.application.count({ where: { jobId: id } }),
    ]);
    if (!job || job.userId !== authResult.auth.user.id) {
      return fail("Job not found", 404, "JOB_NOT_FOUND");
    }
    return ok("Job fetched", {
      job,
      pagination: {
        page,
        limit,
        logs: {
          total: logsTotal,
          totalPages: Math.ceil(logsTotal / limit),
        },
        applications: {
          total: applicationsTotal,
          totalPages: Math.ceil(applicationsTotal / limit),
        },
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch job");
  }
}
