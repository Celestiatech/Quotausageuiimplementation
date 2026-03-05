import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "src/lib/prisma";
import { adminLoginSchema } from "src/lib/schemas";
import { createSessionAndTokens, setAuthCookies, toClientUser } from "src/lib/auth";
import { fail, handleApiError } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "auth.admin_login"),
      limit: 10,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const body = adminLoginSchema.parse(await req.json());
    const { email, password } = body;
    let admin = await prisma.user.findUnique({ where: { email } });
    const allowBootstrap = (process.env.ALLOW_ADMIN_BOOTSTRAP || "false").toLowerCase() === "true";

    if (!admin && allowBootstrap) {
      const envAdminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
      const envAdminPassword = process.env.ADMIN_PASSWORD || "";
      const envAdminName = process.env.ADMIN_NAME || "AutoApply CV Admin";
      if (envAdminEmail && envAdminPassword && envAdminEmail === email && envAdminPassword === password) {
        admin = await prisma.user.create({
          data: {
            name: envAdminName,
            email: envAdminEmail,
            passwordHash: await bcrypt.hash(envAdminPassword, 10),
            role: "admin",
            plan: "coach",
            quotaTotal: 999999,
            quotaUsed: 0,
            quotaResetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    if (!admin || admin.role !== "admin") {
      return fail("Invalid admin credentials", 401, "INVALID_ADMIN_CREDENTIALS");
    }
    const validPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!validPassword) return fail("Invalid admin credentials", 401, "INVALID_ADMIN_CREDENTIALS");

    const { accessToken, refreshToken } = await createSessionAndTokens({
      id: admin.id,
      email: admin.email,
      role: admin.role,
    });
    await setAuthCookies(accessToken, refreshToken);

    await writeAuditLog({
      actorUserId: admin.id,
      action: "auth.admin_login",
      targetType: "user",
      targetId: admin.id,
    });

    const clientUser = toClientUser(admin);
    return NextResponse.json({
      success: true,
      message: "Admin login successful",
      data: { user: clientUser },
      user: clientUser,
    });
  } catch (error) {
    console.error("admin login error:", error);
    return handleApiError(error, "Admin login failed");
  }
}
