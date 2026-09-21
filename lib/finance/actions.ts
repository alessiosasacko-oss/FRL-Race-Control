"use server";

import { revalidatePath } from "next/cache";
import { FinanceTransactionType } from "@/generated/prisma/client";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { queueAutomaticFinancePublication, queueFinanceDiscordPublication } from "./discord";
import {
  createFinanceRuleVersion,
  createManualFinanceTransaction,
  saveFinancePublishSetting,
  saveResultFinanceDamage,
  setTeamStartBalance,
} from "./mutations";
import { reconcileAutomaticallyConfiguredRace, reconcileRaceFinances } from "./reconciliation";
import { reconcileSeasonFinances } from "./season-settlement";
import {
  financeDamageSchema,
  financePublishSettingSchema,
  financeRuleSchema,
  manualFinanceTransactionSchema,
  raceFinanceSchema,
  seasonFinanceSchema,
  startBalanceSchema,
} from "./schemas";
import type { FinanceActionState } from "./types";

function errorState(message: string): FinanceActionState {
  return { status: "error", message };
}

function successState(message: string): FinanceActionState {
  return { status: "success", message };
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Die Finanzaktion konnte nicht abgeschlossen werden.";
  const messages: Record<string, string> = {
    RESULTS_NOT_READY: "Qualifying und Rennen müssen zuerst veröffentlicht werden.",
    NO_TEAMS: "Es wurden keine veröffentlichten Rennteilnehmer gefunden.",
    FINANCE_PUBLISHING_DISABLED: "Finance-Publishing ist für diese Liga nicht aktiv.",
    FINANCE_SETTLEMENT_NOT_FOUND: "Die Rennfinanzen müssen zuerst finalisiert werden.",
    DISCORD_CHANNEL_INVALID: "Der ausgewählte Discord-Kanal ist nicht verfügbar oder dem Bot fehlen Rechte.",
    DISCORD_ROLE_INVALID: "Die ausgewählte Discord-Rolle ist nicht konfiguriert.",
  };
  return messages[error.message] ?? "Die Finanzaktion konnte nicht abgeschlossen werden.";
}

