import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Careers() {
  return (
    <MarketingInfoPage
      eyebrow="Careers"
      title="Help build the job search platform people trust"
      description="We are building practical automation tools for modern job seekers. If you like shipping product with real user feedback, we should talk."
      metrics={[
        { label: "Work style", value: "Remote-first" },
        { label: "Team model", value: "Small, senior, shipping-focused" },
        { label: "Hiring focus", value: "Product + engineering + growth" },
      ]}
      sections={[
        {
          title: "Why join",
          bullets: [
            "Direct customer impact with short feedback loops.",
            "Ownership over end-to-end product areas, not isolated tickets.",
            "Pragmatic engineering culture focused on reliability and outcomes.",
            "Transparent roadmap prioritization tied to user pain points.",
          ],
        },
        {
          title: "Open roles",
          cards: [
            {
              kicker: "Engineering",
              title: "Frontend Engineer (React + TypeScript)",
              description: "Own UX reliability for public pages and dashboard workflows with production-grade polish.",
            },
            {
              kicker: "Engineering",
              title: "Automation Engineer",
              description: "Improve browser workflow robustness, validation handling, and run-state recovery behavior.",
            },
            {
              kicker: "Product/Growth",
              title: "Product Growth Analyst",
              description: "Drive activation, retention, and conversion improvements using event data and experiment design.",
            },
          ],
        },
      ]}
      ctaTitle="No matching role right now?"
      ctaDescription="Send a short note with your profile and the problem area you want to own."
      primaryAction={{ label: "Contact Hiring Team", to: "/contact" }}
      secondaryAction={{ label: "Read About Us", to: "/about" }}
    />
  );
}
