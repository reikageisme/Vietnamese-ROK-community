import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function appUrl(path: string) {
  const base = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

