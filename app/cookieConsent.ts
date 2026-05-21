export type ConsentPreferences = {
  analytics: boolean;
  advertising: boolean;
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
  if (legacy === "granted") return { analytics: true, advertising: true };
  if (legacy === "denied") return { analytics: false, advertising: false };

  try {
    const parsed = JSON.parse(trimmed) as Partial<ConsentPreferences> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.analytics !== "boolean") return null;
    if (typeof parsed.advertising !== "boolean") return null;
    return { analytics: parsed.analytics, advertising: parsed.advertising };
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
