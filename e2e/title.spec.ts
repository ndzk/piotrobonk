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
  xp: number;
  level: number;
  debugNearlyMaxed(): void;
  debugOpenChest(): void;
}
const game = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as { __game: DebugGame }).__game.state);

async function startDebugRun(page: Page): Promise<void> {
  await page.goto('./?debug=1&seed=3');
  await page.waitForFunction(() => document.querySelector('.start.is-ready') !== null, undefined, { timeout: 60_000 });
  await page.mouse.click(10, 10);
  await expect.poll(() => game(page)).toBe('playing');
}

test('karty: przy jednej karcie klawisz 3 nic nie psuje', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'logic test, one engine is enough');
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

test('skrzynka otwarta razem z awansem pokazuje swój ekran', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'logic test, one engine is enough');
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

test('pauza po skoku zostaje otwarta (żadnych zaległych naciśnięć)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'logic test, one engine is enough');
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
