import type { DefaultSession } from "next-auth";
import type { Role } from "@/domain";

declare module "next-auth" {
  interface Session {
    user: {
      canonicalUserId: number;
      displayName: string;
      roles: Role[];
      active: boolean;
      themePreference: string | null;
      unreadNotificationCount: number;
    } & NonNullable<DefaultSession["user"]>;
  }

  interface User {
    displayName: string;
    roles: Role[];
    active: boolean;
    themePreference: string | null;
    unreadNotificationCount: number;
  }
}

export {};
