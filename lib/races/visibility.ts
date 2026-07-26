export const MYSTERY_TRACK_REVEAL_LEAD_MS = 60 * 60 * 1000;

type MysteryRace = {
  mystery: boolean;
  scheduledAt: Date;
};

export function isMysteryTrackRevealed(
  race: MysteryRace,
  now = new Date(),
): boolean {
  return (
    !race.mystery ||
    now.getTime() >=
      race.scheduledAt.getTime() - MYSTERY_TRACK_REVEAL_LEAD_MS
  );
}

export function publicRaceTrack<
  Race extends MysteryRace & {
    name: string;
    circuit: string | null;
    countryCode: string | null;
  },
>(
  race: Race,
  now = new Date(),
): {
  name: string;
  circuit: string | null;
  countryCode: string | null;
  revealed: boolean;
} {
  const revealed = isMysteryTrackRevealed(race, now);

  return revealed
    ? {
        name: race.name,
        circuit: race.circuit,
        countryCode: race.countryCode,
        revealed,
      }
    : {
        name: "Mystery Track",
        circuit: null,
        countryCode: null,
        revealed,
      };
}
