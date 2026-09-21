import { ResultStatus } from "@/domain";

export type FinancePositionReward = { position: number; amountEuro: bigint };
export type FinancePenaltyThreshold = { points: number; amountEuro: bigint };

export type FinanceRules = {
  defaultStartBalanceEuro: bigint;
  participationFeeBps: number;
  superLicensePerPointEuro: bigint;
  poleRewardEuro: bigint;
  fastestLapRewardEuro: bigint;
  dnfFeeEuro: bigint;
  dsqFeeEuro: bigint;
  pitRetirementFeeEuro: bigint;
  frontWingDamageFeeEuro: bigint;
  underfloorDamageFeeEuro: bigint;
  sidepodDamageFeeEuro: bigint;
  rearWingDamageFeeEuro: bigint;
  positionRewards: FinancePositionReward[];
  penaltyPointThresholds: FinancePenaltyThreshold[];
  teamChampionshipRewards: FinancePositionReward[];
};

export const DEFAULT_POSITION_REWARDS: FinancePositionReward[] = [
  4_500_000, 4_000_000, 3_750_000, 3_250_000,
  2_750_000, 2_500_000, 2_250_000, 2_000_000,
  1_750_000, 1_500_000, 1_000_000, 850_000,
].map((value) => BigInt(value)).map((amountEuro, index) => ({ position: index + 1, amountEuro }));

export const DEFAULT_TEAM_CHAMPIONSHIP_REWARDS: FinancePositionReward[] = [
  30_000_000, 27_000_000, 24_000_000, 21_000_000,
  18_000_000, 16_000_000, 14_000_000, 13_000_000,
  12_000_000, 11_000_000, 10_000_000,
].map((value) => BigInt(value)).map((amountEuro, index) => ({ position: index + 1, amountEuro }));

export const DEFAULT_FINANCE_RULES: FinanceRules = {
  defaultStartBalanceEuro: BigInt(100_000_000),
  participationFeeBps: 150,
  superLicensePerPointEuro: BigInt(30_000),
  poleRewardEuro: BigInt(2_000_000),
  fastestLapRewardEuro: BigInt(500_000),
  dnfFeeEuro: BigInt(3_000_000),
  dsqFeeEuro: BigInt(5_000_000),
  pitRetirementFeeEuro: BigInt(6_000_000),
  frontWingDamageFeeEuro: BigInt(500_000),
  underfloorDamageFeeEuro: BigInt(1_000_000),
  sidepodDamageFeeEuro: BigInt(1_000_000),
  rearWingDamageFeeEuro: BigInt(1_000_000),
  positionRewards: DEFAULT_POSITION_REWARDS,
  penaltyPointThresholds: [
    { points: 8, amountEuro: BigInt(1_000_000) },
    { points: 20, amountEuro: BigInt(10_000_000) },
  ],
  teamChampionshipRewards: DEFAULT_TEAM_CHAMPIONSHIP_REWARDS,
};

export type StoredMoneyRule = { position?: number; points?: number; amountEuro: string };

export function serializePositionRules(rules: readonly FinancePositionReward[]): StoredMoneyRule[] {
  return rules.map((rule) => ({ position: rule.position, amountEuro: rule.amountEuro.toString() }));
}

export function serializeThresholdRules(rules: readonly FinancePenaltyThreshold[]): StoredMoneyRule[] {
  return rules.map((rule) => ({ points: rule.points, amountEuro: rule.amountEuro.toString() }));
}

export function parsePositionRules(value: unknown, fallback: readonly FinancePositionReward[]): FinancePositionReward[] {
  if (!Array.isArray(value)) return [...fallback];
  const parsed = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const position = Number((item as { position?: unknown }).position);
    const amount = (item as { amountEuro?: unknown }).amountEuro;
    if (!Number.isInteger(position) || position <= 0 || (typeof amount !== "string" && typeof amount !== "number")) return [];
    try {
      const amountEuro = BigInt(amount);
      return amountEuro >= 0 ? [{ position, amountEuro }] : [];
    } catch {
      return [];
    }
  });
  return parsed.length > 0 ? parsed.sort((left, right) => left.position - right.position) : [...fallback];
}

export function parseThresholdRules(value: unknown): FinancePenaltyThreshold[] {
  if (!Array.isArray(value)) return [...DEFAULT_FINANCE_RULES.penaltyPointThresholds];
  const parsed = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const points = Number((item as { points?: unknown }).points);
    const amount = (item as { amountEuro?: unknown }).amountEuro;
    if (!Number.isFinite(points) || points <= 0 || (typeof amount !== "string" && typeof amount !== "number")) return [];
    try {
      const amountEuro = BigInt(amount);
      return amountEuro >= 0 ? [{ points, amountEuro }] : [];
    } catch {
      return [];
    }
  });
  return parsed.length > 0 ? parsed.sort((left, right) => left.points - right.points) : [...DEFAULT_FINANCE_RULES.penaltyPointThresholds];
}

export function roundBasisPoints(baseEuro: bigint, basisPoints: number): bigint {
  if (baseEuro <= BigInt(0) || basisPoints <= 0) return BigInt(0);
  return (baseEuro * BigInt(basisPoints) + BigInt(5_000)) / BigInt(10_000);
}

export function amountForPoints(points: number, euroPerPoint: bigint): bigint {
  if (!Number.isFinite(points) || points <= 0 || euroPerPoint <= BigInt(0)) return BigInt(0);
  const thousandths = BigInt(Math.round(points * 1_000));
  return (thousandths * euroPerPoint + BigInt(500)) / BigInt(1_000);
}

export function rewardForPosition(position: number | null, rules: readonly FinancePositionReward[]): bigint {
  if (!position) return BigInt(0);
  return rules.find((rule) => rule.position === position)?.amountEuro ?? BigInt(0);
}

export function reconciliationDelta(currentEntries: readonly bigint[], desiredAmount: bigint): bigint {
  return desiredAmount - currentEntries.reduce((sum, amount) => sum + amount, BigInt(0));
}

export function resultStatusFee(status: ResultStatus, rules: FinanceRules): { amountEuro: bigint; label: string } | null {
  if (status === ResultStatus.Dsq) return { amountEuro: rules.dsqFeeEuro, label: "Disqualifikation" };
  if (status === ResultStatus.Retired) return { amountEuro: rules.pitRetirementFeeEuro, label: "Box-Aufgabe" };
  if (status === ResultStatus.Dnf) return { amountEuro: rules.dnfFeeEuro, label: "DNF" };
  return null;
}

export function damageFees(
  damage: { frontWingDamage: boolean; underfloorDamage: boolean; sidepodDamage: boolean; rearWingDamage: boolean },
  rules: FinanceRules,
): Array<{ key: string; label: string; amountEuro: bigint }> {
  return [
    damage.frontWingDamage ? { key: "front-wing", label: "Frontflügel", amountEuro: rules.frontWingDamageFeeEuro } : null,
    damage.underfloorDamage ? { key: "underfloor", label: "Unterboden", amountEuro: rules.underfloorDamageFeeEuro } : null,
    damage.sidepodDamage ? { key: "sidepod", label: "Seitenkasten", amountEuro: rules.sidepodDamageFeeEuro } : null,
    damage.rearWingDamage ? { key: "rear-wing", label: "Heckflügel", amountEuro: rules.rearWingDamageFeeEuro } : null,
  ].filter((item): item is { key: string; label: string; amountEuro: bigint } => item !== null);
}

export function formatEuro(value: bigint | string): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(BigInt(value))} €`;
}
