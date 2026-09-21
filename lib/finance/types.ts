import type { FinanceSettlementStatus, FinanceTransactionType } from "@/domain";

export type FinanceTransactionView = {
  id: number;
  amountEuro: string;
  type: FinanceTransactionType;
  description: string;
  source: "AUTOMATIC" | "MANUAL";
  createdAt: string;
  race: { id: number; name: string; round: number; mystery: boolean; scheduledAt: string } | null;
  driver: { id: number; name: string } | null;
  actor: { displayName: string } | null;
};

export type FinanceAccountView = {
  id: number;
  teamId: number;
  teamName: string;
  shortName: string;
  color: string;
  logoUrl: string | null;
  league: { id: number; code: string; name: string };
  season: { id: number; name: string };
  balanceEuro: string;
  totalIncomeEuro: string;
  totalExpensesEuro: string;
  lastTransactionAt: string | null;
};

export type FinancePreviewEntry = {
  logicalKey: string;
  teamId: number;
  teamName: string;
  driverId: number | null;
  driverName: string | null;
  type: FinanceTransactionType;
  amountEuro: string;
  description: string;
};

export type RaceFinancePreview = {
  ready: boolean;
  message: string;
  race: { id: number; name: string; round: number; scheduledAt: string };
  league: { id: number; code: string; name: string };
  season: { id: number; name: string };
  ruleSet: { id: number | null; version: number; activeVersion: number | null };
  settlement: { id: number; revision: number; status: FinanceSettlementStatus; inputHash: string | null } | null;
  currentInputHash: string;
  needsReconciliation: boolean;
  entries: FinancePreviewEntry[];
  teamTotals: Array<{ teamId: number; teamName: string; openingBalanceEuro: string; incomeEuro: string; expensesEuro: string; netEuro: string }>;
};

export type SeasonFinancePreview = {
  ready: boolean;
  message: string;
  league: { id: number; code: string; name: string };
  season: { id: number; name: string };
  ruleSet: { id: number | null; version: number; activeVersion: number | null };
  settlement: { id: number; revision: number; status: FinanceSettlementStatus; inputHash: string | null } | null;
  currentInputHash: string;
  needsReconciliation: boolean;
  entries: FinancePreviewEntry[];
};

export type FinanceActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialFinanceActionState: FinanceActionState = { status: "idle", message: "" };
