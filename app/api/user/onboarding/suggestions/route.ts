import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { cacheGetOrSet } from "src/lib/cache";

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
        onboardingCompleted: true,
      },
    });
    if (!user) return fail("User not found", 404, "USER_NOT_FOUND");

    const resumeData = await cacheGetOrSet(`user:resume-parsed:${userId}`, 300, async () => {
      const resume = await prisma.userResume.findUnique({
        where: { userId },
        select: { parsedData: true },
      });
      return resume?.parsedData || null;
    });

    const parsed = resumeData && typeof resumeData === "object" ? (resumeData as Record<string, unknown>) : null;

    const suggestedProfile = {
      name: user.name || parsed?.name || "",
      email: user.email || parsed?.email || "",
      phone: user.phone || parsed?.phone || "",
      currentCity: user.currentCity || parsed?.city || "",
      linkedinUrl: user.linkedinUrl || parsed?.linkedinUrl || "",
      portfolioUrl: user.portfolioUrl || parsed?.portfolioUrl || "",
    };

    const suggestedPreferences = {
      yearsOfExperience: parsed?.yearsOfExperience || "",
      skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
      jobTitles: Array.isArray(parsed?.jobTitles) ? parsed.jobTitles : [],
      educationLevel: parsed?.educationLevel || "",
      workAuthorization: parsed?.workAuthorization || "",
    };

    return ok("Onboarding suggestions fetched", {
      user,
      resumeParsed: !!parsed,
      suggestedProfile,
      suggestedPreferences,
      steps: [
        { key: "profile", label: "Profile", completed: Boolean(user.name && user.email) },
        { key: "resume", label: "Resume", completed: Boolean(user.resumeFileName) },
        { key: "preferences", label: "Preferences", completed: Boolean(parsed?.yearsOfExperience) },
        { key: "screening", label: "Screening Answers", completed: false },
      ],
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch onboarding suggestions");
  }
}
