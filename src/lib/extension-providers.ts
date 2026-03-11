export type ExtensionProvider = "linkedin" | "indeed";

export type ExtensionProviderConfig = {
  provider: ExtensionProvider;
  code: string;
  displayName: string;
  shortLabel: string;
  rootDir: string;
  sourceKey: string;
  zipPrefix: string;
};

const EXTENSION_PROVIDERS: Record<ExtensionProvider, ExtensionProviderConfig> = {
  linkedin: {
    provider: "linkedin",
    code: "li",
    displayName: "AutoApply CV LinkedIn Copilot",
    shortLabel: "LinkedIn",
    rootDir: "CareerPilotLinkedInExtension",
    sourceKey: "linkedin_extension",
    zipPrefix: "AutoApplyCVLinkedInExtensionVersion",
  },
  indeed: {
    provider: "indeed",
    code: "indeed",
    displayName: "AutoApply CV Indeed Copilot",
    shortLabel: "Indeed",
    rootDir: "CareerPilotIndeedExtension",
    sourceKey: "indeed_extension",
    zipPrefix: "AutoApplyCVIndeedExtensionVersion",
  },
};

export function normalizeExtensionProvider(
  value: unknown,
  fallback: ExtensionProvider = "linkedin",
): ExtensionProvider {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "indeed" || raw === "id" || raw === "in") return "indeed";
  if (raw === "linkedin" || raw === "li") return "linkedin";
  return fallback;
}

export function getExtensionProviderConfig(
  provider: unknown,
  fallback: ExtensionProvider = "linkedin",
): ExtensionProviderConfig {
  return EXTENSION_PROVIDERS[normalizeExtensionProvider(provider, fallback)];
}

export function listExtensionProviderConfigs(): ExtensionProviderConfig[] {
  return Object.values(EXTENSION_PROVIDERS);
}

export function extensionIdempotencyPrefix(provider: unknown): string {
  return `ext:${getExtensionProviderConfig(provider).code}:`;
}

export function extensionSourceKey(provider: unknown): string {
  return getExtensionProviderConfig(provider).sourceKey;
}
