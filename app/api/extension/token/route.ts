import { requireAuth } from "src/lib/guards";
import { createSessionAndTokens } from "src/lib/auth";
import { fail, handleApiError, ok } from "src/lib/api";

const EXTENSION_TOKEN_TTL_SECONDS = 15 * 60;

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const { user } = authResult.auth;
    const { accessToken } = await createSessionAndTokens(user);

    return ok("Extension token issued", {
      token: accessToken,
      expiresIn: EXTENSION_TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    return handleApiError(error, "Failed to issue extension token");
  }
}
