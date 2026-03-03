import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { ok } from "src/lib/api";
import { verifyMailConnection } from "src/lib/mail";
import { queueHealth } from "src/lib/queue";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  let dbHealthy = true;
  let dbMessage = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbHealthy = false;
    dbMessage = error instanceof Error ? error.message : "db health failed";
  }

  let mailHealthy = true;
  let mailMessage = "ok";
  try {
    await verifyMailConnection();
  } catch (error) {
    mailHealthy = false;
    mailMessage = error instanceof Error ? error.message : "mail health failed";
  }

  const queue = await queueHealth();
  return ok("System health", {
    db: { healthy: dbHealthy, message: dbMessage },
    mail: { healthy: mailHealthy, message: mailMessage },
    queue,
    timestamp: new Date().toISOString(),
  });
}
