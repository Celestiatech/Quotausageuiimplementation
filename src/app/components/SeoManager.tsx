import { useEffect } from "react";
import { useLocation } from "react-router";

type SeoEntry = {
  title: string;
  description: string;
  index: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const DEFAULT_SEO: SeoEntry = {
  title: "CareerPilot | LinkedIn Auto Apply Bot & AI Job Search Tool",
  description:
    "CareerPilot is an AI job search automation platform with a LinkedIn auto apply bot, AI resume builder, and job application tracker.",
  index: true,
};

const SEO_BY_PATH: Record<string, SeoEntry> = {
  "/": {
    title: "CareerPilot | LinkedIn Auto Apply Bot for Software Engineers",
    description:
      "Apply to LinkedIn jobs automatically with CareerPilot. Use AI resume builder tools, ATS resume optimization, and a job application tracker in one place.",
    index: true,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "CareerPilot",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "AI job search automation platform with LinkedIn auto apply, resume optimization, and job application tracking."
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "CareerPilot",
        url: "https://careerpilot.com"
      }
    ],
  },
  "/features": {
    title: "AI Resume Builder, Job Tracker & Auto Apply Features | CareerPilot",
    description:
      "Explore job search automation features: LinkedIn easy apply bot workflows, AI resume tailoring, interview preparation AI, and application analytics.",
    index: true,
  },
  "/how-it-works": {
    title: "How CareerPilot Auto Apply Works | CareerPilot",
    description:
      "See how to set up CareerPilot, auto apply to jobs, optimize ATS resumes, and track every step with a job application tracker.",
    index: true,
  },
  "/pricing": {
    title: "Pricing | LinkedIn Auto Apply Bot Plans | CareerPilot",
    description:
      "Compare CareerPilot pricing for LinkedIn auto apply bot usage, AI resume optimization, interview prep AI, and job search automation limits.",
    index: true,
  },
  "/about": {
    title: "About | CareerPilot",
    description:
      "Learn about the CareerPilot mission to help job seekers land better opportunities faster.",
    index: true,
  },
  "/faq": {
    title: "FAQ | LinkedIn Auto Apply Bot Questions | CareerPilot",
    description:
      "Get answers about LinkedIn easy apply bot behavior, auto apply limits, AI resume builder features, and job search automation setup.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is CareerPilot a LinkedIn auto apply bot?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "CareerPilot includes LinkedIn easy apply automation with controls to keep users in charge of their applications."
          }
        },
        {
          "@type": "Question",
          name: "Do you include a job application tracker?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. CareerPilot includes a job application tracker for organizing roles, stages, notes, and interview status."
          }
        },
        {
          "@type": "Question",
          name: "Can I use CareerPilot as an AI resume builder?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. CareerPilot helps tailor resume content to job descriptions and improve ATS keyword alignment."
          }
        }
      ]
    },
  },
  "/blog": {
    title: "Job Search Automation Blog | CareerPilot",
    description:
      "Read guides on LinkedIn auto apply, AI resume builder strategy, ATS optimization, and job application tracking.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "CareerPilot Blog",
      description: "Guides about AI job search automation and LinkedIn auto apply workflows."
    },
  },
  "/blog/lazyapply-alternative": {
    title: "LazyApply Alternative for Better Results | CareerPilot Blog",
    description:
      "Looking for a LazyApply alternative? Compare automation quality, ATS resume optimization, and tracking for better interviews.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "LazyApply Alternative: What to Pick for Better Interview Results",
      description:
        "A practical comparison guide for users evaluating LazyApply alternatives and LinkedIn auto apply workflows.",
      author: {
        "@type": "Organization",
        name: "CareerPilot"
      }
    },
  },
  "/blog/best-ai-job-search-tools": {
    title: "Best AI Job Search Tools in 2026 | CareerPilot Blog",
    description:
      "A practical list of the best AI job search tools and what to evaluate for resumes, automation, and interviews.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Best AI Job Search Tools in 2026: Practical Picks for Engineers",
      description:
        "How to evaluate AI job search tools for ATS alignment, application quality, and interview conversion.",
      author: {
        "@type": "Organization",
        name: "CareerPilot"
      }
    },
  },
  "/blog/linkedin-easy-apply-does-it-work": {
    title: "LinkedIn Easy Apply: Does It Work? | CareerPilot Blog",
    description:
      "See when LinkedIn Easy Apply works, why applications fail, and how to improve callbacks with resume and targeting changes.",
    index: true,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "LinkedIn Easy Apply: Does It Work for Software Engineers?",
      description:
        "Guidance on improving LinkedIn Easy Apply results with tailored resumes and better targeting.",
      author: {
        "@type": "Organization",
        name: "CareerPilot"
      }
    },
  },
  "/login": {
    title: "Login | CareerPilot",
    description: "Login to your CareerPilot account.",
    index: false,
  },
  "/signup": {
    title: "Sign Up | CareerPilot",
    description: "Create your CareerPilot account.",
    index: false,
  },
  "/admin/login": {
    title: "Admin Login | CareerPilot",
    description: "Admin access portal for CareerPilot platform operations.",
    index: false,
  },
};

function upsertMetaByName(name: string, content: string) {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let tag = document.head.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function upsertStructuredData(data?: Record<string, unknown> | Array<Record<string, unknown>>) {
  const id = "careerpilot-structured-data";
  const existing = document.getElementById(id);
  if (!data) {
    if (existing) existing.remove();
    return;
  }

  const payload = Array.isArray(data) ? data : [data];
  const script = existing ?? document.createElement("script");
  script.setAttribute("type", "application/ld+json");
  script.setAttribute("id", id);
  script.textContent = JSON.stringify(payload.length === 1 ? payload[0] : payload);
  if (!existing) {
    document.head.appendChild(script);
  }
}

function resolveSeo(pathname: string): SeoEntry {
  if (SEO_BY_PATH[pathname]) return SEO_BY_PATH[pathname];
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    return {
      title: "CareerPilot Dashboard",
      description: "Private dashboard area.",
      index: false,
    };
  }
  return DEFAULT_SEO;
}

export function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const seo = resolveSeo(location.pathname);
    const baseUrl =
      ((import.meta as any).env?.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, "") ||
      window.location.origin;
    const canonical = `${baseUrl}${location.pathname}`;

    document.title = seo.title;
    upsertMetaByName("description", seo.description);
    upsertMetaByName("robots", seo.index ? "index,follow" : "noindex,nofollow");
    upsertMetaByProperty("og:type", "website");
    upsertMetaByProperty("og:title", seo.title);
    upsertMetaByProperty("og:description", seo.description);
    upsertMetaByProperty("og:url", canonical);
    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", seo.title);
    upsertMetaByName("twitter:description", seo.description);
    upsertCanonical(canonical);
    upsertStructuredData(seo.structuredData);
  }, [location.pathname]);

  return null;
}

