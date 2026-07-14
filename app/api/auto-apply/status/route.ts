import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";

const POLL_INTERVAL_MS = 5000;

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const userId = authResult.auth.user.id;
  const jobId = req.nextUrl.searchParams.get("jobId");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let pollCount = 0;
      const maxPolls = 120;

      function send(event, data) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      }

      async function poll() {
        if (closed || pollCount >= maxPolls) {
          send("done", { message: "Stream ended" });
          try { controller.close(); } catch {}
          return;
        }
        pollCount++;
        try {
          const where = jobId
            ? { id: jobId, userId }
            : { userId };

          const jobs = await prisma.autoApplyJob.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: jobId ? 1 : 5,
            include: {
              logs: { orderBy: { createdAt: "desc" }, take: 3 },
              applications: { orderBy: { submittedAt: "desc" }, take: 10 },
            },
          });

          const applications = await prisma.application.findMany({
            where: { userId },
            orderBy: { submittedAt: "desc" },
            take: 20,
          });

          send("status", {
            timestamp: new Date().toISOString(),
            jobs: jobs.map((j) => ({
              id: j.id,
              status: j.status,
              createdAt: j.createdAt.toISOString(),
              attempts: j.attempts,
              latestLogs: j.logs.map((l) => ({
                level: l.level,
                step: l.step,
                message: l.message,
                createdAt: l.createdAt.toISOString(),
              })),
            })),
            recentApplications: applications.map((a) => ({
              id: a.id,
              company: a.company,
              title: a.title,
              status: a.status,
              submittedAt: a.submittedAt?.toISOString() || null,
            })),
          });
        } catch (err) {
          send("error", { message: err?.message || "Poll failed" });
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      }

      send("connected", { message: "Connected to live status stream" });
      poll();

      req.signal.addEventListener("abort", () => {
        closed = true;
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
