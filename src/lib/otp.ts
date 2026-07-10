import { createHash, randomInt } from "crypto";
import { prisma } from "./prisma";
import { sendMail } from "./mail";
import { getRequiredEnv } from "./env";

const OTP_TTL_MINUTES = 10;
const OTP_VERIFY_MAX_AGE_MINUTES = 30;
const OTP_MIN_RESEND_SECONDS = 30;

export type OtpPurpose = "signup" | "login" | "password_reset";

const hashOtp = (email: string, otp: string) => {
  const secret = getRequiredEnv("OTP_HASH_SECRET", { minLength: 16 });
  return createHash("sha256")
    .update(`${email.toLowerCase().trim()}:${otp}:${secret}`)
    .digest("hex");
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const generateOtp = () => randomInt(100000, 1000000).toString();

export async function createAndSendOtp(emailRaw: string, purpose: OtpPurpose) {
  const email = normalizeEmail(emailRaw);
  const now = new Date();
  const latest = await prisma.emailOtp.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (latest && now.getTime() - latest.createdAt.getTime() < OTP_MIN_RESEND_SECONDS * 1000) {
    const waitSeconds =
      OTP_MIN_RESEND_SECONDS - Math.floor((now.getTime() - latest.createdAt.getTime()) / 1000);
    throw new Error(`Please wait ${waitSeconds}s before requesting another OTP`);
  }

  const otp = generateOtp();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.emailOtp.create({
    data: {
      email,
      purpose,
      codeHash: hashOtp(email, otp),
      expiresAt,
    },
  });

  const devBypassMail = (process.env.OTP_DEV_BYPASS_MAIL || "false").toLowerCase() === "true";
  let delivered = false;
  let deliveryError: string | null = null;

  if (!devBypassMail) {
    try {
      await sendMail({
        to: email,
        subject: "Your CareerPilot Verification Code",
        template: "otp_verification",
        text: `Your CareerPilot verification code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, please ignore this email.`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f8f9fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6366f1);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-family:Arial,sans-serif;font-size:22px;font-weight:700;">CareerPilot</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;color:#6b7280;font-family:Arial,sans-serif;font-size:14px;">Hello,</p>
            <p style="margin:0 0 24px;color:#1f2937;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">
              Use the following code to verify your email address:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#f5f3ff;border:2px dashed #c4b5fd;border-radius:12px;padding:20px;text-align:center;">
                  <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#6d28d9;font-family:'Courier New',monospace;">${otp}</span>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#9ca3af;font-family:Arial,sans-serif;font-size:13px;text-align:center;">
              This code expires in <strong style="color:#6b7280;">${OTP_TTL_MINUTES} minutes</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
              <p style="margin:0;color:#9ca3af;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;text-align:center;">
                If you didn't request this email, you can safely ignore it.<br/>
                &copy; ${new Date().getFullYear()} CareerPilot. All rights reserved.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
      delivered = true;
    } catch (error) {
      delivered = false;
      deliveryError = error instanceof Error ? error.message : String(error);
      // In local/dev, email providers (e.g. Resend testing) can block sending to unverified recipients.
      // Don't break signup UX: allow returning the OTP via API when the caller opts-in (send-otp route decides).
      if (process.env.NODE_ENV === "production") throw error;
    }
  }

  return { otp, delivered, deliveryError, bypassed: devBypassMail };
}

export async function verifyOtp(emailRaw: string, otp: string, purpose: OtpPurpose) {
  const email = normalizeEmail(emailRaw);
  const now = new Date();
  const record = await prisma.emailOtp.findFirst({
    where: {
      email,
      purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { ok: false, reason: "No OTP requested for this email" };
  }
  if (record.verifiedAt) {
    return { ok: true };
  }
  if (now > record.expiresAt) {
    return { ok: false, reason: "OTP expired. Request a new one" };
  }
  if (record.attempts >= record.maxAttempts) {
    return { ok: false, reason: "Too many failed attempts. Request a new OTP" };
  }

  const valid = record.codeHash === hashOtp(email, otp);
  if (!valid) {
    await prisma.emailOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "Invalid OTP" };
  }

  await prisma.emailOtp.update({
    where: { id: record.id },
    data: { verifiedAt: now },
  });
  return { ok: true };
}

export async function consumeVerifiedOtp(emailRaw: string, purpose: OtpPurpose) {
  const email = normalizeEmail(emailRaw);
  const now = new Date();
  const minVerifiedAt = new Date(now.getTime() - OTP_VERIFY_MAX_AGE_MINUTES * 60 * 1000);

  const record = await prisma.emailOtp.findFirst({
    where: {
      email,
      purpose,
      consumedAt: null,
      verifiedAt: {
        gte: minVerifiedAt,
      },
      expiresAt: {
        gte: now,
      },
    },
    orderBy: { verifiedAt: "desc" },
  });

  if (!record) {
    return false;
  }

  await prisma.emailOtp.update({
    where: { id: record.id },
    data: { consumedAt: now },
  });

  return true;
}
