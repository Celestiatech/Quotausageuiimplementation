import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApply() {
  return (
    <MarketingInfoPage
      eyebrow="Auto Apply"
      title="Free Auto Apply tool for faster job applications"
      description="Free to start. AutoApply CV helps you auto apply to jobs with quality controls: targeting rules, reusable answers, and outcome tracking so you improve callbacks over time."
      metrics={[
        { label: "Cost", value: "Free to start", note: "No credit card required" },
        { label: "Workflow", value: "Target → Apply → Track" },
        { label: "Quality", value: "Guardrails", note: "Skip duplicates + external apply" },
        { label: "Bonus", value: "300 Hires", note: "Signup bonus credits" },
      ]}
      sections={[
        {
          title: "What “auto apply” means",
          description:
            "Auto apply is a job search workflow that uses automation to submit applications faster while you stay in control of fit, pacing, and answers.",
          bullets: [
            "Use filters so you apply to the right roles, not everything.",
            "Reuse a screening answer bank to prevent form errors.",
            "Track submitted vs skipped vs failed outcomes and fix the biggest blocker.",
            "Prefer quality-first submissions for better interview rate.",
          ],
        },
        {
          title: "How AutoApply CV improves results",
          cards: [
            {
              kicker: "Targeting",
              title: "Fit-first filters",
              description: "Choose titles, location rules, and easy-apply-only to reduce wasted runs.",
            },
            {
              kicker: "Answers",
              title: "Reusable answer bank",
              description: "Save common answers once (salary, notice, work auth) and sync across web + extension.",
            },
            {
              kicker: "Tracking",
              title: "Outcome visibility",
              description: "See what submitted and what got skipped (duplicates / external apply / validation errors).",
            },
          ],
        },
        {
          title: "FAQ",
          bullets: [
            "Is AutoApply CV free? Free to start, with a daily cap. Use the cap on high-fit roles for best results.",
            "Is auto apply safe? Use pacing and targeting. Avoid blasting low-fit jobs; prefer consistent Easy Apply flows.",
            "Do I need a cover letter? Not always—use it only when a role truly requires it or when competition is high.",
            "How do I start? Create an account, complete onboarding, and start your first run.",
          ],
        },
      ]}
      ctaTitle="Start free auto apply today"
      ctaDescription="Create your free account and begin applying with quality controls and clear tracking."
      primaryAction={{ label: "Sign up free", to: "/signup" }}
      secondaryAction={{ label: "Read the blog", to: "/blog" }}
    />
  );
}

