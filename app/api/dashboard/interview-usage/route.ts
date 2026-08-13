import { ok, handleApiError } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { getInterviewUsageSummary } from "src/lib/hires";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const summary = await getInterviewUsageSummary(authResult.auth.user.id);
    return ok("Interview Copilot usage fetched", summary);
  } catch (error) {
    return handleApiError(error, "Failed to fetch interview usage");
  }
}
