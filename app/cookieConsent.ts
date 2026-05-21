export type ConsentPreferences = {
  ad_storage: boolean;
  ad_user_data: boolean;
  ad_personalization: boolean;
  analytics_storage: boolean;
  functionality_storage: boolean;
  personalization_storage: boolean;
  security_storage: boolean;
};

export const CONSENT_COOKIE = "cp_cookie_consent";
export const CONSENT_STORAGE_KEY = "cp_cookie_consent";
export const CONSENT_MAX_AGE_DAYS = 180;
export const CONSENT_DRAFT_SESSION_KEY = "cp_cookie_consent_draft";

export const EDIT_CONSENT_EVENT = "cp:cookie-consent:edit";
export const CONSENT_CHANGED_EVENT = "cp:cookie-consent:changed";

export function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key === name) return eq === -1 ? "" : decodeURIComponent(part.slice(eq + 1));
  }
  return "";
}

export function writeCookie(name: string, value: string, maxAgeDays: number) {
  if (typeof document === "undefined") return;
  const maxAgeSeconds = Math.max(1, Math.floor(maxAgeDays * 24 * 60 * 60));
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

export function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function readStorage(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

export function readSession(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.sessionStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

export function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (e.g. blocked).
  }
}

export function writeSession(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (e.g. blocked).
  }
}

export function clearStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures (e.g. blocked).
  }
}

export function clearSession(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures (e.g. blocked).
  }
}

function toLegacyConsentState(raw: string): "granted" | "denied" | "unknown" {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "granted" || v === "accept" || v === "accepted" || v === "yes" || v === "true") return "granted";
  if (v === "denied" || v === "reject" || v === "rejected" || v === "no" || v === "false") return "denied";
  return "unknown";
}

function parsePreferences(raw: string): ConsentPreferences | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  const legacy = toLegacyConsentState(trimmed);
  if (legacy === "granted") {
    return {
      ad_storage: true,
      ad_user_data: true,
      ad_personalization: true,
      analytics_storage: true,
      functionality_storage: true,
      personalization_storage: true,
      security_storage: true,
    };
  }
  if (legacy === "denied") {
    return {
      ad_storage: false,
      ad_user_data: false,
      ad_personalization: false,
      analytics_storage: false,
      functionality_storage: true,
      personalization_storage: false,
      security_storage: true,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;

    // Back-compat with the earlier { analytics, advertising } shape.
    if ("analytics" in parsed || "advertising" in parsed) {
      const analytics = Boolean(parsed.analytics);
      const advertising = Boolean(parsed.advertising);
      return {
        ad_storage: advertising,
        ad_user_data: advertising,
        ad_personalization: advertising,
        analytics_storage: analytics,
        functionality_storage: true,
        personalization_storage: advertising,
        security_storage: true,
      };
    }

    const full = parsed as Partial<ConsentPreferences>;
    if (typeof full.ad_storage !== "boolean") return null;
    if (typeof full.ad_user_data !== "boolean") return null;
    if (typeof full.ad_personalization !== "boolean") return null;
    if (typeof full.analytics_storage !== "boolean") return null;
    if (typeof full.functionality_storage !== "boolean") return null;
    if (typeof full.personalization_storage !== "boolean") return null;
    if (typeof full.security_storage !== "boolean") return null;
    return {
      ad_storage: full.ad_storage,
      ad_user_data: full.ad_user_data,
      ad_personalization: full.ad_personalization,
      analytics_storage: full.analytics_storage,
      functionality_storage: full.functionality_storage,
      personalization_storage: full.personalization_storage,
      security_storage: full.security_storage,
    };
  } catch {
    return null;
  }
}

export function readConsentPreferences(): ConsentPreferences | null {
  const raw = readStorage(CONSENT_STORAGE_KEY) || readCookie(CONSENT_COOKIE);
  return parsePreferences(raw);
}

export function setConsentPreferences(prefs: ConsentPreferences) {
  const value = JSON.stringify(prefs);
  writeStorage(CONSENT_STORAGE_KEY, value);
  writeCookie(CONSENT_COOKIE, value, CONSENT_MAX_AGE_DAYS);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }
}

export function defaultConsentPreferences(): ConsentPreferences {
  return {
    ad_storage: false,
    ad_user_data: false,
    ad_personalization: false,
    analytics_storage: false,
    functionality_storage: true,
    personalization_storage: false,
    security_storage: true,
  };
}
