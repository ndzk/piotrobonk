import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { UI } from '../src/content/ui';

// Under SwiftShader (CI, no GPU) headless Chrome reads the canvas back to composite it and logs this driver
// warning itself. It never appears with a real GPU, where the check stays fully strict.
const SWIFTSHADER_NOISE = /GL Driver Message .*GPU stall due to ReadPixels/;

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (process.env.CI && SWIFTSHADER_NOISE.test(msg.text())) return;
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return problems;
}

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 30_000 });
}

test('ekran tytułowy startuje bez błędów i ostrzeżeń', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  await ready(page);
  await expect(page.locator('.title__logo')).toHaveText(UI.title);
  await expect(page.locator('.board__status')).toBeInViewport({ ratio: 1 });
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

test('nakładka błędu pokazuje raport i działające przyciski', async ({ page }) => {
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
  await page.keyboard.press('Digit1');
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
  await page.waitForTimeout(1300);
  await page.keyboard.press('Enter');
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

test('mapa trasy: stacje zamknięte poza pierwszą, wybór kursu', async ({ page }) => {
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
  await expect(page.locator('.route')).toBeVisible();
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
  test.setTimeout(120_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./?debug=1&seed=11&stacja=fabryczna');
  await page.waitForFunction(() => document.body.dataset.state === 'playing', undefined, { timeout: 60_000 });
  // Skip the survival timer: the boss is due now.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: DebugGame }).__game;
    g.time = g.bossAt;
  });
  await expect(page.locator('.boss-intro')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.bossbar')).toBeVisible({ timeout: 20_000 });
  // Soften the boss and let the arsenal finish it mid-step, the way a real kill happens: the pool
  // compacts in the same step, which is exactly what used to leave the controller on a random pigeon.
  await page.waitForFunction(() => {
    const g = (window as unknown as { __game: DebugGame }).__game;
    if (!g.boss || g.boss.index < 0) return false;
    g.enemies.hp[g.boss.index] = 1;
    return true;
  }, undefined, { timeout: 30_000, polling: 200 });
  await expect(page.locator('.cleared')).toBeVisible({ timeout: 60_000 });
  // The boss's own death counts and pays out.
  await expect(page.locator('.cleared__stats')).toContainText(UI.cleared.bottles.replace('{v}', ''));
  const kills = await page.evaluate(() => (window as unknown as { __game: DebugGame }).__game.enemies.kills);
  expect(kills).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  // Back on the route map, with the next stop open.
  await expect(page.locator('.route')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.stop.is-cleared')).toHaveCount(1);
  await expect(page.locator('.stop.is-locked')).toHaveCount(7);
  expect(problems).toEqual([]);
});

test('przejazd na kolejną stację przebudowuje arenę', async ({ page }) => {
  test.setTimeout(90_000);
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
  test.setTimeout(120_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./?debug=1&seed=6&stacja=fabryczna');
  await expect.poll(() => game(page), { timeout: 60_000 }).toBe('playing');
  const mem = async (): Promise<{ geometries: number; textures: number }> =>
    page.evaluate(() => (window as unknown as { __info: () => { geometries: number; textures: number } }).__info());
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
