export type StaticBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  keywordsJson: string[];
  publishedAt: string;
  createdAt: string;
  author: { name: string };
  contentHtml: string;
};

const AUTHOR = { name: "AutoApply CV Team" };

function isoDate(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

function post(input: Omit<StaticBlogPost, "id" | "createdAt" | "publishedAt" | "author"> & { daysAgo: number }) {
  const createdAt = isoDate(input.daysAgo + 2);
  const publishedAt = isoDate(input.daysAgo);
  return {
    id: `static_${input.slug}`,
    author: AUTHOR,
    createdAt,
    publishedAt,
    ...input,
  };
}

const COVERS = [
  "/blog/covers/auto-apply-1.svg",
  "/blog/covers/auto-apply-2.svg",
  "/blog/covers/auto-apply-3.svg",
  "/blog/covers/auto-apply-4.svg",
  "/blog/covers/auto-apply-5.svg",
];

function coverFor(i: number) {
  return COVERS[i % COVERS.length];
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugToPretty(slug: string) {
  return slug.replaceAll("-", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function blogIntro(title: string, primaryKeyword: string) {
  const safeTitle = escapeHtml(title);
  const safeKeyword = escapeHtml(primaryKeyword);
  return `<p><strong>${safeTitle}</strong> is a practical guide for <strong>${safeKeyword}</strong>. Free to start: focus on quality-first targeting, resume alignment, and tracking.</p>`;
}

function toolCriteriaSection() {
  return `
    <h2>How to evaluate auto apply tools (the short checklist)</h2>
    <ul>
      <li><strong>Targeting:</strong> can you filter by title, level, location, and “Easy Apply only”?</li>
      <li><strong>Quality controls:</strong> does it skip duplicates and avoid external apply loops?</li>
      <li><strong>Answer reuse:</strong> does it store common screening answers and prevent repeated manual edits?</li>
      <li><strong>Tracking:</strong> can you see submitted vs skipped vs failed outcomes (and why)?</li>
      <li><strong>Pacing:</strong> does it help you avoid blasting low-fit roles too fast?</li>
    </ul>
  `;
}

function generateComparisonListHtml(title: string) {
  const safeTitle = escapeHtml(title);
  return `
    <h2>${safeTitle}: recommended shortlist (quality-first)</h2>
    <p>Instead of “#1” claims, use the checklist above and pick what matches your workflow. Here’s a practical shortlist by approach:</p>
    <ol>
      <li><strong>AutoApply CV (Recommended for quality-first auto apply):</strong> targeting rules + reusable answers + clear tracking.</li>
      <li><strong>Manual Easy Apply with saved answers:</strong> slower, but maximum control.</li>
      <li><strong>Job board alerts + quick apply:</strong> good for early-stage exploration, weaker tracking.</li>
      <li><strong>ATS-focused resume tailoring tools:</strong> improves conversion, not submission speed.</li>
      <li><strong>CRM-style trackers:</strong> great visibility, not automation.</li>
    </ol>
    <p>If you want to apply faster <em>and</em> keep quality, start with AutoApply CV + a weekly review of outcomes.</p>
  `;
}

function generateContentHtml(input: { title: string; slug: string; keywords: string[] }) {
  const primaryKeyword = input.keywords[0] || "auto apply";
  const secondaryKeyword = input.keywords[1] || "auto apply jobs";
  const safePrimary = escapeHtml(primaryKeyword);
  const safeSecondary = escapeHtml(secondaryKeyword);
  const isToolsPost = /\btools?\b/i.test(input.title) || /\btop\b/i.test(input.title) || /\bcomparison\b/i.test(input.title) || /\breviews?\b/i.test(input.title);
  const isLinkedIn = /\blinkedin\b/i.test(input.title) || input.slug.includes("linkedin");
  const isFree = /\bfree\b/i.test(input.title) || input.slug.includes("free");

  const howTo = `
    <h2>Step-by-step: a high-quality auto apply workflow</h2>
    <ol>
      <li><strong>Pick a narrow target:</strong> one role title + level + location rule.</li>
      <li><strong>Align your resume:</strong> add true keywords from target roles (ATS-friendly formatting).</li>
      <li><strong>Prepare answers:</strong> save common screening answers (salary, notice, work auth).</li>
      <li><strong>Apply with guardrails:</strong> prefer Easy Apply; skip external apply when automating.</li>
      <li><strong>Review outcomes weekly:</strong> fix the top skip/fail reason first.</li>
    </ol>
  `;

  const linkedinSection = isLinkedIn
    ? `
      <h2>Auto apply LinkedIn: settings that reduce failures</h2>
      <ul>
        <li>Prefer <strong>Easy Apply-only</strong> when you want reliable automation.</li>
        <li>Keep a clean PDF resume ready (no tables, no weird fonts).</li>
        <li>Use pacing and avoid applying to everything; match quality matters most.</li>
      </ul>
    `
    : "";

  const freeSection = isFree
    ? `
      <h2>Free to start: how to use a daily cap wisely</h2>
      <ul>
        <li>Spend your best applications on high-fit roles (strong match score).</li>
        <li>Skip low-signal roles (wrong seniority/location, unclear requirements).</li>
        <li>Improve conversion by iterating on resume keywords weekly.</li>
      </ul>
    `
    : "";

  const mistakes = `
    <h2>Common mistakes that kill results</h2>
    <ul>
      <li>Applying to low-fit roles just to increase volume.</li>
      <li>Using the same resume for unrelated job families.</li>
      <li>Not tracking skip/fail reasons (so the same blocker repeats).</li>
      <li>Automating external apply pages without guardrails.</li>
    </ul>
  `;

  const faq = `
    <h2>FAQ</h2>
    <p><strong>What is “${safePrimary}”?</strong> It’s a workflow that helps you apply faster with automation, while keeping quality controls.</p>
    <p><strong>Is it safe?</strong> It’s safer when you use pacing + targeting and avoid spammy low-fit applications.</p>
    <p><strong>What should I do next?</strong> Start with <a href="/auto-apply">/auto-apply</a> and <a href="/auto-apply-linkedin">/auto-apply-linkedin</a>, then read <a href="/blog">the blog</a> and track outcomes weekly.</p>
  `;

  const toolsContent = isToolsPost ? `${toolCriteriaSection()}${generateComparisonListHtml(input.title)}` : "";

  return `
    ${blogIntro(input.title, primaryKeyword)}
    <p>This post targets <strong>${safePrimary}</strong> and related intent like <strong>${safeSecondary}</strong>. The goal is simple: more submitted applications and more interviews, with fewer wasted runs.</p>
    ${toolsContent}
    ${howTo}
    ${linkedinSection}
    ${freeSection}
    ${mistakes}
    <h2>Helpful internal links</h2>
    <ul>
      <li><a href="/auto-apply">Free Auto Apply guide</a></li>
      <li><a href="/auto-apply-linkedin">Auto Apply LinkedIn</a></li>
      <li><a href="/pricing">Pricing</a></li>
      <li><a href="/signup">Sign up free</a></li>
      <li><a href="/help-center">Help center</a></li>
    </ul>
    ${faq}
  `;
}

export const STATIC_BLOG_POSTS: StaticBlogPost[] = [
  post({
    daysAgo: 1,
    title: "Auto Apply: What It Means (and How to Use It Without Getting Rejected)",
    slug: "auto-apply-meaning-and-best-practices",
    excerpt:
      "A practical guide to the auto apply workflow: what it is, when it works, common failure points, and how to keep quality high while applying faster.",
    coverImage: coverFor(0),
    keywordsJson: ["auto apply", "auto apply jobs", "job search automation"],
    contentHtml: `
      <p><strong>Auto apply</strong> means using automation to submit job applications faster while you stay in control of quality.</p>
      <h2>When auto apply works best</h2>
      <ul>
        <li>Roles with consistent forms (e.g. Easy Apply).</li>
        <li>When your resume is already aligned to the target role.</li>
        <li>When you have a repeatable answers bank for screening questions.</li>
      </ul>
      <h2>Common reasons auto apply fails</h2>
      <ul>
        <li>External apply pages (multi-step redirects).</li>
        <li>Blocked fields (date/number formats, required uploads).</li>
        <li>Low match (wrong seniority/location/stack).</li>
      </ul>
      <h2>Auto apply checklist</h2>
      <ol>
        <li>Pick 1–2 target titles and a location rule.</li>
        <li>Prepare one “core resume” and a lightweight tailored version.</li>
        <li>Save standard answers (salary, notice, work auth).</li>
        <li>Track outcomes (submitted / skipped / failed) and fix blockers.</li>
      </ol>
      <p>Free to start: focus on high-signal roles and improve your resume iteratively.</p>
      <h2>Helpful internal links</h2>
      <ul>
        <li><a href="/auto-apply">Free Auto Apply guide</a></li>
        <li><a href="/auto-apply-linkedin">Auto Apply LinkedIn</a></li>
        <li><a href="/pricing">Pricing</a></li>
        <li><a href="/signup">Sign up free</a></li>
        <li><a href="/help-center">Help center</a></li>
      </ul>
    `,
  }),
  post({
    daysAgo: 2,
    title: "Auto Apply LinkedIn (2026): Setup, Safety, and Best Results",
    slug: "auto-apply-linkedin-setup-safety-results",
    excerpt:
      "Step-by-step LinkedIn auto apply setup, safety guidelines, and practical tips to increase submissions without triggering blocks.",
    coverImage: coverFor(1),
    keywordsJson: ["auto apply linkedin", "linkedin auto apply", "easy apply bot"],
    contentHtml: `
      <p>If you want to rank for <strong>auto apply LinkedIn</strong>, you need a workflow that is fast <em>and</em> consistent.</p>
      <h2>Setup (quick)</h2>
      <ol>
        <li>Complete your profile basics (title, location, work authorization).</li>
        <li>Upload a clean PDF resume with ATS-friendly headings.</li>
        <li>Enable Easy Apply-only to reduce failures.</li>
      </ol>
      <h2>Safety rules</h2>
      <ul>
        <li>Use reasonable pacing.</li>
        <li>Avoid applying to everything; filter for fit.</li>
        <li>Keep a manual review step for sensitive questions.</li>
      </ul>
      <h2>Improve results</h2>
      <ul>
        <li>Target 20–50 roles/week with strong match.</li>
        <li>Refresh keywords in your resume weekly based on top roles.</li>
        <li>Track skip reasons and fix them once.</li>
      </ul>
      <h2>Helpful internal links</h2>
      <ul>
        <li><a href="/auto-apply-linkedin">Auto Apply LinkedIn guide</a></li>
        <li><a href="/auto-apply">Auto Apply workflow</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/signup">Sign up free</a></li>
      </ul>
    `,
  }),
  post({
    daysAgo: 3,
    title: "Free Auto Apply Jobs: A Quality-First Strategy That Actually Gets Interviews",
    slug: "free-auto-apply-jobs-quality-first-strategy",
    excerpt:
      "How to use a free auto apply tool effectively: target selection, resume tailoring, and outcome tracking that improves callbacks over time.",
    coverImage: coverFor(2),
    keywordsJson: ["free auto apply", "auto apply jobs", "apply to jobs automatically"],
    contentHtml: `
      <p>“<strong>Free auto apply</strong>” works best when you treat it like a feedback loop, not a volume hack.</p>
      <h2>Pick a narrow target</h2>
      <p>Choose one primary role title and 3–5 skill keywords. Your match rate will rise immediately.</p>
      <h2>Tailor once, reuse often</h2>
      <p>Keep one strong base resume and swap 3–5 bullet points per job family.</p>
      <h2>Track outcomes</h2>
      <p>Log submitted vs skipped vs failed. Your next improvement should always remove the biggest blocker.</p>
      <h2>FAQ</h2>
      <p><strong>Does free auto apply mean unlimited?</strong> Not always—many tools include daily caps. Use the cap wisely on high-fit roles.</p>
      <h2>Helpful internal links</h2>
      <ul>
        <li><a href="/auto-apply">Free Auto Apply guide</a></li>
        <li><a href="/auto-apply-jobs">Auto Apply Jobs strategy</a></li>
        <li><a href="/pricing">Pricing</a></li>
        <li><a href="/signup">Sign up free</a></li>
      </ul>
    `,
  }),
  post({
    daysAgo: 4,
    title: "Auto Apply vs Easy Apply: What Counts as One Application?",
    slug: "auto-apply-vs-easy-apply-what-counts",
    excerpt:
      "Understand the difference between auto apply and Easy Apply, what gets skipped, and how to avoid wasting daily quota on low-value submissions.",
    coverImage: coverFor(3),
    keywordsJson: ["auto apply", "easy apply", "job application automation"],
    contentHtml: `
      <p><strong>Auto apply</strong> is the automation method; <strong>Easy Apply</strong> is a platform-specific application flow.</p>
      <h2>What usually counts</h2>
      <ul>
        <li>Submitted applications (final confirmation).</li>
        <li>Not skipped due to duplicates or external apply redirects.</li>
      </ul>
      <h2>What should not count</h2>
      <ul>
        <li>Already-applied duplicates.</li>
        <li>Jobs that require external forms if you configured Easy Apply-only.</li>
      </ul>
      <h2>Best practice</h2>
      <p>Optimize for completion quality: fewer, better submissions outperform broad low-fit applications.</p>
      <h2>Helpful internal links</h2>
      <ul>
        <li><a href="/auto-apply-linkedin">Auto Apply LinkedIn</a></li>
        <li><a href="/auto-apply">Auto Apply workflow</a></li>
        <li><a href="/help-center">Help center</a></li>
      </ul>
    `,
  }),
  post({
    daysAgo: 5,
    title: "Auto Apply Resume Tips: ATS Keywords Without Sounding Fake",
    slug: "auto-apply-resume-tips-ats-keywords",
    excerpt:
      "A practical resume approach for auto apply workflows: keyword alignment, formatting, and quick tailoring so applications don’t get filtered out.",
    coverImage: coverFor(4),
    keywordsJson: ["auto apply resume", "ats resume", "resume optimization"],
    contentHtml: `
      <p>Your auto apply success depends heavily on how your resume matches ATS filters.</p>
      <h2>Formatting rules</h2>
      <ul>
        <li>Use simple headings (Experience, Projects, Skills).</li>
        <li>Avoid tables and multi-column layouts for ATS-heavy roles.</li>
        <li>Export to PDF with selectable text.</li>
      </ul>
      <h2>Keyword approach</h2>
      <p>Add keywords where they are true. Prioritize tools, frameworks, and responsibilities that appear in target roles.</p>
      <h2>Quick tailoring</h2>
      <p>Swap 3–5 bullets to mirror the job’s core responsibilities and seniority level.</p>
      <h2>Helpful internal links</h2>
      <ul>
        <li><a href="/auto-apply">Free Auto Apply guide</a></li>
        <li><a href="/features">Features</a></li>
        <li><a href="/signup">Sign up free</a></li>
      </ul>
    `,
  }),
];

// Fill up to 30 posts with variations that target long-tail keywords.
const EXTRA_TITLES: Array<[string, string, string[]]> = [
  ["Auto Apply Bot: How to Evaluate Tools (Speed, Safety, Quality)", "auto-apply-bot-how-to-evaluate-tools", ["auto apply bot", "auto apply", "job automation"]],
  ["Auto Apply Chrome Extension: Setup and Troubleshooting Guide", "auto-apply-chrome-extension-setup-troubleshooting", ["auto apply chrome extension", "auto apply", "chrome extension"]],
  ["Auto Apply for Software Engineers: Best Filters for 2026", "auto-apply-for-software-engineers-best-filters-2026", ["auto apply", "software engineer", "linkedin auto apply"]],
  ["Auto Apply for Freshers: How to Avoid Low-Quality Spam Applications", "auto-apply-for-freshers-avoid-spam", ["auto apply", "freshers", "job search"]],
  ["Auto Apply for Remote Jobs: Location Rules That Increase Responses", "auto-apply-remote-jobs-location-rules", ["auto apply remote jobs", "auto apply", "remote"]],
  ["Auto Apply Tracking: What to Measure Weekly (and Why)", "auto-apply-tracking-what-to-measure", ["auto apply tracking", "job tracker", "analytics"]],
  ["Auto Apply Screening Questions: Create an Answer Bank Once", "auto-apply-screening-questions-answer-bank", ["auto apply", "screening questions", "answer bank"]],
  ["Auto Apply Errors: Fix Date/Number Formats and Required Uploads", "auto-apply-errors-fix-common-form-issues", ["auto apply errors", "application form", "troubleshooting"]],
  ["Auto Apply LinkedIn Headline: Simple Templates That Improve Match", "auto-apply-linkedin-headline-templates", ["auto apply linkedin", "linkedin headline", "job search"]],
  ["Auto Apply Cover Letters: When to Skip vs Generate", "auto-apply-cover-letters-when-to-skip", ["auto apply", "cover letter", "job applications"]],
  ["Auto Apply Networking: The 10-Minute Add-On That Doubles Replies", "auto-apply-networking-10-minute-addon", ["auto apply", "networking", "referrals"]],
  ["Auto Apply Timing: Best Days and Times to Apply (Based on Process)", "auto-apply-timing-best-days-times", ["auto apply", "apply timing", "job search"]],
  ["Auto Apply and Work Authorization: Handling Forms Cleanly", "auto-apply-work-authorization-forms", ["auto apply", "work authorization", "forms"]],
  ["Auto Apply Job Boards: LinkedIn vs Indeed vs Company Sites", "auto-apply-job-boards-linkedin-indeed-company", ["auto apply jobs", "linkedin", "indeed"]],
  ["Auto Apply for Internships: What to Optimize First", "auto-apply-internships-what-to-optimize", ["auto apply", "internships", "resume"]],
  ["Auto Apply for Senior Roles: Quality Controls to Use", "auto-apply-senior-roles-quality-controls", ["auto apply", "senior roles", "quality"]],
  ["Auto Apply with Daily Limits: How to Pick the 3 Best Jobs Today", "auto-apply-daily-limits-pick-best-jobs", ["auto apply", "daily limit", "free"]],
  ["Auto Apply Keywords: How to Choose Skill Tags That Convert", "auto-apply-keywords-how-to-choose-skill-tags", ["auto apply keywords", "ats", "skills"]],
  ["Auto Apply Portfolio: What to Link (and What to Remove)", "auto-apply-portfolio-what-to-link", ["auto apply", "portfolio", "linkedin"]],
  ["Auto Apply FAQ: Top Questions About Automation, Safety, and Results", "auto-apply-faq-automation-safety-results", ["auto apply", "faq", "job automation"]],
  ["Auto Apply for Data Roles: Resume and Filter Tips", "auto-apply-data-roles-resume-filter-tips", ["auto apply", "data analyst", "data engineer"]],
  ["Auto Apply for Product Roles: Keyword Mapping Guide", "auto-apply-product-roles-keyword-mapping", ["auto apply", "product manager", "keywords"]],
  ["Auto Apply for Designers: Portfolio + ATS Tips", "auto-apply-designers-portfolio-ats-tips", ["auto apply", "designer", "portfolio"]],
  ["Auto Apply Rejections: How to Diagnose Low Callback Rates", "auto-apply-rejections-diagnose-callbacks", ["auto apply", "rejections", "callbacks"]],
  ["Top 10 Auto Apply Tools (2026): What to Pick and Why", "top-10-auto-apply-tools-2026", ["top auto apply tools", "auto apply tools", "job search automation"]],
  ["Top 30 Auto Apply Tools List (2026): Categories, Pros, and Cons", "top-30-auto-apply-tools-list-2026", ["top auto apply tools", "auto apply", "best tools"]],
  ["Best Auto Apply Tool for LinkedIn Easy Apply (Shortlist)", "best-auto-apply-tool-for-linkedin-easy-apply", ["best auto apply tool", "auto apply linkedin", "easy apply"]],
  ["Best Free Auto Apply Tools: What’s Actually Free (and What Isn’t)", "best-free-auto-apply-tools-whats-free", ["best free auto apply tools", "free auto apply", "auto apply tools"]],
  ["Auto Apply Tools Comparison: Speed vs Safety vs Quality", "auto-apply-tools-comparison-speed-safety-quality", ["auto apply tools comparison", "auto apply", "job automation"]],
  ["Auto Apply Tools for Engineers: Filters That Matter Most", "auto-apply-tools-for-engineers-filters-that-matter", ["auto apply tools", "software engineer", "auto apply"]],
  ["Auto Apply Tools for Remote Jobs: Avoid Low-Signal Applications", "auto-apply-tools-for-remote-jobs-avoid-low-signal", ["auto apply tools", "remote jobs", "auto apply"]],
  ["Auto Apply Tool Checklist: 12 Features to Require Before You Trust It", "auto-apply-tool-checklist-12-features", ["auto apply tool", "auto apply bot", "checklist"]],
  ["Auto Apply Tool Reviews: How to Read Claims and Verify Results", "auto-apply-tool-reviews-how-to-verify-results", ["auto apply tool reviews", "auto apply tools", "job search"]],
  ["Best Auto Apply Tools for Beginners: Simple Setup, Real Guardrails", "best-auto-apply-tools-for-beginners-simple-setup", ["best auto apply tools", "auto apply", "beginners"]],
];

for (let i = 0; i < EXTRA_TITLES.length; i += 1) {
  const [title, slug, keywords] = EXTRA_TITLES[i];
  STATIC_BLOG_POSTS.push(
    post({
      daysAgo: 6 + i,
      title,
      slug,
      excerpt:
        `Free to start. ${slugToPretty(slug)}: targeting, resume alignment, and tracking to improve auto apply results.`,
      coverImage: coverFor(5 + i),
      keywordsJson: keywords,
      contentHtml: generateContentHtml({ title, slug, keywords }),
    })
  );
}

export const STATIC_BLOG_POSTS_BY_SLUG = Object.fromEntries(
  STATIC_BLOG_POSTS.map((p) => [p.slug, p])
);
