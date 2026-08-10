import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { newGoogleUserData } from "@/modules/identity/google-profile";
import { addLoginMethod } from "@/modules/identity/login-methods";

/**
 * Keep Auth.js' standard user shape while preserving RokViet Hub's domain fields.
 * The OAuth profile id is Google's verified `sub`; it is never exposed in session data.
 */
export function RokVietPrismaAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    async createUser(user) {
      const { name, email, emailVerified, image } = user;
      const googleSub = (user as AdapterUser & { googleSub?: unknown }).googleSub;
      if (typeof googleSub !== "string" || !googleSub) throw new Error("Missing verified Google subject");
      const created = await prisma.user.create({
        data: { ...newGoogleUserData({ sub: googleSub, name: name ?? null, email, image: image ?? null }), emailVerified: emailVerified ?? new Date() },
      });
      return created as AdapterUser;
    },
    async updateUser({ id, ...user }) {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...user,
          ...(user.name !== undefined ? { displayName: user.name } : {}),
        },
      });
      return updated as AdapterUser;
    },
    async linkAccount(account) {
      if (account.provider !== "google") {
        const linked = await base.linkAccount!(account);
        return linked ?? account;
      }
      const [target, existingGoogle] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: account.userId }, select: { loginMethods: true } }),
        prisma.account.findFirst({ where: { userId: account.userId, provider: "google" }, select: { providerAccountId: true } }),
      ]);
      if (existingGoogle && existingGoogle.providerAccountId !== account.providerAccountId) {
        throw new Error("A Google account is already linked to this user");
      }
      await prisma.$transaction([
        prisma.account.create({ data: account }),
        prisma.user.update({
          where: { id: account.userId },
          data: {
            googleSub: account.providerAccountId,
            loginMethods: addLoginMethod(target.loginMethods, "google"),
            emailVerified: new Date(),
          },
        }),
      ]);
      return account;
    },
    async unlinkAccount(providerAccountId) {
      const account = await prisma.account.findUniqueOrThrow({
        where: { provider_providerAccountId: providerAccountId },
        select: { userId: true, provider: true },
      });
      const deleted = await base.unlinkAccount!(providerAccountId);
      if (account.provider === "google") {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId }, select: { loginMethods: true } });
        await prisma.user.update({
          where: { id: account.userId },
          data: { googleSub: null, loginMethods: user.loginMethods.filter((method) => method !== "google") },
        });
      }
      return deleted ?? undefined;
    },
  };
}
