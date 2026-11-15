// Balance simulation for whole stations: the bot plays a natural run from the first second (no debug build,
// no immortality), the clock sped up (three times by default), through the waves to the boss and its end. Answers the
// brief's "is every station passable on every difficulty" for a player who never dodges on purpose.
// Usage: node scripts/station-balance.ts [--kurs=spokojny,normalnie,opoznienie] [--stacja=fabryczna,widzew] [--zegar=3]
// (a faster clock is quicker to run but the bot reacts less often per game second: lower is fairer).
// Runs against the production build, so build first (npm run build).
import { chromium } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  boss: { alive: boolean; health: number } | null;
  player: { hp: number; maxHp: number; pos: { x: number; z: number } };
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
  console.log('kurs        stacja        wynik        czas gry  poziom  min HP  HP przy bossie  walka  boss zostało  zabicia  utknął  (realnie)');
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
      let bossHp = NaN;
      let bossFrom = NaN;
      let bossLeft = 1;
      // A run whose clock stops for a minute of real time is stuck somewhere (a card, a chest): say where.
      let lastTime = -1;
      let movedAt = Date.now();
      // Seconds of play where Piotrek moved less than a metre: the bot pinned against a prop, not outplayed.
      let samples = 0;
      let pinned = 0;
      let px = 0;
      let pz = 0;
      for (;;) {
        await page.waitForTimeout(1000);
        const g = await page.evaluate((speed) => {
          const game = (window as Win).__game;
          if (!game) return null;
          // A faster clock while the run plays (cutscenes keep their own pace).
          if (game.state === 'playing') game.timeScale = speed;
          return { state: game.state, time: game.time, bossAt: game.bossAt, level: game.level, boss: game.boss?.alive ?? false, bossLeft: game.boss?.health ?? 0, hp: game.player.hp / game.player.maxHp, kills: game.enemies.kills, x: game.player.pos.x, z: game.player.pos.z };
        }, clock);
        if (!g) break;
        if (g.state === 'playing' && samples++ > 0 && Math.hypot(g.x - px, g.z - pz) < 1) pinned++;
        px = g.x;
        pz = g.z;
        if (g.time !== lastTime) {
          lastTime = g.time;
          movedAt = Date.now();
        }
        minHp = Math.min(minHp, g.hp);
        if (g.boss && !sawBoss) {
          bossHp = g.hp;
          bossFrom = g.time;
        }
        if (g.boss) bossLeft = g.bossLeft;
        sawBoss ||= g.boss;
        if (g.state === 'cleared' || g.state === 'call') outcome = 'boss pokonany';
        else if (g.state === 'dying' || g.state === 'dead') outcome = sawBoss ? 'śmierć: boss' : 'śmierć: fale';
        else if (Date.now() - movedAt > 60_000) outcome = `stoi: ${g.state}`;
        if (outcome.startsWith('stoi') || outcome === 'śmierć: fale') {
          const shot = join(tmpdir(), `piotrobonk-stoi-${id}.png`);
          await page.screenshot({ path: shot });
          console.log(`zrzut: ${shot}`);
        }
        if (outcome !== 'bez końca' || Date.now() - t0 > 900_000) {
          console.log(`${kurs.padEnd(11)} ${id.padEnd(13)} ${outcome.padEnd(12)} ${(g.time / 60).toFixed(1).padStart(5)} min  ${String(g.level).padStart(6)}  ${Math.round(minHp * 100).toString().padStart(4)}%  ${(Number.isNaN(bossHp) ? '—' : `${String(Math.round(bossHp * 100))}%`).padStart(14)}  ${(Number.isNaN(bossFrom) ? '—' : `${(g.time - bossFrom).toFixed(0)} s`).padStart(5)}  ${(sawBoss && outcome !== 'boss pokonany' ? `${String(Math.round(bossLeft * 100))}%` : '—').padStart(12)}  ${String(g.kills).padStart(8)}  ${`${String(Math.round((pinned / Math.max(1, samples)) * 100))}%`.padStart(6)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
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
