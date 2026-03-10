import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function HelpCenter() {
  return (
    <MarketingInfoPage
      eyebrow="Help Center"
      title="Documentation for setup, sync, and run troubleshooting"
      description="Use these guides to configure your profile, extension, and search strategy for stable runs and better submission quality."
      sections={[
        {
          title: "Setup guides",
          cards: [
            {
              kicker: "Start here",
              title: "Extension install + version check",
              description: "Download the current package, load unpacked in Chrome, and verify detected extension version.",
            },
            {
              kicker: "Profile",
              title: "Sync answers from dashboard",
              description: "Save typed answers once and push them to extension settings for reuse in LinkedIn screening fields.",
            },
            {
              kicker: "Preferences",
              title: "Search terms, location, and work mode",
              description: "Configure remote/on-site behavior, date range, and role keywords before starting automation.",
            },
          ],
        },
        {
          title: "Troubleshooting topics",
          cards: [
            {
              kicker: "Validation",
              title: "Red field errors in Easy Apply",
              description: "When LinkedIn rejects an answer, update it from dashboard pending questions and resume.",
            },
            {
              kicker: "Navigation",
              title: "Stuck jobs or repeated pages",
              description: "Use latest extension version and reset runs to avoid stale selected-job search state.",
            },
            {
              kicker: "Sync",
              title: "Pending queue not imported",
              description: "Keep dashboard open once and verify site auth so extension import can flush queued outcomes.",
            },
          ],
        },
      ]}
      ctaTitle="Need help beyond docs?"
      ctaDescription="Share logs + job URL and the support team will help you resolve the exact blocker."
      primaryAction={{ label: "Contact Support", to: "/contact" }}
      secondaryAction={{ label: "Open FAQ", to: "/faq" }}
    />
  );
}
