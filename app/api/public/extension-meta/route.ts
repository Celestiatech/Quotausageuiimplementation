import { NextResponse } from "next/server";
import { getExtensionRelease } from "src/lib/extension-package";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  const release = await getExtensionRelease();
  return noStore(
    NextResponse.json({
      success: true,
      data: {
        version: release.version,
        displayName: release.displayName,
        downloadFileName: release.zipFileName,
        downloadBaseName: release.zipBaseName,
      },
    }),
  );
}
