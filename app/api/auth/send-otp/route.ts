import { NextRequest, NextResponse } from "next/server";
import { createAndSendOtp, OtpPurpose } from "src/lib/otp";
import { otpSendSchema } from "src/lib/schemas";
import { handleApiError, ok } from "src/lib/api";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = enforceRateLimit({
      key: rateLimitKey(req, "auth.send_otp"),
      limit: 6,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const body = otpSendSchema.parse(await req.json());
    const { email, purpose } = body as { email: string; purpose: OtpPurpose };

    const { otp } = await createAndSendOtp(email, purpose);
    const showOtp = (process.env.OTP_DEV_SHOW_CODE || "false").toLowerCase() === "true";

    return ok("OTP sent successfully", showOtp ? { otp } : undefined);
  } catch (error) {
    console.error("send-otp error:", error);
    return handleApiError(error, "Failed to send OTP");
  }
}
