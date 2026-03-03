import { NextRequest, NextResponse } from "next/server";
import { OtpPurpose, verifyOtp } from "src/lib/otp";
import { otpVerifySchema } from "src/lib/schemas";
import { fail, handleApiError, ok } from "src/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = otpVerifySchema.parse(await req.json());
    const { email, otp, purpose } = body as { email: string; otp: string; purpose: OtpPurpose };

    const result = await verifyOtp(email, otp, purpose);
    if (!result.ok) {
      return fail(result.reason || "OTP verification failed", 400, "OTP_INVALID");
    }

    return ok("Email verified successfully");
  } catch (error) {
    console.error("verify-otp error:", error);
    return handleApiError(error, "Failed to verify OTP");
  }
}
