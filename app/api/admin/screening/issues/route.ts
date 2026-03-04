import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";
import { prisma } from "src/lib/prisma";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const url = new URL(req.url);
    const scanLimitRaw = Number(url.searchParams.get("scanLimit") || 2000);
    const scanLimit = Number.isFinite(scanLimitRaw)
      ? Math.max(500, Math.min(5000, Math.floor(scanLimitRaw)))
      : 2000;

    const logs = await prisma.auditLog.findMany({
      where: {
        action: { in: ["user.screening_issue_detected", "user.screening_answer_saved"] },
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: scanLimit,
    });

    const latestByUserAndKey = new Map<
      string,
      {
        userId: string;
        userName: string;
        userEmail: string;
        questionKey: string;
        questionLabel: string;
        validationMessage: string;
        status: "pending" | "resolved";
        updatedAt: string;
      }
    >();

    for (const log of logs) {
      const userId = log.actor?.id || "";
      if (!userId) continue;
      const meta = asObject(log.metadataJson);
      if (!meta) continue;
      const questionKey = String(meta.questionKey || "").trim();
      if (!questionKey) continue;
      const mapKey = `${userId}:${questionKey}`;
      if (latestByUserAndKey.has(mapKey)) continue;
      latestByUserAndKey.set(mapKey, {
        userId,
        userName: log.actor?.name || "Unknown",
        userEmail: log.actor?.email || "",
        questionKey,
        questionLabel: String(meta.questionLabel || "").trim() || questionKey,
        validationMessage: String(meta.validationMessage || "").trim(),
        status: log.action === "user.screening_issue_detected" ? "pending" : "resolved",
        updatedAt: log.createdAt.toISOString(),
      });
    }

    const all = Array.from(latestByUserAndKey.values());
    const pending = all.filter((r) => r.status === "pending");
    const resolved = all.filter((r) => r.status === "resolved");
    const pendingPage = pending.slice(skip, skip + limit);
    const resolvedPage = resolved.slice(skip, skip + limit);

    return ok("Admin screening issues fetched", {
      pending: pendingPage,
      resolved: resolvedPage,
      counts: {
        pending: pending.length,
        resolved: resolved.length,
      },
      pagination: {
        page,
        limit,
        totalPages: {
          pending: Math.ceil(pending.length / limit),
          resolved: Math.ceil(resolved.length / limit),
        },
      },
      scanLimit,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch admin screening issues");
  }
}

