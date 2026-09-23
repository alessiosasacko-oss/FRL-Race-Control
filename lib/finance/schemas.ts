import { z } from "zod";
import { FinanceTransactionType } from "@/domain";

const entityId = z.coerce.number().int().positive();
const euroAmount = z.preprocess(
  (value) => typeof value === "string" ? value.replace(/[.\s€]/g, "").replace(",", ".") : value,
  z.coerce.number().int().safe(),
);
const nonNegativeEuro = euroAmount.refine((value) => value >= 0, "Der Betrag darf nicht negativ sein.");

export const financeSelectionSchema = z.object({
  leagueId: entityId,
  seasonId: entityId,
});

export const startBalanceSchema = financeSelectionSchema.extend({
  organizationId: entityId,
  amountEuro: euroAmount,
  description: z.string().trim().min(3).max(500),
});

export const manualFinanceTransactionSchema = financeSelectionSchema.extend({
  organizationId: entityId,
  amountEuro: euroAmount.refine((value) => value !== 0, "Der Betrag darf nicht 0 sein."),
  type: z.enum([
    FinanceTransactionType.ManualAdjustment,
    FinanceTransactionType.RuleViolationFine,
    FinanceTransactionType.DriverTransfer,
  ]),
  description: z.string().trim().min(3).max(500),
  raceId: z.preprocess((value) => value === "" || value === null ? null : value, entityId.nullable()),
  driverId: z.preprocess((value) => value === "" || value === null ? null : value, entityId.nullable()),
});

export const financeRuleSchema = financeSelectionSchema.extend({
  defaultStartBalanceEuro: nonNegativeEuro,
  participationFeeBps: z.coerce.number().int().min(0).max(10_000),
  superLicensePerPointEuro: nonNegativeEuro,
  poleRewardEuro: nonNegativeEuro,
  fastestLapRewardEuro: nonNegativeEuro,
  dnfFeeEuro: nonNegativeEuro,
  dsqFeeEuro: nonNegativeEuro,
  pitRetirementFeeEuro: nonNegativeEuro,
  frontWingDamageFeeEuro: nonNegativeEuro,
  underfloorDamageFeeEuro: nonNegativeEuro,
  sidepodDamageFeeEuro: nonNegativeEuro,
  rearWingDamageFeeEuro: nonNegativeEuro,
  positionRewards: z.array(nonNegativeEuro).length(12),
  penaltyPoint8Euro: nonNegativeEuro,
  penaltyPoint20Euro: nonNegativeEuro,
  teamChampionshipRewards: z.array(nonNegativeEuro).length(11),
});

export const raceFinanceSchema = z.object({
  raceId: entityId,
  leagueId: entityId,
  useCurrentRules: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export const seasonFinanceSchema = financeSelectionSchema.extend({
  useCurrentRules: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export const financeDamageSchema = z.object({
  raceResultId: entityId,
  frontWingDamage: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  underfloorDamage: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  sidepodDamage: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  rearWingDamage: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export const financePublishSettingSchema = z.object({
  leagueId: entityId,
  guildSettingsId: entityId,
  enabled: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  autoReconcile: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  autoPublish: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  channelId: z.string().regex(/^\d{17,20}$/),
  pingRoleId: z.preprocess((value) => value === "" || value === null ? null : value, z.string().regex(/^\d{17,20}$/).nullable()),
  messageTemplate: z.string().trim().min(1).max(1000)
    .refine((value) => !/@everyone|@here|<@/i.test(value), "Direkte Discord-Erwähnungen sind nur über den Rollen-Selector erlaubt."),
  showBalances: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  showDelta: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});
