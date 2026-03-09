import { NextRequest, NextResponse } from "next/server";

function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || createRequestId();
  const path = req.nextUrl.pathname;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && path.startsWith("/downloads/")) {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }

  if (path.startsWith("/api/")) {
    const method = req.method.toUpperCase();
    const isWriteMethod = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
    if (isWriteMethod) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      let sameOrigin = false;
      if (origin && host) {
        try {
          sameOrigin = new URL(origin).host === host;
        } catch {
          sameOrigin = false;
        }
      }
      const allowNoOrigin =
        path === "/api/billing/webhook/razorpay" ||
        path === "/api/internal/worker/run";
      if (!sameOrigin && !(allowNoOrigin && !origin)) {
        return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
      }
    }
  }

  const res = NextResponse.next();
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
    "connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://db.prisma.io https://*.upstash.io",
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "form-action 'self' https://api.razorpay.com https://checkout.razorpay.com",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  res.headers.set("x-request-id", requestId);
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  res.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("x-dns-prefetch-control", "off");
  res.headers.set("cross-origin-opener-policy", "same-origin");
  res.headers.set("cross-origin-resource-policy", "same-origin");
  res.headers.set("origin-agent-cluster", "?1");
  if (isProd) {
    res.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }
  res.headers.set("content-security-policy", csp);

  if (path.startsWith("/api/")) {
    res.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    res.headers.set("cache-control", "no-store");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
