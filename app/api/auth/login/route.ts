import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError } from "src/lib/api";
import { createSessionAndTokens, setAuthCookies, toClientUser } from "src/lib/auth";
import { loginSchema } from "src/lib/schemas";
import { ensureHireWindow } from "src/lib/hires";
import { writeAuditLog } from "src/lib/audit";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = enforceRateLimit({
      key: rateLimitKey(req, "auth.login"),
      limit: 10,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const body = loginSchema.parse(await req.json());
    const { email, password, role: requestedRole } = body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return fail("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return fail("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    if (requestedRole && user.role !== requestedRole) {
      return fail("Account role mismatch", 403, "ROLE_MISMATCH");
    }

    const quotaAwareUser = await ensureHireWindow(user.id);
    const { accessToken, refreshToken } = await createSessionAndTokens({
      id: quotaAwareUser.id,
      email: quotaAwareUser.email,
      role: quotaAwareUser.role,
    });
    await setAuthCookies(accessToken, refreshToken);

    await writeAuditLog({
      actorUserId: quotaAwareUser.id,
      action: "auth.login",
      targetType: "user",
      targetId: quotaAwareUser.id,
    });

    const clientUser = toClientUser(quotaAwareUser);
    return NextResponse.json({
      success: true,
      message: "Login successful",
      data: { user: clientUser },
      user: clientUser,
    });
  } catch (error) {
    console.error("login error:", error);
    return handleApiError(error, "Login failed");
  }
}
