import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { fail } from "./api";

type Entry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Entry>();
let lastCleanupAt = 0;
let redisClient: Redis | null | undefined;

function getRedisClient() {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

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

function enforceInMemoryRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  if (buckets.size > 10_000 || now - lastCleanupAt > 60_000) {
    for (const [bucketKey, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    lastCleanupAt = now;
  }

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

export async function enforceRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const redis = getRedisClient();
  if (!redis) return enforceInMemoryRateLimit(input);

  try {
    const windowSec = Math.max(1, Math.ceil(input.windowMs / 1000));
    const key = `cp:rl:${input.key}`;
    const count = Number(await redis.incr(key));
    if (count === 1) {
      await redis.expire(key, windowSec);
    }
    if (count > input.limit) {
      let retryAfterSec = Number(await redis.ttl(key));
      if (!Number.isFinite(retryAfterSec) || retryAfterSec < 1) retryAfterSec = windowSec;
      const res = fail("Too many requests. Try again shortly.", 429, "RATE_LIMITED");
      res.headers.set("Retry-After", String(retryAfterSec));
      return res;
    }
    return null;
  } catch (error) {
    console.error("rate-limit redis fallback:", error);
    return enforceInMemoryRateLimit(input);
  }
}
