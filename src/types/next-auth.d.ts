import type { DefaultSession } from "next-auth";
import type { UserRoleName } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRoleName;
      reputation: number;
      isEmailVerified: boolean;
      loginMethods: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    rvRole?: UserRoleName;
    rvReputation?: number;
    rvEmailVerified?: boolean;
    rvLoginMethods?: string[];
  }
}
