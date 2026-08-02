import type { DriverCharacterConfiguration, NormalPose, TeamSuitConfiguration, WinnerPose } from "./schema";

export type DriverCharacterView = {
  id: number | null;
  configuration: DriverCharacterConfiguration;
  normalPose: NormalPose;
  winnerPose: WinnerPose;
  version: number;
  suitVariantId: number | null;
  customized: boolean;
};

export type TeamSuitView = {
  id: number | null;
  organizationId: number | null;
  name: string;
  configuration: TeamSuitConfiguration;
};
