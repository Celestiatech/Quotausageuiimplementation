import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { toClientUser } from "src/lib/auth";
import { updateProfileSchema } from "src/lib/schemas";
import { writeAuditLog } from "src/lib/audit";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const user = await prisma.user.findUnique({ where: { id: authResult.auth.user.id } });
  if (!user) return fail("User not found", 404, "USER_NOT_FOUND");
  return ok("Profile fetched", { user: toClientUser(user) });
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = updateProfileSchema.parse(await req.json());
    const user = await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.avatar !== undefined ? { avatar: payload.avatar } : {}),
      },
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: "user.profile_update",
      targetType: "user",
      targetId: user.id,
    });
    return ok("Profile updated", { user: toClientUser(user) });
  } catch (error) {
    return handleApiError(error, "Failed to update profile");
  }
}
