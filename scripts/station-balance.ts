// Balance simulation for whole stations: the bot plays a natural run from the first second (no debug build,
// no immortality), the clock sped up (three times by default), through the waves to the boss and its end. Answers the
// brief's "is every station passable on every difficulty" for a player who never dodges on purpose.
// Usage: node scripts/station-balance.ts [--kurs=spokojny,normalnie,opoznienie] [--stacja=fabryczna,widzew] [--zegar=3]
// (a faster clock is quicker to run but the bot reacts less often per game second: lower is fairer).
// Runs against the production build, so build first (npm run build).
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const arg = (name: string): string[] | null => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3).split(',') ?? null;
const kursy = arg('kurs') ?? ['spokojny', 'normalnie', 'opoznienie'];
const stations = arg('stacja') ?? ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice'];
const clock = Number(arg('zegar')?.[0] ?? 3);
const server = await preview({ preview: { port: 5189, strictPort: true }, base: '/piotrobonk/', logLevel: 'error' });
// PW_SHELL=1: the headless shell, where full Chromium will not start (see CLAUDE.md).
const browser = await chromium.launch(process.env.PW_SHELL ? {} : { channel: 'chromium' });

interface RunGame {
  state: string;
  time: number;
  bossAt: number;
  level: number;
  timeScale: number;
  boss: { alive: boolean } | null;
  player: { hp: number; maxHp: number };
  enemies: { kills: number };
  start(seed: number, station: string, difficulty: string): void;
}
type Win = Window & { __game?: RunGame };

try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const problems: string[] = [];
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !/ReadPixels|Blit feedback/.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  console.log('kurs        stacja        wynik        czas gry  poziom  min HP   zabicia  (realnie)');
  for (const kurs of kursy) {
    for (const id of stations) {
      await page.goto(`http://localhost:5189/piotrobonk/?bot=1&debug=1&seed=11&stacja=${id}`);
      await page.waitForFunction(() => (window as Win).__game?.state === 'playing', undefined, { timeout: 90_000 });
      await page.evaluate(
        ([s, k]) => {
          (window as Win).__game?.start(11, s, k);
        },
        [id, kurs],
      );
      const t0 = Date.now();
      let minHp = Infinity;
      let outcome = 'bez końca';
      let sawBoss = false;
      for (;;) {
        await page.waitForTimeout(1000);
        const g = await page.evaluate((speed) => {
          const game = (window as Win).__game;
          if (!game) return null;
          // A faster clock while the run plays (cutscenes keep their own pace).
          if (game.state === 'playing') game.timeScale = speed;
          return { state: game.state, time: game.time, bossAt: game.bossAt, level: game.level, boss: game.boss?.alive ?? false, hp: game.player.hp / game.player.maxHp, kills: game.enemies.kills };
        }, clock);
        if (!g) break;
        minHp = Math.min(minHp, g.hp);
        sawBoss ||= g.boss;
        if (g.state === 'cleared' || g.state === 'call') outcome = 'boss pokonany';
        else if (g.state === 'dying' || g.state === 'dead') outcome = sawBoss ? 'śmierć: boss' : 'śmierć: fale';
        if (outcome !== 'bez końca' || Date.now() - t0 > 900_000) {
          console.log(`${kurs.padEnd(11)} ${id.padEnd(13)} ${outcome.padEnd(12)} ${(g.time / 60).toFixed(1).padStart(5)} min  ${String(g.level).padStart(6)}  ${Math.round(minHp * 100).toString().padStart(4)}%  ${String(g.kills).padStart(8)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
          break;
        }
      }
    }
  }
  console.log(problems.length ? problems.join('\n') : 'console clean');
} finally {
  await browser.close();
  await server.close();
}
