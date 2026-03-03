import { clearAuthCookies, readRefreshTokenFromCookies, rotateRefreshToken, setAuthCookies, toClientUser } from "src/lib/auth";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";

export async function POST() {
  try {
    const refreshToken = await readRefreshTokenFromCookies();
    if (!refreshToken) return fail("Refresh token missing", 401, "NO_REFRESH_TOKEN");

    const rotated = await rotateRefreshToken(refreshToken);
    await setAuthCookies(rotated.accessToken, rotated.refreshToken);
    await writeAuditLog({
      actorUserId: rotated.user.id,
      action: "auth.refresh",
      targetType: "session",
      targetId: rotated.sessionId,
    });

    return ok("Token refreshed", { user: toClientUser(rotated.user) });
  } catch (error) {
    await clearAuthCookies();
    return handleApiError(error, "Failed to refresh token");
  }
}
