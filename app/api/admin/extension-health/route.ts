import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { handleApiError, ok } from "src/lib/api";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      usersLast24h,
      usersLast7d,
      totalJobs,
      jobsRunning,
      jobsQueued,
      jobsSucceeded24h,
      jobsFailed24h,
      jobsSucceeded7d,
      jobsFailed7d,
      totalApplications,
      applications24h,
      applicationsFailed24h,
      recentErrors,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: last24h } } }),
      prisma.user.count({ where: { createdAt: { gte: last7d } } }),
      prisma.autoApplyJob.count(),
      prisma.autoApplyJob.count({ where: { status: "running" } }),
      prisma.autoApplyJob.count({ where: { status: "queued" } }),
      prisma.autoApplyJob.count({ where: { status: "succeeded", createdAt: { gte: last24h } } }),
      prisma.autoApplyJob.count({ where: { status: "failed", createdAt: { gte: last24h } } }),
      prisma.autoApplyJob.count({ where: { status: "succeeded", createdAt: { gte: last7d } } }),
      prisma.autoApplyJob.count({ where: { status: "failed", createdAt: { gte: last7d } } }),
      prisma.application.count(),
      prisma.application.count({ where: { submittedAt: { gte: last24h } } }),
      prisma.application.count({ where: { status: "failed", submittedAt: { gte: last24h } } }),
      prisma.autoApplyJobLog.findMany({
        where: {
          level: "error",
          createdAt: { gte: last24h },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { job: { select: { id: true, userId: true } } },
      }),
    ]);

    const successRate24h = jobsSucceeded24h + jobsFailed24h > 0
      ? Math.round((jobsSucceeded24h / (jobsSucceeded24h + jobsFailed24h)) * 100)
      : 100;
    const successRate7d = jobsSucceeded7d + jobsFailed7d > 0
      ? Math.round((jobsSucceeded7d / (jobsSucceeded7d + jobsFailed7d)) * 100)
      : 100;

    return ok("Extension health fetched", {
      users: {
        total: totalUsers,
        newLast24h: usersLast24h,
        newLast7d: usersLast7d,
      },
      jobs: {
        total: totalJobs,
        running: jobsRunning,
        queued: jobsQueued,
        succeeded24h: jobsSucceeded24h,
        failed24h: jobsFailed24h,
        successRate24h,
        successRate7d,
      },
      applications: {
        total: totalApplications,
        submitted24h: applications24h,
        failed24h: applicationsFailed24h,
      },
      recentErrors: recentErrors.map((e) => ({
        jobId: e.jobId,
        userId: e.job?.userId,
        step: e.step,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch extension health");
  }
}
