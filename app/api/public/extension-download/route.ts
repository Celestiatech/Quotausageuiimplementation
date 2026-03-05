import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const ZIP_FILE_NAME = "AutoApplyCVLinkedInExtension.zip";
const FALLBACK_GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/Celestiatech/Quotausageuiimplementation/main/public/downloads/AutoApplyCVLinkedInExtension.zip";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  const localZipPath = path.join(process.cwd(), "public", "downloads", ZIP_FILE_NAME);

  try {
    const file = await fs.readFile(localZipPath);
    const res = new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${ZIP_FILE_NAME}"`,
      },
    });
    return noStore(res);
  } catch {
    const redirect = NextResponse.redirect(FALLBACK_GITHUB_RAW_URL, 307);
    return noStore(redirect);
  }
}
