Create a complete, production-grade design system and full website UI for a Next.js product called “AutoApply CV”.

Product:
AutoApply CV is an AI-powered career platform for Software Development Engineers (SDEs) and job seekers. It helps users tailor resumes, match jobs, track applications, prepare for interviews, and improve offer outcomes. It also has B2B use for career coaches/agencies.

Primary outcomes:
- Increase interview callbacks
- Save job search time
- Improve application quality and conversion
- Provide clear progress tracking

Design style direction:
- Modern SaaS (premium, clean, conversion-focused)
- Not generic template UI
- Strong visual hierarchy, high readability
- Bold but professional
- Responsive-first (desktop + tablet + mobile)

Brand foundation:
- Brand name: AutoApply CV
- Tagline: Land Better Jobs, Faster.
- Tone: confident, clear, practical, engineer-friendly
- Personality: intelligent, trustworthy, execution-driven

Color system:
- Primary: Deep Navy
- Accent: Electric Blue
- Secondary accent: Teal/Cyan
- Neutrals: cool grays + soft backgrounds
- Semantic colors: success, warning, error, info
- Ensure WCAG-friendly contrast

Typography:
- Use a modern, distinctive sans-serif (not default system-only look)
- Clear scale for display/headings/body/captions
- Strong heading contrast, readable body text

Spacing & layout:
- 12-column grid desktop
- 8-column tablet
- 4-column mobile
- Consistent spacing tokens (4/8 system)
- Auto-layout ready components

Motion intent:
- Subtle page-load reveals
- Stagger for card grids
- Soft hover states and transitions
- No excessive motion

Deliverables:
1) Full design system (styles + components)
2) Marketing website pages
3) Auth and onboarding flows
4) Product dashboard screens
5) Legal/support pages
6) Mobile-responsive variants
7) Component states (default/hover/focus/error/loading/empty)

=====================================
A) DESIGN SYSTEM (FOUNDATIONS)
=====================================
Create and name reusable tokens:
- Colors (brand, neutral, semantic)
- Typography scale
- Spacing scale
- Radius scale
- Shadows
- Border styles
- Opacity scale
- Z-index/layer conventions

Create component library:
- Buttons: primary, secondary, ghost, destructive, icon, loading
- Inputs: text, email, password, phone, URL, search, textarea
- Select, multiselect, combobox, checkbox, radio, toggle
- Date picker, tags/chips, sliders
- Toasts, alerts, banners
- Modals, drawers, popovers, tooltips
- Tabs, accordions
- Tables, pagination
- Breadcrumbs
- Progress bars, steppers
- Cards (feature, pricing, testimonial, KPI, job card)
- Navigation (top nav, side nav, mobile nav)
- Footer variants
- Empty/error states
- Skeleton/loading states
- Chart containers

=====================================
B) WEBSITE INFORMATION ARCHITECTURE
=====================================
Top-level nav:
- Features
- Solutions
- Pricing
- Success Stories
- Resources
- About
- Login
- CTA: Start Free

Footer:
- Product: Features, Roadmap, Integrations
- Company: About, Careers, Contact, Press
- Resources: Blog, Guides, FAQ, Help Center
- Legal: Privacy Policy, Terms, Cookie Policy
- Social links
- Newsletter signup

=====================================
C) MARKETING PAGES
=====================================

1) Home / Landing
Sections:
- Announcement bar (optional)
- Navbar
- Hero:
  H1: Land Better SDE Roles, Faster.
  Subtext: AI-powered job search, resume tailoring, and application tracking built for engineers.
  Primary CTA: Get Started Free
  Secondary CTA: Watch Demo
  Product visual (dashboard mock)
- Trust logos strip
- Social proof stats (users, callbacks, time saved)
- Features grid (Resume Tailor, Match Score, Tracker CRM, Interview Prep, Insights, Coach Workspace)
- How it works (3-step)
- Persona blocks (Student, Mid-level, Senior, Coach)
- Testimonials (3–6)
- Pricing preview
- FAQ preview
- Final CTA banner
- Footer

2) Features
- Feature hero
- Deep dive sections for each feature:
  - AI Resume Tailor
  - Smart Job Match Score
  - Application Pipeline Tracker
  - Interview Prep Assistant
  - Weekly Analytics
  - Team/Coach collaboration
