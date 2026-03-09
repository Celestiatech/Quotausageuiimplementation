import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GOOGLE_TAG_ID = "G-L6QMNGGDVH";

export const metadata: Metadata = {
  metadataBase: new URL("https://autoapplycv.in"),
  title: "AutoApply CV",
  description: "AutoApply CV - quota usage and job application UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
      </head>
      <body>{children}</body>
    </html>
  );
}
