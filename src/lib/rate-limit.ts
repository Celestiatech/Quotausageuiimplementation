import { NextRequest } from "next/server";
import { fail } from "./api";

type Entry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Entry>();

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimitKey(req: NextRequest, scope: string, identity?: string) {
  const ip = getClientIp(req);
  const who = identity || "anon";
  return `${scope}:${who}:${ip}`;
}

export function enforceRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const existing = buckets.get(input.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return null;
  }

  if (existing.count >= input.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    const res = fail("Too many requests. Try again shortly.", 429, "RATE_LIMITED");
    res.headers.set("Retry-After", String(retryAfterSec));
    return res;
  }

  existing.count += 1;
  buckets.set(input.key, existing);
  return null;
}

