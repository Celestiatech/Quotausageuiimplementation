import { NextRequest } from "next/server";
import { popQueuedJob } from "src/lib/queue";
import { processAutoApplyJob } from "src/lib/worker";
import { fail, handleApiError, ok } from "src/lib/api";

function isAuthorized(req: NextRequest) {
  const secret = process.env.WORKER_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-worker-secret");
  return header === secret;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return fail("Unauthorized worker call", 401, "UNAUTHORIZED");
    const payload = await popQueuedJob();
    if (!payload) {
      return ok("No jobs in queue", { processed: 0 });
    }
    await processAutoApplyJob(payload.jobId);
    return ok("Processed one job", { processed: 1, jobId: payload.jobId });
  } catch (error) {
    return handleApiError(error, "Worker processing failed");
  }
}
