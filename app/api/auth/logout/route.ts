import { clearAuthCookies, clearExtensionAuthCookie, readRefreshTokenFromCookies, revokeByRefreshToken } from "src/lib/auth";
import { ok } from "src/lib/api";

export async function POST() {
  const refreshToken = await readRefreshTokenFromCookies();
  if (refreshToken) {
    await revokeByRefreshToken(refreshToken);
  }
  await clearAuthCookies();
  await clearExtensionAuthCookie();
  return ok("Logged out");
}
