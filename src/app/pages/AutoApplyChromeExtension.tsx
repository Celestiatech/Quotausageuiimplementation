import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApplyChromeExtension() {
  return (
    <MarketingInfoPage
      eyebrow="Chrome Extension"
      title="Free auto apply Chrome extension workflow"
      description="Free to start. Use the AutoApply CV extension to streamline your auto apply workflow with synced answers, tracking, and guardrails."
      sections={[
        {
          title: "What the extension helps with",
          bullets: [
            "Sync your screening answers from the dashboard to the browser.",
            "Reduce repeat manual edits with an answers bank.",
            "Skip duplicates and external apply forms when configured.",
            "Send outcomes back to your dashboard for tracking.",
          ],
        },
        {
          title: "Troubleshooting",
          bullets: [
            "If quota shows 401, sign in again and refresh the dashboard.",
            "If a form fails, check required fields (date/number formats, uploads).",
            "If pages are slow, close extra tabs and try again.",
          ],
        },
      ]}
      ctaTitle="Start free with the extension"
      ctaDescription="Create an account, complete onboarding, and run your first auto apply flow."
      primaryAction={{ label: "Sign up free", to: "/signup" }}
      secondaryAction={{ label: "Help center", to: "/help-center" }}
    />
  );
}

