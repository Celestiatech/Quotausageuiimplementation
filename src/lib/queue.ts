import { Redis } from "@upstash/redis";

const JOB_QUEUE_KEY = process.env.UPSTASH_JOB_QUEUE_KEY || "careerpilot:auto_apply_jobs";

let redisClient: Redis | null = null;

export function isQueueConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  if (redisClient) return redisClient;
  redisClient = new Redis({ url, token });
  return redisClient;
}

export type QueuePayload = {
  jobId: string;
  userId: string;
};

export async function enqueueJob(payload: QueuePayload) {
  const redis = getRedisClient();
  if (!redis) return false;
  await redis.rpush(JOB_QUEUE_KEY, JSON.stringify(payload));
  return true;
}

export async function popQueuedJob() {
  const redis = getRedisClient();
  if (!redis) return null;
  const raw = await redis.lpop<string>(JOB_QUEUE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as QueuePayload;
  return parsed;
}

export async function queueHealth() {
  const redis = getRedisClient();
  if (!redis) {
    return { provider: "none", healthy: false, message: "Upstash env missing" };
  }
  try {
    const len = await redis.llen(JOB_QUEUE_KEY);
    return { provider: "upstash", healthy: true, queueLength: len };
  } catch (error) {
    return {
      provider: "upstash",
      healthy: false,
      message: error instanceof Error ? error.message : "Queue health failed",
    };
  }
}
