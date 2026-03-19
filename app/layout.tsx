import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GOOGLE_TAG_ID = String(process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || "").trim();

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {GOOGLE_TAG_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-tag-manager" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GOOGLE_TAG_ID}');
              `}
            </Script>
          </>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
