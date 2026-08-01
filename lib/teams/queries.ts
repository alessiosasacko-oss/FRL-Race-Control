import "server-only";
import { DriverLineupStatus } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";

const leagueCodes = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;

export async function getGlobalTeamOverview(input: {
  q?: string;
  seasonId?: number;
  includeArchived?: boolean;
}) {
  const prisma = getPrismaClient();
  const season = input.seasonId
    ? await prisma.season.findUnique({ where: { id: input.seasonId }, select: { id: true, name: true } })
    : await prisma.season.findFirst({
        where: { active: true, archivedAt: null },
        orderBy: { startsOn: "desc" },
        select: { id: true, name: true },
      });
  const [seasons, leagues] = await Promise.all([
    prisma.season.findMany({ orderBy: { startsOn: "desc" }, select: { id: true, name: true, active: true } }),
    prisma.league.findMany({
      where: { code: { in: [...leagueCodes] } },
      orderBy: { displayOrder: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);
  if (!season) return { season: null, seasons, leagues, organizations: [] };

  const organizations = await prisma.teamOrganization.findMany({
    where: {
      active: input.includeArchived ? undefined : true,
      teams: input.includeArchived
        ? undefined
        : {
            some: {
              seasonId: season.id,
              active: true,
              archivedAt: null,
            },
          },
      OR: input.q
        ? [
            { name: { contains: input.q, mode: "insensitive" } },
            { shortName: { contains: input.q, mode: "insensitive" } },
            { driverAssignments: { some: { seasonId: season.id, driver: { name: { contains: input.q, mode: "insensitive" } } } } },
          ]
        : undefined,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      seasons: {
        where: { seasonId: season.id },
        take: 1,
        include: { principal: { select: { displayName: true } } },
      },
      driverAssignments: {
        where: { seasonId: season.id },
        orderBy: { driver: { number: "asc" } },
        include: {
          driver: {
            select: {
              id: true,
              name: true,
              number: true,
              countryCode: true,
              active: true,
            },
          },
        },
      },
      teams: {
        where: {
          seasonId: season.id,
          active: input.includeArchived ? undefined : true,
          archivedAt: input.includeArchived ? undefined : null,
        },
        orderBy: { league: { displayOrder: "asc" } },
        include: {
          league: { select: { id: true, code: true, name: true } },
          principal: { select: { displayName: true } },
        },
      },
    },
  });

  return {
    season,
    seasons,
    leagues,
    organizations: organizations.map((organization) => ({
      id: organization.id,
      representativeTeamId: organization.teams[0]?.id ?? null,
      name: organization.name,
      shortName: organization.shortName,
      color: organization.color,
      logoUrl: organization.teams.find((team) => team.logoUrl)?.logoUrl ?? null,
      active: organization.active,
      principalName:
        organization.seasons[0]?.principal?.displayName ??
        organization.teams.find((team) => team.principal)?.principal?.displayName ??
        "Nicht zugewiesen",
      leagues: leagues.map((league) => {
        const drivers = organization.driverAssignments
          .filter((assignment) => assignment.leagueId === league.id)
          .map((assignment) => ({
            id: assignment.driver.id,
            name: assignment.driver.name,
            number: assignment.driver.number,
            countryCode: assignment.driver.countryCode,
            active: assignment.active && assignment.driver.active,
            lineupStatus: assignment.lineupStatus,
          }));
        return {
          ...league,
          primaryDrivers: drivers.filter((driver) => driver.lineupStatus === DriverLineupStatus.Primary && driver.active),
          substitutes: drivers.filter((driver) => driver.lineupStatus === DriverLineupStatus.Substitute || !driver.active),
        };
      }),
    })),
  };
}

export async function getGlobalTeamDetail(teamId: number, seasonId?: number) {
  const prisma = getPrismaClient();
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { organizationId: true, seasonId: true, archivedAt: true },
  });
  if (!team?.organizationId) return null;
  const overview = await getGlobalTeamOverview({
    seasonId: seasonId ?? team.seasonId,
    includeArchived: true,
  });
  const organization = overview.organizations.find((candidate) => candidate.id === team.organizationId);
  return organization
    ? {
        ...organization,
        archived: team.archivedAt !== null,
        season: overview.season,
        seasons: overview.seasons,
      }
    : null;
}
