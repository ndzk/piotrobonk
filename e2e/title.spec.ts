import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { UI } from '../src/content/ui';

import { ready, watch } from './helpers';

test('ekran tytułowy startuje bez błędów i ostrzeżeń', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  await ready(page);
  await expect(page.locator('.title__logo')).toHaveText(UI.title);
  await expect(page.getByRole('region', { name: 'Odjazdy' }).locator('.board__status')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.fatal, #boot-fail')).toHaveCount(0);
  const expected = process.env.EXPECT_SHA;
  if (expected) {
    await expect(page.locator('meta[name="piotrobonk-version"]')).toHaveAttribute('content', new RegExp(`${expected}$`));
  }
  await page.waitForTimeout(1500);
  expect(problems).toEqual([]);
  // Screenshot last: reading back a WebGL canvas can itself make Chrome log a ReadPixels warning.
  await page.screenshot({ path: test.info().outputPath('title.png') });
});

test('brak WebGL2 pokazuje komunikat zamiast pustego ekranu', async ({ page }) => {
  const problems = watch(page);
  await page.addInitScript({
    content: `{ const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : get.call(this, type, ...rest); }; }`,
  });
  await page.goto('./');
  await expect(page.locator('.fatal h1')).toHaveText(UI.noWebGL.title);
  await expect(page.locator('.fatal')).toBeInViewport();
  await expect(page.locator('.title')).toHaveCount(0);
  expect(problems).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('no-webgl.png') });
});

test('nakładka błędu pokazuje raport i działające przyciski', async ({ page, browserName }) => {
  // On https (the live site) Chromium's clipboard waits for a permission headless never answers.
  if (browserName === 'chromium') await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await ready(page);
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('test e2e: celowy wyjątek');
    });
  });
  await expect(page.locator('.fatal h1')).toHaveText(UI.crash.title);
  await expect(page.locator('.fatal textarea')).toHaveValue(/PIOTROBONK v[\s\S]*celowy wyjątek/);
  for (const name of [UI.crash.copy, UI.crash.reload]) {
    const button = page.getByRole('button', { name });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport({ ratio: 1 });
  }
  await page.getByRole('button', { name: UI.crash.copy }).click();
  await expect(page.locator('.fatal__actions button').first()).not.toHaveText(UI.crash.copy);
  await page.screenshot({ path: test.info().outputPath('crash.png') });
});

test('nieudane pobranie skryptu pokazuje komunikat startowy', async ({ page }) => {
  await page.route(/\/assets\/index-[\w-]+\.js$/, (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('./');
  await expect(page.locator('#boot-fail')).toBeVisible();
  await expect(page.locator('#boot-fail h1')).toHaveText('Gra się nie załadowała');
});

test('nieistniejący adres pokazuje stronę 404 z powrotem na peron', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'GitHub Pages serves 404.html; vite preview does not');
  await page.goto('./nie-ma-takiej-stacji');
  const home = page.getByRole('link', { name: 'Wracam na peron' });
  await expect(home).toBeVisible();
  await home.click();
  await ready(page);
});

test('build offline działa z file://', async ({ page }) => {
  test.skip(!!process.env.BASE_URL, 'only for local builds');
  const problems = watch(page);
  await page.goto(pathToFileURL(resolve('dist-offline/index.html')).href);
  await ready(page);
  await expect(page.locator('.title__logo')).toHaveText(UI.title);
  expect(problems).toEqual([]);
});

test('bot gra co najmniej 15 sekund gry: zabija, zbiera XP, zero błędów', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await page.goto('./?bot=1&seed=1');
  await page.waitForFunction(() => document.body.dataset.state === 'playing', undefined, { timeout: 60_000 });
  // Game time, not wall time: software rendering in CI runs the simulation slower than real time.
  // The bot may first walk to a coffee machine or chest, so allow up to 40 s of game time for the first kill.
  await page.waitForFunction(() => (Number(document.body.dataset.time) >= 15 && Number(document.body.dataset.kills) > 0) || Number(document.body.dataset.time) >= 40, undefined, { timeout: 150_000, polling: 500 });
  const d = await page.evaluate(() => Object.fromEntries(Object.entries(document.body.dataset)));
  expect(Number(d.kills)).toBeGreaterThan(0);
  expect(problems).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('gameplay.png') });
});

