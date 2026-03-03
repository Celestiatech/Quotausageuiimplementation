import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { createJobSchema } from "src/lib/schemas";
import { fail, handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { getWalletSummary } from "src/lib/hires";
import { enqueueJob, isQueueConfigured } from "src/lib/queue";
import { writeAuditLog } from "src/lib/audit";
import { processAutoApplyJob } from "src/lib/worker";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = createJobSchema.parse(await req.json());

    const userId = authResult.auth.user.id;
    if (process.env.NODE_ENV === "production" && !isQueueConfigured()) {
      return fail("Queue service is not configured", 503, "QUEUE_UNAVAILABLE");
    }

    const wallet = await getWalletSummary(userId);
    if (wallet.spendable < 1) {
      return fail("Insufficient Hires or daily limit reached", 429, "HIRES_EXHAUSTED");
    }

    const consent = await prisma.consentLog.findFirst({
      where: {
        userId,
        consentType: "auto_apply_terms",
      },
      orderBy: { acceptedAt: "desc" },
    });
    if (!consent) return fail("Consent required before auto-apply", 400, "CONSENT_REQUIRED");

    if (payload.idempotencyKey) {
      const existing = await prisma.autoApplyJob.findUnique({
        where: { idempotencyKey: payload.idempotencyKey },
      });
      if (existing && existing.userId === userId) {
        return ok("Job already exists", { job: existing });
      }
    }

    const job = await prisma.autoApplyJob.create({
      data: {
        userId,
        criteriaJson: payload.criteria,
        profileSnapshot: payload.profileSnapshot,
        idempotencyKey: payload.idempotencyKey,
        status: "queued",
      },
    });

    await prisma.autoApplyJobLog.create({
      data: {
        jobId: job.id,
        step: "enqueue",
        message: "Job queued",
      },
    });

    const enqueued = await enqueueJob({ jobId: job.id, userId });
    if (!enqueued) {
      // Fallback for local/dev when queue is not configured.
      processAutoApplyJob(job.id).catch((error) => {
        console.error("background fallback worker failed:", error);
      });
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "auto_apply.job_created",
      targetType: "auto_apply_job",
      targetId: job.id,
      metadataJson: {
        queuedWithRedis: enqueued,
        hiresSpendableAtEnqueue: wallet.spendable,
      },
    });

    return ok("Job queued", { job }, 201);
  } catch (error) {
    return handleApiError(error, "Failed to create auto-apply job");
  }
}

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const jobs = await prisma.autoApplyJob.findMany({
      where: { userId: authResult.auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
    return ok("Jobs fetched", { jobs });
  } catch (error) {
    return handleApiError(error, "Failed to fetch jobs");
  }
}
