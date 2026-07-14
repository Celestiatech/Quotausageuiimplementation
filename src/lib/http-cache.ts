import { NextResponse } from "next/server";

export function withCacheControl(
  response: NextResponse,
  options: {
    maxAge?: number;
    staleWhileRevalidate?: number;
    public?: boolean;
    noStore?: boolean;
  } = {},
) {
  const { maxAge = 60, staleWhileRevalidate = 300, public: isPublic = true, noStore = false } = options;

  if (noStore) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  } else {
    const parts = [isPublic ? "public" : "private", `max-age=${maxAge}`];
    if (staleWhileRevalidate > 0) {
      parts.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }
    response.headers.set("Cache-Control", parts.join(", "));
  }

  return response;
}

export function noStore(response: NextResponse) {
  return withCacheControl(response, { noStore: true });
}
