import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { parseResumeFile } from "src/lib/resume-parser";
import { writeAuditLog } from "src/lib/audit";

function safeFileName(original: string) {
  const base = original.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${Date.now()}_${base}`;
}

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
    const fileName = safeFileName(file.name);
    const relativePath = path.join("uploads", "resumes", fileName);
    const fullPath = path.join(process.cwd(), "public", relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);

    await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: {
        resumeFileName: file.name,
        resumeFilePath: `/${relativePath.replace(/\\/g, "/")}`,
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

    return ok("Resume uploaded and parsed", {
      fileName: file.name,
      extracted: parsed.extracted,
    });
  } catch (error) {
    return handleApiError(error, "Failed to upload resume");
  }
}
