import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  assetReferenceSchema,
  contrastRatio,
  defaultDesignTheme,
  designThemeConfigSchema,
  hexColorSchema,
  readableTextColor,
  themeContrastWarnings,
  themeCssVariables,
  themePresets,
  validateSvgAsset,
} from "./theme";

test("app has a valid FRL fallback without a stored theme", () => {
  assert.equal(designThemeConfigSchema.safeParse(defaultDesignTheme).success, true);
});

test("all seven presets use the same validated token architecture", () => {
  assert.equal(Object.keys(themePresets).length, 7);
  for (const preset of Object.values(themePresets)) {
    assert.equal(designThemeConfigSchema.safeParse(preset).success, true);
  }
});

test("preset selection changes tokens without changing their shape", () => {
  assert.notEqual(themePresets.RACING_RED.darkTokens.primary, themePresets.FRL_RACING_BLUE.darkTokens.primary);
  assert.deepEqual(Object.keys(themePresets.RACING_RED.darkTokens), Object.keys(defaultDesignTheme.darkTokens));
});

test("driver cannot change global branding", () => {
  assert.equal(hasPermission([Role.Driver], Permission.ManageBranding), false);
});

test("admin can change global branding", () => {
  assert.equal(hasPermission([Role.Admin], Permission.ManageBranding), true);
});

test("draft and publication flags remain database concerns", () => {
  assert.equal("isActive" in defaultDesignTheme, false);
  assert.equal("isDraft" in defaultDesignTheme, false);
});

test("dark and light token values are independent", () => {
  assert.notEqual(defaultDesignTheme.darkTokens.background, defaultDesignTheme.lightTokens.background);
});

test("page accent is emitted as a central CSS variable", () => {
  const variables = themeCssVariables(defaultDesignTheme, "DARK");
  assert.equal(variables["--accent-fia"], defaultDesignTheme.pageAccents.fia);
});

test("team color produces a readable text color", () => {
  assert.equal(readableTextColor("#05080E"), "#FFFFFF");
  assert.equal(readableTextColor("#F8FAFC"), "#0F172A");
});

test("league colors use the strict hex schema", () => {
  assert.equal(hexColorSchema.parse("#ff0000"), "#FF0000");
});

test("invalid hex colors are rejected", () => {
  assert.equal(hexColorSchema.safeParse("red").success, false);
  assert.equal(hexColorSchema.safeParse("#12345G").success, false);
});

test("poor contrast produces a warning", () => {
  const config = structuredClone(defaultDesignTheme);
  config.darkTokens.text = config.darkTokens.background;
  assert.equal(themeContrastWarnings(config).length > 0, true);
});

test("contrast ratio recognizes accessible black and white", () => {
  assert.equal(contrastRatio("#FFFFFF", "#000000"), 21);
});

test("safe SVG layouts are accepted", () => {
  assert.equal(validateSvgAsset('<svg viewBox="0 0 10 10"><path d="M0 0" /></svg>').startsWith("<svg"), true);
});

test("script elements in SVG layouts are rejected", () => {
  assert.throws(() => validateSvgAsset("<svg><script>alert(1)</script></svg>"), /UNSAFE_SVG/);
});

test("event handlers in SVG layouts are rejected", () => {
  assert.throws(() => validateSvgAsset('<svg onload="alert(1)"></svg>'), /UNSAFE_SVG/);
});

test("external SVG resources are rejected", () => {
  assert.throws(() => validateSvgAsset('<svg><image href="https://example.com/a.png" /></svg>'), /UNSAFE_SVG/);
});

test("SVG style blocks and CSS URLs are rejected", () => {
  assert.throws(() => validateSvgAsset("<svg><style>@import url(https://example.com/a.css)</style></svg>"), /UNSAFE_SVG/);
});

test("javascript and arbitrary CSS cannot be imported", () => {
  const unsafe = { ...defaultDesignTheme, customCss: "body{display:none}", script: "alert(1)" };
  assert.equal(designThemeConfigSchema.safeParse(unsafe).success, false);
});

test("asset references accept only HTTPS or the controlled track path", () => {
  assert.equal(assetReferenceSchema.safeParse("/assets/tracks/spa.svg").success, true);
  assert.equal(assetReferenceSchema.safeParse("https://cdn.example.com/spa.webp").success, true);
  assert.equal(assetReferenceSchema.safeParse("javascript:alert(1)").success, false);
  assert.equal(assetReferenceSchema.safeParse('https://cdn.example.com/a")').success, false);
});

test("default theme mode must remain enabled", () => {
  const config = structuredClone(defaultDesignTheme);
  config.allowDarkMode = false;
  assert.equal(designThemeConfigSchema.safeParse(config).success, false);
});

test("status tokens retain textual semantic keys", () => {
  const tokens = defaultDesignTheme.darkTokens;
  for (const key of ["success", "warning", "error", "fiaOpen", "fiaResolved"] as const) {
    assert.equal(typeof tokens[key], "string");
  }
});

test("mobile navigation remains limited to three through five known items", () => {
  const config = structuredClone(defaultDesignTheme);
  config.navigationSettings.mobileItems = ["dashboard", "calendar"];
  assert.equal(designThemeConfigSchema.safeParse(config).success, false);
});