function revalidateFinance(): void {
  revalidatePath("/admin/finance");
  revalidatePath("/admin/results");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function setStartBalanceAction(_previous: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const actor = await requirePermission(Permission.ManageFinance);
  const parsed = startBalanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Bitte Team, Kontext, Betrag und Begründung vollständig prüfen.");
  try {
    await setTeamStartBalance({ ...parsed.data, amountEuro: BigInt(parsed.data.amountEuro), actorUserId: actor.id });
    revalidateFinance();
    return successState("Startkontostand wurde revisionssicher angepasst.");
  } catch (error: unknown) {
    return errorState(errorMessage(error));
  }
}

export async function createManualFinanceTransactionAction(_previous: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const actor = await requirePermission(Permission.ManageFinance);
  const parsed = manualFinanceTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Bitte Buchung, Betrag und Begründung vollständig prüfen.");
  try {
    await createManualFinanceTransaction({ ...parsed.data, type: parsed.data.type as FinanceTransactionType, amountEuro: BigInt(parsed.data.amountEuro), actorUserId: actor.id });
    revalidateFinance();
    return successState("Finanzbuchung wurde erstellt und auditiert.");
  } catch (error: unknown) {
    return errorState(errorMessage(error));
  }
}

export async function saveFinanceRulesAction(_previous: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const actor = await requirePermission(Permission.ManageFinance);
  const parsed = financeRuleSchema.safeParse({
    ...Object.fromEntries(formData),
    positionRewards: formData.getAll("positionRewards"),
    teamChampionshipRewards: formData.getAll("teamChampionshipRewards"),
  });
  if (!parsed.success) return errorState("Die Finanzregeln enthalten ungültige Werte.");
  try {
    await createFinanceRuleVersion({
      ...parsed.data,
      actorUserId: actor.id,
      defaultStartBalanceEuro: BigInt(parsed.data.defaultStartBalanceEuro),
      superLicensePerPointEuro: BigInt(parsed.data.superLicensePerPointEuro),
      poleRewardEuro: BigInt(parsed.data.poleRewardEuro),
      fastestLapRewardEuro: BigInt(parsed.data.fastestLapRewardEuro),
      dnfFeeEuro: BigInt(parsed.data.dnfFeeEuro),
      dsqFeeEuro: BigInt(parsed.data.dsqFeeEuro),
      pitRetirementFeeEuro: BigInt(parsed.data.pitRetirementFeeEuro),
      frontWingDamageFeeEuro: BigInt(parsed.data.frontWingDamageFeeEuro),
      underfloorDamageFeeEuro: BigInt(parsed.data.underfloorDamageFeeEuro),
      sidepodDamageFeeEuro: BigInt(parsed.data.sidepodDamageFeeEuro),
      rearWingDamageFeeEuro: BigInt(parsed.data.rearWingDamageFeeEuro),
      positionRewards: parsed.data.positionRewards.map((value) => BigInt(value)),
      penaltyPoint8Euro: BigInt(parsed.data.penaltyPoint8Euro),
      penaltyPoint20Euro: BigInt(parsed.data.penaltyPoint20Euro),
      teamChampionshipRewards: parsed.data.teamChampionshipRewards.map((value) => BigInt(value)),
    });
    revalidateFinance();
    return successState("Neue Regelversion wurde aktiviert. Alte Abrechnungen behalten ihre Regelversion.");
  } catch (error: unknown) {
    return errorState(errorMessage(error));
  }
}

export async function reconcileRaceFinanceAction(_previous: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const actor = await requirePermission(Permission.ManageFinance);
  const parsed = raceFinanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Rennen oder Liga sind ungültig.");
  try {
    const result = await reconcileRaceFinances({ ...parsed.data, actorUserId: actor.id });
    await queueAutomaticFinancePublication(parsed.data.raceId, parsed.data.leagueId, result.changed);
    revalidateFinance();
    return successState(result.changed ? `Rennfinanzen wurden als Revision ${result.revision} abgeglichen.` : "Rennfinanzen sind bereits aktuell; keine Doppelbuchung erstellt.");
  } catch (error: unknown) {
    return errorState(errorMessage(error));
  }
}

export async function reconcileSeasonFinanceAction(_previous: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const actor = await requirePermission(Permission.ManageFinance);
  const parsed = seasonFinanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Saison oder Liga sind ungültig.");
  try {
    const result = await reconcileSeasonFinances({ ...parsed.data, actorUserId: actor.id });
    revalidateFinance();
    return successState(result.changed ? `Team-WM-Endauszahlung wurde als Revision ${result.revision} gebucht.` : "Die Team-WM-Endauszahlung ist bereits aktuell.");
  } catch (error: unknown) {
    return errorState(errorMessage(error));
  }
}

export async function saveFinanceDamageAction(_previous: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const actor = await requirePermission(Permission.ManageFinance);
  const parsed = financeDamageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Schadensdaten sind ungültig.");
  try {
    await saveResultFinanceDamage({ ...parsed.data, actorUserId: actor.id });
    revalidateFinance();
    return successState("Finanzrelevante Schäden wurden gespeichert.");
  } catch (error: unknown) {
    return errorState(errorMessage(error));
  }
}

export async function saveFinancePublishSettingAction(_previous: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const actor = await requirePermission(Permission.ManageFinance);
  const parsed = financePublishSettingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Discord-Konfiguration ist unvollständig oder ungültig.");
  try {
    await saveFinancePublishSetting({ ...parsed.data, actorUserId: actor.id });
    revalidateFinance();
    return successState("Finance-Publishing wurde gespeichert.");
  } catch (error: unknown) {
    return errorState(errorMessage(error));
  }
}

export async function publishFinanceDiscordAction(_previous: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  await requirePermission(Permission.ManageFinance);
  const parsed = raceFinanceSchema.pick({ raceId: true, leagueId: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Rennen oder Liga sind ungültig.");
  try {
    const result = await queueFinanceDiscordPublication(parsed.data.raceId, parsed.data.leagueId, { force: true });
    revalidateFinance();
    return successState(result.queued ? "Discord-Veröffentlichung wurde sicher in die Outbox gelegt." : "Diese Revision ist bereits eingeplant.");
  } catch (error: unknown) {
    return errorState(errorMessage(error));
  }
}

export async function triggerAutomaticRaceFinanceAction(raceId: number, leagueId: number): Promise<void> {
  await requirePermission(Permission.ManageResults);
  const result = await reconcileAutomaticallyConfiguredRace(raceId, leagueId);
  if (result.processed) await queueAutomaticFinancePublication(raceId, leagueId, result.changed);
  if (result.processed) revalidateFinance();
}
