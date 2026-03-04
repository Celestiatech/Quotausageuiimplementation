import { ok, handleApiError } from "src/lib/api";
import { getStoredAllowedDashboardOrigins } from "src/lib/extension-config";

export async function GET() {
  try {
    const allowedDashboardOrigins = await getStoredAllowedDashboardOrigins();
    return ok("Extension config fetched", { allowedDashboardOrigins });
  } catch (error) {
    return handleApiError(error, "Failed to fetch extension config");
  }
}
