import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireExtAuth } from "src/lib/v1";
import { buildResumeContext, loadUserContext } from "src/lib/resume-context";

export async function GET() {
  const auth = await requireExtAuth();
  if ("error" in auth) return auth.error;

  const userId = auth.auth.user.id;
  const { parsed, profile } = await loadUserContext(userId);
  const resumeContext = buildResumeContext(parsed, profile);
  const sessionId = randomUUID();

  return NextResponse.json({
    success: true,
    message: "Session context",
    resumeContext,
    sessionId,
  });
}
