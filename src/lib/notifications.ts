import { Redis } from "@upstash/redis";

const QUEUE_KEY = "cp:notifications:queue";
const PROCESSED_KEY = "cp:notifications:processed";
const MAX_PROCESSED = 1000;

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

export type NotificationPayload = {
  id: string;
  userId: string;
  type: "job_applied" | "job_failed" | "quota_low" | "error" | "welcome" | "interview";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  createdAt: string;
};

export async function enqueueNotification(payload: Omit<NotificationPayload, "id" | "createdAt">) {
  const redis = getRedisClient();
  if (!redis) return false;

  const notification: NotificationPayload = {
    ...payload,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    await redis.rpush(QUEUE_KEY, JSON.stringify(notification));
    return true;
  } catch {
    return false;
  }
}

export async function dequeueNotification(): Promise<NotificationPayload | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.lpop<string>(QUEUE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NotificationPayload;
  } catch {
    return null;
  }
}

export async function markProcessed(id: string) {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.lpush(PROCESSED_KEY, id);
    await redis.ltrim(PROCESSED_KEY, 0, MAX_PROCESSED - 1);
  } catch {
    // ignore
  }
}

export async function getNotificationQueueLength() {
  const redis = getRedisClient();
  if (!redis) return 0;

  try {
    return await redis.llen(QUEUE_KEY);
  } catch {
    return 0;
  }
}
