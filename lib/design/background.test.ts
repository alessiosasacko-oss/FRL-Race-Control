import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Role } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { BackgroundImageError, MAX_BACKGROUND_IMAGE_BYTES, validateBackgroundImage } from "@/lib/storage/background-image";
import {
  backgroundPresentation,
  backgroundSettingsSchema,
  defaultBackgroundSettings,
  defaultDesignTheme,
  designThemeConfigSchema,
} from "./theme";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const editor = source("components/design/BackgroundEditor.tsx");
const preview = source("components/design/DesignBrandingEditor.tsx");
const surface = source("components/design/ThemeSurface.tsx");
const actions = source("lib/design/actions.ts");
const queries = source("lib/design/queries.ts");
const route = source("app/api/admin/design/backgrounds/route.ts");
const css = source("app/globals.css");

function png(width = 320, height = 320) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpeg(width = 320, height = 320) {
  const bytes = new Uint8Array(13);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x09, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01]);
  return bytes;
}

function webp(width = 320, height = 320) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBPVP8X"), 8);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes.set([encodedWidth & 0xff, (encodedWidth >> 8) & 0xff, (encodedWidth >> 16) & 0xff], 24);
  bytes.set([encodedHeight & 0xff, (encodedHeight >> 8) & 0xff, (encodedHeight >> 16) & 0xff], 27);
  return bytes;
}

test("admin can validate a solid app background", () => {
  assert.equal(backgroundSettingsSchema.safeParse({ ...defaultBackgroundSettings, type: "COLOR", colorDark: "#07111F" }).success, true);
});

test("invalid background colors are rejected", () => {
  assert.equal(backgroundSettingsSchema.safeParse({ ...defaultBackgroundSettings, colorDark: "navy" }).success, false);
});

test("linear gradients with two colors are rendered", () => {
  const settings = { ...defaultBackgroundSettings, type: "GRADIENT" as const, gradientType: "LINEAR" as const, gradientColors: ["#07111F", "#05080E"] };
  assert.match(backgroundPresentation(settings, "DARK").image, /linear-gradient/);
});

test("radial gradients are rendered", () => {
  assert.match(backgroundPresentation({ ...defaultBackgroundSettings, type: "GRADIENT", gradientType: "RADIAL" }, "DARK").image, /radial-gradient/);
});

test("all required background patterns are selectable", () => {
  assert.equal((editor.match(/<AppBackground settings=\{previewSettings\}/g)?.length ?? 0) > 0, true);
  assert.match(editor, /Carbon-Struktur/);
  assert.match(editor, /Geschwindigkeitsspuren/);
});

test("pattern opacity affects the presentation", () => {
  assert.equal(backgroundPresentation({ ...defaultBackgroundSettings, type: "PATTERN", pattern: "DOTS", patternOpacity: 12 }, "DARK").opacity, 0.12);
});

test("authorized background upload uses the dedicated endpoint", () => {
  assert.match(editor, /\/api\/admin\/design\/backgrounds/);
  assert.equal(hasPermission([Role.Admin], Permission.ManageBranding), true);
});

test("non-admin background upload is denied by the route", () => {
  assert.equal(hasPermission([Role.Driver], Permission.ManageBranding), false);
  assert.match(route, /Permission\.ManageBranding/);
  assert.match(route, /status: 403/);
});

test("invalid background MIME type is rejected", () => {
  assert.throws(() => validateBackgroundImage("attack.svg", "image/svg+xml", 4, new Uint8Array(4)), BackgroundImageError);
});

test("oversized background image is rejected", () => {
  assert.throws(() => validateBackgroundImage("large.png", "image/png", MAX_BACKGROUND_IMAGE_BYTES + 1, new Uint8Array(1)), /INVALID_BACKGROUND_SIZE/);
});

test("JPG magic bytes and dimensions are accepted", () => {
  const bytes = jpeg();
  assert.deepEqual(validateBackgroundImage("race.jpg", "image/jpeg", bytes.length, bytes), { mimeType: "image/jpeg", extension: "jpg", width: 320, height: 320 });
});

test("PNG magic bytes and dimensions are accepted", () => {
  const bytes = png();
  assert.equal(validateBackgroundImage("race.png", "image/png", bytes.length, bytes).width, 320);
});

test("WebP magic bytes and dimensions are accepted", () => {
  const bytes = webp();
  assert.equal(validateBackgroundImage("race.webp", "image/webp", bytes.length, bytes).height, 320);
});

test("SVG is never accepted as an app background", () => {
  assert.doesNotMatch(editor, /image\/svg\+xml/);
  assert.throws(() => validateBackgroundImage("race.svg", "image/svg+xml", 1, new Uint8Array([1])));
});

test("background image can be replaced", () => {
  assert.match(editor, /Bild ersetzen/);
  assert.match(editor, /update\("assetPath", result\.url\)/);
});

test("background image reference can be removed without deleting versions", () => {
  assert.match(editor, /update\("assetPath", ""\)/);
  assert.doesNotMatch(route, /export async function DELETE/);
});

test("missing background image falls back to the configured color", () => {
  const presentation = backgroundPresentation({ ...defaultBackgroundSettings, type: "IMAGE", assetPath: "" }, "DARK");
  assert.equal(presentation.image, "none");
  assert.equal(presentation.fallbackColor, defaultBackgroundSettings.colorDark);
});

test("overlay is rendered independently from the image", () => {
  assert.match(source("components/design/AppBackground.tsx"), /presentation\.overlayColor/);
  assert.equal(backgroundPresentation(defaultBackgroundSettings, "DARK").overlayOpacity, 0.55);
});

test("published background is mounted in the protected app", () => {
  assert.match(surface, /<AppBackground/);
  assert.match(surface, /PROTECTED_APP/);
});

test("live preview includes every background change", () => {
  assert.match(preview, /<AppBackground settings=\{config\.backgroundSettings\}/);
  assert.match(preview, /<BackgroundEditor config=\{config\}/);
});

test("saving a draft does not activate the design", () => {
  assert.match(actions, /isDraft: true/);
  assert.match(actions, /isActive: false/);
});

test("publication creates a version containing background settings", () => {
  assert.match(actions, /designThemeVersion\.create/);
  assert.match(actions, /snapshot: parsed\.data/);
  assert.match(actions, /backgroundSettings: config\.backgroundSettings/);
});

test("version restoration validates the entire snapshot", () => {
  assert.match(actions, /designThemeConfigSchema\.safeParse\(version\.snapshot\)/);
});

test("theme export includes the background configuration", () => {
  assert.match(preview, /JSON\.stringify\(config, null, 2\)/);
});

test("theme import validates the background configuration", () => {
  assert.match(preview, /designThemeConfigSchema\.safeParse\(JSON\.parse/);
});

test("mobile editor avoids horizontal overflow", () => {
  assert.match(editor, /min-w-0/);
  assert.match(editor, /grid grid-cols-2/);
  assert.match(surface, /overflow-x-clip/);
});

test("existing themes without background settings receive safe defaults", () => {
  const legacy = structuredClone(defaultDesignTheme) as Record<string, unknown>;
  delete legacy.backgroundSettings;
  const parsed = designThemeConfigSchema.parse(legacy);
  assert.deepEqual(parsed.backgroundSettings, defaultBackgroundSettings);
  assert.match(queries, /backgroundSettings \?\? undefined/);
});

test("cards and navigation retain readable glass and emphasis options", () => {
  assert.match(css, /data-background-glass/);
  assert.match(css, /backdrop-filter: blur\(18px\)/);
  assert.match(css, /data-navigation-emphasis/);
});
