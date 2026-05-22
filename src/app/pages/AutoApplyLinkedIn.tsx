import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function AutoApplyLinkedIn() {
  return (
    <MarketingInfoPage
      eyebrow="Auto Apply LinkedIn"
      title="Free auto apply LinkedIn workflow (quality-first)"
      description="Free to start. Use Easy Apply targeting, a reusable answers bank, and pacing rules to auto apply on LinkedIn without burning your daily limit on low-fit roles."
      sections={[
        {
          title: "Setup checklist",
          bullets: [
            "Complete your profile basics (title, location, work authorization).",
            "Upload a clean ATS-friendly PDF resume.",
            "Enable Easy Apply-only to reduce external apply failures.",
            "Save common screening answers once and reuse them.",
          ],
        },
        {
          title: "Best practices for better callbacks",
          bullets: [
            "Apply to fewer roles with higher match; quality beats volume.",
            "Refresh resume keywords weekly from the top roles you target.",
            "Track skip reasons and fix the top blocker first.",
            "Use a short networking message for high-priority roles.",
          ],
        },
        {
          title: "FAQ",
          bullets: [
            "Does LinkedIn auto apply work? Yes, when you target the right roles and keep resume + answers consistent.",
            "What about external apply jobs? Skip them for automation and handle manually when needed.",
          ],
        },
      ]}
      ctaTitle="Auto apply on LinkedIn for free to start"
      ctaDescription="Create an account, connect the workflow, and start with a quality-first approach."
      primaryAction={{ label: "Sign up free", to: "/signup" }}
      secondaryAction={{ label: "How it works", to: "/how-it-works" }}
    />
  );
}

