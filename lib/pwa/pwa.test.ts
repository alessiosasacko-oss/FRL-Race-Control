import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import manifest from "../../app/manifest";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("manifest exposes the FRL standalone application and required icons", () => {
  const value = manifest();
  assert.equal(value.name, "FRL Race Control");
  assert.equal(value.short_name, "FRL");
  assert.equal(value.start_url, "/");
  assert.equal(value.display, "standalone");
  assert.equal(value.orientation, "any");
  assert.ok(value.icons?.some((icon) => icon.sizes === "192x192"));
  assert.ok(value.icons?.some((icon) => icon.sizes === "512x512"));
  assert.ok(value.icons?.some((icon) => icon.purpose === "maskable"));
});

test("generated PWA and Apple icons have their declared dimensions", async () => {
  for (const [path, size] of [
    ["public/icons/frl-192.png", 192],
    ["public/icons/frl-512.png", 512],
    ["public/icons/frl-maskable-512.png", 512],
    ["public/icons/apple-touch-icon.png", 180],
  ] as const) {
    const metadata = await sharp(
      fileURLToPath(new URL(`../../${path}`, import.meta.url)),
    ).metadata();
    assert.equal(metadata.width, size, path);
    assert.equal(metadata.height, size, path);
  }
});

test("service worker keeps navigations network-first and caches no private route", () => {
  const worker = source("public/sw.js");
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /fetch\(request\)\.catch\(\(\) => caches\.match\("\/offline"\)\)/);
  assert.doesNotMatch(worker, /"\/api\//);
  assert.doesNotMatch(worker, /"\/finance/);
  assert.doesNotMatch(worker, /"\/admin/);
  assert.doesNotMatch(worker, /_next/);
});

test("root metadata covers iOS standalone and safe-area rendering", () => {
  const layout = source("app/layout.tsx");
  const styles = source("app/globals.css");
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /black-translucent/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(styles, /safe-area-inset-top/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /display-mode: standalone/);
});

test("service worker updates reload only after explicit user confirmation", () => {
  const lifecycle = source("components/pwa/PwaLifecycle.tsx");
  assert.match(lifecycle, /if \(!refreshRequested\.current \|\| reloading\) return/);
  assert.match(lifecycle, /refreshRequested\.current = true/);
  assert.match(lifecycle, /SKIP_WAITING/);
});

test("PWA shell routes remain public while protected data stays behind proxy", () => {
  const proxy = source("proxy.ts");
  for (const path of ["/offline", "/manifest.webmanifest", "/sw.js"]) {
    assert.ok(proxy.includes(`"${path}"`), path);
  }
  assert.doesNotMatch(proxy, /"\/finance"/);
  assert.doesNotMatch(proxy, /"\/admin"/);
});
