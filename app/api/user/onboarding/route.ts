import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { onboardingSchema } from "src/lib/schemas";
import { toClientUser } from "src/lib/auth";
import { writeAuditLog } from "src/lib/audit";
import { hasCompletedRequiredOnboarding } from "src/lib/onboarding";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const user = await prisma.user.findUnique({ where: { id: authResult.auth.user.id } });
  if (!user) return fail("User not found", 404, "USER_NOT_FOUND");
  return ok("Onboarding profile fetched", { user: toClientUser(user) });
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const payload = onboardingSchema.parse(await req.json());
    const userId = authResult.auth.user.id;
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return fail("User not found", 404, "USER_NOT_FOUND");

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: payload.name,
        phone: payload.phone,
        currentCity: payload.currentCity,
        addressLine: payload.addressLine,
        linkedinUrl: payload.linkedinUrl,
        portfolioUrl: payload.portfolioUrl,
      },
    });
    const completed = hasCompletedRequiredOnboarding(user);
    const finalizedUser = completed
      ? await prisma.user.update({
          where: { id: user.id },
          data: { onboardingCompleted: true },
        })
      : user;

    await writeAuditLog({
      actorUserId: userId,
      action: "user.onboarding_completed",
      targetType: "user",
      targetId: userId,
    });

    return ok("Onboarding completed", { user: toClientUser(finalizedUser) });
  } catch (error) {
    return handleApiError(error, "Failed to save onboarding details");
  }
}
