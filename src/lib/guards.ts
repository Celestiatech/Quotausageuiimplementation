import { fail } from "./api";
import { getAuthUserFromRequest } from "./auth";

export async function requireAuth() {
  const auth = await getAuthUserFromRequest();
  if (!auth) return { error: fail("Unauthorized", 401, "UNAUTHORIZED") } as const;
  return { auth } as const;
}

export async function requireAdmin() {
  const result = await requireAuth();
  if ("error" in result) return result;
  if (result.auth.user.role !== "admin") {
    return { error: fail("Forbidden", 403, "FORBIDDEN") } as const;
  }
  return result;
}
