// The chosen kurs reaches the game, through the player's own path (the save's choice, the hub, the route, a
// station), in the build that is served: the run's effective numbers are read from the game itself, and no two
// kursy (nor Normalnie with a ladder rung) may come out the same. CI runs this against the live Pages URL too.
import { expect, test, type Page } from '@playwright/test';
import { UI } from '../src/content/ui';
import { watch } from './helpers';

interface Effective {
  difficulty: string;
  kurs: Record<string, unknown>;
  bossAt: number;
  hp: number;
  damage: number;
  mods: string[];
  director: unknown;
  rung: number;
}

async function play(page: Page, difficulty: string, rung: number): Promise<Effective> {
  await page.goto('./?debug=1&seed=5');
  await page.waitForFunction(() => document.querySelector('.start.is-ready') !== null, undefined, { timeout: 60_000 });
  await page.evaluate(
    ([d, r]) => {
      localStorage.setItem('piotrobonk:save', JSON.stringify({ version: 5, rev: 1, save: { introSeen: true, difficulty: d, ladder: { open: 20, best: 20, chosen: r } } }));
    },
    [difficulty, rung] as const,
  );
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.start.is-ready') !== null, undefined, { timeout: 60_000 });
  await page.mouse.click(10, 10);
  await expect(page.locator('.hubmenu')).toBeVisible();
  await page.getByRole('button', { name: UI.hub.play }).click();
  await expect(page.locator('.route')).toBeVisible({ timeout: 30_000 });
  await page.locator('.route').getByRole('button', { name: UI.route.play }).click();
  await page.waitForFunction(() => (window as unknown as { __game?: { state: string } }).__game?.state === 'playing', undefined, { timeout: 90_000 });
  return page.evaluate(() => {
    const g = (window as unknown as { __game: Record<string, unknown> & { hpMul(): number; dmgMul(): number; director: Record<string, unknown> } }).__game;
    return {
      difficulty: g.difficulty as string,
      kurs: g.kurs as Record<string, unknown>,
      bossAt: g.bossAt as number,
      hp: g.hpMul(),
      damage: g.dmgMul(),
      mods: [...(g.mods as Set<string>)].sort(),
      director: g.director.tuning,
      rung: g.rung as number,
    };
  });
}

test('wybrany kurs trafia do gry, a każdy daje inną grę', async ({ page }) => {
  test.setTimeout(400_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  const cases: [string, number][] = [
    ['spokojny', 0],
    ['normalnie', 0],
    ['opoznienie', 0],
    ['normalnie', 10],
  ];
  const seen: Effective[] = [];
  for (const [d, r] of cases) {
    const e = await play(page, d, r);
    // The game plays the kurs that was chosen (and the rung, only on Normalnie).
    expect(e.difficulty).toBe(d);
    expect(e.rung).toBe(r);
    expect(e.mods.length).toBe(r);
    for (const other of seen) {
      const same = JSON.stringify([e.kurs, e.bossAt, e.hp, e.damage, e.mods, e.director]) === JSON.stringify([other.kurs, other.bossAt, other.hp, other.damage, other.mods, other.director]);
      expect(same, `${d}+${String(r)} plays the same as ${other.difficulty}+${String(other.rung)}`).toBe(false);
    }
    seen.push(e);
  }
  // Harder is harder: tougher and harder-hitting enemies up the list, the boss later.
  const [easy, normal, late] = seen;
  expect(easy.hp).toBeLessThan(normal.hp);
  expect(normal.hp).toBeLessThan(late.hp);
  expect(easy.damage).toBeLessThan(normal.damage);
  expect(normal.damage).toBeLessThan(late.damage);
  console.log(JSON.stringify(seen.map((s) => ({ d: s.difficulty, r: s.rung, hp: s.hp, damage: s.damage, bossAt: s.bossAt, mods: s.mods.length }))));
  expect(problems).toEqual([]);
});
