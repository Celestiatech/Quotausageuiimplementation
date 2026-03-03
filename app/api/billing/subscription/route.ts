import { prisma } from "src/lib/prisma";
import { requireAuth } from "src/lib/guards";
import { ok } from "src/lib/api";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;
  const subscription = await prisma.subscription.findUnique({
    where: { userId: authResult.auth.user.id },
  });
  return ok("Subscription fetched", { subscription });
}
