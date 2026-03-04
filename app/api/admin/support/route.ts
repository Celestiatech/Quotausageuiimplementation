import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [failedEmails, failedJobs, recentAudit, failedEmailsTotal, failedJobsTotal, auditLogsTotal] =
      await Promise.all([
      prisma.emailLog.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.autoApplyJob.findMany({
        where: { status: { in: ["failed", "dead_letter"] } },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.emailLog.count({ where: { status: "failed" } }),
      prisma.autoApplyJob.count({ where: { status: { in: ["failed", "dead_letter"] } } }),
      prisma.auditLog.count(),
    ]);

    return ok("Support incidents fetched", {
      incidents: {
        failedEmails,
        failedJobs,
      },
      auditLogs: recentAudit,
      pagination: {
        page,
        limit,
        totals: {
          failedEmails: failedEmailsTotal,
          failedJobs: failedJobsTotal,
          auditLogs: auditLogsTotal,
        },
        totalPages: {
          failedEmails: Math.ceil(failedEmailsTotal / limit),
          failedJobs: Math.ceil(failedJobsTotal / limit),
          auditLogs: Math.ceil(auditLogsTotal / limit),
        },
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch support incidents");
  }
}

