import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EXTENSION_VERSION = "1.2.0";
const EXTENSION_ID = process.env.CHROME_EXTENSION_ID || "";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  if (!EXTENSION_ID) {
    return noStore(
      NextResponse.json({ error: "Extension ID not configured" }, { status: 503 })
    );
  }

  const updateManifest = {
    manifest_version: 3,
    version: EXTENSION_VERSION,
    critical: false,
    details: `Version ${EXTENSION_VERSION} improves stability and fixes crashes.`,
  };

  return noStore(NextResponse.json(updateManifest));
}
