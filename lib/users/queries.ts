import "server-only";
import { Role } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { effectiveUserAccess } from "./permissions";
import { userListQuerySchema } from "./schemas";

export function parseUserListQuery(
  input: Record<string, string | string[] | undefined>,
) {
  const value = (key: string) => {
    const candidate = input[key];
    return Array.isArray(candidate) ? candidate[0] : candidate;
  };
  return userListQuerySchema.parse({
    q: value("q") ?? "",
    role: value("role") || undefined,
    leagueId: value("leagueId") || undefined,
    teamId: value("teamId") || undefined,
    lineupStatus: value("lineupStatus") || undefined,
  });
}

export async function getUserAdminOptions() {
  const prisma = getPrismaClient();
  const [leagues, seasons, organizations, primaryAssignments] = await Promise.all([
    prisma.league.findMany({
      where: { code: { in: ["F1", "F2", "F3", "F4", "F5", "F6"] } },
      orderBy: { displayOrder: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.season.findMany({
      orderBy: [{ active: "desc" }, { startsOn: "desc" }],
      select: { id: true, name: true, active: true, archivedAt: true },
    }),
    prisma.teamOrganization.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, shortName: true, color: true },
    }),
    prisma.driverSeasonAssignment.findMany({
      where: { active: true, lineupStatus: "PRIMARY", organizationId: { not: null } },
      orderBy: { driver: { name: "asc" } },
      select: {
        driverId: true,
        seasonId: true,
        leagueId: true,
        organizationId: true,
        driver: { select: { name: true, number: true } },
        season: { select: { name: true } },
        league: { select: { code: true } },
        organization: { select: { name: true } },
      },
    }),
  ]);
  return { leagues, seasons, organizations, primaryAssignments };
}

export async function getUserAdminList(
  query: ReturnType<typeof parseUserListQuery>,
) {
  const users = await getPrismaClient().user.findMany({
    where: {
      roles: query.role ? { has: query.role } : undefined,
      OR: query.q
        ? [
            { displayName: { contains: query.q, mode: "insensitive" } },
            { discordUsername: { contains: query.q, mode: "insensitive" } },
            { discordGlobalName: { contains: query.q, mode: "insensitive" } },
            { driver: { name: { contains: query.q, mode: "insensitive" } } },
          ]
        : undefined,
      driver: query.leagueId || query.teamId || query.lineupStatus
        ? {
            is: {
              seasonAssignments: {
                some: {
                  leagueId: query.leagueId,
                  organizationId: query.teamId,
                  lineupStatus: query.lineupStatus,
                  active: true,
                },
              },
            },
          }
        : undefined,
    },
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
    include: {
      driver: {
        include: {
          league: { select: { id: true, code: true, name: true } },
          team: { select: { id: true, name: true, color: true } },
          seasonAssignments: {
            orderBy: { season: { startsOn: "desc" } },
            take: 1,
            include: {
              season: { select: { id: true, name: true } },
              league: { select: { id: true, code: true } },
              organization: { select: { id: true, name: true, color: true } },
            },
          },
        },
      },
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    discordName:
      user.discordGlobalName ?? user.discordUsername ?? user.displayName,
    avatarUrl: user.discordAvatarUrl ?? user.avatarUrl,
    roles: user.roles as Role[],
    active: user.active,
    lastLoginAt: user.sessions[0]?.updatedAt.toISOString() ?? null,
    betaAccess: null as boolean | null,
    driver: user.driver
      ? {
          id: user.driver.id,
          name: user.driver.name,
          number: user.driver.number,
          countryCode: user.driver.countryCode,
          active: user.driver.active,
          league: user.driver.league,
          team: user.driver.team,
          assignment: user.driver.seasonAssignments[0] ?? null,
        }
      : null,
  }));
}

export async function getUserAdminDetail(userId: number) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      driver: {
        include: {
          league: { select: { id: true, code: true, name: true } },
          team: { select: { id: true, name: true, color: true } },
          seasonAssignments: {
            orderBy: { season: { startsOn: "desc" } },
            include: {
              season: { select: { id: true, name: true } },
              league: { select: { id: true, code: true, name: true } },
              organization: { select: { id: true, name: true, color: true } },
            },
          },
        },
      },
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });
  if (!user) return null;

  const audit = await prisma.systemAuditLog.findMany({
    where: {
      OR: [
        { entityType: "User", entityId: user.id },
        ...(user.driver
          ? [{ entityType: "Driver", entityId: user.driver.id }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { displayName: true } } },
  });
  const currentAssignment = user.driver?.seasonAssignments[0] ?? null;
  const access = effectiveUserAccess({
    roles: user.roles as Role[],
    leagueCode: currentAssignment?.league.code ?? user.driver?.league.code,
    teamName: currentAssignment?.organization?.name ?? user.driver?.team?.name,
    hasDriverProfile: Boolean(user.driver),
  });

  return {
    id: user.id,
    displayName: user.displayName,
    discordName: user.discordGlobalName ?? user.discordUsername ?? user.displayName,
    discordId: user.discordId,
    avatarUrl: user.discordAvatarUrl ?? user.avatarUrl,
    email: user.email,
    roles: user.roles as Role[],
    active: user.active,
    lastLoginAt: user.sessions[0]?.updatedAt.toISOString() ?? null,
    betaAccess: null as boolean | null,
    driver: user.driver
      ? {
          id: user.driver.id,
          name: user.driver.name,
          number: user.driver.number,
          countryCode: user.driver.countryCode,
          active: user.driver.active,
          league: user.driver.league,
          team: user.driver.team,
          assignments: user.driver.seasonAssignments,
        }
      : null,
    access,
    audit: audit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      metadata: entry.metadata,
      actorName: entry.actor?.displayName ?? "System",
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export async function getUserDataQualityReport() {
  const prisma = getPrismaClient();
  const [usersWithoutDriver, drivers] = await Promise.all([
    prisma.user.count({ where: { driver: null } }),
    prisma.driver.findMany({
      select: {
        id: true,
        name: true,
        countryCode: true,
        teamId: true,
        seasonAssignments: {
          where: { active: true },
          select: {
            seasonId: true,
            leagueId: true,
            organizationId: true,
            lineupStatus: true,
          },
        },
      },
    }),
  ]);
  const primarySlots = new Map<string, number>();
  for (const driver of drivers) {
    for (const assignment of driver.seasonAssignments) {
      if (assignment.lineupStatus !== "PRIMARY" || !assignment.organizationId) continue;
      const key = `${assignment.seasonId}:${assignment.leagueId}:${assignment.organizationId}`;
      primarySlots.set(key, (primarySlots.get(key) ?? 0) + 1);
    }
  }
  return {
    usersWithoutDriver,
    driversWithoutTeam: drivers.filter((driver) => !driver.teamId).length,
    invalidCountryCodes: drivers.filter(
      (driver) => !/^[A-Z]{2}$/.test(driver.countryCode.trim()),
    ).map((driver) => ({ id: driver.id, name: driver.name, value: driver.countryCode })),
    overfilledPrimarySlots: [...primarySlots.values()].filter((count) => count > 2).length,
  };
}

export const editableSystemRoles = [
  Role.Driver,
  Role.TeamPrincipal,
  Role.Steward,
  Role.Admin,
  Role.SuperAdmin,
] as const;
