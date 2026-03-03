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
  if (!devBypassMail) {
    await sendMail({
      to: email,
      subject: "CareerPilot verification code",
      template: "otp_verification",
      text: `Your CareerPilot verification code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;"><h2>CareerPilot Verification</h2><p>Your one-time code:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${otp}</p><p>Expires in ${OTP_TTL_MINUTES} minutes.</p></div>`,
    });
  }

  return { otp };
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
