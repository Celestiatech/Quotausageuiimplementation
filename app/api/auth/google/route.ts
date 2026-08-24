import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

function getGoogleRedirectUri(req: NextRequest): string {
  const host = req.headers.get("host") || "";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return `http://${host}/api/auth/callback/google`;
  }
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "https://www.autoapplycv.in/api/auth/callback/google"
  );
}

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { success: false, message: "Google Client ID is not configured" },
        { status: 500 }
      );
    }

    const redirectUri = getGoogleRedirectUri(req);
    const state = randomBytes(24).toString("hex");

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("state", state);
    googleAuthUrl.searchParams.set("prompt", "select_account");
    googleAuthUrl.searchParams.set("access_type", "offline");

    const response = NextResponse.redirect(googleAuthUrl.toString());

    // Store state in an HTTP-only short lived cookie for CSRF verification
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error("Failed to initiate Google OAuth:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_init_failed", req.url));
  }
}
