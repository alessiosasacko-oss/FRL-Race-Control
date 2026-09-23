"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { careerStatsView, reconcileDriverCareerStats } from "./career-stats";

export type CareerStatsActionState = { status: "idle" | "success" | "error"; message: string };

const totalsSchema = z.object({
  raceStarts: z.coerce.number().int().min(0).max(10000),
  wins: z.coerce.number().int().min(0).max(10000),
  podiums: z.coerce.number().int().min(0).max(10000),
  poles: z.coerce.number().int().min(0).max(10000),
  fastestLaps: z.coerce.number().int().min(0).max(10000),
  points: z.coerce.number().min(0).max(1000000),
  firstGrandPrix: z.string().trim().max(240),
  pastTeams: z.string().trim().max(4000),
});

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function authorized(driverId: number, adminOnly = false) {
  const actor = await requireAuthenticatedUser();
  const driver = await getPrismaClient().driver.findUnique({ where: { id: driverId }, select: { id: true, userId: true } });
  const admin = hasPermission(actor.roles, Permission.ManageMasterData);
  if (!driver || (adminOnly ? !admin : driver.userId !== actor.id && !admin)) return null;
  return { actor, driver, admin };
}

async function refresh(driverId: number) {
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath(`/admin/drivers/${driverId}`);
  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  await touchAppDataRevisionSafely(getPrismaClient(), ["drivers", "championship", "results"]);
}

export async function updateDriverCareerStatsAction(driverId: number, _previous: CareerStatsActionState, formData: FormData): Promise<CareerStatsActionState> {
  const auth = await authorized(driverId);
  if (!auth) return { status: "error", message: "Du darfst diese Fahrerstatistik nicht bearbeiten." };
  const parsed = totalsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Bitte prüfe die Statistikwerte." };
  await reconcileDriverCareerStats(driverId);
  const prisma = getPrismaClient();
  const current = await prisma.driverCareerStats.findUnique({ where: { driverId } });
  if (!current) return { status: "error", message: "Die Statistik konnte nicht geladen werden." };
  const pastTeams = [...new Set(parsed.data.pastTeams.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean))];
  const next = {
    manualRaceStartsAdjustment: parsed.data.raceStarts - current.autoRaceStarts,
    manualWinsAdjustment: parsed.data.wins - current.autoWins,
    manualPodiumsAdjustment: parsed.data.podiums - current.autoPodiums,
    manualPolesAdjustment: parsed.data.poles - current.autoPoles,
    manualFastestLapsAdjustment: parsed.data.fastestLaps - current.autoFastestLaps,
    manualPointsAdjustment: parsed.data.points - current.autoPoints,
    manualFirstGrandPrix: current.autoFirstGrandPrix ? current.manualFirstGrandPrix : parsed.data.firstGrandPrix || null,
    manualPastTeams: pastTeams,
  };
  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.driverCareerStats.update({ where: { driverId }, data: next });
    await transaction.driverCareerStatsAudit.create({ data: { driverId, actorId: auth.actor.id, action: "MANUAL_TOTALS_UPDATED", previousState: json(careerStatsView(current)), newState: json(careerStatsView(updated)) } });
  });
  await refresh(driverId);
  return { status: "success", message: "Karrierestatistik wurde gespeichert." };
}

export async function resyncDriverCareerStatsAction(driverId: number, _previous: CareerStatsActionState): Promise<CareerStatsActionState> {
  void _previous;
  const auth = await authorized(driverId, true);
  if (!auth) return { status: "error", message: "Nur Admins dürfen Statistiken neu synchronisieren." };
  const before = await getPrismaClient().driverCareerStats.findUnique({ where: { driverId } });
  const updated = await reconcileDriverCareerStats(driverId);
  if (!updated) return { status: "error", message: "Fahrer wurde nicht gefunden." };
  await getPrismaClient().driverCareerStatsAudit.create({ data: { driverId, actorId: auth.actor.id, action: "AUTOMATIC_RESYNC", previousState: json(careerStatsView(before)), newState: json(careerStatsView(updated)) } });
  await refresh(driverId);
  return { status: "success", message: "Automatische Statistik wurde neu berechnet; manuelle Korrekturen blieben erhalten." };
}

export async function resetDriverCareerAdjustmentsAction(driverId: number, _previous: CareerStatsActionState, formData: FormData): Promise<CareerStatsActionState> {
  const auth = await authorized(driverId, true);
  if (!auth) return { status: "error", message: "Nur Admins dürfen manuelle Korrekturen zurücksetzen." };
  if (formData.get("confirmation") !== "RESET") return { status: "error", message: "Bitte bestätige das Zurücksetzen ausdrücklich." };
  const prisma = getPrismaClient();
  const current = await prisma.driverCareerStats.findUnique({ where: { driverId } });
  if (!current) return { status: "error", message: "Die Statistik wurde nicht gefunden." };
  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.driverCareerStats.update({ where: { driverId }, data: {
      manualRaceStartsAdjustment: 0, manualWinsAdjustment: 0, manualPodiumsAdjustment: 0,
      manualPolesAdjustment: 0, manualFastestLapsAdjustment: 0, manualPointsAdjustment: 0,
      manualFirstGrandPrix: null, manualPastTeams: [],
    } });
    await transaction.driverCareerStatsAudit.create({ data: { driverId, actorId: auth.actor.id, action: "MANUAL_ADJUSTMENTS_RESET", previousState: json(careerStatsView(current)), newState: json(careerStatsView(updated)) } });
  });
  await refresh(driverId);
  return { status: "success", message: "Manuelle Korrekturen wurden zurückgesetzt." };
}
