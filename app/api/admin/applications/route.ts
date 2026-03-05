import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";

const REASON_LABELS: Record<string, string> = {
  NO_APPLY_BUTTON: "No Easy Apply button",
  APPLIED_CACHE_HIT: "Already applied earlier",
  ALREADY_APPLIED: "Already applied on LinkedIn",
  RECENTLY_RETRIED: "Recently retried",
  EASY_APPLY_MODAL_MISSING: "Easy Apply modal not found",
  MODAL_NOT_FOUND: "Easy Apply modal not found",
  EXTERNAL_APPLY_ONLY: "External apply only",
  PENDING_USER_INPUT: "Pending user input",
  SUBMIT_NOT_REACHED: "Submit step not reached",
  MODAL_FLOW_ERROR: "Modal flow error",
  DAILY_EASY_APPLY_LIMIT: "LinkedIn daily Easy Apply limit",
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function formatReasonCode(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (REASON_LABELS[upper]) return REASON_LABELS[upper];
  return raw
    .toLowerCase()
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [applications, summary, total] = await Promise.all([
      prisma.application.findMany({
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, plan: true },
          },
          job: {
            select: { id: true, status: true, createdAt: true, criteriaJson: true, errorMessage: true },
          },
        },
      }),
      prisma.application.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.application.count(),
    ]);

    const counts = {
      submitted: 0,
      skipped: 0,
      failed: 0,
      total,
    };

    for (const row of summary) {
      if (row.status === "submitted") counts.submitted = row._count._all;
      if (row.status === "skipped") counts.skipped = row._count._all;
      if (row.status === "failed") counts.failed = row._count._all;
    }

    const normalizedApplications = applications.map((row) => {
      const metadata = asObject(row.metadataJson);
      const jobCriteria = asObject(row.job?.criteriaJson);
      const reasonCodeRaw = String(
        metadata?.reasonCode || jobCriteria?.reasonCode || "",
      ).trim();
      const reasonCode = reasonCodeRaw ? reasonCodeRaw.toUpperCase() : "";
      const reasonRaw = String(
        metadata?.reason || jobCriteria?.reason || row.job?.errorMessage || "",
      ).trim();
      const reason = reasonRaw || (reasonCode ? formatReasonCode(reasonCode) : "");
      return {
        ...row,
        reasonCode: reasonCode || null,
        reason: reason || null,
        jobUrl: String(metadata?.jobUrl || jobCriteria?.jobUrl || "").trim() || null,
      };
    });

    return ok("Applications fetched", {
      applications: normalizedApplications,
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch applications");
  }
}
