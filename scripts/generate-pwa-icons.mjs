import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "images", "frl-logo.png");
const output = join(root, "public", "icons");
const background = { r: 5, g: 8, b: 14, alpha: 1 };

await mkdir(output, { recursive: true });

async function createIcon(filename, size, logoScale) {
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(source)
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(join(output, filename));
}

await Promise.all([
  createIcon("frl-192.png", 192, 0.78),
  createIcon("frl-512.png", 512, 0.78),
  createIcon("frl-maskable-512.png", 512, 0.62),
  createIcon("apple-touch-icon.png", 180, 0.78),
]);
