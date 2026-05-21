import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import CookieConsentBanner from "./CookieConsentBanner";
import AnalyticsScripts from "./AnalyticsScripts";
import GoogleConsentMode from "./GoogleConsentMode";

const GOOGLE_TAG_ID = String(process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || "").trim();
const GTM_ID = String(process.env.NEXT_PUBLIC_GTM_ID || "").trim();
const CLARITY_TAG_ID = String(process.env.NEXT_PUBLIC_CLARITY_TAG_ID || "").trim();

function consentModeDefaultsFromCookie(raw: string | undefined) {
  const base = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    personalization_storage: "denied",
    security_storage: "granted",
  } as const;

  const trimmed = String(raw || "").trim();
  if (!trimmed) return base;

  const lower = trimmed.toLowerCase();
  if (lower === "granted" || lower === "accept" || lower === "accepted" || lower === "yes" || lower === "true") {
    return {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
      functionality_storage: "granted",
      personalization_storage: "granted",
      security_storage: "granted",
    } as const;
  }
  if (lower === "denied" || lower === "reject" || lower === "rejected" || lower === "no" || lower === "false") {
    return base;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    // Back-compat with old { analytics, advertising }.
    if (typeof parsed.analytics === "boolean" || typeof parsed.advertising === "boolean") {
      const analytics = Boolean(parsed.analytics);
      const advertising = Boolean(parsed.advertising);
      return {
        ad_storage: advertising ? "granted" : "denied",
        ad_user_data: advertising ? "granted" : "denied",
        ad_personalization: advertising ? "granted" : "denied",
        analytics_storage: analytics ? "granted" : "denied",
        functionality_storage: "granted",
        personalization_storage: advertising ? "granted" : "denied",
        security_storage: "granted",
      } as const;
    }

    const get = (k: string) => (parsed[k] === true ? "granted" : parsed[k] === false ? "denied" : null);
    const ad_storage = get("ad_storage");
    const ad_user_data = get("ad_user_data");
    const ad_personalization = get("ad_personalization");
    const analytics_storage = get("analytics_storage");
    const functionality_storage = get("functionality_storage");
    const personalization_storage = get("personalization_storage");
    const security_storage = get("security_storage");
    if (
      !ad_storage ||
      !ad_user_data ||
      !ad_personalization ||
      !analytics_storage ||
      !functionality_storage ||
      !personalization_storage ||
      !security_storage
    ) {
      return base;
    }
    return {
      ad_storage,
      ad_user_data,
      ad_personalization,
      analytics_storage,
      functionality_storage,
      personalization_storage,
      security_storage,
    } as const;
  } catch {
    return base;
  }
}

export const metadata: Metadata = {
  metadataBase: new URL("https://www.autoapplycv.in"),
  title: "Free Auto Apply CV | AI-Powered Job Application Automation",
  description: "Free auto apply CV tool that automates job applications on LinkedIn and Indeed. Save hours with AI-powered resume matching, smart application tracking, and automated job search. Start applying to hundreds of jobs for free!",
  manifest: "/site.webmanifest",
  keywords: ["free auto apply cv", "free job application automation", "auto apply jobs free", "automated job applications", "LinkedIn auto apply", "Indeed auto apply", "free AI job search", "resume automation free"],
  openGraph: {
    title: "Free Auto Apply CV | Automate Your Job Search",
    description: "Apply to hundreds of jobs automatically for free! AI-powered job application automation for LinkedIn and Indeed. Smart resume matching and application tracking included.",
    type: "website",
    url: "https://www.autoapplycv.in",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Auto Apply CV | AI Job Application Automation",
    description: "Free tool to auto-apply to jobs on LinkedIn & Indeed. Save time with AI-powered automation. Start now!",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const consentCookie = (await cookies()).get("cp_cookie_consent")?.value;
  const consentDefaults = consentModeDefaultsFromCookie(consentCookie);

  return (
    <html lang="en">
      <head>
        <Script id="gtag-consent-default" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', ${JSON.stringify(consentDefaults)}, { wait_for_update: 500 });
          `}
        </Script>
        {GTM_ID ? (
          <Script id="gtm-init" strategy="beforeInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${GTM_ID}');
            `}
          </Script>
        ) : null}
      </head>
      <body>
        <GoogleConsentMode />
        {GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <AnalyticsScripts googleTagId={GOOGLE_TAG_ID} clarityProjectId={CLARITY_TAG_ID} />
        {children}
        <CookieConsentBanner clarityProjectId={CLARITY_TAG_ID} googleTagId={GOOGLE_TAG_ID} gtmId={GTM_ID} />
      </body>
    </html>
  );
}
