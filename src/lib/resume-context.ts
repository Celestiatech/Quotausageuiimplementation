import { prisma } from "./prisma";

export function buildResumeContext(parsed: Record<string, unknown>, profile: Record<string, string>) {
  const lines: string[] = [];

  const headline = parsed.headline;
  if (typeof headline === "string" && headline.trim()) lines.push(`Headline: ${headline.trim()}`);
  const summary = parsed.summary;
  if (typeof summary === "string" && summary.trim()) lines.push(`Summary: ${summary.trim()}`);

  const skills = parsed.skills;
  if (Array.isArray(skills) && skills.length) {
    lines.push(`Skills: ${skills.map((s) => String(s)).join(", ")}`);
  }

  const experience = parsed.experience;
  if (Array.isArray(experience) && experience.length) {
    const brief = experience
      .slice(0, 6)
      .map((job: Record<string, unknown>) => {
        const title = String(job.title || "");
        const company = String(job.company || "");
        const years = String(job.startDate || "");
        return [title, company].filter(Boolean).join(" at ") + (years ? ` (${years})` : "");
      })
      .filter(Boolean)
      .join("; ");
    if (brief) lines.push(`Experience: ${brief}`);
  }

  const projects = parsed.projects;
  if (Array.isArray(projects) && projects.length) {
    const brief = projects
      .slice(0, 6)
      .map((p: Record<string, unknown>) => String(p.name || p.title || ""))
      .filter(Boolean)
      .join(", ");
    if (brief) lines.push(`Projects: ${brief}`);
  }

  const education = parsed.education;
  if (Array.isArray(education) && education.length) {
    const brief = education
      .slice(0, 3)
      .map((e: Record<string, unknown>) => {
        const degree = String(e.degree || "");
        const field = String(e.field || "");
        const school = String(e.institution || "");
        return [degree, field].filter(Boolean).join(" in ") + (school ? ` @ ${school}` : "");
      })
      .filter(Boolean)
      .join("; ");
    if (brief) lines.push(`Education: ${brief}`);
  }

  if (profile.currentCity) lines.push(`Location: ${profile.currentCity}`);
  if (profile.linkedinUrl) lines.push(`LinkedIn: ${profile.linkedinUrl}`);

  return lines.length ? lines.join("\n") : "";
}

export async function loadUserContext(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, currentCity: true, linkedinUrl: true },
    });
    const resume = await prisma.userResume.findUnique({
      where: { userId },
      select: { parsedData: true },
    });
    const parsed = (resume?.parsedData as Record<string, unknown>) || {};
    const profile = {
      name: user?.name || "",
      currentCity: user?.currentCity || "",
      linkedinUrl: user?.linkedinUrl || "",
    };
    return { parsed, profile };
  } catch (error) {
    console.error("[resume-context] resume context unavailable:", error);
    return { parsed: {}, profile: {} };
  }
}