interface DebugGame {
  state: string;
  god: boolean;
  stationDef: { id: string; name: string };
  start(seed: number, station?: string): void;
  xp: number;
  level: number;
  time: number;
  bossAt: number;
  boss: { index: number } | null;
  enemies: { hp: Float32Array; kills: number; hit(i: number, amount: number, dx: number, dz: number, kb: number): boolean };
  debugNearlyMaxed(): void;
  debugOpenChest(): void;
  levelActions: { pick(i: number): void };
}
const game = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as { __game?: DebugGame }).__game?.state ?? 'none');

async function startDebugRun(page: Page): Promise<void> {
  // ?stacja= goes straight into the arena, past the title and the route map.
  await page.goto('./?debug=1&seed=3&stacja=fabryczna');
  await expect.poll(() => game(page), { timeout: 60_000 }).toBe('playing');
  await page.mouse.click(10, 10);
}

test('karty: przy jednej karcie klawisz 3 nic nie psuje', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await startDebugRun(page);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: DebugGame }).__game;
    g.debugNearlyMaxed();
    g.xp = 9999;
  });
  await expect.poll(() => game(page)).toBe('levelup');
  await expect(page.locator('.card')).toHaveCount(1);
  await page.waitForTimeout(500);
  await page.keyboard.press('Digit3');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(300);
  await expect(page.locator('.fatal')).toHaveCount(0);
  // The cards ignore keys for a moment of game time (frames: longer than wall clock under software GL).
  for (let k = 0; k < 40 && (await game(page)) === 'levelup'; k++) {
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(300);
  }
  await expect.poll(() => game(page)).toBe('playing');
  expect(problems).toEqual([]);
});

test('skrzynka otwarta razem z awansem pokazuje swój ekran', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await startDebugRun(page);
  // Enough XP for a level-up in the very step that opens the chest: the chest screen must still win.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: DebugGame }).__game;
    g.xp = 30;
    g.debugOpenChest();
  });
  await expect(page.locator('.chest')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.chest .btn')).toBeVisible();
  // The screen ignores keys for its first second of game time (frames: under software GL that is longer than a
  // second of wall clock), so press until it closes.
  for (let k = 0; k < 40 && (await game(page)) === 'chest'; k++) {
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
  }
  // The pending level-ups come next, and the game is playable again afterwards.
  await expect.poll(() => game(page)).toBe('levelup');
  for (let k = 0; k < 40 && (await game(page)) === 'levelup'; k++) {
    await page.waitForTimeout(350);
    await page.keyboard.press('Digit1');
  }
  await expect.poll(() => game(page)).toBe('playing');
  expect(problems).toEqual([]);
});

test('pauza po skoku zostaje otwarta (żadnych zaległych naciśnięć)', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await startDebugRun(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyP');
  await expect.poll(() => game(page)).toBe('paused');
  await page.waitForTimeout(600);
  expect(await game(page)).toBe('paused');
  await expect(page.locator('.pause')).toBeVisible();
  await page.keyboard.press('KeyP');
  await expect.poll(() => game(page)).toBe('playing');
  expect(problems).toEqual([]);
});

