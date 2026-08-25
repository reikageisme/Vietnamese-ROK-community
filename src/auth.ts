import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { RokFaqPrismaAdapter } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { googleProviderProfile, syncExistingGoogleUser } from "@/modules/identity/google-profile";
import { authorizeCredentials } from "@/modules/identity/credentials";
import { securityNoticeEmail } from "@/lib/email";
import { currentSecurityAction } from "@/modules/identity/security-actions";
import type { UserRoleName } from "@prisma/client";

const rolePriority = ["ADMIN", "MODERATOR", "R5", "R4", "CONTRIBUTOR", "MEMBER"] as const;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: RokFaqPrismaAdapter(),
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin", error: "/auth/signin" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      profile(profile) {
        // Auth core intentionally replaces `id` with an app-local UUID before
        // createUser. Preserve the verified subject under a private adapter field.
        return googleProviderProfile(profile);
      },
    }),
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;
      if (account?.provider !== "google") return false;
      const googleSub = typeof profile?.sub === "string" ? profile.sub : null;
      if (!googleSub) return false;

      const linkedUser = await prisma.user.findUnique({ where: { googleSub }, select: { id: true } });
      const [linkAction, reauthAction] = await Promise.all([
        currentSecurityAction("LINK_GOOGLE"),
        currentSecurityAction("SET_PASSWORD"),
      ]);
      if (linkAction && linkedUser && linkedUser.id !== linkAction.userId) return false;
      if (reauthAction && linkedUser?.id !== reauthAction.userId) return false;
      if (reauthAction) {
        await prisma.securityActionToken.update({ where: { id: reauthAction.id }, data: { verifiedAt: new Date() } });
      }

      // Existing accounts receive current Google profile details. First-time users are
      // created atomically by the adapter with MEMBER as their only default role.
      if (!user.email) return false;
      await syncExistingGoogleUser({
        findByGoogleSub: (sub) => prisma.user.findUnique({ where: { googleSub: sub }, select: { id: true } }),
        updateProfile: async (id, latest) => {
          await prisma.user.update({
            where: { id },
            data: { name: latest.name, displayName: latest.name, email: latest.email, image: latest.image, emailVerified: new Date() },
          });
        },
      }, { sub: googleSub, name: user.name ?? null, email: user.email, image: user.image ?? null });
      return true;
    },
    async jwt({ token, user }) {
      const userId = user?.id ?? token.sub;
      if (!userId) return null;
      const [freshUser, reputation] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            image: true,
            emailVerified: true,
            loginMethods: true,
            sessionVersion: true,
            isActive: true,
            roles: { select: { role: true } },
          },
        }),
        prisma.reputationEvent.aggregate({
          where: { userId },
          _sum: { points: true },
        }),
      ]);

      if (!freshUser?.isActive) return null;
      if (user && token.sessionVersion === undefined) token.sessionVersion = freshUser.sessionVersion;
      if (token.sessionVersion !== freshUser.sessionVersion) return null;
      const assignedRoles = new Set(freshUser.roles.map(({ role }) => role));
      const role = rolePriority.find((candidate) => assignedRoles.has(candidate)) ?? "MEMBER";
      token.sub = freshUser.id;
      token.name = freshUser.displayName ?? freshUser.name;
      token.email = freshUser.email;
      token.picture = freshUser.image;
      token.rvRole = role;
      token.rvReputation = reputation._sum.points ?? 0;
      token.rvEmailVerified = Boolean(freshUser.emailVerified);
      token.rvLoginMethods = freshUser.loginMethods;
      return token;
    },
    async session({ session, token }) {
      if (!token.sub) return session;
      session.user.id = token.sub;
      session.user.name = token.name;
      session.user.email = token.email ?? session.user.email;
      session.user.image = token.picture;
      session.user.role = (token.rvRole as UserRoleName | undefined) ?? "MEMBER";
      session.user.reputation = (token.rvReputation as number | undefined) ?? 0;
      session.user.isEmailVerified = (token.rvEmailVerified as boolean | undefined) ?? false;
      session.user.loginMethods = (token.rvLoginMethods as string[] | undefined) ?? [];
      return session;
    },
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      const protectedPath =
        path.startsWith("/profile") ||
        /^\/tools\/[^/]+\/save(?:\/|$)/.test(path) ||
        /^\/forum\/.+\/new(?:\/|$)/.test(path) ||
        /^\/codex\/.+\/edit(?:\/|$)/.test(path);
      return !protectedPath || Boolean(session?.user);
    },
  },
  events: {
    async linkAccount({ user, account }) {
      if (account.provider === "google" && user.email) {
        const action = await currentSecurityAction("LINK_GOOGLE");
        if (action && action.userId === user.id) {
          const actionId = action.id;
          await prisma.securityActionToken.update({ where: { id: actionId }, data: { verifiedAt: new Date(), usedAt: new Date() } });
        }
        await securityNoticeEmail(user.email, "Tài khoản của bạn vừa liên kết phương thức đăng nhập Google").catch(console.error);
      }
    },
  },
});
