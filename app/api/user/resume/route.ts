import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const userId = authResult.auth.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        currentCity: true,
        addressLine: true,
        linkedinUrl: true,
        portfolioUrl: true,
        resumeFileName: true,
      },
    });
    if (!user) return fail("User not found", 404, "USER_NOT_FOUND");

    const resume = await prisma.userResume.findUnique({
      where: { userId },
      select: { parsedData: true },
    });

    const parsedData = (resume?.parsedData as Record<string, unknown>) || null;

    return ok("Resume data fetched", {
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        currentCity: user.currentCity || "",
        addressLine: user.addressLine || "",
        linkedinUrl: user.linkedinUrl || "",
        portfolioUrl: user.portfolioUrl || "",
        resumeFileName: user.resumeFileName || "",
      },
      parsed: parsedData,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch resume data");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const userId = authResult.auth.user.id;
    const body = await req.json();

    const { headline, summary, skills, experience, projects, education, certifications } = body as {
      headline?: string;
      summary?: string;
      skills?: string[];
      experience?: Array<{
        title: string;
        company: string;
        location?: string;
        startDate: string;
        endDate?: string;
        description?: string[];
      }>;
      projects?: Array<{
        name: string;
        description?: string;
        technologies?: string[];
        link?: string;
      }>;
      education?: Array<{
        degree: string;
        field?: string;
        institution: string;
        location?: string;
        startDate?: string;
        endDate?: string;
      }>;
      certifications?: Array<{
        name: string;
        issuer?: string;
        date?: string;
      }>;
    };

    const existing = await prisma.userResume.findUnique({
      where: { userId },
      select: { parsedData: true },
    });

    const currentParsed = (existing?.parsedData as Record<string, unknown>) || {};

    const updatedParsed = {
      ...currentParsed,
      ...(headline !== undefined && { headline }),
      ...(summary !== undefined && { summary }),
      ...(skills !== undefined && { skills }),
      ...(experience !== undefined && { experience }),
      ...(projects !== undefined && { projects }),
      ...(education !== undefined && { education }),
      ...(certifications !== undefined && { certifications }),
    };

    await prisma.userResume.upsert({
      where: { userId },
      update: { parsedData: updatedParsed },
      create: { userId, parsedData: updatedParsed },
    });

    return ok("Resume data saved", { parsed: updatedParsed });
  } catch (error) {
    return handleApiError(error, "Failed to save resume data");
  }
}
