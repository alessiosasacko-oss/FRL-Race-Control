import type { GraphicTemplate } from "./catalog";

export type GraphicDriver = {
  name: string; number: number; teamName: string; teamColor: string;
  teamLogoDataUrl: string | null; imageDataUrl: string | null;
  imageKind?: "render" | "profile";
  position?: number; primary?: string;
};
export type GraphicRow = {
  position: number; name: string; teamName: string; teamColor: string;
  teamLogoDataUrl: string | null; primary: string; secondary: string;
  status?: string | null; imageDataUrl?: string | null; number?: number;
};
export type ResultGraphicRenderData = {
  template?: GraphicTemplate;
  title: string; subtitle: string; leagueCode: string; seasonName: string; raceName: string;
  round?: number; circuit?: string; sessionLabel?: string; formatLabel?: string | null; draft?: boolean;
  frlLogoDataUrl: string | null;
  leaderLabel: "POLE" | "WINNER" | "LEADER" | "LEADERS" | "FASTEST LAP";
  leader: GraphicDriver | null; highlights?: GraphicDriver[];
  rows: GraphicRow[]; columnLabels?: [string, string];
};
