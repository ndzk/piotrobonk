// Balance simulation: fights every boss headless with a maxed build and reports how long it takes and
// how close it came to killing Piotrek. Usage: node scripts/boss-balance.ts [difficulty] [--god]
// Runs against the production build, so build first (npm run build).
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { BOSSES } from '../src/content/bosses.ts';

const difficulty = process.argv[2] ?? 'normalnie';
const only = process.argv.find((a) => a.startsWith('--stacja='))?.slice(9);
const god = process.argv.includes('--god');
const server = await preview({ preview: { port: 5187, strictPort: true }, base: '/piotrobonk/', logLevel: 'error' });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  console.log(`kurs: ${difficulty}${god ? ' (nieśmiertelny)' : ''}`);
  for (const boss of BOSSES.filter((b) => !only || b.station === only)) {
    await page.goto(`http://localhost:5187/piotrobonk/?bot=1&debug=1&seed=5&stacja=${boss.station}`);
    await page.waitForFunction(() => document.body.dataset.state === 'playing', undefined, { timeout: 60_000 });
    await page.evaluate(
      ({ difficulty, god }) => {
        const g = (window as unknown as { __game: Record<string, unknown> }).__game as {
          god: boolean;
          difficulty: string;
          debugNearlyMaxed(): void;
          time: number;
          bossAt: number;
        };
        g.god = god;
        g.difficulty = difficulty;
        g.debugNearlyMaxed();
        g.time = g.bossAt - 0.5;
      },
      { difficulty, god },
    );
    const start = Date.now();
    const result = await page
      .waitForFunction(
        () => {
          const g = (window as unknown as { __game: { state: string; boss: unknown; time: number; bossAt: number; player: { hp: number } } }).__game;
          if (g.state === 'cleared') return { outcome: 'wygrana', time: g.time - g.bossAt, hp: Math.round(g.player.hp) };
          if (g.state === 'dying' || g.state === 'dead') return { outcome: 'śmierć', time: g.time - g.bossAt, hp: 0 };
          return null;
        },
        undefined,
        { timeout: 240_000, polling: 250 },
      )
      .catch(() => null);
    const r = result ? ((await result.jsonValue()) as { outcome: string; time: number; hp: number }) : { outcome: 'bez końca', time: 0, hp: 0 };
    console.log(`${boss.station.padEnd(12)} ${boss.name.padEnd(32)} ${r.outcome.padEnd(8)} ${r.time.toFixed(1).padStart(6)} s   HP ${String(r.hp).padStart(3)}   (${((Date.now() - start) / 1000).toFixed(0)} s realu)`);
  }
  console.log(problems.length ? problems.join('\n') : 'console clean');
} finally {
  await browser.close();
  await server.close();
}
