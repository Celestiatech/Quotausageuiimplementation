"use client";

import { useEffect, useMemo, useState } from "react";
import Clarity from "@microsoft/clarity";

type ConsentState = "unknown" | "granted" | "denied";

const CONSENT_COOKIE = "cp_cookie_consent";
const CONSENT_MAX_AGE_DAYS = 180;

function readCookie(name: string): string {
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

function writeCookie(name: string, value: string, maxAgeDays: number) {
  if (typeof document === "undefined") return;
  const maxAgeSeconds = Math.max(1, Math.floor(maxAgeDays * 24 * 60 * 60));
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

function toConsentState(raw: string): ConsentState {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "granted" || v === "accept" || v === "accepted" || v === "yes" || v === "true") return "granted";
  if (v === "denied" || v === "reject" || v === "rejected" || v === "no" || v === "false") return "denied";
  return "unknown";
}

function applyClarityConsent(projectId: string, consent: ConsentState) {
  const id = String(projectId || "").trim();
  if (!id) return;
  if (typeof window === "undefined") return;

  if (consent !== "granted") return;

  try {
    Clarity.init(id);
    Clarity.consentV2({ ad_Storage: "denied", analytics_Storage: "granted" });
  } catch {
    // Ignore; Clarity is non-critical.
  }
}

export default function CookieConsentBanner({ clarityProjectId }: { clarityProjectId: string }) {
  const [consent, setConsent] = useState<ConsentState>("unknown");

  const enabled = useMemo(() => Boolean(String(clarityProjectId || "").trim()), [clarityProjectId]);

  useEffect(() => {
    const stored = toConsentState(readCookie(CONSENT_COOKIE));
    setConsent(stored);
    if (enabled) applyClarityConsent(clarityProjectId, stored);
  }, [clarityProjectId, enabled]);

  if (!enabled) return null;
  if (consent !== "unknown") return null;

  const accept = () => {
    writeCookie(CONSENT_COOKIE, "granted", CONSENT_MAX_AGE_DAYS);
    setConsent("granted");
    applyClarityConsent(clarityProjectId, "granted");
  };

  const reject = () => {
    writeCookie(CONSENT_COOKIE, "denied", CONSENT_MAX_AGE_DAYS);
    setConsent("denied");
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur md:p-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-700">
          <div className="font-semibold text-gray-900">Cookies</div>
          <div>
            We use cookies for essential functionality and, with your consent, analytics (Microsoft Clarity).{" "}
            <a className="underline hover:no-underline" href="/cookie-policy">
              Learn more
            </a>
            .
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={reject}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

