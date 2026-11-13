// Plays the game with the bot in headless Chromium and reports what happened.
// Usage: node scripts/bot-run.ts [seconds=60] [outDir=test-results/bot] [query=""]
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const seconds = Number(process.argv[2] ?? 60);
const out = process.argv[3] ?? 'test-results/bot';
const extra = process.argv[4] ?? '';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:5198/?bot=1&debug=1&seed=7${extra}`);
  await page.waitForFunction(() => document.body.dataset.state === 'playing', undefined, { timeout: 60_000 });
  const shots = Math.max(1, Math.round(seconds / 10));
  for (let k = 1; k <= shots; k++) {
    await page.waitForTimeout((seconds * 1000) / shots);
    await page.screenshot({ path: `${out}/t${String(k * Math.round(seconds / shots)).padStart(3, '0')}.png` });
    const d = await page.evaluate(() => Object.fromEntries(Object.entries(document.body.dataset)));
    console.log(JSON.stringify(d));
  }
  console.log(problems.length ? problems.join('\n') : 'console clean');
} finally {
  await browser.close();
  await server.close();
}
