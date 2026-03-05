import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok } from "src/lib/api";
import { consumeVerifiedOtp, verifyOtp } from "src/lib/otp";
import { resetPasswordSchema } from "src/lib/schemas";
import { writeAuditLog } from "src/lib/audit";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "auth.reset_password"),
      limit: 8,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const body = resetPasswordSchema.parse(await req.json());
    const { email, otp, password } = body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      return fail("Account not found for this email", 404, "USER_NOT_FOUND");
    }

    const verified = await verifyOtp(email, otp, "password_reset");
    if (!verified.ok) {
      return fail(verified.reason || "Invalid OTP", 400, "OTP_INVALID");
    }

    const consumed = await consumeVerifiedOtp(email, "password_reset");
    if (!consumed) {
      return fail("OTP verification has expired. Request a new code.", 400, "OTP_EXPIRED");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.session.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "revoked" },
      }),
    ]);

    await writeAuditLog({
      actorUserId: user.id,
      action: "auth.password_reset",
      targetType: "user",
      targetId: user.id,
    });

    return ok("Password reset successful. Please sign in again.");
  } catch (error) {
    return handleApiError(error, "Failed to reset password");
  }
}
