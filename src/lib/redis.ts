import Redis from "ioredis";

const globalRedis = globalThis as unknown as { rokvietRedis?: Redis };

export const redis = globalRedis.rokvietRedis ?? new Redis(process.env.REDIS_URL ?? "redis://localhost:6379/0", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

if (process.env.NODE_ENV !== "production") globalRedis.rokvietRedis = redis;

export async function ensureRedis() {
  if (redis.status === "wait") await redis.connect();
  return redis;
}