test('pierwszy wyjazd: intro do pominięcia, potem mapa trasy i wybór kursu', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./');
  await ready(page);
  await page.evaluate(() => {
    localStorage.removeItem('piotrobonk:save');
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.start.is-ready') !== null, undefined, { timeout: 60_000 });
  await page.mouse.click(10, 10);
  // The start screen leads to the hub; "Jedziemy" opens the line.
  await expect(page.locator('.hubmenu')).toBeVisible();
  await page.getByRole('button', { name: UI.hub.play }).click();
  // The first trip opens with the intro at the departures board; Esc skips all of it, once and for good.
  await expect(page.locator('.intro__caption')).toBeVisible();
  await expect(page.locator('.talk:visible')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  // The route opens over the hub, whose attract-mode arena is rebuilt first: slow with software GL.
  await expect(page.locator('.route')).toBeVisible({ timeout: 30_000 });
  const seen = await page.evaluate(() => (JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { introSeen?: boolean } }).save.introSeen);
  expect(seen).toBe(true);
  await expect(page.locator('.stop')).toHaveCount(9);
  // Only Łódź Fabryczna is open at the start; the rest wait for their rails.
  await expect(page.locator('.stop.is-locked')).toHaveCount(8);
  await expect(page.locator('.route__difficulty')).toContainText(UI.route.difficulties[1][1]);
  // Clicking the kurs row cycles it; the arrows then nudge it from the keyboard.
  await page.locator('.route__difficulty').click();
  await expect(page.locator('.route__difficulty')).toContainText(UI.route.difficulties[2][1]);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.route__difficulty')).toContainText(UI.route.difficulties[1][1]);
  expect(problems).toEqual([]);
});

test('boss: intro, pasek i odbudowa torów po pokonaniu', async ({ page }) => {
  test.setTimeout(300_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./?debug=1&seed=11&stacja=fabryczna');
  await page.waitForFunction(() => document.body.dataset.state === 'playing', undefined, { timeout: 60_000 });
  // Skip the survival timer: the boss is due now. The player stands still in this test, so make them
  // immortal — otherwise a slow software-GL run ends with Piotrek dead instead of the station cleared.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: DebugGame }).__game;
    g.god = true;
    g.time = g.bossAt;
  });
  await expect(page.locator('.boss-intro')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.bossbar')).toBeVisible({ timeout: 20_000 });
  // Soften the boss and let the arsenal finish it mid-step, the way a real kill happens: the pool
  // compacts in the same step, which is exactly what used to leave the controller on a random pigeon.
  // Under software GL the simulation runs slower than real time, so keep it soft until it dies.
  await page.waitForFunction(
    () => {
      const g = (window as unknown as { __game: DebugGame }).__game;
      if (g.state === 'cleared') return true;
      // The crowd round a player standing still levels them up now and then: take a card and play on.
      if (g.state === 'levelup') g.levelActions.pick(0);
      if (g.boss && g.boss.index >= 0) g.enemies.hp[g.boss.index] = 1;
      return false;
    },
    undefined,
    { timeout: 150_000, polling: 200 },
  );
  await expect(page.locator('.cleared')).toBeVisible({ timeout: 60_000 });
  // The boss's own death counts and pays out.
  await expect(page.locator('.cleared__stats')).toContainText(UI.cleared.bottles.replace('{v}', ''));
  const kills = await page.evaluate(() => (window as unknown as { __game: DebugGame }).__game.enemies.kills);
  expect(kills).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  // Bartek D. calls after the first clear of every station; hanging up goes on to the line.
  await expect(page.locator('.call')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: UI.call.hangup }).click();
  // Back on the route map, with the next stop open.
  await expect(page.locator('.route')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.stop.is-cleared')).toHaveCount(1);
  await expect(page.locator('.stop.is-locked')).toHaveCount(7);
  expect(problems).toEqual([]);
});

test('finał: kawa, nokaut, liść, napisy i filiżanka w gablocie', async ({ page }) => {
  test.setTimeout(480_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./?debug=1&seed=5&stacja=koluszki');
  await page.waitForFunction(() => document.body.dataset.state === 'playing', undefined, { timeout: 60_000 });
  await page.evaluate(() => {
    const g = (window as unknown as { __game: DebugGame }).__game;
    g.god = true;
    g.time = g.bossAt;
  });
  // His cup is the fight's second health bar.
  await expect(page.locator('.coffee')).toBeVisible({ timeout: 30_000 });
  // The last blow never kills him: it knocks him out for the slap. Cards and chests on the way get taken.
  for (let k = 0; k < 500; k++) {
    const state = await game(page);
    if (state === 'finale') break;
    if (state === 'levelup') await page.keyboard.press('Digit1');
    else if (state === 'chest') await page.keyboard.press('Enter');
    else {
      await page.evaluate(() => {
        const g = (window as unknown as { __game: DebugGame }).__game;
        if (g.boss && g.boss.index >= 0) g.enemies.hp[g.boss.index] = Math.min(g.enemies.hp[g.boss.index], 1);
      });
    }
    await page.waitForTimeout(300);
  }
  expect(await game(page)).toBe('finale');
  await expect(page.locator('.qte')).toBeVisible({ timeout: 10_000 });
  type Bar = { width: number; misses: number };
  const bar = (): Promise<number> => page.evaluate(() => (window as unknown as { __game: { slapBar: Bar } }).__game.slapBar.misses);
  // A press outside the window misses (and makes the next one easier), one inside lands.
  await page.evaluate(() => {
    (window as unknown as { __game: { slapBar: Bar } }).__game.slapBar.width = 0;
  });
  await page.keyboard.press('Space');
  await expect.poll(bar).toBe(1);
  await page.evaluate(() => {
    (window as unknown as { __game: { slapBar: Bar } }).__game.slapBar.width = 2;
  });
  await page.keyboard.press('Space');
  await expect(page.locator('.slap')).toBeVisible();
  // The line is finished the moment the hand lands: recorded before any of the cutscene that follows.
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { finished?: number } }).save.finished)).toBe(1);
  // His last words (skipped); then the platform: rails, the train in, Piotrek's line (skipped), aboard, off.
  await expect(page.locator('.talk:visible')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { finaleStage: string | null } }).__game.finaleStage), { timeout: 20_000 }).toBe('ending');
  await page.waitForFunction(() => document.querySelector('.talk:not([hidden]):not(.is-out)') !== null, undefined, { timeout: 120_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.credits')).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('.credits__home')).toContainText(UI.finale.home.split('{v}')[0]);
  const saved = await page.evaluate(() => (JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { finished: number; trophies: string[]; inventory: unknown[] } }).save);
  expect(saved.finished).toBe(1);
  expect(saved.trophies).toContain('filizanka');
  // A ★ knife or gloves from any case waits on his chair.
  expect(saved.inventory).toHaveLength(1);
  // No station card in the ending: the credits are the end card.
  await expect(page.locator('.cleared')).toBeHidden();
  await expect(page.locator('.credits__extra').first()).toHaveText(UI.finale.trophy);
  // The credits ignore input for their first moment (game time: slower under software GL), so a held key
  // cannot skip them by accident.
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(page.locator('.hubmenu')).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  expect(problems).toEqual([]);
});

