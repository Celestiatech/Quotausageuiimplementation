import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function PrivacyPolicy() {
  return (
    <MarketingInfoPage
      eyebrow="Privacy Policy"
      title="How AutoApply CV handles your data"
      description="This summary explains what we collect, why we collect it, and the controls you have over your account data."
      metrics={[{ label: "Last updated", value: "March 10, 2026" }]}
      sections={[
        {
          title: "Data we collect",
          bullets: [
            "Account details such as name, email, and authentication metadata.",
            "Profile and screening answers you explicitly save in the product.",
            "Automation outcome logs (applied, skipped, failed) tied to your account.",
            "Billing metadata required for plans, top-ups, and transaction records.",
          ],
        },
        {
          title: "How data is used",
          bullets: [
            "To run requested product workflows and sync your settings to the extension.",
            "To diagnose failed runs, validation errors, and support requests.",
            "To improve platform reliability, analytics, and product experience.",
            "To meet legal, fraud prevention, and billing compliance obligations.",
          ],
        },
        {
          title: "Your controls",
          bullets: [
            "Edit or remove saved answers and profile fields from your dashboard.",
            "Revoke extension-linked data by logging out and clearing extension settings.",
            "Request account deletion by contacting support with your registered email.",
          ],
        },
      ]}
      ctaTitle="Questions about privacy handling?"
      ctaDescription="Contact support and include your account email so we can respond with account-specific guidance."
      primaryAction={{ label: "Contact Support", to: "/contact" }}
      secondaryAction={{ label: "Terms of Service", to: "/terms-of-service" }}
    />
  );
}
