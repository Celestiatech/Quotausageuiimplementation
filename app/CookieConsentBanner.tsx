"use client";

import { useEffect, useMemo, useState } from "react";
import Clarity from "@microsoft/clarity";
import {
  CONSENT_COOKIE,
  CONSENT_DRAFT_SESSION_KEY,
  CONSENT_STORAGE_KEY,
  clearCookie,
  clearSession,
  clearStorage,
  EDIT_CONSENT_EVENT,
  readConsentPreferences,
  readSession,
  setConsentPreferences,
  writeSession,
  type ConsentPreferences,
} from "./cookieConsent";

function applyClarityConsent(projectId: string, prefs: ConsentPreferences | null) {
  const id = String(projectId || "").trim();
  if (!id) return;
  if (typeof window === "undefined") return;

  if (!prefs?.analytics) return;

  try {
    Clarity.init(id);
    Clarity.consentV2({ ad_Storage: "denied", analytics_Storage: "granted" });
  } catch {
    // Ignore; Clarity is non-critical.
  }
}

export default function CookieConsentBanner({
  clarityProjectId,
  googleTagId,
  gtmId,
}: {
  clarityProjectId: string;
  googleTagId: string;
  gtmId: string;
}) {
  const [prefs, setPrefs] = useState<ConsentPreferences | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const [draftAdvertising, setDraftAdvertising] = useState(false);

  const enabled = useMemo(() => {
    return Boolean(
      String(clarityProjectId || "").trim() ||
        String(googleTagId || "").trim() ||
        String(gtmId || "").trim(),
    );
  }, [clarityProjectId, googleTagId, gtmId]);

  useEffect(() => {
    const stored = readConsentPreferences();
    setPrefs(stored);
    if (enabled) applyClarityConsent(clarityProjectId, stored);
  }, [clarityProjectId, enabled, googleTagId, gtmId]);

  useEffect(() => {
    // Persist draft selections for this browser session until user confirms.
    const raw = readSession(CONSENT_DRAFT_SESSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<ConsentPreferences> | null;
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.analytics === "boolean") setDraftAnalytics(parsed.analytics);
        if (typeof parsed.advertising === "boolean") setDraftAdvertising(parsed.advertising);
      }
    } catch {
      // Ignore invalid draft.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      clearStorage(CONSENT_STORAGE_KEY);
      clearCookie(CONSENT_COOKIE);
      clearSession(CONSENT_DRAFT_SESSION_KEY);
      setPrefs(null);
      setShowSettings(false);
    };
    window.addEventListener(EDIT_CONSENT_EVENT, handler);
    return () => window.removeEventListener(EDIT_CONSENT_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!showSettings) return;
    // If user already adjusted toggles in this session, keep them.
    // Otherwise, default to off until they opt-in.
    const raw = readSession(CONSENT_DRAFT_SESSION_KEY);
    if (!raw) {
      setDraftAnalytics(false);
      setDraftAdvertising(false);
    }
  }, [showSettings]);

  useEffect(() => {
    if (prefs) return;
    const value = JSON.stringify({ analytics: draftAnalytics, advertising: draftAdvertising });
    writeSession(CONSENT_DRAFT_SESSION_KEY, value);
  }, [draftAdvertising, draftAnalytics, prefs]);

  if (!enabled) return null;
  if (prefs) return null;

  const acceptAll = () => {
    const next: ConsentPreferences = { analytics: true, advertising: true };
    setConsentPreferences(next);
    clearSession(CONSENT_DRAFT_SESSION_KEY);
    setPrefs(next);
    applyClarityConsent(clarityProjectId, next);
  };

  const rejectAll = () => {
    const next: ConsentPreferences = { analytics: false, advertising: false };
    setConsentPreferences(next);
    clearSession(CONSENT_DRAFT_SESSION_KEY);
    setPrefs(next);
    try {
      Clarity.consentV2({ ad_Storage: "denied", analytics_Storage: "denied" });
    } catch {
      // Ignore.
    }
  };

  const hasGoogle = Boolean(String(googleTagId || "").trim() || String(gtmId || "").trim());
  const hasClarity = Boolean(String(clarityProjectId || "").trim());
  const supportsAdvertising = true;

  const confirmSelected = () => {
    const next: ConsentPreferences = {
      analytics: Boolean(draftAnalytics),
      advertising: Boolean(draftAdvertising) && supportsAdvertising,
    };
    setConsentPreferences(next);
    clearSession(CONSENT_DRAFT_SESSION_KEY);
    setPrefs(next);
    applyClarityConsent(clarityProjectId, next);
    if (!next.analytics) {
      try {
        Clarity.consentV2({ ad_Storage: "denied", analytics_Storage: "denied" });
      } catch {
        // Ignore.
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-start p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-label="Cookie consent"
        className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
      >
        {!showSettings ? (
          <>
            <h3 className="text-lg font-semibold text-gray-900">We care about your privacy</h3>
            <p className="mt-2 text-sm text-gray-700">
              This website uses cookies needed for the site to work properly and, with your permission, cookies for{" "}
              {hasGoogle ? "analytics" : null}
              {hasGoogle && hasClarity ? " and " : null}
              {hasClarity ? "session insights" : null}
              . By accepting, you agree to store optional cookies on your device as described in our{" "}
              <a className="underline hover:no-underline" href="/cookie-policy" target="_blank" rel="noreferrer">
                Cookie policy
              </a>
              .
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Cookie settings
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Change your cookie preferences for each category of cookies. To find out more, read our{" "}
              <a className="underline hover:no-underline" href="/cookie-policy" target="_blank" rel="noreferrer">
                Cookie policy
              </a>
              .
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Essential cookies</div>
                    <div className="mt-1 text-sm text-gray-700">Required for the website to function.</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-700">Always on</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">Analytics cookies</div>
                    <div className="mt-1 text-sm text-gray-700">Help us understand usage and improve the site.</div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={draftAnalytics}
                      onChange={(e) => setDraftAnalytics(e.target.checked)}
                    />
                    On
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">Advertising cookies</div>
                    <div className="mt-1 text-sm text-gray-700">
                      Help us and our trusted partners serve personalized ads and measure performance.
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={draftAdvertising}
                      onChange={(e) => setDraftAdvertising(e.target.checked)}
                    />
                    On
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={confirmSelected}
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
