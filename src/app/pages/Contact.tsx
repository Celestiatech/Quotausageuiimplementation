import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Contact() {
  return (
    <MarketingInfoPage
      eyebrow="Contact"
      title="Reach the right team quickly"
      description="Use the best channel below and include your account email + relevant job ID/run timestamp so we can diagnose issues faster."
      metrics={[
        { label: "Support response", value: "< 24h on business days" },
        { label: "Priority", value: "Paid users get queue priority" },
        { label: "Coverage", value: "Product, billing, technical support" },
      ]}
      sections={[
        {
          title: "Support channels",
          cards: [
            {
              kicker: "General support",
              title: "help@autoapplycv.in",
              description: "Account access, run behavior, answer sync, and dashboard questions.",
            },
            {
              kicker: "Billing",
              title: "billing@autoapplycv.in",
              description: "Plan changes, invoices, top-up questions, and transaction support.",
            },
            {
              kicker: "Partnerships",
              title: "partners@autoapplycv.in",
              description: "Coach workflows, collaboration opportunities, and integration inquiries.",
            },
          ],
        },
        {
          title: "When reporting automation issues, include",
          bullets: [
            "Extension version and browser version.",
            "A short log export or last 20 run log lines.",
            "The exact LinkedIn URL where behavior diverged.",
            "Whether the issue happened in jobs search or jobs view flow.",
          ],
        },
      ]}
      ctaTitle="Need quick self-service help first?"
      ctaDescription="Most setup and run-flow questions are already documented."
      primaryAction={{ label: "Open Help Center", to: "/help-center" }}
      secondaryAction={{ label: "Read FAQ", to: "/faq" }}
    />
  );
}
