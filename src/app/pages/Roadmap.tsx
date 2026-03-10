import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Roadmap() {
  return (
    <MarketingInfoPage
      eyebrow="Roadmap"
      title="What we are shipping next"
      description="The roadmap focuses on reliability, smarter fit scoring, and better workflow speed for serious job seekers."
      metrics={[
        { label: "Cadence", value: "Weekly updates" },
        { label: "Focus", value: "Reliability + quality" },
        { label: "Now", value: "v1.1.x hardening" },
      ]}
      sections={[
        {
          title: "Now in progress",
          cards: [
            {
              kicker: "Reliability",
              title: "Smarter LinkedIn page-state handling",
              description: "Reduce refresh loops and sticky job state issues on long runs across paginated search results.",
            },
            {
              kicker: "Validation",
              title: "Field-level error feedback",
              description: "Push exact validation messages from Easy Apply into dashboard answer flows for faster correction.",
            },
            {
              kicker: "Sync",
              title: "Cross-surface preference consistency",
              description: "Keep dashboard, extension, and active run settings aligned for search term + location behavior.",
            },
          ],
        },
        {
          title: "Next up",
          cards: [
            {
              kicker: "Targeting",
              title: "Better role-fit ranking",
              description: "Improve ranking of jobs by skill/experience overlap to prioritize stronger applications first.",
            },
            {
              kicker: "Workflow",
              title: "Saved strategy presets",
              description: "Store reusable search + filter strategies for different role tracks and geographies.",
            },
            {
              kicker: "Reporting",
              title: "Weekly performance digest",
              description: "Get summary insights for submitted, skipped reasons, and interview conversion trend.",
            },
          ],
        },
        {
          title: "Planned",
          bullets: [
            "Team workspace improvements for coach-led workflows.",
            "Extended interview preparation module with targeted question packs.",
            "Public API endpoints for external reporting and automation hooks.",
          ],
        },
      ]}
      ctaTitle="Want to influence the roadmap?"
      ctaDescription="Share the most painful workflow blockers and we will prioritize based on user impact."
      primaryAction={{ label: "Contact Product Team", to: "/contact" }}
      secondaryAction={{ label: "Join Community", to: "/community" }}
    />
  );
}
