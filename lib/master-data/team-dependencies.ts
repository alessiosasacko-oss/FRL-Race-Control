import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  canPermanentlyDeleteTeam,
  type TeamActiveDriver,
  type TeamDependencyCounts,
} from "./team-lifecycle";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type TeamDependencySnapshot = {
  team: {
    id: number;
    name: string;
    shortName: string;
    active: boolean;
    archivedAt: Date | null;
    leagueId: number;
    seasonId: number;
    organizationId: number | null;
    logoUrl: string | null;
  };
  dependencies: TeamDependencyCounts;
  activeDrivers: TeamActiveDriver[];
  canPermanentlyDelete: boolean;
};

export async function getTeamDependencySnapshot(
  database: DatabaseClient,
  teamId: number,
): Promise<TeamDependencySnapshot | null> {
  const team = await database.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      shortName: true,
      active: true,
      archivedAt: true,
      leagueId: true,
      seasonId: true,
      organizationId: true,
      principalUserId: true,
      logoUrl: true,
      secondaryColor: true,
      contrastColor: true,
      backgroundGradient: true,
      _count: {
        select: {
          drivers: true,
          standings: true,
          attendanceEntries: true,
          representedResults: true,
          championshipAdjustments: true,
        },
      },
    },
  });
  if (!team) return null;

  const assignmentWhere = team.organizationId
    ? {
        seasonId: team.seasonId,
        leagueId: team.leagueId,
        organizationId: team.organizationId,
      }
    : null;
  const [seasonAssignments, organizationPrincipals, fiaData, notifications, directDrivers, assignedDrivers] =
    await Promise.all([
      assignmentWhere
        ? database.driverSeasonAssignment.count({ where: assignmentWhere })
        : Promise.resolve(0),
      team.organizationId
        ? database.teamOrganizationSeason.count({
            where: {
              organizationId: team.organizationId,
              seasonId: team.seasonId,
              principalUserId: { not: null },
            },
          })
        : Promise.resolve(0),
      database.fiaTicketDriver.count({
        where: {
          driver: {
            OR: [
              { teamId: team.id },
              ...(assignmentWhere
                ? [{ seasonAssignments: { some: assignmentWhere } }]
                : []),
            ],
          },
        },
      }),
      database.notification.count({
        where: { relatedEntityType: "Team", relatedEntityId: team.id },
      }),
      database.driver.findMany({
        where: { teamId: team.id, active: true },
        select: {
          id: true,
          name: true,
          league: { select: { code: true } },
        },
      }),
      assignmentWhere
        ? database.driverSeasonAssignment.findMany({
            where: { ...assignmentWhere, active: true, driver: { active: true } },
            select: {
              driver: { select: { id: true, name: true } },
              league: { select: { code: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  const activeDriverMap = new Map<number, TeamActiveDriver>();
  for (const driver of [...directDrivers, ...assignedDrivers]) {
    const identity = "driver" in driver ? driver.driver : driver;
    activeDriverMap.set(identity.id, {
      id: identity.id,
      name: identity.name,
      leagueCode: driver.league.code,
    });
  }
  const activeDrivers = [...activeDriverMap.values()].sort((left, right) =>
    left.leagueCode.localeCompare(right.leagueCode) ||
    left.name.localeCompare(right.name, "de"),
  );
  const dependencies: TeamDependencyCounts = {
    drivers: team._count.drivers,
    seasonAssignments,
    teamPrincipals: (team.principalUserId ? 1 : 0) + organizationPrincipals,
    results: team._count.representedResults,
    standings: team._count.standings,
    adjustments: team._count.championshipAdjustments,
    attendance: team._count.attendanceEntries,
    fiaData,
    notifications,
    brandingAssets: [
      team.logoUrl,
      team.secondaryColor,
      team.contrastColor,
      team.backgroundGradient,
    ].filter(Boolean).length,
  };

  return {
    team: {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      active: team.active,
      archivedAt: team.archivedAt,
      leagueId: team.leagueId,
      seasonId: team.seasonId,
      organizationId: team.organizationId,
      logoUrl: team.logoUrl,
    },
    dependencies,
    activeDrivers,
    canPermanentlyDelete: canPermanentlyDeleteTeam(dependencies),
  };
}
