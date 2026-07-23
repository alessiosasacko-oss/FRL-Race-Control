"use server";

import { revalidatePath } from "next/cache";
import {
  RaceSession as PrismaRaceSession,
  RaceStatus as PrismaRaceStatus,
} from "@/generated/prisma/client";
import { RaceSession } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  driverSchema,
  entityIdSchema,
  leagueUpdateSchema,
  raceSchema,
  seasonSchema,
  teamSchema,
} from "./schemas";
import { zonedLocalToUtc } from "./timezone";
import type { MasterDataActionState } from "./types";

function errorState(
  message: string,
  fieldErrors?: Record<string, string[]>,
): MasterDataActionState {
  return { status: "error", message, fieldErrors };
}

function successState(message: string): MasterDataActionState {
  return { status: "success", message };
}

function validationState(
  result: { error: { flatten: () => { fieldErrors: unknown } } },
): MasterDataActionState {
  return errorState(
    "Bitte prüfe die markierten Angaben.",
    result.error.flatten().fieldErrors as Record<string, string[]>,
  );
}

function databaseError(): MasterDataActionState {
  return errorState(
    "Die Änderung konnte nicht gespeichert werden. Prüfe eindeutige Namen, Kürzel, Startnummern und Verknüpfungen.",
  );
}

function revalidateMasterData(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/leagues");
  revalidatePath("/admin/seasons");
  revalidatePath("/admin/races");
  revalidatePath("/admin/drivers");
  revalidatePath("/admin/teams");
  revalidatePath("/calendar");
  revalidatePath("/drivers");
  revalidatePath("/drivers/[id]", "page");
  revalidatePath("/teams");
  revalidatePath("/teams/[id]", "page");
  revalidatePath("/fia");
  revalidatePath("/fia/new");
}

async function authorize(): Promise<void> {
  await requirePermission(Permission.ManageMasterData);
}

export async function updateLeagueAction(
  leagueIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const leagueId = entityIdSchema.safeParse(leagueIdInput);
  const parsed = leagueUpdateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    currentSeasonId: formData.get("currentSeasonId"),
    active: formData.get("active"),
  });

  if (!leagueId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültige Liga.")
      : validationState(parsed);
  }

  const prisma = getPrismaClient();

  try {
    if (parsed.data.currentSeasonId) {
      const season = await prisma.season.findFirst({
        where: {
          id: parsed.data.currentSeasonId,
          leagueId: leagueId.data,
          active: true,
          archivedAt: null,
        },
        select: { id: true },
      });

      if (!season) {
        return errorState("Die aktuelle Saison muss zu dieser Liga gehören.");
      }
    }

    await prisma.league.update({
      where: { id: leagueId.data },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        currentSeasonId: parsed.data.currentSeasonId,
        active: parsed.data.active,
      },
    });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Liga wurde aktualisiert.");
}