- Before/after examples
- Integrations strip
- FAQ
- CTA

3) Solutions
- Tabs/segments:
  - Individual Job Seekers
  - Career Coaches
  - Agencies/Bootcamps
- Pain points → outcomes layout
- Workflow examples
- Relevant CTAs

4) Pricing
- Monthly/yearly toggle
- Plans:
  - Free ($0)
  - Pro ($29/mo) [Most Popular]
  - Coach ($149/mo)
- Comparison table
- Feature limits
- Add-ons
- FAQ
- Guarantee/trust messaging

5) Success Stories
- Case study cards
- Filter by role/experience
- Metrics panels (e.g., callback uplift, time-to-interview)
- Detailed story template preview

6) Resources
- Blog index
- Guides/templates
- Resume checklist download block
- Newsletter capture
- Search + category filters

7) About
- Mission
- Founder story
- Values
- Team cards
- Hiring block
- Contact CTA

8) Contact
- Contact form
- Sales/support options
- Response SLA message
- Optional office map card

=====================================
D) AUTH + ONBOARDING FLOWS
=====================================

Pages:
- Sign up
- Login
- Forgot password
- Reset password
- Verify email
- 2FA optional flow

Onboarding multi-step:
1. Profile basics (name, role, location, years exp)
2. Skills and stack
3. Resume upload / LinkedIn import
4. Job preferences (location, role, salary, visa)
5. Goals and cadence
6. Finish setup

Include progress stepper and skip/save states.

=====================================
E) APP DASHBOARD (LOGGED-IN PRODUCT UI)
=====================================

Main shell:
- Left sidebar navigation
- Top bar with search, notifications, profile menu

Screens:
1. Dashboard Overview
- KPI cards
- Job match queue preview
- Application pipeline summary
- Weekly activity chart
- Tasks panel

2. Job Match Queue
- Match score cards
- Filter/sort panel
- Save/reject/apply actions
- Bulk actions

3. Resume Tailor
- Resume versions list
- JD input panel
- AI suggestions panel
- Diff/highlight view
- Export/download actions

4. Application Tracker CRM
- Kanban columns: Saved / Applied / OA / Interview / Offer / Rejected
- Card details drawer
- Reminder and notes

5. Interview Prep
- Question bank
- Mock interview sessions
- Feedback cards
- Prep checklist

6. Analytics
- Callback rate chart
- Funnel chart
- Application velocity
- Skill-gap insights

7. Coach Workspace (B2B)
- Client list
- Client progress dashboards
- Shared templates
- Notes and tasks

8. Settings
- Profile settings
- Notification settings
- Billing
- Integrations
- Data export/delete

=====================================
F) LEGAL + UTILITY PAGES
=====================================
- 404
- 500 error
- Maintenance mode
- Privacy Policy
- Terms of Service
- Cookie preferences
- Changelog
- Status page style

=====================================
G) CONTENT + COPY GUIDELINES
=====================================
- Use concise, outcomes-based copy
- Avoid buzzword fluff
- Use SDE-friendly language
- Headlines should communicate value clearly
- Include realistic placeholder content for all sections

=====================================
H) ACCESSIBILITY REQUIREMENTS
=====================================
- Color contrast compliance
- Visible focus states
- Clear error messaging
- Logical tab order
- Large tap targets on mobile
- Form labels and helper text

=====================================
I) RESPONSIVE REQUIREMENTS
=====================================
For each important page, include:
- Desktop frame
- Tablet frame
- Mobile frame
- Navbar behavior across breakpoints
- Card/section stacking behavior
- Simplified mobile CTAs

=====================================
J) FIGMA FILE ORGANIZATION
=====================================
Create pages in Figma file:
1. Foundations
2. Components
3. Marketing
4. Auth + Onboarding
5. App Dashboard
6. Legal + Utility
7. Prototypes

Naming conventions:
- Use clear component names with variants
- Add notes for interaction behaviors
- Keep reusable blocks as components

Final output expectation:
A complete, cohesive UI kit + full website/app screen set that can be directly used for Next.js frontend implementation.
