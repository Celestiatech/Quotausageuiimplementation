import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { parseResumeFile } from "src/lib/resume-parser";
import { parseResumeWithAi } from "src/lib/resume-ai-parser";
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

    let aiParsed = null;
    try {
      aiParsed = await parseResumeWithAi(parsed.text);
    } catch {
      // AI parsing is non-critical; fall back to regex extraction
    }

    const mergedExtracted = {
      ...parsed.extracted,
      ...(aiParsed ? {
        city: aiParsed.city || parsed.extracted.currentCity,
        state: aiParsed.state,
        country: aiParsed.country,
        name: aiParsed.name || parsed.extracted.name,
        email: aiParsed.email || parsed.extracted.email,
        phone: aiParsed.phone || parsed.extracted.phone,
        linkedinUrl: aiParsed.linkedinUrl || parsed.extracted.linkedinUrl,
        portfolioUrl: aiParsed.portfolioUrl || parsed.extracted.portfolioUrl,
        yearsOfExperience: aiParsed.yearsOfExperience,
        educationLevel: aiParsed.educationLevel,
        skills: aiParsed.skills,
        jobTitles: aiParsed.jobTitles,
        workAuthorization: aiParsed.workAuthorization,
        summary: aiParsed.summary,
        experience: aiParsed.experience,
        projects: aiParsed.projects,
        education: aiParsed.education,
        certifications: aiParsed.certifications,
      } : {}),
    };

    await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: {
        resumeFileName: file.name,
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
      extracted: mergedExtracted,
    });
  } catch (error) {
    return handleApiError(error, "Failed to upload resume");
  }
}
