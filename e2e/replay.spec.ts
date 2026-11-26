// The headless simulation is the game. The bot plays a run in this very build, in the browser, recording it
// (?nagraj=1: every frame's input, the state hashed once a second of play); the simulation then plays the
// recording back from the source of this commit and must reach the same state at every check. Without this
// test green, no number the simulation gives counts (BALANCE.md). CI runs it against the live site too.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { watch } from './helpers';

interface Rec {
  build: string;
  fields: string[];
  checks: number[];
}

// A plain run (cards, chests, elites), and a boss fight brought early (phases, hazards, the boss's death), played
// immortal: the simple test bot dies before the boss on today's Normalnie, and the case then checked no fight at all.
const CASES = [
  { station: 'widzew', seed: 7, until: 75, extra: '' },
  { station: 'zakowice', seed: 11, until: 150, extra: '&bossza=45&niesmiertelny=1' },
];

for (const c of CASES) {
  test(`symulacja odtwarza run z przeglądarki co do stanu: ${c.station}`, async ({ page }, info) => {
    test.setTimeout(900_000);
    test.skip(info.project.name !== 'chromium', 'logic test, one project is enough');
    const problems = watch(page);
    // ZRZUT=<step>: every value of the state is dumped at that step too, and a mismatch lists the paths that differ.
    // KROK=1: every frame 1/60 s, so the same run can be recorded again (with ZRZUT where it went wrong).
    const dump = (process.env.ZRZUT ? `&zrzut=${process.env.ZRZUT}` : '') + (process.env.KROK ? '&krok=1' : '');
    await page.goto(`./?bot=1&seed=${String(c.seed)}&stacja=${c.station}&nagraj=1${c.extra}${dump}`);
    await page.waitForFunction(() => (window as unknown as { __game?: { state: string } }).__game?.state === 'playing', undefined, { timeout: 90_000 });
    // Until the time asked for, or the run is over (the boss down, or Piotrek).
    await page.waitForFunction(
      (until) => {
        const g = (window as unknown as { __game: { time: number; state: string } }).__game;
        return g.time >= until || g.state === 'dying' || g.state === 'dead' || g.state === 'cleared';
      },
      c.until,
      { timeout: 720_000, polling: 500 },
    );
    const rep = await page.evaluate(() => (window as unknown as { __replay: () => Rec | null }).__replay());
    expect(rep).not.toBeNull();
    if (!rep) return;
    // The recording is of the build being tested (in CI, this very commit).
    if (process.env.CI) {
      const sha = rep.build.split(' ')[1] ?? '';
      const head = process.env.EXPECT_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      expect(sha.length >= 7 && head.startsWith(sha), `recorded by ${rep.build}, testing ${head}`).toBe(true);
    }
    const checks = rep.checks.length / (rep.fields.length + 1);
    expect(checks, 'checks recorded (one per second of play)').toBeGreaterThanOrEqual(40);
    const file = info.outputPath(`replay-${c.station}.json`);
    writeFileSync(file, JSON.stringify(rep));
    let out: string;
    try {
      out = execFileSync('node', ['scripts/sim/replay.ts', file], { encoding: 'utf8', timeout: 300_000 });
    } catch (e) {
      out = String((e as { stdout?: string }).stdout ?? e);
    }
    console.log(out.trim());
    expect(out).toContain('all 1 match');
    expect(problems).toEqual([]);
  });
}
