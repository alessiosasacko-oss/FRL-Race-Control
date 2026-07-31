import "server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { publicRaceTrack } from "@/lib/races/visibility";

export async function getTrackAdminData() {
  const tracks = await getPrismaClient().track.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { visual: true, _count: { select: { races: true } } },
  });
  return tracks.map((track) => ({
    ...track,
    visual: track.visual,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  }));
}

export async function getTrackOptions() {
  return getPrismaClient().track.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, countryCode: true },
  });
}

export async function getRaceWeekendPageData(raceId: number) {
  const race = await getPrismaClient().race.findUnique({
    where: { id: raceId },
    include: {
      track: { include: { visual: true } },
      season: { select: { name: true } },
      leagueSchedules: {
        orderBy: [{ league: { displayOrder: "asc" } }, { scheduledAt: "asc" }],
        include: { league: { select: { id: true, code: true, name: true, color: true } } },
      },
      resultSessions: {
        where: { publicationStatus: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: { id: true, league: { select: { code: true, color: true } }, session: true },
      },
    },
  });
  if (!race) return null;
  const publicTrack = publicRaceTrack(race);
  return {
    id: race.id,
    name: publicTrack.name,
    circuit: publicTrack.circuit,
    countryCode: publicTrack.countryCode,
    trackRevealed: publicTrack.revealed,
    round: race.round,
    scheduledAt: race.scheduledAt.toISOString(),
    weekendDate: race.weekendDate.toISOString(),
    timezone: race.timezone,
    status: race.status,
    sprint: race.sprint,
    doublePoints: race.doublePoints,
    mystery: race.mystery,
    season: race.season,
    schedules: race.leagueSchedules.map((schedule) => ({
      id: schedule.id,
      scheduledAt: schedule.scheduledAt.toISOString(),
      timezone: schedule.timezone,
      league: schedule.league,
    })),
    results: race.resultSessions,
    track: publicTrack.revealed && race.track ? {
      id: race.track.id,
      name: race.track.name,
      countryCode: race.track.countryCode,
      lengthKm: race.track.lengthKm,
      lapCount: race.track.lapCount,
      totalDistanceKm: race.track.totalDistanceKm,
      sectorCount: race.track.sectorCount,
      drsZones: race.track.drsZones,
      overtakePoints: race.track.overtakePoints,
      longestStraightM: race.track.longestStraightM,
      poleSide: race.track.poleSide,
      pitLaneLossSeconds: race.track.pitLaneLossSeconds,
      notes: race.track.notes,
      visual: race.track.visual,
    } : null,
  };
}
