import { prisma } from "./prisma";
import { decryptText, encryptText } from "./security";

export const SOCIAL_INTEGRATION_PROVIDERS = ["facebook", "linkedin", "twitter"] as const;

export type SocialIntegrationProvider = (typeof SOCIAL_INTEGRATION_PROVIDERS)[number];

type ProviderMeta = {
  label: string;
  description: string;
  capability: "live_publish" | "stored_only";
  publicKeys: readonly string[];
  secretKeys: readonly string[];
  requiredPublicKeys: readonly string[];
  requiredSecretKeys: readonly string[];
};

const PROVIDER_META: Record<SocialIntegrationProvider, ProviderMeta> = {
  facebook: {
    label: "Facebook Page",
    description: "Used by blog auto-publish when a post is published.",
    capability: "live_publish",
    publicKeys: ["pageId"],
    secretKeys: ["pageAccessToken"],
    requiredPublicKeys: ["pageId"],
    requiredSecretKeys: ["pageAccessToken"],
  },
  linkedin: {
    label: "LinkedIn Company Page",
    description: "Stores organization publishing credentials for future social workflows.",
    capability: "stored_only",
    publicKeys: ["organizationUrn"],
    secretKeys: ["accessToken"],
    requiredPublicKeys: ["organizationUrn"],
    requiredSecretKeys: ["accessToken"],
  },
  twitter: {
    label: "X / Twitter",
    description: "Stores app and account credentials for future publishing workflows.",
    capability: "stored_only",
    publicKeys: ["handle"],
    secretKeys: ["apiKey", "apiSecret", "accessToken", "accessTokenSecret"],
    requiredPublicKeys: [],
    requiredSecretKeys: ["apiKey", "apiSecret", "accessToken", "accessTokenSecret"],
  },
};

export type SocialIntegrationSummary = {
  provider: SocialIntegrationProvider;
  label: string;
  description: string;
  capability: ProviderMeta["capability"];
  enabled: boolean;
  configured: boolean;
  updatedAt: string | null;
  publicConfig: Record<string, string>;
  secretMasks: Record<string, string | null>;
};

export type DecryptedSocialIntegration = {
  provider: SocialIntegrationProvider;
  enabled: boolean;
  configured: boolean;
  updatedAt: Date | null;
  publicConfig: Record<string, string>;
  secrets: Record<string, string>;
};

type UpsertSocialIntegrationInput = {
  provider: SocialIntegrationProvider;
  enabled: boolean;
  publicConfig: Record<string, unknown>;
  secrets: Record<string, unknown>;
  updatedById: string;
};

function asStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    out[key] = String(raw || "").trim();
  }
  return out;
}

function sanitizeByKeys(value: Record<string, unknown>, allowedKeys: readonly string[]) {
  const out: Record<string, string> = {};
  for (const key of allowedKeys) {
    out[key] = String(value[key] || "").trim();
  }
  return out;
}

function decryptSecrets(payload?: string | null) {
  if (!payload) return {} as Record<string, string>;
  try {
    return asStringRecord(JSON.parse(decryptText(payload)));
  } catch {
    return {} as Record<string, string>;
  }
}

function hasValue(record: Record<string, string>, key: string) {
  return Boolean(String(record[key] || "").trim());
}

function isConfigured(
  provider: SocialIntegrationProvider,
  publicConfig: Record<string, string>,
  secrets: Record<string, string>,
) {
  const meta = PROVIDER_META[provider];
  const publicReady = meta.requiredPublicKeys.every((key) => hasValue(publicConfig, key));
  const secretReady = meta.requiredSecretKeys.every((key) => hasValue(secrets, key));
  return publicReady && secretReady;
}

