import { NextResponse } from "next/server";
import { verifyMailConnection } from "src/lib/mail";

export async function GET() {
  const otpBypass = (process.env.OTP_DEV_BYPASS_MAIL || "false").toLowerCase() === "true";
  const allowBypass = (process.env.MAIL_HEALTH_ALLOW_BYPASS || "true").toLowerCase() === "true";
  try {
    await verifyMailConnection();
    return NextResponse.json({
      success: true,
      message: "SMTP connection verified",
    });
  } catch (error) {
    if (otpBypass && allowBypass) {
      return NextResponse.json({
        success: true,
        message: "SMTP bypass enabled for local development",
      });
    }
    const message = error instanceof Error ? error.message : "SMTP verification failed";
    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
