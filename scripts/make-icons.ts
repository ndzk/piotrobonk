// Draws the app icons from one SVG and rasterises them in headless Chromium (no image libraries):
// favicons, the apple-touch-icon, the PWA icons and a maskable one with the art inside the safe zone.
// Usage: node scripts/make-icons.ts   (writes public/icons/*.png; commit the result)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BLUE = '#0d3b8c';
const DEEP = '#081f52';
const YELLOW = '#ffd400';

/**
 * The PKP-blue tile with the yellow P and, under it, a broken stretch of track: the game in one glyph.
 * `pad` shrinks the art towards the centre (maskable icons get cropped to a circle by some launchers).
 */
function svg(size: number, pad: number, rounded: boolean, track: boolean): string {
  const s = 64;
  const k = 1 - pad * 2;
  // Track seen from above: two rails over sleepers, torn apart in the middle. Too fine for a 16 px tab.
  let rails = '';
  if (track) {
    for (const [x0, x1] of [
      [7, 28],
      [36, 57],
    ]) {
      for (let x = x0 + 2; x < x1; x += 5) rails += `<rect x="${x}" y="47.5" width="2.4" height="12" rx="0.6" fill="${YELLOW}" opacity="0.75"/>`;
      rails += `<rect x="${x0}" y="50" width="${x1 - x0}" height="2.2" rx="1" fill="${YELLOW}"/><rect x="${x0}" y="55.2" width="${x1 - x0}" height="2.2" rx="1" fill="${YELLOW}"/>`;
    }
  }
  const glyph = track ? 'M19 6h17a13 13 0 0 1 0 26h-6v11H19zm11 9v8h5a4 4 0 0 0 0-8z' : 'M19 12h17a13 13 0 0 1 0 26h-6v14H19zm11 9v8h5a4 4 0 0 0 0-8z';
  const art = `<g transform="translate(${s * pad} ${s * pad}) scale(${k})"><path fill="${YELLOW}" fill-rule="evenodd" d="${glyph}"/>${rails}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${DEEP}"/></linearGradient></defs>
  <rect width="${s}" height="${s}" ${rounded ? 'rx="14"' : ''} fill="url(#g)"/>${art}</svg>`;
}

const out = 'public/icons';
mkdirSync(out, { recursive: true });
const jobs: [string, number, number, boolean, boolean][] = [
  ['favicon-16.png', 16, 0, true, false],
  ['favicon-32.png', 32, 0, true, false],
  ['apple-touch-icon.png', 180, 0.06, false, true],
  ['icon-192.png', 192, 0, true, true],
  ['icon-512.png', 512, 0, true, true],
  ['maskable-512.png', 512, 0.12, false, true],
];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [name, size, pad, rounded, track] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, pad, rounded, track)}</body></html>`);
    await page.locator('svg').screenshot({ path: `${out}/${name}`, omitBackground: true });
  }
  writeFileSync('public/favicon.svg', `${svg(64, 0, true, false).replace(/\s*\n\s*/g, '')}\n`);
  console.log(`icons in ${out}/: ${jobs.map((j) => j[0]).join(', ')}`);
} finally {
  await browser.close();
}
