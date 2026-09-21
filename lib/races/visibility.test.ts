import assert from "node:assert/strict";
import test from "node:test";
import { publicRacePresentation } from "./visibility";

const race = {
  name: "Italian Grand Prix",
  circuit: "Autodromo Nazionale Monza",
  countryCode: "IT",
  mystery: true,
  scheduledAt: new Date("2026-09-21T18:00:00.000Z"),
  visual: {
    desktopHeroAsset: null,
    mobileHeroAsset: "https://cdn.example.test/monza-event-mobile.webp",
    heroAltText: "Monza race weekend",
  },
  track: {
    visual: {
      desktopHeroAsset: "https://cdn.example.test/monza-track-desktop.webp",
      mobileHeroAsset: "https://cdn.example.test/monza-track-mobile.webp",
      heroAltText: "Monza track",
    },
  },
};

test("mystery presentation hides image and metadata before reveal", () => {
  const presentation = publicRacePresentation(race, new Date("2026-09-21T16:00:00.000Z"));
  assert.equal(presentation.revealed, false);
  assert.equal(presentation.circuit, null);
  assert.equal(presentation.countryCode, null);
  assert.equal(presentation.hero, null);
});

test("race image variants override track defaults independently after reveal", () => {
  const presentation = publicRacePresentation(race, new Date("2026-09-21T17:30:00.000Z"));
  assert.equal(presentation.revealed, true);
  assert.equal(presentation.hero?.desktopUrl, "https://cdn.example.test/monza-track-desktop.webp");
  assert.equal(presentation.hero?.mobileUrl, "https://cdn.example.test/monza-event-mobile.webp");
  assert.equal(presentation.hero?.alt, "Monza race weekend");
});