test('przejazd na kolejną stację przebudowuje arenę', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./?debug=1&seed=4&stacja=fabryczna');
  await expect.poll(() => game(page), { timeout: 60_000 }).toBe('playing');
  const first = await page.evaluate(() => (window as unknown as { __game: DebugGame }).__game.stationDef.id);
  expect(first).toBe('fabryczna');
  // Travelling swaps the world, the enemy types and the map items; nothing may leak between arenas.
  await page.evaluate(() => {
    (window as unknown as { __game: DebugGame }).__game.start(9, 'andrzejow');
  });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const g = (window as unknown as { __game: DebugGame & { world: { radius: number }; enemies: { count: number } } }).__game;
    return { id: g.stationDef.id, state: g.state, enemies: g.enemies.count, radius: g.world.radius };
  });
  expect(after.id).toBe('andrzejow');
  expect(after.state).toBe('playing');
  await page.waitForTimeout(2500);
  expect(problems).toEqual([]);
});

test('zmiana stacji nie zostawia zasobów GPU', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./?debug=1&seed=6&stacja=fabryczna');
  await expect.poll(() => game(page), { timeout: 60_000 }).toBe('playing');
  // Counted after the last arena has been drawn: geometry goes to the GPU with the first frame that shows it
  // (the warm-up compiles, it does not draw), and a slow runner may not have drawn one yet.
  const mem = async (): Promise<{ geometries: number; textures: number }> =>
    page.evaluate(async () => {
      await new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          done();
        }));
      });
      return (window as unknown as { __info: () => { geometries: number; textures: number } }).__info();
    });
  // One lap of the line first: the first visit to a station builds caches that are meant to stay.
  const ids = ['niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki', 'fabryczna'];
  for (const id of ids) {
    await page.evaluate((s) => {
      (window as unknown as { __game: DebugGame }).__game.start(3, s);
    }, id);
    await page.waitForTimeout(120);
  }
  const before = await mem();
  // A second lap must not grow them: an arena has to free what it built.
  for (const id of ids) {
    await page.evaluate((s) => {
      (window as unknown as { __game: DebugGame }).__game.start(3, s);
    }, id);
    await page.waitForTimeout(120);
  }
  const after = await mem();
  expect(after.geometries, `geometrie ${before.geometries} → ${after.geometries}`).toBeLessThanOrEqual(before.geometries + 8);
  expect(after.textures, `tekstury ${before.textures} → ${after.textures}`).toBeLessThanOrEqual(before.textures + 4);
  expect(problems).toEqual([]);
});

