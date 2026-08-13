import { NextRequest, NextResponse } from "next/server";
import { requireExtAuth } from "src/lib/v1";
import { getInterviewUsageSummary } from "src/lib/hires";
import { fail } from "src/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireExtAuth();
  if ("error" in auth) return auth.error;

  let body: { sessionId?: unknown; transcriptId?: unknown; elapsedSeconds?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400, "VALIDATION_ERROR");
  }

  const sessionId = String(body.sessionId || "").slice(0, 200);
  const transcriptId = String(body.transcriptId || "").slice(0, 200);
  const elapsedSeconds = Math.max(0, Math.floor(Number(body.elapsedSeconds) || 0));

  const summary = await getInterviewUsageSummary(auth.auth.user.id);

  return NextResponse.json({
    success: true,
    message: "Heartbeat",
    sessionId,
    transcriptId,
    elapsedSeconds,
    minutesLeft: summary.spendable,
  });
}
