import { prisma } from "./prisma";

export const DEFAULT_ALLOWED_DASHBOARD_ORIGINS = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
];

const EXTENSION_CONFIG_ACTION = "admin.extension_config_updated";

function normalizeOrigin(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!parsed.protocol.startsWith("http")) return "";
    return parsed.origin.toLowerCase();
  } catch {
    return "";
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function sanitizeAllowedDashboardOrigins(origins: string[]) {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const origin of origins) {
    const normalized = normalizeOrigin(origin);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(normalized);
  }
  return cleaned.slice(0, 30);
}

export async function getStoredAllowedDashboardOrigins() {
  const latest = await prisma.auditLog.findFirst({
    where: { action: EXTENSION_CONFIG_ACTION },
    orderBy: { createdAt: "desc" },
    select: { metadataJson: true },
  });
  const meta = asObject(latest?.metadataJson);
  if (!meta || !Array.isArray(meta.allowedDashboardOrigins)) {
    return [...DEFAULT_ALLOWED_DASHBOARD_ORIGINS];
  }
  const sanitized = sanitizeAllowedDashboardOrigins(
    meta.allowedDashboardOrigins.map((item) => String(item || "")),
  );
  if (!sanitized.length) return [...DEFAULT_ALLOWED_DASHBOARD_ORIGINS];
  return sanitized;
}

export const EXTENSION_CONFIG_AUDIT_ACTION = EXTENSION_CONFIG_ACTION;
