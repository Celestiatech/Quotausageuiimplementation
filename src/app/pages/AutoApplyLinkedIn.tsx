import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApplyLinkedIn() {
  return (
    <MarketingInfoPage
      eyebrow="LinkedIn Auto Apply Bot & Copilot"
      title="Free LinkedIn Auto Apply Bot & Easy Apply Automation"
      description="Automate LinkedIn Easy Apply jobs safely with human-paced automation, intelligent screening answer reuse, and real-time application tracking. 100% free to start."
      metrics={[
        { label: "Hours Saved / Week", value: "15+ hrs", note: "Skip manual form clicking" },
        { label: "Form Fill Success Rate", value: "94%", note: "Verified screening answers" },
        { label: "Account Safety", value: "100%", note: "Human pacing guardrails" },
        { label: "Free Daily Applications", value: "Included", note: "No credit card required" },
      ]}
      sections={[
        {
          title: "How the LinkedIn Auto Apply Bot Works",
          description: "Streamline your job search from hours of clicking to 3 automated steps.",
          cards: [
            {
              kicker: "Step 1",
              title: "Install Chrome Extension",
              description:
                "Add the AutoApply CV copilot extension to your browser and connect to your dashboard in seconds.",
            },
            {
              kicker: "Step 2",
              title: "Configure Answer Bank",
              description:
                "Save your work authorization, years of experience, and role preferences once to auto-fill future forms.",
            },
            {
              kicker: "Step 3",
              title: "1-Click Auto Apply",
              description:
                "Navigate to LinkedIn Easy Apply jobs, activate the copilot, and watch it autofill and submit accurately.",
            },
          ],
        },
        {
          title: "Account Safety & Ban Prevention Guardrails",
          description:
            "Unlike dangerous mass-scrapers, AutoApply CV acts as an assisted client-side copilot with built-in safety controls.",
          cards: [
            {
              kicker: "Human Pacing",
              title: "Natural Timing & Pacing",
              description:
                "Simulates natural human form completion with randomized delays to keep your LinkedIn account 100% safe.",
            },
            {
              kicker: "Deduplication",
              title: "Zero Duplicate Applications",
              description:
                "Automatically verifies your application history so you never re-apply to the same company or job ID twice.",
            },
            {
              kicker: "Human-in-the-Loop",
              title: "Auto-Pause & Review",
              description:
                "Pauses whenever an unexpected custom question arises, letting you confirm answers before submitting.",
            },
          ],
        },
        {
          title: "Frequently Asked Questions",
          description:
            "Everything you need to know about using a LinkedIn auto apply bot for your job hunt.",
          bullets: [
            "Is there a free LinkedIn auto apply bot? Yes, AutoApply CV is free to start with generous daily application credits.",
            "Will LinkedIn ban my account? No. The copilot operates inside your active browser session with realistic delays and human-like interactions.",
            "How does the bot answer screening questions? It matches questions against your verified answer bank (experience, salary, visa, notice period).",
            "Can I track my submitted applications? Yes, all applications, statuses, timestamps, and job links sync to your unified dashboard.",
          ],
        },
      ]}
      ctaTitle="Start applying with the LinkedIn auto apply bot today"
      ctaDescription="Join thousands of job seekers saving 15+ hours every week. Free to start, no credit card required."
      primaryAction={{ label: "Sign up free", to: "/signup" }}
      secondaryAction={{ label: "View all features", to: "/features" }}
    />
  );
}

