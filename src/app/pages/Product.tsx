import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Product() {
  return (
    <MarketingInfoPage
      eyebrow="Product"
      title="One platform for high-quality job search execution"
      description="AutoApply CV combines controlled LinkedIn automation, AI resume optimization, and pipeline visibility so you can move faster without lowering application quality."
      metrics={[
        { label: "Workflow", value: "Discovery -> Apply -> Track" },
        { label: "Control", value: "Human-in-the-loop", note: "Pause, review, resume anytime" },
        { label: "Optimization", value: "ATS + role fit" },
        { label: "Coverage", value: "Daily apply planning" },
      ]}
      sections={[
        {
          title: "Core capabilities",
          cards: [
            {
              kicker: "Automation",
              title: "LinkedIn Auto Apply Copilot",
              description: "Execute faster on Easy Apply jobs with guardrails for required questions, resume prompts, and external-apply filtering.",
            },
            {
              kicker: "Resume",
              title: "AI resume tailoring",
              description: "Adapt resume content to job language and role signals so your profile remains relevant to ATS and recruiters.",
            },
            {
              kicker: "Screening",
              title: "Reusable answer bank",
              description: "Capture screening questions once, sync across dashboard + extension, and reduce repeated manual edits.",
            },
            {
              kicker: "Tracking",
              title: "Application pipeline",
              description: "See applied, skipped, and failed outcomes with reasons so you can correct blockers quickly.",
            },
            {
              kicker: "Insights",
              title: "Conversion analytics",
              description: "Monitor submission volume, skip reasons, and interview progress to improve your search strategy weekly.",
            },
            {
              kicker: "Setup",
              title: "Guided install + onboarding",
              description: "Use in-product install tours and profile sync to get from account setup to first applications in minutes.",
            },
          ],
        },
        {
          title: "Designed for consistent quality",
          bullets: [
            "Prefer fit and completion quality over blind high-volume applications.",
            "Keep manual override available at every important workflow step.",
            "Persist settings + search state so runs do not drift into noisy loops.",
            "Surface actionable validation errors directly to the dashboard in real time.",
          ],
        },
      ]}
      ctaTitle="See the full platform flow"
      ctaDescription="Review how setup, automation, and optimization work together before you start your first run."
      primaryAction={{ label: "How It Works", to: "/how-it-works" }}
      secondaryAction={{ label: "View Pricing", to: "/pricing" }}
    />
  );
}
