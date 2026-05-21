"use client";

import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import Clarity from "@microsoft/clarity";
import {
  CONSENT_CHANGED_EVENT,
  EDIT_CONSENT_EVENT,
  readConsentPreferences,
  type ConsentPreferences,
} from "./cookieConsent";

function applyClarityConsent(projectId: string, prefs: ConsentPreferences | null) {
  const id = String(projectId || "").trim();
  if (!id) return;
  if (typeof window === "undefined") return;

  if (!prefs?.analytics_storage) return;

  try {
    Clarity.init(id);
    Clarity.consentV2({ ad_Storage: "denied", analytics_Storage: "granted" });
  } catch {
    // Ignore; Clarity is non-critical.
  }
}

export default function AnalyticsScripts({
  googleTagId,
  clarityProjectId,
}: {
  googleTagId: string;
  clarityProjectId: string;
}) {
  const [prefs, setPrefs] = useState<ConsentPreferences | null>(null);

  const hasAnyTracking = useMemo(() => {
    return Boolean(String(googleTagId || "").trim() || String(clarityProjectId || "").trim());
  }, [clarityProjectId, googleTagId]);

  useEffect(() => {
    if (!hasAnyTracking) return;
    const current = readConsentPreferences();
    setPrefs(current);
    applyClarityConsent(clarityProjectId, current);
  }, [clarityProjectId, hasAnyTracking]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasAnyTracking) return;
    const handler = () => setPrefs(readConsentPreferences());
    window.addEventListener(CONSENT_CHANGED_EVENT, handler);
    window.addEventListener(EDIT_CONSENT_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, handler);
      window.removeEventListener(EDIT_CONSENT_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [hasAnyTracking]);

  if (!hasAnyTracking) return null;
  if (!prefs?.analytics_storage) return null;

  const normalizedGoogleTagId = String(googleTagId || "").trim();

  return (
    <>
      {normalizedGoogleTagId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${normalizedGoogleTagId}`} strategy="afterInteractive" />
          <Script id="google-tag" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${normalizedGoogleTagId}');
            `}
          </Script>
        </>
      ) : null}
    </>
  );
}
