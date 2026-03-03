import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError } from "src/lib/api";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const [failedEmails, failedJobs, recentAudit] = await Promise.all([
      prisma.emailLog.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.autoApplyJob.findMany({
        where: { status: { in: ["failed", "dead_letter"] } },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return ok("Support incidents fetched", {
      incidents: {
        failedEmails,
        failedJobs,
      },
      auditLogs: recentAudit,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch support incidents");
  }
}