function maskSecret(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export function getSocialIntegrationMeta(provider: SocialIntegrationProvider) {
  return PROVIDER_META[provider];
}

export async function listSocialIntegrationSummaries(): Promise<SocialIntegrationSummary[]> {
  const records = await prisma.socialIntegration.findMany({
    where: {
      provider: {
        in: [...SOCIAL_INTEGRATION_PROVIDERS],
      },
    },
    orderBy: {
      provider: "asc",
    },
  });

  const byProvider = new Map(records.map((record) => [record.provider, record]));

  return SOCIAL_INTEGRATION_PROVIDERS.map((provider) => {
    const meta = PROVIDER_META[provider];
    const record = byProvider.get(provider);
    const publicConfig = sanitizeByKeys(asStringRecord(record?.publicConfigJson), meta.publicKeys);
    const secrets = decryptSecrets(record?.encryptedSecrets);
    const secretMasks = Object.fromEntries(
      meta.secretKeys.map((key) => [key, maskSecret(secrets[key] || "")]),
    ) as Record<string, string | null>;

    return {
      provider,
      label: meta.label,
      description: meta.description,
      capability: meta.capability,
      enabled: Boolean(record?.enabled),
      configured: isConfigured(provider, publicConfig, secrets),
      updatedAt: record?.updatedAt?.toISOString() || null,
      publicConfig,
      secretMasks,
    };
  });
}

export async function getDecryptedSocialIntegration(
  provider: SocialIntegrationProvider,
): Promise<DecryptedSocialIntegration | null> {
  const record = await prisma.socialIntegration.findUnique({
    where: { provider },
  });
  if (!record) return null;

  const meta = PROVIDER_META[provider];
  const publicConfig = sanitizeByKeys(asStringRecord(record.publicConfigJson), meta.publicKeys);
  const secrets = sanitizeByKeys(decryptSecrets(record.encryptedSecrets), meta.secretKeys);

  return {
    provider,
    enabled: record.enabled,
    configured: isConfigured(provider, publicConfig, secrets),
    updatedAt: record.updatedAt,
    publicConfig,
    secrets,
  };
}

export async function upsertSocialIntegration(input: UpsertSocialIntegrationInput) {
  const meta = PROVIDER_META[input.provider];
  const existing = await prisma.socialIntegration.findUnique({
    where: { provider: input.provider },
  });

  const existingSecrets = sanitizeByKeys(decryptSecrets(existing?.encryptedSecrets), meta.secretKeys);
  const incomingSecrets = sanitizeByKeys(input.secrets, meta.secretKeys);
  const nextSecrets = { ...existingSecrets };
  for (const key of meta.secretKeys) {
    if (incomingSecrets[key]) {
      nextSecrets[key] = incomingSecrets[key];
    }
  }

  const publicConfig = sanitizeByKeys(input.publicConfig, meta.publicKeys);
  const hasAnySecret = meta.secretKeys.some((key) => hasValue(nextSecrets, key));

  const record = await prisma.socialIntegration.upsert({
    where: { provider: input.provider },
    create: {
      provider: input.provider,
      enabled: input.enabled,
      publicConfigJson: publicConfig,
      encryptedSecrets: hasAnySecret ? encryptText(JSON.stringify(nextSecrets)) : null,
      keyVersion: 1,
      updatedById: input.updatedById,
    },
    update: {
      enabled: input.enabled,
      publicConfigJson: publicConfig,
      encryptedSecrets: hasAnySecret ? encryptText(JSON.stringify(nextSecrets)) : null,
      keyVersion: 1,
      updatedById: input.updatedById,
    },
  });

  return {
    record,
    summary: {
      provider: input.provider,
      label: meta.label,
      description: meta.description,
      capability: meta.capability,
      enabled: record.enabled,
      configured: isConfigured(input.provider, publicConfig, nextSecrets),
      updatedAt: record.updatedAt.toISOString(),
      publicConfig,
      secretMasks: Object.fromEntries(
        meta.secretKeys.map((key) => [key, maskSecret(nextSecrets[key] || "")]),
      ) as Record<string, string | null>,
    } satisfies SocialIntegrationSummary,
  };
}

export async function clearSocialIntegration(provider: SocialIntegrationProvider) {
  const existing = await prisma.socialIntegration.findUnique({
    where: { provider },
  });
  if (!existing) return null;
  await prisma.socialIntegration.delete({
    where: { provider },
  });
  return existing;
}

export async function getFacebookPublishIntegration() {
  const stored = await getDecryptedSocialIntegration("facebook");
  if (stored) {
    if (!stored.enabled) {
      return { source: "admin" as const, enabled: false, configured: false };
    }
    return {
      source: "admin" as const,
      enabled: stored.enabled,
      configured: stored.configured,
      pageId: stored.publicConfig.pageId || "",
      pageAccessToken: stored.secrets.pageAccessToken || "",
    };
  }

  const pageId = String(process.env.FACEBOOK_PAGE_ID || "").trim();
  const pageAccessToken = String(process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  const configured = Boolean(pageId && pageAccessToken);

  return {
    source: "env" as const,
    enabled: configured,
    configured,
    pageId,
    pageAccessToken,
  };
}
