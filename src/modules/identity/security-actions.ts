import { cookies } from "next/headers";
import type { SecurityActionPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOpaqueToken, hashOpaqueToken } from "@/modules/identity/tokens";

export const SECURITY_ACTION_COOKIE = "rokviet.security-action";

export async function createSecurityAction(userId: string, purpose: SecurityActionPurpose) {
  const opaque = createOpaqueToken();
  await prisma.securityActionToken.deleteMany({ where: { userId, purpose, usedAt: null } });
  await prisma.securityActionToken.create({
    data: { userId, purpose, tokenHash: opaque.tokenHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  const store = await cookies();
  store.set(SECURITY_ACTION_COOKIE, opaque.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function currentSecurityAction(purpose: SecurityActionPurpose) {
  const raw = (await cookies()).get(SECURITY_ACTION_COOKIE)?.value;
  if (!raw) return null;
  return prisma.securityActionToken.findFirst({
    where: { tokenHash: hashOpaqueToken(raw), purpose, usedAt: null, expiresAt: { gt: new Date() } },
  });
}

export async function clearSecurityActionCookie() {
  (await cookies()).delete(SECURITY_ACTION_COOKIE);
}

