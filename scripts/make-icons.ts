// Draws the app icons from one SVG and rasterises them in headless Chromium (no image libraries):
// favicons, the apple-touch-icon, the PWA icons and a maskable one with the art inside the safe zone.
// Usage: node scripts/make-icons.ts   (writes public/icons/*.png; commit the result)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BLUE = '#0d3b8c';
const DEEP = '#081f52';
const YELLOW = '#ffd400';

/** A comic "bonk": a twelve-point burst, the points alternating long and short. */
function burst(cx: number, cy: number, outer: number, inner: number, points = 12): string {
  const d: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer * (i % 4 === 0 ? 1 : 0.86);
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2 + 0.13;
    d.push(`${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${d.join('L')}Z`;
}

/**
 * The PKP-blue tile with a yellow "bonk" burst and, under it, a broken stretch of track: the game in one
 * glyph (an earlier yellow P read as a parking sign). `pad` shrinks the art towards the centre: maskable
 * icons get cropped to a circle, and their art must stay inside its middle 80 %.
 */
function svg(size: number, pad: number, rounded: boolean, track: boolean): string {
  const s = 64;
  const k = 1 - pad * 2;
  // The track in perspective, running from the bottom edge into the burst: two rails converging, sleepers
  // narrowing with distance. Too fine for a 16 px tab, which gets the burst alone.
  let rails = '';
  if (track) {
    const at = (t: number): [number, number, number] => {
      // t = 0 at the bottom edge, 1 at the burst: y, left rail x, right rail x.
      const y = 63 - t * 23;
      const half = 17 - t * 11;
      return [y, 32 - half, 32 + half];
    };
    for (const t of [0.04, 0.24, 0.42, 0.58, 0.72]) {
      const [y, l, r] = at(t);
      const over = 4 - t * 2.5;
      rails += `<rect x="${(l - over).toFixed(2)}" y="${(y - 1.4 + t).toFixed(2)}" width="${(r - l + over * 2).toFixed(2)}" height="${(2.6 - t * 1.2).toFixed(2)}" rx="0.6" fill="${YELLOW}" opacity="0.7"/>`;
    }
    const [y0, l0, r0] = at(0);
    const [y1, l1, r1] = at(1);
    for (const [a, b] of [
      [l0, l1],
      [r0, r1],
    ])
      rails += `<path d="M${a - 1.6} ${y0 + 1}L${a + 1.6} ${y0 + 1}L${b + 0.7} ${y1}L${b - 0.7} ${y1}Z" fill="${YELLOW}"/>`;
  }
  // A jagged impact burst with a pale hot core: the "bonk" of the title.
  const [cy, outer, inner] = track ? [24, 21, 12] : [32, 29, 16];
  const glyph = `<path fill="${YELLOW}" d="${burst(32, cy, outer, inner)}"/><path fill="#fff4c4" d="${burst(32, cy, outer * 0.5, inner * 0.45, 8)}"/>`;
  const art = `<g transform="translate(${s * pad} ${s * pad}) scale(${k})">${rails}${glyph}</g>`;
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
  ['maskable-512.png', 512, 0.2, false, true],
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
