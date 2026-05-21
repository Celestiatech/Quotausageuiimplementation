"use client";

import { useEffect } from "react";
import {
  CONSENT_CHANGED_EVENT,
  defaultConsentPreferences,
  readConsentPreferences,
  type ConsentPreferences,
} from "./cookieConsent";

type ConsentModeValue = "granted" | "denied";

function toConsentModeValue(enabled: boolean): ConsentModeValue {
  return enabled ? "granted" : "denied";
}

function applyConsent(prefs: ConsentPreferences | null) {
  if (typeof window === "undefined") return;

  const effective = prefs ?? defaultConsentPreferences();

  // Ensure gtag is available as a queue even before GA loads.
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag =
    w.gtag ||
    function gtag(...args: unknown[]) {
      w.dataLayer?.push(args);
    };

  w.gtag("consent", "update", {
    ad_storage: toConsentModeValue(effective.ad_storage),
    ad_user_data: toConsentModeValue(effective.ad_user_data),
    ad_personalization: toConsentModeValue(effective.ad_personalization),
    analytics_storage: toConsentModeValue(effective.analytics_storage),
    functionality_storage: toConsentModeValue(effective.functionality_storage),
    personalization_storage: toConsentModeValue(effective.personalization_storage),
    security_storage: toConsentModeValue(effective.security_storage),
  });
}

export default function GoogleConsentMode() {
  useEffect(() => {
    applyConsent(readConsentPreferences());
    const handler = () => applyConsent(readConsentPreferences());
    window.addEventListener(CONSENT_CHANGED_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return null;
}

