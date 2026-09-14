import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  NotificationType as PrismaNotificationType,
  PrismaClient,
  RaceSession as PrismaRaceSession,
  RaceStatus as PrismaRaceStatus,
  ResultSession as PrismaResultSession,
  Role as PrismaRole,
} from "../generated/prisma/client";
import { drivers } from "../lib/data/drivers";
import { leagues } from "../lib/data/leagues";
import { races } from "../lib/data/races";
import { seasons } from "../lib/data/seasons";
import { teams } from "../lib/data/teams";
import {
  DEFAULT_RACE_POINTS,
  DEFAULT_SPRINT_POINTS,
} from "../lib/championship/scoring";
import { calculateLeagueRaceSchedule } from "../lib/races/scheduling";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the development database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function seed(): Promise<void> {
  await prisma.user.upsert({
    where: { id: 1 },
    update: {
      displayName: "FRL Race Control",
      roles: [PrismaRole.ADMIN],
      active: true,
    },
    create: {
      id: 1,
      displayName: "FRL Race Control",
      roles: [PrismaRole.ADMIN],
      active: true,
    },
  });
  await prisma.userSettings.upsert({
    where: { userId: 1 },
    update: {
      inAppEnabled: true,
      inAppCategories: Object.values(PrismaNotificationType),
      emailEnabled: false,
      emailCategories: Object.values(PrismaNotificationType),
      timezone: "Europe/Berlin",
      theme: "dark",
      language: "de",
    },
    create: {
      userId: 1,
      inAppEnabled: true,
      inAppCategories: Object.values(PrismaNotificationType),
      emailEnabled: false,
      emailCategories: Object.values(PrismaNotificationType),
      timezone: "Europe/Berlin",
      theme: "dark",
      language: "de",
    },
  });

  for (const league of leagues) {
    const data = {
      name: league.name,
      code: league.code,
      description: league.description,
      active: league.active,
      raceWeekday: league.raceWeekday,
      raceStartMinute: league.raceStartMinute,
      raceTimezone: league.raceTimezone,
      displayOrder: league.displayOrder,
    };

    await prisma.league.upsert({
      where: { id: league.id },
      update: data,
      create: { id: league.id, ...data },
    });
  }

  for (const season of seasons) {
    const data = {
      leagueId: season.leagueId,
      name: season.name,
      startsOn: new Date(`${season.startsOn}T00:00:00.000Z`),
      endsOn: new Date(`${season.endsOn}T00:00:00.000Z`),
      active: season.active,
      archivedAt: season.archivedAt
        ? new Date(season.archivedAt)
        : null,
      participatingLeagues: {
        connect: season.participatingLeagueIds.map((id) => ({ id })),
      },
    };

    await prisma.season.upsert({
      where: { id: season.id },
      update: data,
      create: { id: season.id, ...data },
    });
  }

  for (const league of leagues) {
    await prisma.league.update({
      where: { id: league.id },
      data: { currentSeasonId: league.currentSeasonId },
    });
  }

  const organizationByTeamId = new Map<number, number>();
  for (const team of teams) {
    const organization = await prisma.teamOrganization.upsert({
      where: { name: team.name },
      update: {
        shortName: team.shortName,
        color: team.color,
        active: team.active,
        archivedAt: team.active ? null : new Date(),
      },
      create: {
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        active: team.active,
        archivedAt: team.active ? null : new Date(),
      },
    });
    organizationByTeamId.set(team.id, organization.id);
  }

  for (const team of teams) {
    const organizationId = organizationByTeamId.get(team.id);
    if (!organizationId) throw new Error(`Missing organization for team ${team.id}`);
    const data = {
      leagueId: team.leagueId,
      seasonId: team.seasonId,
      organizationId,
      principalUserId: null,
      name: team.name,
      shortName: team.shortName,
      color: team.color,
      active: team.active,
      archivedAt: team.active ? null : new Date(),
      systemManaged: true,
      internalSlotKey: `organization:${organizationId}:season:${team.seasonId}:league:${team.leagueId}`,
    };

    await prisma.team.upsert({
      where: { id: team.id },
      update: data,
      create: { id: team.id, ...data },
    });
  }

  for (const driver of drivers) {
    const data = {
      userId: driver.userId,
      teamId: driver.teamId,
      leagueId: driver.leagueId,
      name: driver.name,
      number: driver.number,
      flag: driver.flag,
      countryCode: driver.countryCode,
      active: driver.active,
    };

    await prisma.driver.upsert({
      where: { id: driver.id },
      update: data,
      create: { id: driver.id, ...data },
    });
  }

  for (const race of races) {
    const data = {
      seasonId: race.seasonId,
      name: race.name,
      circuit: race.circuit,
      countryCode: race.countryCode,
      round: race.round,
      weekendDate: new Date(`${race.weekendDate}T00:00:00.000Z`),
      scheduledAt: new Date(race.scheduledAt),
      timezone: race.timezone,
      status: race.status as PrismaRaceStatus,
      sessions: race.sessions.map(
        (session) => session as PrismaRaceSession,
      ),
      sprint: race.sprint,
      doublePoints: race.doublePoints,
      mystery: race.mystery,
    };

    const raceRecord = await prisma.race.upsert({
      where: { id: race.id },
      update: data,
      create: { id: race.id, ...data },
    });
    const season = seasons.find((item) => item.id === race.seasonId);
    const calculatedSchedules = leagues
      .filter((league) =>
        season?.participatingLeagueIds.includes(league.id),
      )
      .map((league) => ({
        league,
        ...calculateLeagueRaceSchedule(race.weekendDate, league),
      }));
    for (const schedule of calculatedSchedules) {
      await prisma.raceLeagueSchedule.upsert({
        where: {
          raceId_leagueId: {
            raceId: raceRecord.id,
            leagueId: schedule.league.id,
          },
        },
        update: {
          scheduledAt: schedule.scheduledAt,
          timezone: schedule.timezone,
        },
        create: {
          raceId: raceRecord.id,
          leagueId: schedule.league.id,
          scheduledAt: schedule.scheduledAt,
          timezone: schedule.timezone,
        },
      });
    }
    const firstSchedule = calculatedSchedules.sort(
      (left, right) =>
        left.scheduledAt.getTime() - right.scheduledAt.getTime(),
    )[0];
    if (firstSchedule) {
      await prisma.race.update({
        where: { id: raceRecord.id },
        data: {
          scheduledAt: firstSchedule.scheduledAt,
          timezone: firstSchedule.timezone,
        },
      });
    }
  }

  for (const season of seasons) {
    for (const leagueId of season.participatingLeagueIds) {
      await prisma.championship.upsert({
        where: {
          leagueId_seasonId: { leagueId, seasonId: season.id },
        },
        update: { name: `${season.name} Championship` },
        create: {
          leagueId,
          seasonId: season.id,
          name: `${season.name} Championship`,
        },
      });

      const scoringConfiguration =
        await prisma.scoringConfiguration.upsert({
          where: {
            leagueId_seasonId: { leagueId, seasonId: season.id },
          },
        update: {
          fastestLapPoint: 1,
          fastestLapRequiresTopPosition: 10,
          polePositionPoint: 0,
          dnfScoresPoints: false,
          retiredScoresPoints: false,
          minimumClassifiedPercentage: 90,
          teamPointsEnabled: true,
          substituteDriverPointsEnabled: true,
          deductPenaltyPoints: false,
        },
        create: {
          leagueId,
          seasonId: season.id,
          fastestLapPoint: 1,
          fastestLapRequiresTopPosition: 10,
          polePositionPoint: 0,
          dnfScoresPoints: false,
          retiredScoresPoints: false,
          minimumClassifiedPercentage: 90,
          teamPointsEnabled: true,
          substituteDriverPointsEnabled: true,
          deductPenaltyPoints: false,
        },
        });

      await prisma.scoringPosition.deleteMany({
        where: { scoringConfigurationId: scoringConfiguration.id },
      });
      await prisma.scoringPosition.createMany({
        data: [
        ...DEFAULT_RACE_POINTS.map(
          (points, index) => ({
            scoringConfigurationId: scoringConfiguration.id,
            session: PrismaResultSession.RACE,
            position: index + 1,
            points,
          }),
        ),
        ...DEFAULT_SPRINT_POINTS.map(
          (points, index) => ({
            scoringConfigurationId: scoringConfiguration.id,
            session: PrismaResultSession.SPRINT,
            position: index + 1,
            points,
          }),
        ),
        ],
      });
    }
  }

  const explicitlySeededTables = [
    "User",
    "League",
    "Season",
    "Team",
    "Driver",
    "Race",
    "Championship",
  ] as const;

  for (const table of explicitlySeededTables) {
    await prisma.$queryRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE(MAX("id"), 1), MAX("id") IS NOT NULL) FROM "${table}"`,
    );
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
