import { useEffect } from "react";
import { useLocation } from "react-router";

type SeoEntry = {
  title: string;
  description: string;
  index: boolean;
};

const DEFAULT_SEO: SeoEntry = {
  title: "CareerPilot | AI Job Search Copilot",
  description:
    "CareerPilot helps job seekers automate applications, manage resumes, and track outcomes with an AI-assisted dashboard.",
  index: true,
};

const SEO_BY_PATH: Record<string, SeoEntry> = {
  "/": {
    title: "CareerPilot | AI Job Search Copilot",
    description:
      "Automate job applications, optimize your profile, and track your job search in one platform.",
    index: true,
  },
  "/features": {
    title: "Features | CareerPilot",
    description:
      "Explore CareerPilot features: auto-apply workflows, resume tools, interview prep, and analytics.",
    index: true,
  },
  "/how-it-works": {
    title: "How It Works | CareerPilot",
    description:
      "See how CareerPilot works from onboarding to automated applications and job pipeline tracking.",
    index: true,
  },
  "/pricing": {
    title: "Pricing | CareerPilot",
    description:
      "Compare Free, Pro, and Coach plans with daily auto-apply limits and premium capabilities.",
    index: true,
  },
  "/about": {
    title: "About | CareerPilot",
    description:
      "Learn about the CareerPilot mission to help job seekers land better opportunities faster.",
    index: true,
  },
  "/faq": {
    title: "FAQ | CareerPilot",
    description:
      "Get answers about CareerPilot setup, automation behavior, subscriptions, and account management.",
    index: true,
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
  }, [location.pathname]);

  return null;
}

