import { NextRequest, NextResponse } from "next/server";
import { createAndSendOtp, OtpPurpose } from "src/lib/otp";
import { otpSendSchema } from "src/lib/schemas";
import { handleApiError, ok } from "src/lib/api";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "auth.send_otp"),
      limit: 6,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const body = otpSendSchema.parse(await req.json());
    const { email, purpose } = body as { email: string; purpose: OtpPurpose };

    const result = await createAndSendOtp(email, purpose);
    const showOtp = (process.env.OTP_DEV_SHOW_CODE || "false").toLowerCase() === "true";
    const isDev = process.env.NODE_ENV !== "production";
    const includeOtp = showOtp || (isDev && (!result.delivered || result.bypassed));

    if (!result.delivered && isDev) {
      // Give a clearer message for local development environments.
      return ok(
        "OTP generated (email not delivered). Using dev fallback.",
        includeOtp ? { otp: result.otp, deliveryError: result.deliveryError } : undefined,
      );
    }

    return ok("OTP sent successfully", includeOtp ? { otp: result.otp } : undefined);
  } catch (error) {
    console.error("send-otp error:", error);
    return handleApiError(error, "Failed to send OTP");
  }
}