test('po rozgrzewce nic nie kompiluje shaderów: hub, recyklomat, ekwipunek, run', async ({ page }) => {
  // A program compiled at the moment something is first drawn freezes the game (seconds for the skin
  // shader). Everything must be compiled in the warm-ups at start-up, and kept: a skin program deleted with
  // its last material used to be compiled again for every picture in the Recyklomat.
  test.setTimeout(180_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __links: string[] | null };
    w.__links = null;
    const proto = WebGL2RenderingContext.prototype;
    const link: (this: WebGL2RenderingContext, program: WebGLProgram) => void = Reflect.get(proto, 'linkProgram');
    proto.linkProgram = function (this: WebGL2RenderingContext, program: WebGLProgram): void {
      if (w.__links) {
        const source = (this.getAttachedShaders(program) ?? []).map((s) => this.getShaderSource(s) ?? '').join(' ');
        w.__links.push(/#define SHADER_TYPE (\w+)/.exec(source)?.[1] ?? 'unknown');
      }
      link.call(this, program);
    };
  });
  await page.goto('./?debug=1');
  await ready(page);
  await page.evaluate(() => {
    localStorage.setItem('piotrobonk:save', JSON.stringify({ version: 4, rev: 1, save: { bottles: 500, deposit: 12, introSeen: true } }));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.start.is-ready') !== null, undefined, { timeout: 60_000 });
  await page.evaluate(() => {
    (window as unknown as { __links: string[] }).__links = [];
  });
  await page.mouse.click(10, 10);
  await expect(page.locator('.hubmenu')).toBeVisible();
  const shop = page.getByRole('button', { name: UI.hub.recyklomat, exact: true });
  await expect(shop).toBeEnabled({ timeout: 30_000 });
  await shop.click();
  // The pictures of the first case's contents (Steam's, here a stand-in).
  await expect(page.locator('.case-detail .skin-pic:not(.is-loading) img').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: UI.hub.inventory }).click();
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await expect(page.locator('.hubmenu')).toBeVisible();
  await page.getByRole('button', { name: UI.hub.play }).click();
  await expect(page.locator('.route')).toBeVisible({ timeout: 30_000 });
  await page.locator('.route').getByRole('button', { name: UI.route.play }).click();
  await expect.poll(() => game(page), { timeout: 60_000 }).toBe('playing');
  // Five seconds of the run drawn, or the first cards (a quick level-up stops the clock before that).
  await page.waitForFunction(
    () => {
      const g = (window as unknown as { __game?: DebugGame }).__game;
      return (g?.time ?? 0) >= 5 || (g?.state === 'levelup' && g.time >= 2);
    },
    undefined,
    { timeout: 90_000 },
  );
  expect(await page.evaluate(() => (window as unknown as { __links: string[] }).__links)).toEqual([]);
  expect(problems).toEqual([]);
});

test('hub: recyklomat otwiera skrzynkę, skin trafia do ekwipunku i na Gnata', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./');
  await ready(page);
  await page.evaluate(() => {
    localStorage.setItem('piotrobonk:save', JSON.stringify({ version: 2, save: { bottles: 500, deposit: 12 } }));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.start.is-ready') !== null, undefined, { timeout: 60_000 });
  await page.mouse.click(10, 10);
  await expect(page.locator('.hubmenu')).toBeVisible();
  // The skins load as their own chunk; the shop button waits for them.
  const shop = page.getByRole('button', { name: UI.hub.recyklomat, exact: true });
  await expect(shop).toBeEnabled({ timeout: 30_000 });
  await shop.click();
  await expect(page.locator('.recyk')).toBeVisible();
  await expect(page.locator('.case-row')).toHaveCount(42);
  await page.locator('.case-detail .btn').click();
  await expect(page.locator('.roulette')).toBeVisible({ timeout: 20_000 });
  // Once the strip's pictures are in it spins; skip it: the result was decided (and saved) before it started.
  await expect(page.locator('.roulette__hint')).toHaveText(UI.recyklomat.skip, { timeout: 40_000 });
  await page.keyboard.press('Space');
  await expect(page.locator('.reveal')).toBeVisible({ timeout: 15_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { bottles: number; inventory: unknown[] } });
  // 500 − 30 for the case and its key (the 12 deposited were already in the bank, the hub only shows them going in).
  expect(saved.save.bottles).toBe(470);
  expect(saved.save.inventory).toHaveLength(1);
  await page.getByRole('button', { name: UI.recyklomat.next }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.hubmenu')).toBeVisible();
  await page.getByRole('button', { name: UI.hub.inventory }).click();
  await expect(page.locator('.inv .skin-tile')).toHaveCount(1);
  const equip = page.locator('.inv__actions .btn').first();
  await equip.click();
  await expect(equip).toHaveText(UI.inventory.unequip);
  const equipped = await page.evaluate(() => (JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { equip: Record<string, unknown> } }).save.equip);
  expect(equipped.gun ?? equipped.knife ?? equipped.gloves).not.toBeNull();
  expect(problems).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('inventory.png') });
});
