import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { consumeHiresForApplies } from "src/lib/hires";

type IncomingEntry = {
  ts: string;
  outcomeType: string;
  data?: Record<string, unknown>;
};

function parseLinkedInJobId(input: unknown) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const m = raw.match(/\/jobs\/view\/(\d+)/i);
  if (m?.[1]) return String(m[1]);
  const q1 = raw.match(/[?&]currentJobId=(\d+)/i);
  if (q1?.[1]) return String(q1[1]);
  const q2 = raw.match(/[?&]jobId=(\d+)/i);
  if (q2?.[1]) return String(q2[1]);
  return "";
}

function normalizeOutcome(value: unknown) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "APPLIED" || v === "FAILED" || v === "SKIPPED" || v === "EXTERNAL") return v;
  return "SKIPPED";
}

function toJobStatus(outcomeType: string) {
  if (outcomeType === "APPLIED") return "succeeded";
  if (outcomeType === "FAILED") return "failed";
  return "cancelled";
}

function toAppStatus(outcomeType: string) {
  if (outcomeType === "APPLIED") return "submitted";
  if (outcomeType === "FAILED") return "failed";
  return "skipped";
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const body = await req.json().catch(() => null);
    const entriesRaw = Array.isArray(body?.entries) ? body.entries : [];
    const entries: IncomingEntry[] = entriesRaw
      .map((e: any) => ({
        ts: String(e?.ts || ""),
        outcomeType: normalizeOutcome(e?.outcomeType),
        data: e?.data && typeof e.data === "object" ? (e.data as Record<string, unknown>) : {},
      }))
      .filter((e) => Boolean(e.ts));

    if (!entries.length) return fail("No entries to import", 400, "NO_ENTRIES");

    const userId = authResult.auth.user.id;

    const results = [];
    for (const entry of entries.slice(0, 200)) {
      const data = entry.data || {};
      const jobUrlId = parseLinkedInJobId(data.jobUrl);
      const pageUrlId = parseLinkedInJobId(data.pageUrl);
      // Prefer the canonical /jobs/view/<id> value when available; card "jobId" can be an internal id in some views.
      const jobId = jobUrlId || pageUrlId || String(data.jobId || "").trim();
      if (!jobId) continue;

      const idempotencyKey = `ext:li:${jobId}`;
      const jobUrl = String(data.jobUrl || "").trim();
      const pageUrl = String(data.pageUrl || "").trim();
      const title = String(data.title || "").trim();
      const company = String(data.company || "").trim();
      const workLocation = String(data.workLocation || "").trim();
      const reasonCode = String(data.reasonCode || "").trim();

      const status = toJobStatus(entry.outcomeType);
      const criteriaJson = {
        source: "linkedin_extension",
        jobId,
        jobUrl,
        pageUrl,
        title,
        company,
        workLocation,
        reasonCode,
      };

      // Upsert a synthetic "job" so existing dashboard pages can reuse /api/auto-apply/jobs.
      const job = await prisma.autoApplyJob.upsert({
        where: { idempotencyKey },
        create: {
          userId,
          idempotencyKey,
          criteriaJson,
          status,
          scheduledAt: new Date(entry.ts),
          startedAt: new Date(entry.ts),
          finishedAt: entry.outcomeType === "APPLIED" || entry.outcomeType === "FAILED" ? new Date(entry.ts) : null,
          errorMessage: entry.outcomeType === "FAILED" ? String(data.reason || "Extension reported failure") : null,
        },
        update: {
          status,
          criteriaJson,
          finishedAt: entry.outcomeType === "APPLIED" || entry.outcomeType === "FAILED" ? new Date(entry.ts) : null,
          errorMessage: entry.outcomeType === "FAILED" ? String(data.reason || "Extension reported failure") : null,
        },
      });

      // Idempotent application: one record per imported job.
      const appStatus = toAppStatus(entry.outcomeType);
      const existingApp = await prisma.application.findFirst({
        where: { userId, jobId: job.id },
        orderBy: { createdAt: "desc" },
      });
      const prevStatus = existingApp?.status ? String(existingApp.status) : "";
      const shouldCharge = entry.outcomeType === "APPLIED" && (!existingApp || prevStatus !== "submitted");
      if (!existingApp) {
        await prisma.application.create({
          data: {
            userId,
            jobId: job.id,
            externalJobId: jobId,
            company: company || null,
            title: title || null,
            status: appStatus as any,
            submittedAt: new Date(entry.ts),
            metadataJson: {
              source: "linkedin_extension",
              reasonCode,
              jobUrl,
              pageUrl,
              workLocation,
              importedAt: new Date().toISOString(),
              historyTs: entry.ts,
            },
          },
        });
      } else {
        await prisma.application.update({
          where: { id: existingApp.id },
          data: {
            status: appStatus as any,
            submittedAt: new Date(entry.ts),
            metadataJson: {
              ...(typeof existingApp.metadataJson === "object" && existingApp.metadataJson ? (existingApp.metadataJson as any) : {}),
              source: "linkedin_extension",
              reasonCode,
              jobUrl,
              pageUrl,
              workLocation,
              importedAt: new Date().toISOString(),
              historyTs: entry.ts,
            },
          },
        });
      }

      // Charge Hires only once per successful submit.
      if (shouldCharge) {
        await consumeHiresForApplies({
          userId,
          count: 1,
          referenceType: "extension_apply",
          referenceId: String(job.id),
          idempotencyPrefix: `ext_apply:${jobId}:${entry.ts}`,
          metadataJson: {
            source: "linkedin_extension",
            externalJobId: jobId,
            jobUrl,
            pageUrl,
            title,
            company,
          },
        }).catch(() => {
          // Don't fail import if billing fails; UI will still show the job.
        });
      }

      await prisma.autoApplyJobLog.create({
        data: {
          jobId: job.id,
          level: entry.outcomeType === "FAILED" ? "error" : entry.outcomeType === "SKIPPED" ? "warn" : "info",
          step: "import",
          message: `Imported from extension (${entry.outcomeType}${reasonCode ? `:${reasonCode}` : ""})`,
          metadataJson: criteriaJson,
        },
      });

      results.push({ jobId: job.id, externalJobId: jobId, outcomeType: entry.outcomeType });
    }

    return ok("Imported extension pipeline events", { imported: results.length, results });
  } catch (error) {
    return handleApiError(error, "Failed to import extension events");
  }
}
