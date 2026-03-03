import { NextRequest, NextResponse } from "next/server";

function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || createRequestId();
  const res = NextResponse.next();

  res.headers.set("x-request-id", requestId);
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  res.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("x-dns-prefetch-control", "off");

  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/")) {
    res.headers.set("cache-control", "no-store");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
