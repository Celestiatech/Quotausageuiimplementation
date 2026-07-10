import { NextRequest } from "next/server";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { generateAtsResume } from "src/lib/resume-ats-generator";
import { writeAuditLog } from "src/lib/audit";
import { prisma } from "src/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const body = await req.json();
    const { extracted } = body as { extracted: Record<string, unknown> };

    if (!extracted || Object.keys(extracted).length === 0) {
      return fail("No resume data provided", 400, "DATA_REQUIRED");
    }

    const html = await generateAtsResume(extracted);

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "user.resume_ats_generated",
      targetType: "resume",
      metadataJson: {
        fields: Object.keys(extracted),
      },
    });

    await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: {
        resumeFileName: "ATS_Resume.html",
        resumeText: html.slice(0, 100000),
      },
    });

    return ok("ATS resume generated", { html, fileName: "ATS_Resume.html" });
  } catch (error) {
    return handleApiError(error, "Failed to generate ATS resume");
  }
}
