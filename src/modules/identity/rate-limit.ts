import { createHash } from "node:crypto";
import { ensureRedis } from "@/lib/redis";

function keyPart(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function incrementWithWindow(key: string, seconds: number) {
  const client = await ensureRedis();
  const count = await client.incr(key);
  if (count === 1) await client.expire(key, seconds);
  return count;
}

export async function consumeRegistrationAttempt(ip: string) {
  const count = await incrementWithWindow(`rokfaq:auth:register:${keyPart(ip)}`, 60 * 60);
  return { allowed: count <= 5, remaining: Math.max(0, 5 - count) };
}

export async function isLoginLocked(email: string) {
  const client = await ensureRedis();
  return Number(await client.get(`rokfaq:auth:login:${keyPart(email)}`)) >= 5;
}

export async function recordFailedLogin(email: string) {
  return incrementWithWindow(`rokfaq:auth:login:${keyPart(email)}`, 15 * 60);
}

export async function clearFailedLogins(email: string) {
  const client = await ensureRedis();
  await client.del(`rokfaq:auth:login:${keyPart(email)}`);
}

