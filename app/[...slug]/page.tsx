import type { Metadata } from "next";
import App from "../../src/app/App";
import { canonicalForPath, resolveSeo } from "../../src/app/seo/seoConfig";

export async function generateMetadata({ params }: { params?: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const resolvedParams = params ? await params : {};
  const pathname = `/${(resolvedParams.slug || []).join("/")}`;
  const seo = resolveSeo(pathname === "/" ? "/" : pathname);
  const canonical = canonicalForPath(pathname);

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    robots: seo.index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function CatchAllPage({ params }: { params?: Promise<{ slug?: string[] }> }) {
  const resolvedParams = params ? await params : {};
  const pathname = `/${(resolvedParams.slug || []).join("/")}`;
  const seo = resolveSeo(pathname === "/" ? "/" : pathname);
  const structuredData = seo.structuredData;

  return (
    <>
      {structuredData ? (
        <script
          id="careerpilot-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(Array.isArray(structuredData) ? structuredData : structuredData),
          }}
        />
      ) : null}
      <App initialPathname={pathname === "/" ? "/" : pathname} />
    </>
  );
}
