import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { prisma } from "./prisma";

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
};

const toBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

const resolveMailConfig = () => {
  const host = process.env.MAIL_HOST || process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const port = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 587);
  const username = process.env.MAIL_USERNAME || process.env.SMTP_USER || "";
  const password = process.env.MAIL_PASSWORD || process.env.SMTP_PASS || "";
  const fromAddress =
    process.env.MAIL_FROM_ADDRESS || process.env.EMAIL_FROM || "no-reply@careerpilot.com";
  const fromName = process.env.MAIL_FROM_NAME || "CareerPilot";
  const encryptionRaw = (process.env.MAIL_ENCRYPTION || "").trim().toLowerCase();
  const encryption = encryptionRaw === "null" ? "" : encryptionRaw;
  // For SMTP 587 (STARTTLS), secure must be false. secure=true is for implicit TLS (usually 465).
  const secure =
    encryption === "ssl" || encryption === "smtps" || toBool(process.env.SMTP_SECURE, port === 465);
  const requireTLS = encryption === "tls" || (host.includes("gmail.com") && port === 587);
  const rejectUnauthorized = toBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);

  return {
    host,
    port,
    username,
    password,
    fromAddress,
    fromName,
    secure,
    requireTLS,
    rejectUnauthorized,
  };
};

let cachedTransporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  const config = resolveMailConfig();

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    tls: {
      rejectUnauthorized: config.rejectUnauthorized,
    },
    auth: config.username
      ? {
          user: config.username,
          pass: config.password,
        }
      : undefined,
  });

  return cachedTransporter;
};

const safeLogEmail = async (entry: {
  toEmail: string;
  subject: string;
  template?: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
}) => {
  try {
    await prisma.emailLog.create({
      data: entry,
    });
  } catch (error) {
    console.error("email log write failed:", error);
  }
};

export async function sendMail(input: SendMailInput) {
  const config = resolveMailConfig();
  const transporter = getTransporter();

  try {
    const result = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    await safeLogEmail({
      toEmail: input.to,
      subject: input.subject,
      template: input.template,
      status: "sent",
      providerMessageId: result.messageId,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown SMTP error";
    await safeLogEmail({
      toEmail: input.to,
      subject: input.subject,
      template: input.template,
      status: "failed",
      errorMessage,
    });
    throw error;
  }
}

export async function verifyMailConnection() {
  const transporter = getTransporter();
  await transporter.verify();
  return true;
}
