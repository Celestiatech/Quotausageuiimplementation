import MarketingInfoPage from "../components/marketing/MarketingInfoPage";

export default function Product() {
  return (
    <MarketingInfoPage
      eyebrow="AutoApply CV Product Suite"
      title="Complete AI Job Search Automation & LinkedIn Apply Bot Platform"
      description="Free to start. AutoApply CV unites powerful LinkedIn Easy Apply automation, intelligent AI resume tailoring, automated recruiter outreach, and centralized application tracking into one seamless workflow."
      metrics={[
        { label: "Core Engine", value: "LinkedIn Auto Apply Bot", note: "Client-side Easy Apply copilot" },
        { label: "Resume Tech", value: "AI ATS Optimization", note: "Real-time keyword tailoring" },
        { label: "Outreach", value: "HR Email Finder", note: "Verified recruiter contacts" },
        { label: "Safety", value: "Human-in-the-Loop", note: "Pause, review & resume anytime" },
      ]}
      sections={[
        {
          title: "Core Platform Features & Tools",
          cards: [
            {
              kicker: "Automation",
              title: "LinkedIn Auto Apply Bot",
              description:
                "Apply to hundreds of LinkedIn Easy Apply jobs automatically with customizable search filters, human typing pacing, and duplicate prevention.",
            },
            {
              kicker: "Resume AI",
              title: "AI Resume Tailoring & ATS Builder",
              description:
                "Automatically adapts your resume bullets and technical skills to match target job descriptions, ensuring maximum pass rates through ATS filters.",
            },
            {
              kicker: "Efficiency",
              title: "Reusable Screening Answer Bank",
              description:
                "Store verified answers to common recruiter questions (years of experience, visa status, notice period) and auto-fill them on every application.",
            },
            {
              kicker: "Tracking",
              title: "Job Application Tracker CRM",
              description:
                "Organize your entire pipeline with Kanban-style boards. Track applied, skipped, interviewing, and offered stages in real time.",
            },
            {
              kicker: "Chrome Extension",
              title: "In-Browser Copilot Extension",
              description:
                "The AutoApply CV extension sits alongside your job search window, providing live feedback, instant autofill, and automatic data synchronization.",
            },
            {
              kicker: "Outreach",
              title: "HR & Recruiter Email Finder",
              description:
                "Discover decision-makers and hiring managers at target companies and send personalized follow-up emails to boost your response rate.",
            },
          ],
        },
        {
          title: "Designed for Safe, High-Converting Job Search Automation",
          bullets: [
            "Quality-First Pacing: Prevents account bans by using randomized human-like delays and mouse movement simulation.",
            "Smart Duplicate Guard: Automatically detects and skips roles you have already submitted to across platforms.",
            "Live Error Detection: Surfaces validation issues immediately and lets you fix answer fields with a single click.",
            "Transparent Conversion Analytics: Track weekly application velocity, callback rates, and interview conversion ratios.",
          ],
        },
      ]}
      ctaTitle="Accelerate your job search with AutoApply CV"
      ctaDescription="Experience how automated job applying, AI resume building, and application tracking transform your career."
      primaryAction={{ label: "Sign Up Free", to: "/signup" }}
      secondaryAction={{ label: "How It Works", to: "/how-it-works" }}
    />
  );
}
