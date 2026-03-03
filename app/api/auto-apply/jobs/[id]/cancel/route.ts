import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { cancelJobSchema } from "src/lib/schemas";
import { fail, handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { writeAuditLog } from "src/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { id } = await params;
    const payload = cancelJobSchema.parse(await req.json().catch(() => ({})));
    const job = await prisma.autoApplyJob.findUnique({ where: { id } });
    if (!job || job.userId !== authResult.auth.user.id) {
      return fail("Job not found", 404, "JOB_NOT_FOUND");
    }
    if (job.status === "running") {
      return fail("Cannot cancel a running job", 409, "JOB_ALREADY_RUNNING");
    }
    if (job.status === "succeeded" || job.status === "failed" || job.status === "dead_letter") {
      return fail("Job is already completed", 409, "JOB_ALREADY_COMPLETED");
    }

    const updated = await prisma.autoApplyJob.update({
      where: { id: job.id },
      data: {
        status: "cancelled",
        finishedAt: new Date(),
        errorMessage: payload.reason || "Cancelled by user",
      },
    });

    await prisma.autoApplyJobLog.create({
      data: {
        jobId: job.id,
        level: "warn",
        step: "cancel",
        message: payload.reason || "Cancelled by user",
      },
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "auto_apply.job_cancelled",
      targetType: "auto_apply_job",
      targetId: job.id,
      metadataJson: payload.reason ? { reason: payload.reason } : undefined,
    });

    return ok("Job cancelled", { job: updated });
  } catch (error) {
    return handleApiError(error, "Failed to cancel job");
  }
}
