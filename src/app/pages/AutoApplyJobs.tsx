import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApplyJobs() {
  return (
    <MarketingInfoPage
      eyebrow="Auto Apply Jobs"
      title="Free auto apply jobs strategy that stays high-quality"
      description="Free to start. AutoApply CV helps you auto apply to jobs with guardrails and tracking so you can improve your interview rate instead of blasting random roles."
      sections={[
        {
          title: "A simple 3-step strategy",
          cards: [
            {
              kicker: "1) Target",
              title: "Pick a narrow job family",
              description: "One title + one level + a location rule. This increases relevance and callback rate.",
            },
            {
              kicker: "2) Apply",
              title: "Use a consistent resume",
              description: "Keep a base resume and tailor only a few bullets for the job family.",
            },
            {
              kicker: "3) Track",
              title: "Improve weekly",
              description: "Review submitted/skipped/failed outcomes and fix the biggest blocker first.",
            },
          ],
        },
        {
          title: "FAQ",
          bullets: [
            "Is it really free? Free to start. Use your daily limit on your best-fit roles.",
            "What if an application fails? Fix the form blocker once (date/number formats, required uploads, missing answers).",
          ],
        },
      ]}
      ctaTitle="Start free auto apply jobs"
      ctaDescription="Create your account and begin applying with quality controls and visibility."
      primaryAction={{ label: "Create free account", to: "/signup" }}
      secondaryAction={{ label: "View pricing", to: "/pricing" }}
    />
  );
}

