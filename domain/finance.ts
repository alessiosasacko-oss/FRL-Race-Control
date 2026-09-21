import { FinanceTransactionType } from "./enums";

export const financeTransactionTypeLabels: Record<FinanceTransactionType, string> = {
  [FinanceTransactionType.StartBalance]: "Startkontostand",
  [FinanceTransactionType.RacePositionReward]: "Rennplatzierungsprämie",
  [FinanceTransactionType.PoleReward]: "Pole-Prämie",
  [FinanceTransactionType.FastestLapReward]: "Schnellste-Runde-Prämie",
  [FinanceTransactionType.ParticipationFee]: "Teilnahmegebühr",
  [FinanceTransactionType.SuperLicenseFee]: "Superlizenz",
  [FinanceTransactionType.DamageFee]: "Schaden",
  [FinanceTransactionType.DnfFee]: "DNF-Gebühr",
  [FinanceTransactionType.DsqFee]: "DSQ-Gebühr",
  [FinanceTransactionType.PitRetirementFee]: "Box-Aufgabe",
  [FinanceTransactionType.PenaltyPointsFine]: "Penalty-Points-Bußgeld",
  [FinanceTransactionType.RuleViolationFine]: "Regelverstoß",
  [FinanceTransactionType.TeamChampionshipReward]: "Team-WM-Prämie",
  [FinanceTransactionType.DriverTransfer]: "Fahrertransfer",
  [FinanceTransactionType.ManualAdjustment]: "Manuelle Buchung",
  [FinanceTransactionType.Correction]: "Korrektur",
};
