import { Prisma } from "@prisma/client";
import { decryptText } from "./security";
import { prisma } from "./prisma";
import { consumeHiresForApplies, getWalletSummary, refundHires } from "./hires";
import { runAutoApply } from "./auto-apply-adapter";

async function addJobLog(
  jobId: string,
  step: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
  metadataJson?: Prisma.InputJsonValue
) {
  await prisma.autoApplyJobLog.create({
    data: {
      jobId,
      step,
      message,
      level,
      metadataJson,
    },
  });
}

function isRetryable(errorMessage: string) {
  const retriableTokens = [
    "timeout",
    "network",
    "temporarily",
    "429",
    "5xx",
    "rate limit",
    "session not created",
    "chrome failed to start",
    "devtoolsactiveport",
    "cannot connect to chrome",
    "chrome not reachable",
  ];
  const lower = errorMessage.toLowerCase();
  return retriableTokens.some((token) => lower.includes(token));
}

export async function processAutoApplyJob(jobId: string) {
  const job = await prisma.autoApplyJob.findUnique({
    where: { id: jobId },
    include: { user: true },
  });
  if (!job) throw new Error("Job not found");
  if (job.status === "cancelled" || job.status === "succeeded" || job.status === "dead_letter") return;

  await prisma.autoApplyJob.update({
    where: { id: job.id },
    data: {
      status: "running",
      startedAt: new Date(),
      attempts: { increment: 1 },
      errorMessage: null,
    },
  });
  await addJobLog(job.id, "start", "Job execution started");

  let reservedCount = 0;
  try {
    const wallet = await getWalletSummary(job.userId);
    if (wallet.spendable < 1) {
      throw new Error("Insufficient Hires or daily limit reached");
    }

    const consent = await prisma.consentLog.findFirst({
      where: { userId: job.userId, consentType: "auto_apply_terms" },
      orderBy: { acceptedAt: "desc" },
    });
    if (!consent) {
      throw new Error("Missing required consent for auto-apply");
    }

    const secret = await prisma.userSecret.findUnique({
      where: {
        userId_provider: {
          userId: job.userId,
          provider: "linkedin",
        },
      },
    });
    if (!secret) {
      throw new Error("LinkedIn credentials are not configured");
    }
    const raw = JSON.parse(decryptText(secret.encryptedValue)) as { username: string; password: string };

    const rawMax = Number((job.criteriaJson as Record<string, unknown>)?.maxApplications || 3);
    const plannedMaxApplies = Number.isFinite(rawMax) && rawMax > 0 ? Math.min(Math.floor(rawMax), 25) : 3;
    const reserved = await consumeHiresForApplies({
      userId: job.userId,
      count: plannedMaxApplies,
      referenceType: "auto_apply_job_reserve",
      referenceId: job.id,
      idempotencyPrefix: `reserve:${job.id}:${job.attempts + 1}`,
      metadataJson: {
        plannedMaxApplies,
      },
    });
    if (!reserved.ok) {
      if (reserved.reason === "DAILY_CAP_REACHED") {
        throw new Error("Daily Hires cap reached");
      }
      throw new Error("Insufficient Hires balance");
    }
    reservedCount = plannedMaxApplies;

    await addJobLog(job.id, "adapter_call", "Invoking auto-apply adapter");
    const result = await runAutoApply({
      criteria: job.criteriaJson as Record<string, unknown>,
      profileSnapshot: job.profileSnapshot as Record<string, unknown> | undefined,
      credentials: raw,
    });

    if (result.status === "failed") {
      throw new Error(result.errorMessage || "Auto-apply failed");
    }

    const submittedCount = result.applications.filter((app) => app.status === "submitted").length;
    if (reservedCount > submittedCount) {
      const refundCount = reservedCount - submittedCount;
      await refundHires({
        userId: job.userId,
        count: refundCount,
        referenceType: "auto_apply_job_reconcile",
        referenceId: job.id,
        idempotencyKey: `refund:${job.id}:${job.attempts + 1}:${refundCount}`,
        metadataJson: {
          reservedCount,
          submittedCount,
        },
      });
      await addJobLog(job.id, "billing_reconcile", `Refunded ${refundCount} Hires (unused reservation)`);
    }

    for (const app of result.applications) {
      await prisma.application.create({
        data: {
          userId: job.userId,
          jobId: job.id,
          externalJobId: app.externalJobId,
          company: app.company,
          title: app.title,
          status: app.status,
          metadataJson: (app.metadata || null) as Prisma.InputJsonValue,
        },
      });
    }

    await prisma.autoApplyJob.update({
      where: { id: job.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
      },
    });
    await addJobLog(job.id, "complete", "Job completed successfully", "info", {
      applicationCount: result.applications.length,
    });
  } catch (error) {
    if (reservedCount > 0) {
      await refundHires({
        userId: job.userId,
        count: reservedCount,
        referenceType: "auto_apply_job_refund",
        referenceId: job.id,
        idempotencyKey: `refund:full:${job.id}:${job.attempts + 1}:${reservedCount}`,
        metadataJson: {
          reason: "job_failed",
        },
      }).catch(() => null);
    }
    const current = await prisma.autoApplyJob.findUnique({ where: { id: job.id } });
    const message = error instanceof Error ? error.message : "Unknown worker failure";
    const attempts = current?.attempts ?? job.attempts + 1;
    const maxAttempts = current?.maxAttempts ?? job.maxAttempts;
    const canRetry = attempts < maxAttempts && isRetryable(message);
    const status = canRetry ? "queued" : attempts >= maxAttempts ? "dead_letter" : "failed";
    await prisma.autoApplyJob.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt: canRetry ? null : new Date(),
        errorMessage: message,
      },
    });
    await addJobLog(job.id, "error", message, "error", { attempts, maxAttempts, canRetry });
  }
}
