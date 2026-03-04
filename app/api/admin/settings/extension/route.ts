import { z } from "zod";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import {
  EXTENSION_CONFIG_AUDIT_ACTION,
  getStoredAllowedDashboardOrigins,
  sanitizeAllowedDashboardOrigins,
} from "src/lib/extension-config";

const extensionSettingsSchema = z.object({
  allowedDashboardOrigins: z.array(z.string().trim().max(200)).min(1).max(30),
});

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const allowedDashboardOrigins = await getStoredAllowedDashboardOrigins();
    return ok("Extension settings fetched", { allowedDashboardOrigins });
  } catch (error) {
    return handleApiError(error, "Failed to fetch extension settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const payload = extensionSettingsSchema.parse(await req.json());
    const allowedDashboardOrigins = sanitizeAllowedDashboardOrigins(payload.allowedDashboardOrigins);
    if (!allowedDashboardOrigins.length) {
      return fail("At least one valid HTTP/HTTPS origin is required", 400, "VALIDATION_ERROR");
    }

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: EXTENSION_CONFIG_AUDIT_ACTION,
      targetType: "extension_config",
      targetId: "dashboard_origins",
      metadataJson: { allowedDashboardOrigins },
    });

    return ok("Extension settings updated", { allowedDashboardOrigins });
  } catch (error) {
    return handleApiError(error, "Failed to update extension settings");
  }
}
