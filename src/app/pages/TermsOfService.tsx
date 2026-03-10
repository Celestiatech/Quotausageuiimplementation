import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function TermsOfService() {
  return (
    <MarketingInfoPage
      eyebrow="Terms of Service"
      title="Usage terms for AutoApply CV"
      description="By using the platform, you agree to responsible use, account security practices, and applicable payment terms."
      metrics={[{ label: "Last updated", value: "March 10, 2026" }]}
      sections={[
        {
          title: "Account responsibilities",
          bullets: [
            "Use accurate information and keep your credentials secure.",
            "You are responsible for actions performed from your account and extension session.",
            "Do not use the service for unlawful, abusive, or deceptive activity.",
          ],
        },
        {
          title: "Platform usage",
          bullets: [
            "Auto-apply tools are provided to improve workflow speed, not to guarantee outcomes.",
            "You should review settings and run behavior before high-volume execution.",
            "We may limit or suspend abusive usage that risks platform integrity.",
          ],
        },
        {
          title: "Billing and plans",
          bullets: [
            "Paid plans, top-ups, and credits follow the pricing shown at checkout.",
            "Usage deductions are based on submitted application actions and plan policy.",
            "Refund and dispute handling follows the applicable billing policy and law.",
          ],
        },
      ]}
      ctaTitle="Need clarification on a specific term?"
      ctaDescription="Contact support with the exact clause or workflow scenario you want clarified."
      primaryAction={{ label: "Contact Support", to: "/contact" }}
      secondaryAction={{ label: "Privacy Policy", to: "/privacy-policy" }}
    />
  );
}
