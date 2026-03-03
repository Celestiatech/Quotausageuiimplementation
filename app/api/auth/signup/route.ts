import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "src/lib/prisma";
import { consumeVerifiedOtp } from "src/lib/otp";
import { signupSchema } from "src/lib/schemas";
import { createSessionAndTokens, setAuthCookies, toClientUser } from "src/lib/auth";
import { getPlanQuota } from "src/lib/quota";
import { getDailyHireCap } from "src/lib/hires";
import { writeAuditLog } from "src/lib/audit";
import { fail, handleApiError } from "src/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = signupSchema.parse(await req.json());
    const { name, email, password } = body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return fail("An account with this email already exists", 409, "EMAIL_TAKEN");
    }

    const otpVerified = await consumeVerifiedOtp(email, "signup");
    if (!otpVerified) {
      return fail("Email verification is required before signup", 400, "OTP_REQUIRED");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    nextReset.setUTCHours(0, 0, 0, 0);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "user",
        plan: "free",
        onboardingCompleted: false,
        quotaUsed: 0,
        quotaTotal: getPlanQuota("free"),
        quotaResetTime: nextReset,
        dailyHireUsed: 0,
        dailyHireCap: getDailyHireCap("free"),
        dailyHireResetTime: nextReset,
      },
    });

    const { accessToken, refreshToken } = await createSessionAndTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    await setAuthCookies(accessToken, refreshToken);

    await writeAuditLog({
      actorUserId: user.id,
      action: "auth.signup",
      targetType: "user",
      targetId: user.id,
    });

    const clientUser = toClientUser(user);
    return NextResponse.json(
      {
        success: true,
        message: "Account created",
        data: { user: clientUser },
        user: clientUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("signup error:", error);
    return handleApiError(error, "Failed to create account");
  }
}
