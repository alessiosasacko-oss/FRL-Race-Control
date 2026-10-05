import { ResultGraphicType, ResultSession } from "@/domain/enums";

export const graphicTemplates = {
  [ResultGraphicType.QualifyingClassification]: { label: "Qualifying Classification", session: ResultSession.Qualifying, layout: "classification" },
  [ResultGraphicType.RaceClassification]: { label: "Race Classification", session: ResultSession.Race, layout: "classification" },
  POLE: { label: "Pole Position", session: ResultSession.Qualifying, layout: "portrait" },
  FRONT_ROW: { label: "Front Row", session: ResultSession.Qualifying, layout: "duo" },
  GRID: { label: "Starting Grid", session: ResultSession.Race, layout: "grid" },
  WINNER: { label: "Race Winner", session: ResultSession.Race, layout: "portrait" },
  FASTEST_LAP: { label: "Fastest Lap", session: ResultSession.Race, layout: "portrait" },
  PODIUM: { label: "Podium", session: ResultSession.Race, layout: "podium" },
  [ResultGraphicType.DriverChampionship]: { label: "Drivers’ Championship", session: ResultSession.Race, layout: "classification" },
  [ResultGraphicType.ConstructorChampionship]: { label: "TCWM / Team-WM", session: ResultSession.Race, layout: "classification" },
} as const;

export type GraphicTemplate = keyof typeof graphicTemplates;
export function isGraphicTemplate(value: unknown): value is GraphicTemplate {
  return typeof value === "string" && Object.hasOwn(graphicTemplates, value);
}
export function templatesForSession(session: ResultSession) {
  return (Object.keys(graphicTemplates) as GraphicTemplate[]).filter((key) => graphicTemplates[key].session === session);
}
