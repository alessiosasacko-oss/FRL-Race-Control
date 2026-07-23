import type { DefaultSession } from "next-auth";
import type { Role } from "@/domain";

declare module "next-auth" {
  interface Session {
    user: {
      canonicalUserId: number;
      displayName: string;
      roles: Role[];
      active: boolean;
    } & NonNullable<DefaultSession["user"]>;
  }

  interface User {
    displayName: string;
    roles: Role[];
    active: boolean;
  }
}

export {};
