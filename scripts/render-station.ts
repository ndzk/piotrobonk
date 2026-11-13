// Renders one station arena (dev/station.html) from four angles into a single sheet, for reviewing an
// arena without playing it. Usage: node scripts/render-station.ts <stationId> [outDir] [extraQuery]
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const id = process.argv[2] ?? 'fabryczna';
const outDir = process.argv[3] ?? 'ref/stacje';
const extra = process.argv[4] ?? '';
mkdirSync(outDir, { recursive: true });
const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  for (const view of ['bird', 'corner', 'eye', 'ground']) {
    await page.goto(`http://localhost:5198/dev/station.html?id=${id}&view=${view}${extra}`);
    await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 60_000 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${outDir}/${id}-${view}.png` });
  }
  console.log(`saved ${outDir}/${id}-*.png`);
  console.log(problems.join('\n') || 'console clean');
} finally {
  await browser.close();
  await server.close();
}
