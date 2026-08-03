import { QualifyingFormat } from "@/domain";

export const FULL_QUALIFYING_RECOMMENDATION_THRESHOLD = 17;

export function qualifyingFormatRecommendation(participantCount: number) {
  const normalizedCount = Math.max(0, Math.trunc(participantCount));
  if (normalizedCount >= FULL_QUALIFYING_RECOMMENDATION_THRESHOLD) {
    return {
      format: QualifyingFormat.Full,
      message: "Empfehlung: Volles Qualifying, da mindestens 17 Fahrer teilnehmen.",
    } as const;
  }
  return {
    format: QualifyingFormat.Short,
    message: "Empfehlung: Kurzes Qualifying, da weniger als 17 Fahrer teilnehmen.",
  } as const;
}

export type AdvancedQualifyingData = {
  q2TimeInput?: string | null;
  q2Laps?: string | number | null;
  q3TimeInput?: string | null;
  q3Laps?: string | number | null;
};

export function hasAdvancedQualifyingData(rows: readonly AdvancedQualifyingData[]): boolean {
  return rows.some((row) =>
    Boolean(
      row.q2TimeInput?.trim() ||
      Number(row.q2Laps ?? 0) > 0 ||
      row.q3TimeInput?.trim() ||
      Number(row.q3Laps ?? 0) > 0,
    ),
  );
}

export function qualifyingEliminationSection(row: {
  q2TimeMs: number | null;
  q3TimeMs: number | null;
}): "Q3" | "Q2_EXIT" | "Q1_EXIT" {
  if (row.q3TimeMs !== null) return "Q3";
  if (row.q2TimeMs !== null) return "Q2_EXIT";
  return "Q1_EXIT";
}
