import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  countryCodeFromLegacyFlag,
  countryFlagPath,
  normalizeCountryCode,
} from "@/lib/countries";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function assetExists(code: string): boolean {
  return existsSync(new URL(`../../public/flags/${code}.svg`, import.meta.url));
}

const countryFlag = source("components/ui/CountryFlag.tsx");
const countrySelect = source("components/ui/CountrySelect.tsx");

test("IT uses the Italian SVG", () => {
  assert.equal(countryFlagPath("IT"), "/flags/it.svg");
  assert.equal(assetExists("it"), true);
});

test("DE uses the German SVG", () => {
  assert.equal(countryFlagPath("DE"), "/flags/de.svg");
  assert.equal(assetExists("de"), true);
});

test("AT uses the Austrian SVG", () => {
  assert.equal(countryFlagPath("AT"), "/flags/at.svg");
  assert.equal(assetExists("at"), true);
});

test("GB uses the British SVG", () => {
  assert.equal(countryFlagPath("GB"), "/flags/gb.svg");
  assert.equal(assetExists("gb"), true);
});

test("lowercase ISO codes are normalized", () => {
  assert.equal(normalizeCountryCode("it"), "IT");
});

test("surrounding whitespace is removed", () => {
  assert.equal(countryFlagPath(" IT "), "/flags/it.svg");
});

test("invalid codes use the globe fallback", () => {
  assert.equal(countryFlagPath("Italy"), null);
  assert.match(countryFlag, /Globe2/);
});

test("null uses the globe fallback", () => {
  assert.equal(countryFlagPath(null), null);
  assert.match(countryFlag, /Land nicht angegeben/);
});

test("CountryFlag never creates a visible Unicode flag", () => {
  assert.doesNotMatch(countryFlag, /countryCodeToFlagEmoji/);
  assert.doesNotMatch(countryFlag, /String\.fromCodePoint/);
});

test("CountryFlag never renders a raw ISO code", () => {
  assert.doesNotMatch(countryFlag, />\s*\{code\}\s*</);
  assert.match(countryFlag, /countryFlagPath\(code\)/);
});

test("CountrySelect renders SVG flags for options and selected values", () => {
  assert.match(countrySelect, /<CountryFlag countryCode=\{selectedCode\}/);
  assert.match(countrySelect, /<CountryFlag countryCode=\{country\.code\}/);
});

test("user administration uses CountryFlag", () => {
  assert.match(source("app/(protected)/admin/users/page.tsx"), /<CountryFlag/);
});

test("team overview uses CountryFlag", () => {
  assert.match(source("app/(protected)/teams/page.tsx"), /<CountryFlag/);
});

test("result administration uses CountryFlag", () => {
  assert.match(source("components/championship/ResultsEditor.tsx"), /<CountryFlag/);
});

test("race attendance uses CountryFlag", () => {
  assert.match(source("components/championship/AttendanceRoster.tsx"), /<CountryFlag/);
});

test("Windows compatible rendering is documented", () => {
  const documentation = source("docs/cross-platform-flags.md");
  assert.match(documentation, /Windows 10 und Windows 11/);
  assert.match(documentation, /Edge und Chrome/);
});

test("the production asset set contains every central ISO flag", () => {
  for (const code of ["it", "de", "at", "ch", "fr", "es", "gb", "us"]) {
    assert.equal(assetExists(code), true, `${code}.svg is missing`);
  }
  assert.match(source("package.json"), /"flag-icons": "\^7\.5\.0"/);
});

test("mobile flag controls remain contained and touch-safe", () => {
  assert.match(countryFlag, /min-w-0/);
  assert.match(countrySelect, /min-h-11/);
  assert.match(countrySelect, /inset-x-0/);
  assert.doesNotMatch(countrySelect, /overflow-x/);
});

test("legacy emoji values are decoded only for SVG lookup", () => {
  assert.equal(countryCodeFromLegacyFlag("🇮🇹"), "IT");
  assert.equal(countryCodeFromLegacyFlag("DE"), "DE");
});
