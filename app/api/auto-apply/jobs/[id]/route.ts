import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { id } = await params;
    const job = await prisma.autoApplyJob.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: "asc" },
        },
        applications: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!job || job.userId !== authResult.auth.user.id) {
      return fail("Job not found", 404, "JOB_NOT_FOUND");
    }
    return ok("Job fetched", { job });
  } catch (error) {
    return handleApiError(error, "Failed to fetch job");
  }
}
