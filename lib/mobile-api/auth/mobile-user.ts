import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { roleSchema, type Role } from "@/domain";
import { rolePermissions } from "@/lib/auth/permissions";
import { getPrismaClient } from "@/lib/db/prisma";
import { issueMobileAccessToken, verifyMobileAccessToken } from "./access-token";
import { readBearerToken } from "./bearer-token";
import { forbidden, unauthorized } from "./errors";

export function discordAccountLookup(providerAccountId: string) {
  return {
    provider_providerAccountId: {
      provider: "discord",
      providerAccountId,
    },
  } as const;
}

type MobileEligibilityUser = {
  active: boolean;
  lockedAt: Date | null;
  roles: readonly unknown[];
  driver?: { active: boolean } | null;
};

export function assertMobileUserEligible(user: MobileEligibilityUser): void {
  if (
    !user.active ||
    user.lockedAt !== null ||
    user.roles.length === 0 ||
    user.driver?.active === false
  ) {
    throw forbidden();
  }
  roleSchema.array().parse(user.roles);
}

export const mobileUserSelect = {
  id: true,
  displayName: true,
  discordUsername: true,
  discordGlobalName: true,
  discordAvatarUrl: true,
  avatarUrl: true,
  roles: true,
  active: true,
  lockedAt: true,
  driver: {
    select: {
      id: true,
      name: true,
      number: true,
      flag: true,
      countryCode: true,
      active: true,
      league: { select: { code: true, name: true } },
      team: { select: { name: true, logoUrl: true } },
      seasonAssignments: {
        where: { active: true },
        orderBy: { season: { startsOn: "desc" } },
        take: 1,
        select: {
          league: { select: { code: true, name: true } },
          organization: { select: { name: true, logoUrl: true } },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type MobileDatabaseUser = Prisma.UserGetPayload<{
  select: typeof mobileUserSelect;
}>;

export type MobileUserContext = {
  claims: ReturnType<typeof verifyMobileAccessToken>;
  session: {
    id: string;
    userId: number;
    tokenFamilyId: string;
    expiresAt: Date;
    lastUsedAt: Date;
    revokedAt: Date | null;
  };
  user: MobileDatabaseUser;
};

export async function requireMobileUser(
  request: Request,
  options: { allowRevoked?: boolean; allowIneligible?: boolean } = {},
): Promise<MobileUserContext> {
  const claims = verifyMobileAccessToken(readBearerToken(request));
  const prisma = getPrismaClient();
  const session = await prisma.mobileSession.findUnique({
    where: { id: claims.sid },
    select: {
      id: true,
      userId: true,
      tokenFamilyId: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      user: { select: mobileUserSelect },
    },
  });
  if (!session || String(session.userId) !== claims.sub) {
    throw unauthorized("MOBILE_SESSION_INVALID");
  }
  const now = new Date();
  if (session.expiresAt <= now) {
    throw unauthorized("MOBILE_SESSION_EXPIRED");
  }
  if (session.revokedAt && !options.allowRevoked) {
    throw unauthorized("MOBILE_SESSION_REVOKED");
  }
  if (!options.allowIneligible) assertMobileUserEligible(session.user);
  if (!session.revokedAt) {
    await prisma.mobileSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastUsedAt: now },
    });
  }
  return { claims, session, user: session.user };
}

export function publicPermissions(roles: readonly Role[]): string[] {
  return [...new Set(roles.flatMap((role) => rolePermissions[role]))].sort();
}

export function serializeMobileUser(context: MobileUserContext) {
  const roles = roleSchema.array().parse(context.user.roles);
  const assignment = context.user.driver?.seasonAssignments[0];
  const league = assignment?.league ?? context.user.driver?.league ?? null;
  const team = assignment?.organization ?? context.user.driver?.team ?? null;
  return {
    id: context.user.id,
    discordDisplayName:
      context.user.discordGlobalName ??
      context.user.discordUsername ??
      context.user.displayName,
    discordAvatarUrl:
      context.user.discordAvatarUrl ?? context.user.avatarUrl ?? null,
    driver: context.user.driver
      ? {
          name: context.user.driver.name,
          number: context.user.driver.number,
          flag: context.user.driver.flag,
          countryCode: context.user.driver.countryCode,
        }
      : null,
    league: league ? { code: league.code, name: league.name } : null,
    team: team ? { name: team.name, logoUrl: team.logoUrl } : null,
    roles,
    permissions: publicPermissions(roles),
    status: "ACTIVE" as const,
    sessionId: context.session.id,
  };
}

export { issueMobileAccessToken };
