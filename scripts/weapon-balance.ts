// Balance simulation for weapons: each one alone, at its top level, on the same arena against the same late
// horde (immortal, no level-ups), measured in damage per second of game time and kills. Shows whether any
// weapon outclasses the rest. Usage: node scripts/weapon-balance.ts [secondsPerWeapon=25] [--stacja=id] [--bron=a,b]
// Runs against the production build, so build first (npm run build).
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const seconds = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 25);
const station = process.argv.find((a) => a.startsWith('--stacja='))?.slice(9) ?? 'widzew';
const only = process.argv.find((a) => a.startsWith('--bron='))?.slice(7).split(',');
const server = await preview({ preview: { port: 5188, strictPort: true }, base: '/piotrobonk/', logLevel: 'error' });
// PW_SHELL=1: the headless shell, where full Chromium will not start (see CLAUDE.md).
const browser = await chromium.launch(process.env.PW_SHELL ? {} : { channel: 'chromium' });

interface Def {
  id: string;
  name: string;
  evolved?: boolean;
  levels: unknown[];
}
interface Weapon {
  def: Def;
  level: number;
  mults: number[];
  damage: number;
}
interface DebugGame {
  state: string;
  god: boolean;
  xp: number;
  time: number;
  bossAt: number;
  load: { weapons: Weapon[]; passives: unknown[] };
  arsenal: { reset(): void };
  enemies: { kills: number };
  refreshStats(): void;
  updateSlots(): void;
}
type Win = Window & { __game: DebugGame; __weapons: Def[] };
/** Before the game is built there is no `__game` yet. */
type Early = Window & { __game?: { state: string } };

try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:5188/piotrobonk/?debug=1&seed=5&stacja=${station}`);
  await page.waitForFunction(() => (window as unknown as Early).__game?.state === 'playing', undefined, { timeout: 90_000 });
  const ids = (await page.evaluate(() => (window as unknown as Win).__weapons.map((w) => w.id))).filter((id) => !only || only.includes(id));
  const rows: { name: string; evolved: boolean; dps: number; kills: number }[] = [];
  for (const id of ids) {
    // The same start for every weapon: a fresh run, then the clock moved to the late waves.
    await page.goto(`http://localhost:5188/piotrobonk/?debug=1&seed=5&stacja=${station}`);
    await page.waitForFunction(() => (window as unknown as Early).__game?.state === 'playing', undefined, { timeout: 90_000 });
    await page.evaluate((weapon) => {
      const w = window as unknown as Win;
      const g = w.__game;
      const def = w.__weapons.find((d) => d.id === weapon);
      if (!def) return;
      g.god = true;
      g.xp = -1e9;
      g.time = Math.min(g.bossAt - 40, 240);
      g.load.weapons = [{ def, level: def.levels.length + 1, mults: [], damage: 0 }];
      g.load.passives = [];
      g.arsenal.reset();
      g.refreshStats();
      g.updateSlots();
    }, id);
    const t0 = await page.evaluate(() => (window as unknown as Win).__game.time);
    const k0 = await page.evaluate(() => (window as unknown as Win).__game.enemies.kills);
    await page.waitForTimeout(seconds * 1000);
    const r = await page.evaluate(() => {
      const g = (window as unknown as Win).__game;
      const w = g.load.weapons[0];
      return { name: w.def.name, evolved: w.def.evolved === true, damage: w.damage, time: g.time, kills: g.enemies.kills };
    });
    const dt = Math.max(1, r.time - t0);
    rows.push({ name: r.name, evolved: r.evolved, dps: r.damage / dt, kills: (r.kills - k0) / (dt / 60) });
  }
  for (const evolved of [false, true]) {
    const group = rows.filter((r) => r.evolved === evolved).sort((a, b) => b.dps - a.dps);
    const median = group[Math.floor(group.length / 2)]?.dps ?? 1;
    console.log(evolved ? '\nEwolucje' : 'Bronie na maksymalnym poziomie');
    for (const r of group) console.log(`${r.name.padEnd(28)} ${r.dps.toFixed(0).padStart(6)} DPS  ${(r.dps / median).toFixed(2)}× mediany   ${r.kills.toFixed(0).padStart(4)} zabić/min`);
  }
  console.log(problems.length ? problems.join('\n') : '\nconsole clean');
} finally {
  await browser.close();
  await server.close();
}
