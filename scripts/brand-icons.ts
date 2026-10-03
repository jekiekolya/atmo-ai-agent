// Run `npx tsx scripts/brand-icons.ts` from the repository root after src/app/icon.svg changes; it rewrites favicon.ico and apple-icon.png.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Page } from "@playwright/test";

const APP = join(process.cwd(), "src", "app");
const ICON_SIZES = [16, 32, 48];
const TOUCH_SIZE = 180;
const TOUCH_BACKGROUND = "#f9fafb";

const svg = readFileSync(join(APP, "icon.svg"), "utf8");
const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

async function rasterize(
  page: Page,
  size: number,
  mark: number,
  background?: string,
): Promise<Buffer> {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${background ?? "transparent"}">
      <img src="${source}" width="${mark}" height="${mark}">
    </body>`,
  );
  await page.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  return page.screenshot({ omitBackground: background === undefined });
}

/** ICONDIR + one ICONDIRENTRY per image, then the PNGs themselves — PNG payloads are valid ICO images. */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size % 256, 0);
    entry.writeUInt8(size % 256, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });

    const images = [];
    for (const size of ICON_SIZES) {
      images.push({ size, png: await rasterize(page, size, size) });
    }
    writeFileSync(join(APP, "favicon.ico"), ico(images));

    // iOS draws transparency as black and rounds the corners itself, so the square is opaque.
    const touch = await rasterize(
      page,
      TOUCH_SIZE,
      Math.round(TOUCH_SIZE * 0.75),
      TOUCH_BACKGROUND,
    );
    writeFileSync(join(APP, "apple-icon.png"), touch);
  } finally {
    await browser.close();
  }
}

void main();
