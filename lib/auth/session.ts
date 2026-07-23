import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/domain";
import {
  hasPermission,
  hasRole,
  type Permission,
} from "@/lib/auth/permissions";

export type AuthenticatedUser = {
  id: number;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  roles: Role[];
};

export const getCurrentUser = cache(
  async (): Promise<AuthenticatedUser | null> => {
    const session = await auth();

    if (
      !session?.user ||
      !session.user.active ||
      session.user.roles.length === 0
    ) {
      return null;
    }

    return {
      id: session.user.canonicalUserId,
      displayName: session.user.displayName,
      email: session.user.email ?? "",
      avatarUrl: session.user.image ?? null,
      roles: session.user.roles,
    };
  },
);

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(role: Role): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (!hasRole(user.roles, role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requirePermission(
  permission: Permission,
): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (!hasPermission(user.roles, permission)) {
    redirect("/dashboard");
  }

  return user;
}
