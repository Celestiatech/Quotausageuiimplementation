import { NextResponse } from "next/server";
import { normalizeExtensionProvider } from "src/lib/extension-providers";
import { getExtensionRelease, listExtensionReleases } from "src/lib/extension-package";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(req: Request) {
  const provider = normalizeExtensionProvider(new URL(req.url).searchParams.get("provider"));
  const [release, releases] = await Promise.all([
    getExtensionRelease(provider),
    listExtensionReleases(),
  ]);
  return noStore(
    NextResponse.json({
      success: true,
      data: {
        provider,
        version: release.version,
        displayName: release.displayName,
        downloadFileName: release.zipFileName,
        downloadBaseName: release.zipBaseName,
        providers: releases.map((item) => ({
          provider: item.provider,
          shortLabel: item.shortLabel,
          version: item.version,
          displayName: item.displayName,
          downloadFileName: item.zipFileName,
          downloadBaseName: item.zipBaseName,
        })),
      },
    }),
  );
}
