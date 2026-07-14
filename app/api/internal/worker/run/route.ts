import { NextRequest } from "next/server";
import { popQueuedJob } from "src/lib/queue";
import { processAutoApplyJob } from "src/lib/worker";
import { fail, handleApiError, ok } from "src/lib/api";
import { logInfo, logError } from "src/lib/log";

function isAuthorized(req: NextRequest) {
  const secret = process.env.WORKER_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-worker-secret");
  return header === secret;
}

const MAX_BATCH = 5;

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return fail("Unauthorized worker call", 401, "UNAUTHORIZED");

    let processed = 0;
    let failed = 0;
    const results: Array<{ jobId: string; status: "ok" | "error"; error?: string }> = [];

    for (let i = 0; i < MAX_BATCH; i++) {
      const payload = await popQueuedJob();
      if (!payload) break;

      try {
        await processAutoApplyJob(payload.jobId);
        processed++;
        results.push({ jobId: payload.jobId, status: "ok" });
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ jobId: payload.jobId, status: "error", error: msg });
        logError(`Worker batch job failed: ${payload.jobId}`, "worker", err);
      }
    }

    logInfo(`Worker batch: ${processed} processed, ${failed} failed`, "worker");
    return ok("Worker batch complete", { processed, failed, results });
  } catch (error) {
    return handleApiError(error, "Worker processing failed");
  }
}