function seasonPayload(formData: FormData) {
  return {
    leagueId: formData.get("leagueId"),
    name: formData.get("name"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    active: formData.get("active"),
  };
}

export async function createSeasonAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const parsed = seasonSchema.safeParse(seasonPayload(formData));

  if (!parsed.success) return validationState(parsed);

  const prisma = getPrismaClient();

  try {
    await prisma.season.create({
      data: {
        leagueId: parsed.data.leagueId,
        name: parsed.data.name,
        startsOn: new Date(`${parsed.data.startsOn}T00:00:00.000Z`),
        endsOn: new Date(`${parsed.data.endsOn}T00:00:00.000Z`),
        active: parsed.data.active,
      },
    });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Saison wurde erstellt.");
}

export async function updateSeasonAction(
  seasonIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const seasonId = entityIdSchema.safeParse(seasonIdInput);
  const parsed = seasonSchema.safeParse(seasonPayload(formData));

  if (!seasonId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültige Saison.")
      : validationState(parsed);
  }

  const prisma = getPrismaClient();

  try {
    const current = await prisma.season.findUnique({
      where: { id: seasonId.data },
      select: { leagueId: true },
    });

    if (!current) return errorState("Saison wurde nicht gefunden.");

    await prisma.$transaction(async (transaction) => {
      await transaction.season.update({
        where: { id: seasonId.data },
        data: {
          leagueId: parsed.data.leagueId,
          name: parsed.data.name,
          startsOn: new Date(`${parsed.data.startsOn}T00:00:00.000Z`),
          endsOn: new Date(`${parsed.data.endsOn}T00:00:00.000Z`),
          active: parsed.data.active,
          archivedAt: parsed.data.active ? null : undefined,
        },
      });

      if (
        current.leagueId !== parsed.data.leagueId ||
        !parsed.data.active
      ) {
        await transaction.league.updateMany({
          where: { currentSeasonId: seasonId.data },
          data: { currentSeasonId: null },
        });
      }
    });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Saison wurde aktualisiert.");
}

export async function archiveSeasonAction(
  seasonIdInput: number,
  previousState: MasterDataActionState,
): Promise<MasterDataActionState> {
  void previousState;
  await authorize();
  const seasonId = entityIdSchema.safeParse(seasonIdInput);

  if (!seasonId.success) return errorState("Ungültige Saison.");

  const prisma = getPrismaClient();

  try {
    await prisma.$transaction([
      prisma.season.update({
        where: { id: seasonId.data },
        data: { active: false, archivedAt: new Date() },
      }),
      prisma.league.updateMany({
        where: { currentSeasonId: seasonId.data },
        data: { currentSeasonId: null },
      }),
    ]);
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Saison wurde archiviert.");
}

function racePayload(formData: FormData) {
  return {
    leagueId: formData.get("leagueId"),
    seasonId: formData.get("seasonId"),
    name: formData.get("name"),
    circuit: formData.get("circuit"),
    countryCode: formData.get("countryCode"),
    round: formData.get("round"),
    localStart: formData.get("localStart"),
    timezone: formData.get("timezone"),
    status: formData.get("status"),
    sprint: formData.get("sprint"),
    doublePoints: formData.get("doublePoints"),
    mystery: formData.get("mystery"),
  };
}

async function validateRaceRelations(
  leagueId: number,
  seasonId: number,
): Promise<boolean> {
  const prisma = getPrismaClient();
  return Boolean(
    await prisma.season.findFirst({
      where: { id: seasonId, leagueId },
      select: { id: true },
    }),
  );
}

function raceSessions(sprint: boolean): PrismaRaceSession[] {
  return [
    RaceSession.Practice,
    RaceSession.Qualifying,
    ...(sprint ? [RaceSession.Sprint] : []),
    RaceSession.Race,
  ] as PrismaRaceSession[];
}

export async function createRaceAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const parsed = raceSchema.safeParse(racePayload(formData));

  if (!parsed.success) return validationState(parsed);
  if (
    !(await validateRaceRelations(
      parsed.data.leagueId,
      parsed.data.seasonId,
    ))
  ) {
    return errorState("Die Saison gehört nicht zur gewählten Liga.");
  }

  let scheduledAt: Date;

  try {
    scheduledAt = zonedLocalToUtc(
      parsed.data.localStart,
      parsed.data.timezone,
    );
  } catch {
    return errorState(
      "Die lokale Startzeit existiert in der gewählten Zeitzone nicht.",
    );
  }

  const prisma = getPrismaClient();

  try {
    await prisma.race.create({
      data: {
        seasonId: parsed.data.seasonId,
        name: parsed.data.name,
        circuit: parsed.data.circuit,
        countryCode: parsed.data.countryCode,
        round: parsed.data.round,
        scheduledAt,
        timezone: parsed.data.timezone,
        status: parsed.data.status as PrismaRaceStatus,
        sessions: raceSessions(parsed.data.sprint),
        sprint: parsed.data.sprint,
        doublePoints: parsed.data.doublePoints,
        mystery: parsed.data.mystery,
      },
    });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Rennen wurde erstellt.");
}

export async function updateRaceAction(
  raceIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const raceId = entityIdSchema.safeParse(raceIdInput);
  const parsed = raceSchema.safeParse(racePayload(formData));

  if (!raceId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültiges Rennen.")
      : validationState(parsed);
  }

  if (
    !(await validateRaceRelations(
      parsed.data.leagueId,
      parsed.data.seasonId,
    ))
  ) {
    return errorState("Die Saison gehört nicht zur gewählten Liga.");
  }

  let scheduledAt: Date;

  try {
    scheduledAt = zonedLocalToUtc(
      parsed.data.localStart,
      parsed.data.timezone,
    );
  } catch {
    return errorState("Ungültige lokale Startzeit.");
  }

  const prisma = getPrismaClient();

  try {
    await prisma.race.update({
      where: { id: raceId.data },
      data: {
        seasonId: parsed.data.seasonId,
        name: parsed.data.name,
        circuit: parsed.data.circuit,
        countryCode: parsed.data.countryCode,
        round: parsed.data.round,
        scheduledAt,
        timezone: parsed.data.timezone,
        status: parsed.data.status as PrismaRaceStatus,
        sessions: raceSessions(parsed.data.sprint),
        sprint: parsed.data.sprint,
        doublePoints: parsed.data.doublePoints,
        mystery: parsed.data.mystery,
      },
    });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Rennen wurde aktualisiert.");
}

export async function deleteRaceAction(
  raceIdInput: number,
  previousState: MasterDataActionState,
): Promise<MasterDataActionState> {
  void previousState;
  await authorize();
  const raceId = entityIdSchema.safeParse(raceIdInput);

  if (!raceId.success) return errorState("Ungültiges Rennen.");

  const prisma = getPrismaClient();

  try {
    const ticketCount = await prisma.fiaTicket.count({
      where: { raceId: raceId.data },
    });

    if (ticketCount > 0) {
      return errorState(
        "Rennen mit FIA-Tickets können nicht gelöscht werden. Setze den Status stattdessen auf Abgesagt.",
      );
    }

    await prisma.race.delete({ where: { id: raceId.data } });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Rennen wurde gelöscht.");
}

function driverPayload(formData: FormData) {
  return {
    name: formData.get("name"),
    number: formData.get("number"),
    flag: formData.get("flag"),
    countryCode: formData.get("countryCode"),
    userId: formData.get("userId"),
    leagueId: formData.get("leagueId"),
    teamId: formData.get("teamId"),
    active: formData.get("active"),
  };
}

async function driverTeamIsValid(
  leagueId: number,
  teamId: number | null,
): Promise<boolean> {
  if (!teamId) return true;
  const prisma = getPrismaClient();
  return Boolean(
    await prisma.team.findFirst({
      where: { id: teamId, leagueId },
      select: { id: true },
    }),
  );
}

export async function createDriverAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const parsed = driverSchema.safeParse(driverPayload(formData));

  if (!parsed.success) return validationState(parsed);
  if (
    !(await driverTeamIsValid(
      parsed.data.leagueId,
      parsed.data.teamId,
    ))
  ) {
    return errorState("Das Team gehört nicht zur gewählten Liga.");
  }

  const prisma = getPrismaClient();

  try {
    await prisma.driver.create({ data: parsed.data });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Fahrer wurde erstellt.");
}

export async function updateDriverAction(
  driverIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const driverId = entityIdSchema.safeParse(driverIdInput);
  const parsed = driverSchema.safeParse(driverPayload(formData));

  if (!driverId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültiger Fahrer.")
      : validationState(parsed);
  }

  if (
    !(await driverTeamIsValid(
      parsed.data.leagueId,
      parsed.data.teamId,
    ))
  ) {
    return errorState("Das Team gehört nicht zur gewählten Liga.");
  }

  const prisma = getPrismaClient();

  try {
    await prisma.driver.update({
      where: { id: driverId.data },
      data: parsed.data,
    });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Fahrer wurde aktualisiert.");
}

function teamPayload(formData: FormData) {
  return {
    name: formData.get("name"),
    shortName: formData.get("shortName"),
    color: formData.get("color"),
    leagueId: formData.get("leagueId"),
    seasonId: formData.get("seasonId"),
    principalUserId: formData.get("principalUserId"),
    driverIds: formData.getAll("driverIds"),
    active: formData.get("active"),
  };
}

async function teamSeasonIsValid(
  leagueId: number,
  seasonId: number,
): Promise<boolean> {
  const prisma = getPrismaClient();
  return Boolean(
    await prisma.season.findFirst({
      where: { id: seasonId, leagueId },
      select: { id: true },
    }),
  );
}

async function teamLineupIsValid(
  leagueId: number,
  driverIds: number[],
  currentTeamId?: number,
): Promise<boolean> {
  if (driverIds.length === 0) return true;

  const prisma = getPrismaClient();
  const validDriverCount = await prisma.driver.count({
    where: {
      id: { in: driverIds },
      OR: [
        { leagueId },
        ...(currentTeamId ? [{ teamId: currentTeamId }] : []),
      ],
    },
  });

  return validDriverCount === new Set(driverIds).size;
}

export async function createTeamAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const parsed = teamSchema.safeParse(teamPayload(formData));

  if (!parsed.success) return validationState(parsed);
  if (
    !(await teamSeasonIsValid(
      parsed.data.leagueId,
      parsed.data.seasonId,
    ))
  ) {
    return errorState("Die Saison gehört nicht zur gewählten Liga.");
  }
  if (
    !(await teamLineupIsValid(
      parsed.data.leagueId,
      parsed.data.driverIds,
    ))
  ) {
    return errorState(
      "Alle Fahrer im Line-up müssen zur gewählten Liga gehören.",
    );
  }

  const prisma = getPrismaClient();
  const { driverIds, ...teamData } = parsed.data;

  try {
    await prisma.$transaction(async (transaction) => {
      const team = await transaction.team.create({ data: teamData });

      if (driverIds.length > 0) {
        await transaction.driver.updateMany({
          where: { id: { in: driverIds } },
          data: { teamId: team.id },
        });
      }
    });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Team wurde erstellt.");
}

export async function updateTeamAction(
  teamIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const teamId = entityIdSchema.safeParse(teamIdInput);
  const parsed = teamSchema.safeParse(teamPayload(formData));

  if (!teamId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültiges Team.")
      : validationState(parsed);
  }

  if (
    !(await teamSeasonIsValid(
      parsed.data.leagueId,
      parsed.data.seasonId,
    ))
  ) {
    return errorState("Die Saison gehört nicht zur gewählten Liga.");
  }
  if (
    !(await teamLineupIsValid(
      parsed.data.leagueId,
      parsed.data.driverIds,
      teamId.data,
    ))
  ) {
    return errorState(
      "Alle neuen Fahrer im Line-up müssen zur gewählten Liga gehören.",
    );
  }

  const prisma = getPrismaClient();
  const { driverIds, ...teamData } = parsed.data;

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.team.update({
        where: { id: teamId.data },
        data: teamData,
      });
      await transaction.driver.updateMany({
        where: {
          teamId: teamId.data,
          id: { notIn: driverIds },
        },
        data: { teamId: null },
      });
      if (driverIds.length > 0) {
        await transaction.driver.updateMany({
          where: { id: { in: driverIds } },
          data: {
            leagueId: parsed.data.leagueId,
            teamId: teamId.data,
          },
        });
      }
    });
  } catch {
    return databaseError();
  }

  revalidateMasterData();
  return successState("Team wurde aktualisiert.");
}
