import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, context: RouteParams) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  if (!id) return fail("User id is required", 400, "VALIDATION_ERROR");

  if (id === authResult.auth.user.id) {
    return fail("You cannot delete your own admin account", 400, "SELF_DELETE_FORBIDDEN");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });
  if (!user) return fail("User not found", 404, "USER_NOT_FOUND");

  await prisma.user.delete({ where: { id } });

  await writeAuditLog({
    actorUserId: authResult.auth.user.id,
    action: "admin.user_delete",
    targetType: "user",
    targetId: user.id,
    metadataJson: {
      email: user.email,
      role: user.role,
    },
  });

  return ok("User deleted");
}
