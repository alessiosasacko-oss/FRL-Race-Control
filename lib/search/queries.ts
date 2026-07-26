import "server-only";
import { z } from "zod";
import { getPrismaClient } from "@/lib/db/prisma";
import { publicRaceTrack } from "@/lib/races/visibility";
import type { GlobalSearchResult } from "./types";

const globalSearchSchema = z.string().trim().min(2).max(100);

export async function globalSearch(
  input: string,
): Promise<GlobalSearchResult[]> {
  const parsed = globalSearchSchema.safeParse(input);
  if (!parsed.success) return [];

  const prisma = getPrismaClient();
  const q = parsed.data;
  const number = /^\d+$/.test(q) ? Number(q) : null;
  const [drivers, teams, races, tickets, seasons] =
    await Promise.all([
      prisma.driver.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { user: { displayName: { contains: q, mode: "insensitive" } } },
            ...(number === null ? [] : [{ number }]),
          ],
        },
        orderBy: { name: "asc" },
        take: 5,
        include: {
          team: { select: { name: true } },
          league: { select: { code: true } },
        },
      }),
      prisma.team.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { shortName: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take: 5,
        include: {
          league: { select: { code: true } },
          season: { select: { name: true } },
        },
      }),
      prisma.race.findMany({
        where: {
          OR: [
            {
              AND: [
                {
                  OR: [
                    { mystery: false },
                    {
                      scheduledAt: {
                        lte: new Date(Date.now() + 60 * 60 * 1000),
                      },
                    },
                  ],
                },
                {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    {
                      circuit: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              ],
            },
            ...(number === null ? [] : [{ round: number }]),
          ],
        },
        orderBy: { scheduledAt: "desc" },
        take: 5,
        include: {
          season: {
            include: { league: { select: { code: true } } },
          },
        },
      }),
      prisma.fiaTicket.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            ...(number === null ? [] : [{ id: number }]),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { league: { select: { code: true } } },
      }),
      prisma.season.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { league: { code: { contains: q, mode: "insensitive" } } },
            { league: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        orderBy: { startsOn: "desc" },
        take: 5,
        include: { league: { select: { code: true, name: true } } },
      }),
    ]);

  return [
    ...drivers.map((driver) => ({
      id: `driver-${driver.id}`,
      kind: "driver" as const,
      title: `#${driver.number} ${driver.name}`,
      subtitle: `${driver.team?.name ?? "Ohne Team"} · ${driver.league.code}`,
      href: `/drivers/${driver.id}`,
    })),
    ...teams.map((team) => ({
      id: `team-${team.id}`,
      kind: "team" as const,
      title: team.name,
      subtitle: `${team.league.code} · ${team.season.name}`,
      href: `/teams/${team.id}`,
    })),
    ...races.map((race) => {
      const track = publicRaceTrack(race);
      return {
        id: `race-${race.id}`,
        kind: "race" as const,
        title: track.name,
        subtitle: `${race.season.league.code} · ${race.season.name} · Runde ${race.round}`,
        href: `/results/${race.id}`,
      };
    }),
    ...tickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      kind: "ticket" as const,
      title: `#${ticket.id} ${ticket.title}`,
      subtitle: `${ticket.league.code} · FIA Race Control`,
      href: `/fia/${ticket.id}`,
    })),
    ...seasons.map((season) => ({
      id: `season-${season.id}`,
      kind: "season" as const,
      title: season.name,
      subtitle: `${season.league.code} · ${season.league.name}`,
      href: `/championship?leagueId=${season.leagueId}&seasonId=${season.id}`,
    })),
  ];
}
