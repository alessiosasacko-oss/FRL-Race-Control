export const MYSTERY_TRACK_REVEAL_LEAD_MS = 60 * 60 * 1000;

type MysteryRace = {
  mystery: boolean;
  scheduledAt: Date;
};

type HeroVisual = {
  desktopHeroAsset: string | null;
  mobileHeroAsset: string | null;
  heroAltText: string | null;
};

type PresentableRace = MysteryRace & {
  name: string;
  circuit: string | null;
  countryCode: string | null;
  visual?: HeroVisual | null;
  track?: { visual?: HeroVisual | null } | null;
};

export type PublicRaceHero = {
  desktopUrl: string;
  mobileUrl: string;
  alt: string;
};

export function resolveRaceHero(race: PresentableRace): PublicRaceHero | null {
  const raceVisual = race.visual;
  const trackVisual = race.track?.visual;
  const desktopUrl = raceVisual?.desktopHeroAsset || trackVisual?.desktopHeroAsset ||
    raceVisual?.mobileHeroAsset || trackVisual?.mobileHeroAsset || null;
  const mobileUrl = raceVisual?.mobileHeroAsset || trackVisual?.mobileHeroAsset ||
    raceVisual?.desktopHeroAsset || trackVisual?.desktopHeroAsset || null;
  return desktopUrl && mobileUrl
    ? {
        desktopUrl,
        mobileUrl,
        alt: raceVisual?.heroAltText || trackVisual?.heroAltText ||
          [race.name, race.circuit].filter(Boolean).join(" – "),
      }
    : null;
}

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
  Race extends PresentableRace,
>(
  race: Race,
  now = new Date(),
): {
  name: string;
  circuit: string | null;
  countryCode: string | null;
  revealed: boolean;
} {
  const presentation = publicRacePresentation(race, now);

  return presentation.revealed
    ? {
        name: presentation.name,
        circuit: presentation.circuit,
        countryCode: presentation.countryCode,
        revealed: true,
      }
    : {
        name: "Mystery Track",
        circuit: null,
        countryCode: null,
        revealed: false,
      };
}

export function publicRacePresentation<Race extends PresentableRace>(
  race: Race,
  now = new Date(),
): {
  name: string;
  circuit: string | null;
  countryCode: string | null;
  revealed: boolean;
  hero: PublicRaceHero | null;
} {
  const revealed = isMysteryTrackRevealed(race, now);
  if (!revealed) {
    return {
      name: "Mystery Track",
      circuit: null,
      countryCode: null,
      revealed: false,
      hero: null,
    };
  }

  return {
    name: race.name,
    circuit: race.circuit,
    countryCode: race.countryCode,
    revealed: true,
    hero: resolveRaceHero(race),
  };
}
