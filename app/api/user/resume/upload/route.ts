import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { parseResumeFile } from "src/lib/resume-parser";
import { writeAuditLog } from "src/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const formData = await req.formData();
    const file = formData.get("resume");
    if (!(file instanceof File)) {
      return fail("Resume file is required", 400, "FILE_REQUIRED");
    }

    const maxMb = Number(process.env.MAX_RESUME_FILE_MB || 5);
    if (file.size > maxMb * 1024 * 1024) {
      return fail(`Resume must be <= ${maxMb}MB`, 400, "FILE_TOO_LARGE");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseResumeFile(file.name, bytes);
    await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: {
        resumeFileName: file.name,
        // Resume bytes are not persisted on app servers.
        // Users should keep the source resume in LinkedIn Easy Apply profile.
        resumeFilePath: null,
        resumeText: parsed.text.slice(0, 100000),
      },
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "user.resume_uploaded",
      targetType: "resume",
      metadataJson: {
        fileName: file.name,
        size: file.size,
      },
    });

    return ok("Resume parsed and profile text saved", {
      fileName: file.name,
      extracted: parsed.extracted,
    });
  } catch (error) {
    return handleApiError(error, "Failed to upload resume");
  }
}
