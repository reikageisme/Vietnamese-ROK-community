import type { Session } from "next-auth";
import type { UserRoleName } from "@prisma/client";
import { auth } from "@/auth";

export class AuthenticationError extends Error {
  readonly status = 401;
}

export class AuthorizationError extends Error {
  readonly status = 403;
}

export class EmailVerificationRequiredError extends Error {
  readonly status = 403;
}

export async function requireAuth(): Promise<Session & { user: NonNullable<Session["user"]> }> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthenticationError("Authentication required");
  return session as Session & { user: NonNullable<Session["user"]> };
}

export async function requireVerifiedContributor() {
  const session = await requireAuth();
  if (!session.user.isEmailVerified) throw new EmailVerificationRequiredError("Email verification required");
  return session;
}

export function requireRole(session: Session | null, allowedRoles: readonly UserRoleName[]): void {
  if (!session?.user?.id) throw new AuthenticationError("Authentication required");
  if (!allowedRoles.includes(session.user.role)) throw new AuthorizationError("Insufficient permissions");
}
