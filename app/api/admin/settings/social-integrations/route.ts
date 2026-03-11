import { z } from "zod";
import { requireAdmin } from "src/lib/guards";
import { handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import {
  clearSocialIntegration,
  listSocialIntegrationSummaries,
  upsertSocialIntegration,
} from "src/lib/social-integrations";

const facebookSchema = z.object({
  provider: z.literal("facebook"),
  enabled: z.boolean(),
  publicConfig: z.object({
    pageId: z.string().trim().max(120).optional().default(""),
  }),
  secrets: z.object({
    pageAccessToken: z.string().max(4000).optional().default(""),
  }),
});

const linkedinSchema = z.object({
  provider: z.literal("linkedin"),
  enabled: z.boolean(),
  publicConfig: z.object({
    organizationUrn: z.string().trim().max(160).optional().default(""),
  }),
  secrets: z.object({
    accessToken: z.string().max(4000).optional().default(""),
  }),
});

const twitterSchema = z.object({
  provider: z.literal("twitter"),
  enabled: z.boolean(),
  publicConfig: z.object({
    handle: z.string().trim().max(80).optional().default(""),
  }),
  secrets: z.object({
    apiKey: z.string().max(200).optional().default(""),
    apiSecret: z.string().max(400).optional().default(""),
    accessToken: z.string().max(400).optional().default(""),
    accessTokenSecret: z.string().max(400).optional().default(""),
  }),
});

const socialIntegrationSchema = z.discriminatedUnion("provider", [
  facebookSchema,
  linkedinSchema,
  twitterSchema,
]);

const clearSchema = z.object({
  provider: z.enum(["facebook", "linkedin", "twitter"]),
});

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const integrations = await listSocialIntegrationSummaries();
    return ok("Social integrations fetched", { integrations });
  } catch (error) {
    return handleApiError(error, "Failed to fetch social integrations");
  }
}

export async function PATCH(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const payload = socialIntegrationSchema.parse(await req.json());
    const updated = await upsertSocialIntegration({
      provider: payload.provider,
      enabled: payload.enabled,
      publicConfig: payload.publicConfig,
      secrets: payload.secrets,
      updatedById: authResult.auth.user.id,
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "admin.social_integration_update",
      targetType: "social_integration",
      targetId: payload.provider,
      metadataJson: {
        provider: payload.provider,
        enabled: updated.summary.enabled,
        configured: updated.summary.configured,
        publicConfig: updated.summary.publicConfig,
        capability: updated.summary.capability,
      },
    });

    return ok("Social integration updated", { integration: updated.summary });
  } catch (error) {
    return handleApiError(error, "Failed to update social integration");
  }
}

export async function DELETE(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const payload = clearSchema.parse(await req.json());
    await clearSocialIntegration(payload.provider);

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "admin.social_integration_clear",
      targetType: "social_integration",
      targetId: payload.provider,
      metadataJson: {
        provider: payload.provider,
      },
    });

    return ok("Social integration cleared");
  } catch (error) {
    return handleApiError(error, "Failed to clear social integration");
  }
}
