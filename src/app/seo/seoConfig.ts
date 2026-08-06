export type SeoEntry = {
  title: string;
  description: string;
  index: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
};

import { STATIC_BLOG_POSTS_BY_SLUG } from "src/content/blogPosts";

export const DEFAULT_SEO: SeoEntry = {
  title: "Free AutoApply CV | LinkedIn Auto Apply Bot & AI Job Search Tool",
  description:
    "AutoApply CV is a free AI job search automation platform with a LinkedIn auto apply bot, AI resume builder, and job application tracker.",
  index: true,
};

export const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AutoApply CV",
  url: "https://www.autoapplycv.in",
  logo: "https://www.autoapplycv.in/favicon-96x96.png",
  sameAs: [],
};

export function normalizeCanonicalBaseUrl(value?: string) {
  const fallback = "https://www.autoapplycv.in";
  const raw = value?.trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw);
    if (url.hostname === "autoapplycv.in") {
      url.hostname = "www.autoapplycv.in";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export const SEO_BY_PATH: Record<string, SeoEntry> = {
  "/": {
    title: "Free AutoApply CV | LinkedIn Auto Apply Bot for Software Engineers",
    description:
      "Apply to LinkedIn jobs automatically with AutoApply CV. Includes page-ready waits, duplicate prevention, AI resume optimization, and full job tracking.",
    index: true,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "AutoApply CV",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "AI job search automation platform with LinkedIn auto apply, resume optimization, and job application tracking.",
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "AutoApply CV",
        url: "https://www.autoapplycv.in",
      },
    ],
  },
  "/features": {
    title: "AI Resume Builder, Job Tracker & Auto Apply Features | AutoApply CV",
    description:
      "Explore job search automation features: LinkedIn easy apply bot workflows, AI resume tailoring, interview preparation AI, and application analytics.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/product": {
    title: "Product Overview | AutoApply CV",
    description:
      "See the complete AutoApply CV platform: LinkedIn automation workflows, AI resume optimization, and application tracking.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/how-it-works": {
    title: "How AutoApply CV Auto Apply Works | AutoApply CV",
    description:
      "See how to set up AutoApply CV with page-ready submission checks, dashboard answer sync, ATS resume optimization, and pipeline tracking.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/pricing": {
    title: "Pricing | LinkedIn Auto Apply Bot Plans | AutoApply CV",
    description:
      "Compare transparent AutoApply CV pricing with clear charged vs skipped outcomes, LinkedIn automation limits, and AI resume optimization tools.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/auto-apply": {
    title: "Auto Apply | Free Auto Apply Tool | AutoApply CV",
    description:
      "Free auto apply tool to apply faster with quality controls, reusable answers, and tracking. Learn how to auto apply without wasting applications.",
    index: true,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "AutoApply CV",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "Free auto apply tool with LinkedIn automation, resume optimization, and application tracking.",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is AutoApply CV free?",
            acceptedAnswer: { "@type": "Answer", text: "AutoApply CV is free to start and includes a daily cap for applications." },
          },
          {
            "@type": "Question",
            name: "What is auto apply?",
            acceptedAnswer: { "@type": "Answer", text: "Auto apply is a workflow that uses automation to submit job applications faster while maintaining quality controls." },
          },
        ],
      },
    ],
  },
  "/auto-apply-linkedin": {
    title: "Auto Apply LinkedIn | Free LinkedIn Auto Apply | AutoApply CV",
    description:
      "Free to start: learn how to auto apply on LinkedIn using Easy Apply targeting, reusable answers, and tracking for better callbacks.",
    index: true,
  },
  "/auto-apply-jobs": {
    title: "Auto Apply Jobs | Free Auto Apply Jobs Strategy | AutoApply CV",
    description:
      "Free to start: a quality-first auto apply jobs strategy with targeting rules, resume alignment, and outcome tracking.",
    index: true,
  },
  "/auto-apply-chrome-extension": {
    title: "Auto Apply Chrome Extension | Free Auto Apply Extension | AutoApply CV",
    description:
      "Free to start: use the AutoApply CV Chrome extension workflow to streamline auto apply with synced answers and tracking.",
    index: true,
  },
  "/about": {
    title: "About | AutoApply CV",
    description:
      "Learn how AutoApply CV helps job seekers automate LinkedIn applications, optimize resumes for ATS, and track every job to land interviews faster.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/faq": {
    title: "FAQ | LinkedIn Auto Apply Bot Questions | AutoApply CV",
    description:
      "Get answers about LinkedIn easy apply bot behavior, auto apply limits, AI resume builder features, and job search automation setup.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is AutoApply CV a LinkedIn auto apply bot?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AutoApply CV includes LinkedIn easy apply automation with controls to keep users in charge of their applications.",
          },
        },
        {
          "@type": "Question",
          name: "Do you include a job application tracker?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. AutoApply CV includes a job application tracker for organizing roles, stages, notes, and interview status.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use AutoApply CV as an AI resume builder?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. AutoApply CV helps tailor resume content to job descriptions and improve ATS keyword alignment.",
          },
        },
      ],
    },
  },
  "/roadmap": {
    title: "Roadmap | AutoApply CV",
    description:
      "See the AutoApply CV roadmap with upcoming improvements to run reliability, LinkedIn automation quality, reporting, and resume AI features.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/careers": {
    title: "Careers | AutoApply CV",
    description:
      "Explore open roles at AutoApply CV and help build reliable LinkedIn automation, AI resume tools, and job search workflows that modern candidates trust.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/contact": {
    title: "Contact | AutoApply CV",
    description:
      "Get help from the AutoApply CV team for product questions, billing issues, and LinkedIn automation troubleshooting - we respond fast.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/press-kit": {
    title: "Press Kit | AutoApply CV",
    description:
      "Download the AutoApply CV press kit with company summary, product facts, screenshots, and media contact details for journalists and partners.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/help-center": {
    title: "Help Center | AutoApply CV",
    description:
      "Browse AutoApply CV help center guides for account setup, extension sync, LinkedIn auto apply troubleshooting, and dashboard how-tos.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/community": {
    title: "Community | AutoApply CV",
    description:
      "Join the AutoApply CV community to share LinkedIn auto apply strategies, resume tips, and tracking workflows that improve application quality.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/privacy-policy": {
    title: "Privacy Policy | AutoApply CV",
    description:
      "Read the AutoApply CV privacy policy to understand how we collect, use, and protect your data across the app and LinkedIn Chrome extension.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/terms-of-service": {
    title: "Terms of Service | AutoApply CV",
    description:
      "Review the AutoApply CV terms of service covering account use, LinkedIn automation, paid plans, and acceptable use of the platform.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/cookie-policy": {
    title: "Cookie Policy | AutoApply CV",
    description:
      "Learn how cookies and browser storage are used across AutoApply CV, including analytics, consent settings, and how to manage your preferences.",
    index: true,
    structuredData: ORGANIZATION_SCHEMA,
  },
  "/blog": {
    title: "Job Search Automation Blog | AutoApply CV",
    description:
      "Read guides on LinkedIn auto apply, AI resume builder strategy, ATS optimization, and job application tracking.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "AutoApply CV Blog",
      description: "Guides about AI job search automation and LinkedIn auto apply workflows.",
    },
  },
  "/blog/lazyapply-alternative": {
    title: "LazyApply Alternative for Better Results | AutoApply CV Blog",
    description:
      "Looking for a LazyApply alternative? Compare automation quality, ATS resume optimization, and tracking for better interviews.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "LazyApply Alternative: What to Pick for Better Interview Results",
      description:
        "A practical comparison guide for users evaluating LazyApply alternatives and LinkedIn auto apply workflows.",
      author: { "@type": "Organization", name: "AutoApply CV" },
    },
  },
  "/blog/best-ai-job-search-tools": {
    title: "Best AI Job Search Tools for 2026 | AutoApply CV Blog",
    description:
      "Compare AI job search tools for engineers: automation quality, resume tailoring, tracking, and practical guardrails that prevent wasted applications.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Best AI Job Search Tools for Engineers (2026)",
      description: "A comparison of AI job search tools and automation workflows for engineers.",
      author: { "@type": "Organization", name: "AutoApply CV" },
    },
  },
  "/blog/linkedin-easy-apply-does-it-work": {
    title: "LinkedIn Easy Apply: Does It Work? | AutoApply CV Blog",
    description:
      "See when LinkedIn Easy Apply works, why applications fail, and how to improve callbacks with resume and targeting changes.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "LinkedIn Easy Apply: Does It Work for Software Engineers?",
      description: "Guidance on improving LinkedIn Easy Apply results with tailored resumes and better targeting.",
      author: { "@type": "Organization", name: "AutoApply CV" },
    },
  },
  "/login": {
    title: "Login | AutoApply CV",
    description:
      "Log in to your AutoApply CV account to run LinkedIn auto apply workflows, build AI-optimized resumes, and track your job applications.",
    index: true,
  },
  "/signup": {
    title: "Sign Up | AutoApply CV",
    description:
      "Create your free AutoApply CV account to start automating LinkedIn applications, optimizing your resume for ATS, and tracking every job.",
    index: true,
  },
  "/admin/login": {
    title: "Admin Login | AutoApply CV",
    description: "Admin access portal for AutoApply CV platform operations.",
    index: true,
  },
};

export function resolveSeo(pathname: string): SeoEntry {
  if (pathname === "/blog") {
    return {
      title: "Free Auto Apply Blog | AutoApply CV",
      description:
        "Free auto apply guides, LinkedIn Easy Apply workflows, AI resume optimization, ATS tips, and job tracking tactics that get more interviews.",
      index: true,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "AutoApply CV Blog",
        description: "Free auto apply guides and job search automation content.",
      },
    };
  }

  if (pathname.startsWith("/blog/")) {
    const slug = pathname.replace("/blog/", "").trim().toLowerCase();
    const post = STATIC_BLOG_POSTS_BY_SLUG[slug];
    if (post) {
      return {
        title: `${post.title} | AutoApply CV`,
        description: post.excerpt,
        index: true,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt,
          author: { "@type": "Organization", name: "AutoApply CV" },
        },
      };
    }
  }

  const base =
    SEO_BY_PATH[pathname] ||
    (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")
      ? {
          title: "AutoApply CV Dashboard",
          description: "Private dashboard area.",
          index: true,
        }
      : DEFAULT_SEO);

  const shouldAddFree =
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api");

  if (!shouldAddFree) return base;

  const hasFreeTitle = /\bfree\b/i.test(base.title);
  const hasFreeDesc = /\bfree\b/i.test(base.description);

  return {
    ...base,
    title: hasFreeTitle ? base.title : `Free ${base.title}`,
    description: hasFreeDesc ? base.description : `Free to start. ${base.description}`,
  };
}

export function canonicalForPath(pathname: string, baseUrl = "https://www.autoapplycv.in") {
  const normalizedBase = normalizeCanonicalBaseUrl(baseUrl);
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${normalizedBase}${path === "/" ? "" : path}`;
}
