import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { dequeueNotification, markProcessed } from "src/lib/notifications";
import { logInfo, logError } from "src/lib/log";

const WORKER_SECRET = process.env.WORKER_SECRET || "";

async function sendEmail(to: string, subject: string, html: string) {
  const nodemailer = await import("nodemailer").catch(() => null);
  if (!nodemailer) return false;

  const transporter = nodemailer.default.createTransport({
    host: process.env.MAIL_HOST || process.env.SMTP_HOST,
    port: Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 587),
    secure: process.env.MAIL_ENCRYPTION === "ssl",
    auth: {
      user: process.env.MAIL_USERNAME || process.env.SMTP_USER,
      pass: process.env.MAIL_PASSWORD || process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM_ADDRESS || process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    logError("Email send failed", "notification-worker", err);
    return false;
  }
}

function buildEmailHtml(type: string, title: string, body: string, data: Record<string, unknown> = {}) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a2e;">${title}</h2>
      <p style="color: #555; line-height: 1.6;">${body}</p>
      ${data.jobId ? `<p style="color: #888; font-size: 12px;">Job ID: ${data.jobId}</p>` : ""}
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 11px;">AutoApply CV - This is an automated notification.</p>
    </div>
  `;
}

const MAX_BATCH = 10;

export async function POST(req: NextRequest) {
  if (WORKER_SECRET) {
    const authHeader = req.headers.get("x-worker-secret");
    if (authHeader !== WORKER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < MAX_BATCH; i++) {
    const notification = await dequeueNotification();
    if (!notification) break;

    try {
      const user = await prisma.user.findUnique({
        where: { id: notification.userId },
        select: { email: true, name: true },
      });

      if (!user?.email) {
        failed++;
        await markProcessed(notification.id);
        continue;
      }

      const emailSent = await sendEmail(
        user.email,
        notification.title,
        buildEmailHtml(notification.type, notification.title, notification.body, notification.data || {}),
      );

      await markProcessed(notification.id);
      processed++;

      logInfo(`Notification sent: ${notification.type}`, "notification-worker", {
        userId: notification.userId,
        emailSent,
      });
    } catch (err) {
      failed++;
      logError(`Notification failed: ${notification.type}`, "notification-worker", err);
    }
  }

  return new Response(JSON.stringify({ processed, failed }), {
    headers: { "Content-Type": "application/json" },
  });
}
