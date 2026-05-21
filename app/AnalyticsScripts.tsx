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

  if (!prefs?.analytics) return;

  try {
    Clarity.init(id);
    Clarity.consentV2({ ad_Storage: "denied", analytics_Storage: "granted" });
  } catch {
    // Ignore; Clarity is non-critical.
  }
}

export default function AnalyticsScripts({
  googleTagId,
  gtmId,
  clarityProjectId,
}: {
  googleTagId: string;
  gtmId: string;
  clarityProjectId: string;
}) {
  const [prefs, setPrefs] = useState<ConsentPreferences | null>(null);

  const hasAnyTracking = useMemo(() => {
    return Boolean(String(googleTagId || "").trim() || String(gtmId || "").trim() || String(clarityProjectId || "").trim());
  }, [clarityProjectId, googleTagId, gtmId]);

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
  if (!prefs?.analytics) return null;

  const normalizedGoogleTagId = String(googleTagId || "").trim();
  const normalizedGtmId = String(gtmId || "").trim();

  return (
    <>
      {normalizedGtmId ? (
        <>
          <Script id="gtm-init" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${normalizedGtmId}');
            `}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${normalizedGtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      ) : null}

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
