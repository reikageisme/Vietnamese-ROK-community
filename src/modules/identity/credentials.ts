import { prisma } from "@/lib/prisma";
import { clearFailedLogins, isLoginLocked, recordFailedLogin } from "@/modules/identity/rate-limit";
import { credentialsSchema } from "@/modules/identity/schemas";
import { verifyDummyPassword, verifyPassword } from "@/modules/identity/password";

export async function authorizeCredentials(input: unknown) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  try {
    if (await isLoginLocked(email)) return null;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, displayName: true, email: true, image: true, passwordHash: true, isActive: true },
    });

    const valid = user?.passwordHash
      ? await verifyPassword(user.passwordHash, password)
      : await verifyDummyPassword(password);
    if (!user?.isActive || !user.passwordHash || !valid) {
      await recordFailedLogin(email);
      return null;
    }

    await clearFailedLogins(email);
    return { id: user.id, name: user.displayName ?? user.name, email: user.email, image: user.image };
  } catch {
    // Authentication fails closed when the brute-force store is unavailable.
    return null;
  }
}

