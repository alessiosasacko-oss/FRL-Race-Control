import "server-only";
import type { Role } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import type { ProfileData } from "./types";

export async function getProfileData(
  userId: number,
): Promise<ProfileData> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      driver: {
        include: {
          team: { select: { id: true, name: true, color: true } },
          league: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  if (!user.driver) {
    return {
      user: {
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        roles: user.roles as Role[],
      },
      driver: null,
      statistics: {
        races: 0,
        wins: 0,
        podiums: 0,
        poles: 0,
        fastestLaps: 0,
        championships: 0,
        attendancePercentage: 0,
        penalties: 0,
      },
    };
  }

  const [results, championships, eligibleRaces, attendance, penalties] =
    await Promise.all([
      prisma.raceResult.findMany({
        where: {
          driverId: user.driver.id,
          resultSession: { session: "RACE" },
        },
        select: {
          position: true,
          status: true,
          polePosition: true,
          fastestLap: true,
        },
      }),
      prisma.driverStanding.count({
        where: { driverId: user.driver.id, position: 1 },
      }),
      prisma.race.count({
        where: {
          season: { leagueId: user.driver.leagueId },
          scheduledAt: { lte: new Date() },
          status: { not: "CANCELLED" },
        },
      }),
      prisma.raceAttendance.count({
        where: {
          driverId: user.driver.id,
          status: "REGISTERED",
          race: { scheduledAt: { lte: new Date() } },
        },
      }),
      prisma.fiaTicket.count({
        where: {
          drivers: { some: { driverId: user.driver.id } },
          decision: {
            is: { penaltyType: { not: "NO_FURTHER_ACTION" } },
          },
        },
      }),
    ]);
  const classifiedResults = results.filter(
    (result) => result.status !== "DNS",
  );

  return {
    user: {
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles: user.roles as Role[],
    },
    driver: {
      id: user.driver.id,
      name: user.driver.name,
      number: user.driver.number,
      flag: user.driver.flag,
      countryCode: user.driver.countryCode,
      team: user.driver.team,
      league: user.driver.league,
    },
    statistics: {
      races: classifiedResults.length,
      wins: results.filter((result) => result.position === 1).length,
      podiums: results.filter(
        (result) =>
          result.position !== null && result.position <= 3,
      ).length,
      poles: results.filter((result) => result.polePosition).length,
      fastestLaps: results.filter((result) => result.fastestLap).length,
      championships,
      attendancePercentage:
        eligibleRaces > 0
          ? Math.round((attendance / eligibleRaces) * 100)
          : 0,
      penalties,
    },
  };
}
