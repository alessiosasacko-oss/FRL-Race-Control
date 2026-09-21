import "server-only";
import { characterView, suitView } from "@/lib/characters/resolve";
import { getPrismaClient } from "@/lib/db/prisma";
import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { publicRaceTrack } from "@/lib/races/visibility";
import type { DashboardData } from "./types";

async function optionalDashboardData<T>(label: string, load: () => PromiseLike<T>, fallback: T): Promise<T> {
  try { return await load(); }
  catch (error: unknown) {
    console.error(`[dashboard] Unable to load ${label}.`, { name: error instanceof Error ? error.name : "UnknownError" });
    return fallback;
  }
}

export async function getDashboardData(userId: number): Promise<DashboardData> {
  const startedAt = performance.now();
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true, avatarUrl: true,
      driverCharacter: { select: { id: true, configuration: true, normalPose: true, winnerPose: true, version: true, suitVariantId: true } },
      driver: { select: {
        id: true, name: true, number: true, flag: true,
        league: { select: { id: true, code: true, name: true, currentSeasonId: true } },
        team: { select: { id: true, name: true, shortName: true, color: true, logoUrl: true, seasonId: true, season: { select: { id: true, name: true } }, organization: { select: { id: true, name: true, shortName: true, color: true, logoUrl: true } } } },
        seasonAssignments: { where: { active: true, season: { active: true, archivedAt: null } }, orderBy: { seasonId: "desc" }, take: 1, select: { lineupStatus: true, organization: { select: { id: true, name: true, shortName: true, color: true, secondaryColor: true, contrastColor: true, logoUrl: true, suitTemplates: { where: { active: true, archivedAt: null }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, organizationId: true, name: true, configuration: true } } } } } },
      } },
    },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  let leagueId = user.driver?.league.id ?? null;
  let seasonId = user.driver?.team?.seasonId ?? user.driver?.league.currentSeasonId ?? null;
  if (!seasonId) {
    const league = await optionalDashboardData("active league", () => prisma.league.findFirst({ where: { active: true, currentSeasonId: { not: null } }, orderBy: { displayOrder: "asc" }, select: { id: true, currentSeasonId: true } }), null);
    leagueId = league?.id ?? null;
    seasonId = league?.currentSeasonId ?? null;
  }

  const nextSchedule = leagueId ? await optionalDashboardData("next race", () => prisma.raceLeagueSchedule.findFirst({ where: { leagueId, scheduledAt: { gte: new Date() }, race: { seasonId: seasonId ?? undefined, status: { not: "CANCELLED" } } }, orderBy: { scheduledAt: "asc" }, include: { race: { include: { season: { select: { id: true, name: true } } } } } }), null) : null;
  const fallbackRace = nextSchedule ? null : await optionalDashboardData("next race fallback", () => prisma.race.findFirst({ where: { seasonId: seasonId ?? undefined, scheduledAt: { gte: new Date() }, status: { not: "CANCELLED" } }, orderBy: { scheduledAt: "asc" }, include: { season: { select: { id: true, name: true } } } }), null);
  const nextRace = nextSchedule?.race ?? fallbackRace;
  if (!seasonId && nextRace) seasonId = nextRace.seasonId;
  const driverId = user.driver?.id;
  const teamId = user.driver?.team?.seasonId === seasonId ? user.driver.team.id : null;

  const [championship, lastResult, latestResult, seasonProgress, notifications, unreadNotificationCount, driverStanding, teamStanding] = await Promise.all([
    seasonId && leagueId ? optionalDashboardData("championship", () => prisma.championship.findUnique({ where: { leagueId_seasonId: { leagueId, seasonId } }, include: { driverStandings: { orderBy: { position: "asc" }, take: 5, include: { driver: { select: { name: true, flag: true } } } }, teamStandings: { orderBy: { position: "asc" }, take: 5, include: { team: { select: { name: true, color: true, logoUrl: true, organization: { select: { name: true, color: true, logoUrl: true } } } } } } } }), null) : null,
    driverId && seasonId ? optionalDashboardData("driver result", () => prisma.raceResult.findFirst({ where: { driverId, resultSession: { leagueId: leagueId ?? undefined, session: "RACE", race: { seasonId } } }, orderBy: { resultSession: { race: { scheduledAt: "desc" } } }, select: { racePoints: true, bonusPoints: true } }), null) : null,
    seasonId && leagueId ? optionalDashboardData("latest published result", () => prisma.raceResultSession.findFirst({ where: { leagueId, session: "RACE", publicationStatus: "PUBLISHED", race: { seasonId } }, orderBy: { publishedAt: "desc" }, select: { publishedAt: true, race: { select: { id: true, name: true } }, results: { orderBy: [{ finalPosition: { sort: "asc", nulls: "last" } }, { position: "asc" }], take: 1, select: { finalPosition: true, position: true, racePoints: true, bonusPoints: true } } } }), null) : null,
    seasonId ? optionalDashboardData("season progress", () => prisma.season.findUnique({ where: { id: seasonId }, select: { id: true, name: true, races: { select: { status: true } } } }), null) : null,
    optionalDashboardData("notifications", () => getRecentNotifications(userId, 5), []),
    optionalDashboardData("notification count", () => getUnreadNotificationCount(userId), 0),
    driverId && seasonId ? optionalDashboardData("driver standing", () => prisma.driverStanding.findFirst({ where: { driverId, championship: { seasonId, leagueId: leagueId ?? undefined } } }), null) : null,
    teamId && seasonId ? optionalDashboardData("team standing", () => prisma.teamStanding.findFirst({ where: { teamId, championship: { seasonId, leagueId: leagueId ?? undefined } } }), null) : null,
  ]);

  const character = characterView(user.driverCharacter);
  const organization = user.driver?.seasonAssignments[0]?.organization ?? null;
  const selectedSuit = organization?.suitTemplates.find((template) => template.id === character.suitVariantId) ?? null;
  const publicTrack = nextRace ? publicRaceTrack(nextRace) : null;
  const winner = latestResult?.results[0] ?? null;
  const data: DashboardData = {
    identity: { displayName: user.displayName, avatarUrl: user.avatarUrl, character, teamSuit: suitView(selectedSuit, organization), driver: user.driver ? { id: user.driver.id, name: user.driver.name, number: user.driver.number, flag: user.driver.flag, lineupStatus: user.driver.seasonAssignments[0]?.lineupStatus ?? "PRIMARY", team: user.driver.team ? { id: user.driver.team.organization?.id ?? user.driver.team.id, name: user.driver.team.organization?.name ?? user.driver.team.name, shortName: user.driver.team.organization?.shortName ?? user.driver.team.shortName, color: user.driver.team.organization?.color ?? user.driver.team.color, logoUrl: user.driver.team.organization?.logoUrl ?? user.driver.team.logoUrl } : null, league: { id: user.driver.league.id, code: user.driver.league.code, name: user.driver.league.name } } : null, season: seasonProgress ? { id: seasonProgress.id, name: seasonProgress.name } : user.driver?.team?.season ?? null },
    nextRace: nextRace ? { id: nextRace.id, name: publicTrack?.name ?? "Mystery Track", circuit: publicTrack?.circuit ?? "Mystery Track", round: nextRace.round, scheduledAt: (nextSchedule?.scheduledAt ?? nextRace.scheduledAt).toISOString(), timezone: nextSchedule?.timezone ?? nextRace.timezone, sprint: nextRace.sprint, mystery: nextRace.mystery } : null,
    championship: { driver: driverStanding ? { position: driverStanding.position, points: driverStanding.points, gapToLeader: Math.max(0, (championship?.driverStandings[0]?.points ?? driverStanding.points) - driverStanding.points), lastRacePoints: (lastResult?.racePoints ?? 0) + (lastResult?.bonusPoints ?? 0), wins: driverStanding.wins, podiums: driverStanding.podiums } : null, team: teamStanding ? { position: teamStanding.position, points: teamStanding.points, gapToLeader: Math.max(0, (championship?.teamStandings[0]?.points ?? teamStanding.points) - teamStanding.points) } : null, topDrivers: championship?.driverStandings.map((standing) => ({ position: standing.position, name: standing.driver.name, flag: standing.driver.flag, points: standing.points })) ?? [], topTeams: championship?.teamStandings.map((standing) => ({ position: standing.position, name: standing.team.organization?.name ?? standing.team.name, color: standing.team.organization?.color ?? standing.team.color, logoUrl: standing.team.organization?.logoUrl ?? standing.team.logoUrl, points: standing.points })) ?? [] },
    seasonProgress: seasonProgress ? { completed: seasonProgress.races.filter((race) => race.status === "COMPLETED").length, total: seasonProgress.races.length } : null,
    latestResult: latestResult ? { raceId: latestResult.race.id, raceName: latestResult.race.name, position: winner?.finalPosition ?? winner?.position ?? null, points: (winner?.racePoints ?? 0) + (winner?.bonusPoints ?? 0), publishedAt: latestResult.publishedAt?.toISOString() ?? null } : null,
    notifications, unreadNotificationCount,
  };
  console.info("[dashboard] query completed", { durationMs: Math.round(performance.now() - startedAt) });
  return data;
}
