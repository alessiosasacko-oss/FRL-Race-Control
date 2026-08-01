import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  canPermanentlyDeleteTeam,
  type TeamActiveDriver,
  type TeamDependencyCounts,
} from "./team-lifecycle";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type TeamDependencySnapshot = {
  organization: {
    id: number;
    name: string;
    shortName: string;
    active: boolean;
    archivedAt: Date | null;
    logoUrl: string | null;
  };
  slotIds: number[];
  dependencies: TeamDependencyCounts;
  activeDrivers: TeamActiveDriver[];
  canPermanentlyDelete: boolean;
};

export async function getTeamDependencySnapshot(
  database: DatabaseClient,
  organizationId: number,
): Promise<TeamDependencySnapshot | null> {
  const organization = await database.teamOrganization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      shortName: true,
      active: true,
      archivedAt: true,
      logoUrl: true,
      secondaryColor: true,
      contrastColor: true,
      teams: {
        select: {
          id: true,
          logoUrl: true,
          secondaryColor: true,
          contrastColor: true,
          backgroundGradient: true,
        },
      },
    },
  });
  if (!organization) return null;

  const slotIds = organization.teams.map((team) => team.id);
  const [
    directDrivers,
    seasonAssignments,
    organizationPrincipals,
    slotPrincipals,
    results,
    standings,
    globalStandings,
    contributions,
    adjustments,
    attendance,
    notifications,
  ] = await Promise.all([
    database.driver.findMany({
      where: { teamId: { in: slotIds } },
      select: {
        id: true,
        name: true,
        active: true,
        league: { select: { code: true } },
      },
    }),
    database.driverSeasonAssignment.findMany({
      where: { organizationId },
      select: {
        driverId: true,
        active: true,
        driver: { select: { id: true, name: true, active: true } },
        league: { select: { code: true } },
      },
    }),
    database.teamOrganizationSeason.count({
      where: { organizationId, principalUserId: { not: null } },
    }),
    database.team.count({
      where: { organizationId, principalUserId: { not: null } },
    }),
    database.raceResult.count({
      where: { representedTeamId: { in: slotIds } },
    }),
    database.teamStanding.count({ where: { teamId: { in: slotIds } } }),
    database.globalTeamStanding.count({ where: { organizationId } }),
    database.globalTeamContribution.count({ where: { organizationId } }),
    database.championshipAdjustment.count({
      where: { teamId: { in: slotIds } },
    }),
    database.raceAttendance.count({
      where: { representedTeamId: { in: slotIds } },
    }),
    database.notification.count({
      where: {
        OR: [
          { relatedEntityType: "TeamOrganization", relatedEntityId: organizationId },
          ...(slotIds.length
            ? [{ relatedEntityType: "Team", relatedEntityId: { in: slotIds } }]
            : []),
        ],
      },
    }),
  ]);

  const driverIds = new Set([
    ...directDrivers.map((driver) => driver.id),
    ...seasonAssignments.map((assignment) => assignment.driverId),
  ]);
  const fiaData = driverIds.size
    ? await database.fiaTicketDriver.count({
        where: { driverId: { in: [...driverIds] } },
      })
    : 0;

  const activeDriverMap = new Map<number, TeamActiveDriver>();
  for (const driver of directDrivers) {
    if (!driver.active) continue;
    activeDriverMap.set(driver.id, {
      id: driver.id,
      name: driver.name,
      leagueCode: driver.league.code,
    });
  }
  for (const assignment of seasonAssignments) {
    if (!assignment.active || !assignment.driver.active) continue;
    activeDriverMap.set(assignment.driver.id, {
      id: assignment.driver.id,
      name: assignment.driver.name,
      leagueCode: assignment.league.code,
    });
  }
  const activeDrivers = [...activeDriverMap.values()].sort(
    (left, right) =>
      left.leagueCode.localeCompare(right.leagueCode) ||
      left.name.localeCompare(right.name, "de"),
  );

  const dependencies: TeamDependencyCounts = {
    technicalSlots: slotIds.length,
    drivers: directDrivers.length,
    seasonAssignments: seasonAssignments.length,
    teamPrincipals: organizationPrincipals + slotPrincipals,
    results,
    standings,
    globalStandings,
    contributions,
    adjustments,
    attendance,
    fiaData,
    notifications,
    brandingAssets: new Set(
      [
        organization.logoUrl,
        ...organization.teams.flatMap((team) => [
          team.logoUrl,
          team.backgroundGradient,
        ]),
      ].filter((value): value is string => Boolean(value)),
    ).size,
  };

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      shortName: organization.shortName,
      active: organization.active,
      archivedAt: organization.archivedAt,
      logoUrl: organization.logoUrl,
    },
    slotIds,
    dependencies,
    activeDrivers,
    canPermanentlyDelete: canPermanentlyDeleteTeam(dependencies),
  };
}
