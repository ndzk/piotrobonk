// Stage 6, the platform layer: settings that stick, the journal, the daily run and its share link, moving
// the save as a code, the PWA (manifest, service worker, prefixed caches) and the touch controls.
import { expect, test, type Page } from '@playwright/test';
import { UI } from '../src/content/ui';
import { ready, watch } from './helpers';

/** Straight to the hub with a given save (version 4 fields default when missing). */
async function hub(page: Page, save: Record<string, unknown> = {}, url = './'): Promise<void> {
  await page.goto(url);
  await ready(page);
  await page.evaluate((s) => {
    localStorage.setItem('piotrobonk:save', JSON.stringify({ version: 4, save: { bottles: 800, introSeen: true, runs: 3, ...s } }));
  }, save);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.start.is-ready') !== null, undefined, { timeout: 60_000 });
  await page.mouse.click(10, 10);
  await expect(page.locator('.hubmenu')).toBeVisible();
}

test('ustawienia: zmiana działa od razu i zostaje po odświeżeniu', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await hub(page);
  await page.getByRole('button', { name: UI.settings.open }).click();
  await expect(page.locator('.settings')).toBeVisible();
  // Music 70% → 80% by clicking the row.
  await page.locator('.settings .option', { hasText: UI.settings.music }).click();
  await expect(page.locator('.settings .option', { hasText: UI.settings.music })).toContainText('80%');
  // Text size: the whole interface grows at once.
  await page.locator('.settings__tab', { hasText: UI.settings.tabs.access }).click();
  await page.locator('.settings .option', { hasText: UI.settings.textScale }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('#ui')?.style.zoom)).toBe('1.15');
  // A key binding: jump on J.
  await page.locator('.settings__tab', { hasText: UI.settings.tabs.controls }).click();
  await page.locator('.settings .option', { hasText: UI.settings.keys.jump }).first().click();
  await expect(page.locator('.settings .option', { hasText: UI.settings.keys.jump }).first()).toContainText(UI.settings.press);
  await page.keyboard.press('KeyJ');
  await expect(page.locator('.settings .option', { hasText: UI.settings.keys.jump }).first()).toContainText('J');
  await page.keyboard.press('Escape');
  await expect(page.locator('.hubmenu')).toBeVisible();
  const stored = await page.evaluate(() => (JSON.parse(localStorage.getItem('piotrobonk:settings') ?? '{}') as { settings: { music: number; textScale: number; keys: { jump: string } } }).settings);
  expect(stored.music).toBeCloseTo(0.8);
  expect(stored.textScale).toBe(1.15);
  expect(stored.keys.jump).toBe('KeyJ');
  await page.reload();
  await ready(page);
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('#ui')?.style.zoom)).toBe('1.15');
  expect(problems).toEqual([]);
});

test('dziennik: osiągnięcia, kompendium bez spoilerów, statystyki, co nowego', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await hub(page, { stats: { kills: 1500 }, seen: { enemies: ['golab'], bosses: ['biletomat'], evolutions: [] }, stations: { fabryczna: { cleared: 'normalnie', bestTime: 140, bestKills: 600 } } });
  // Earned on the way in (a run played, the first boss, 1000 kills): stamped in the save.
  await expect.poll(() => page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { achievements?: Record<string, number> } }).save.achievements ?? {}).sort())).toEqual(['biletomat', 'pierwszy-run', 'zabojstwa-1']);
  await expect(page.locator('.achv-toast')).toBeVisible();
  await page.getByRole('button', { name: UI.journal.button }).click();
  await expect(page.locator('.journal')).toBeVisible();
  await expect(page.locator('.journal__lead')).toContainText('3 z');
  await page.locator('.journal .settings__tab', { hasText: UI.journal.tabs.compendium }).click();
  // The pigeon is known, Bartek is not.
  await expect(page.locator('.entry__name', { hasText: 'Gołąb' }).first()).toBeVisible();
  await expect(page.locator('.entry__name', { hasText: 'Bartek D.' })).toHaveCount(0);
  await page.locator('.journal .settings__tab', { hasText: UI.journal.tabs.stats }).click();
  await expect(page.locator('.journal__stats').first()).toContainText('1500');
  await page.locator('.journal .settings__tab', { hasText: UI.journal.tabs.news }).click();
  await expect(page.locator('.journal__lead')).toContainText(UI.journal.version.replace('{v}', ''));
  await page.keyboard.press('Escape');
  await expect(page.locator('.hubmenu')).toBeVisible();
  expect(problems).toEqual([]);
});

test('codzienny kurs: wynik, karta i link ?wynik= otwierający ją u kogoś innego', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  // The daily run shows up once the first station is behind the player.
  await hub(page, { stations: { fabryczna: { cleared: 'normalnie', bestTime: 120, bestKills: 300 } } }, './?debug=1');
  await page.locator('.hubmenu__daily').click();
  await page.waitForFunction(() => (window as unknown as { __game?: { state: string } }).__game?.state === 'playing', undefined, { timeout: 60_000 });
  await expect(page.locator('.hud')).toContainText(UI.daily.hudTag);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    (window as unknown as { __game: { player: { hp: number } } }).__game.player.hp = 0;
  });
  await expect(page.locator('.daily')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.daily__score')).toContainText('pkt');
  const saved = await page.evaluate(() => (JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { daily: Record<string, { code: string }>; stations: Record<string, unknown> } }).save);
  // A daily run never opens the line: only the station cleared before it is there.
  expect(Object.keys(saved.stations)).toEqual(['fabryczna']);
  const code = Object.values(saved.daily)[0].code;
  await page.goto(`./?wynik=${code}`);
  await expect(page.locator('.daily')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: UI.daily.play })).toBeVisible();
  // The link is consumed: a refresh does not show the card again.
  expect(page.url()).not.toContain('wynik');
  // A forged link opens nothing.
  await page.goto('./?wynik=AAAA.zzz');
  await ready(page);
  await expect(page.locator('.daily')).toBeHidden();
  expect(problems).toEqual([]);
});

test('zapis jako kod: skopiowany i wczytany z powrotem', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await hub(page, { bottles: 1234 });
  await page.getByRole('button', { name: UI.settings.open }).click();
  await page.locator('.settings__tab', { hasText: UI.settings.tabs.save }).click();
  await page.getByRole('button', { name: UI.settings.copyCode }).click();
  await expect(page.locator('.settings__code')).toHaveValue(/^PB1-/);
  const code = await page.locator('.settings__code').inputValue();
  // Somewhere else, with another save: paste it, confirm, and the bank is back.
  await page.evaluate(() => {
    localStorage.setItem('piotrobonk:save', JSON.stringify({ version: 4, save: { bottles: 5, introSeen: true, runs: 1 } }));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.start.is-ready') !== null, undefined, { timeout: 60_000 });
  await page.mouse.click(10, 10);
  await page.getByRole('button', { name: UI.settings.open }).click();
  await page.locator('.settings__tab', { hasText: UI.settings.tabs.save }).click();
  await page.locator('.settings__code').fill(code);
  await page.getByRole('button', { name: UI.settings.loadCode }).click();
  await expect(page.locator('.settings__status')).toHaveText(UI.settings.confirm);
  await page.getByRole('button', { name: UI.settings.loadCode }).click();
  await expect(page.locator('.settings__status')).toHaveText(UI.settings.loaded);
  const bottles = await page.evaluate(() => (JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { bottles: number } }).save.bottles);
  expect(bottles).toBe(1234);
  expect(problems).toEqual([]);
});

test('PWA: manifest, service worker i pamięć podręczna z prefiksem piotrobonk:', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'one browser is enough for the service worker');
  const problems = watch(page);
  await page.goto('./');
  await ready(page);
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBeTruthy();
  const res = await page.request.get(new URL(manifest ?? '', page.url()).toString());
  const json = (await res.json()) as { name: string; lang: string; icons: unknown[] };
  expect(json.name).toBe('PIOTROBONK');
  expect(json.lang).toBe('pl');
  expect(json.icons.length).toBeGreaterThanOrEqual(3);
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), undefined, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length), { timeout: 30_000 }).toBeGreaterThan(0);
  const keys = await page.evaluate(async () => caches.keys());
  for (const k of keys) expect(k.startsWith('piotrobonk:')).toBe(true);
  // The whole game is precached, not just the icons: the page, its script and its styles.
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
    return urls;
  });
  const script = await page.locator('script[type="module"][src]').first().getAttribute('src');
  expect(cached.some((u) => u.endsWith('/index.html'))).toBe(true);
  expect(cached.some((u) => u.endsWith((script ?? '?').replace(/^\.\//, '/')))).toBe(true);
  expect(cached.some((u) => u.endsWith('.css'))).toBe(true);
  // And it starts without a network.
  await page.context().setOffline(true);
  await page.reload();
  await ready(page);
  await page.context().setOffline(false);
  expect(problems).toEqual([]);
});

test('dotyk: na telefonie w runie są gałka i przyciski, w menu ich nie ma', async ({ page }) => {
  test.skip(test.info().project.name !== 'android', 'needs a touch phone');
  const problems = watch(page);
  await page.goto('./?debug=1&seed=3&stacja=fabryczna');
  await page.waitForFunction(() => (window as unknown as { __game?: { state: string } }).__game?.state === 'playing', undefined, { timeout: 90_000 });
  // Nothing may get in the way while it waits: no level-up cards, no death.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { god: boolean; xp: number } }).__game;
    g.god = true;
    g.xp = -1e9;
  });
  await page.touchscreen.tap(300, 200);
  await expect(page.locator('.touch')).toBeVisible();
  // Under pointer lock Chromium reports fingers at (0, 0): a phone must never hold one.
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await expect(page.getByRole('button', { name: UI.touch.jump })).toBeVisible();
  await page.getByRole('button', { name: UI.touch.pause }).tap();
  const state = (): Promise<string> => page.evaluate(() => (window as unknown as { __game: { state: string } }).__game.state);
  await expect.poll(state).toBe('paused');
  await expect(page.locator('.touch')).toBeHidden();
  // Back in, one level up: the cards must take a tap through the touch controls' zones.
  await page.getByRole('button', { name: UI.pause.resume }).tap();
  await expect.poll(state).toBe('playing');
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { xp: number; hudState: { xpNext: number } } }).__game;
    g.xp = g.hudState.xpNext;
  });
  await expect.poll(state, { timeout: 30_000 }).toBe('levelup');
  await page.locator('.card').first().tap();
  await expect.poll(state, { timeout: 30_000 }).toBe('playing');
  expect(problems).toEqual([]);
});

test('drabinka opóźnień: po pierwszym dojeździe tablica odjazdów, szczebel wybrany i zapowiedziany w runie', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  const cleared = { cleared: 'normalnie', bestTime: 120, bestKills: 300 };
  // A save from before the ladder (version 4) that has finished the line: the first rung opens on its own.
  await hub(page, { finished: 1, callsSeen: ['fabryczna'], stations: { fabryczna: cleared } });
  await page.locator('.hubmenu .btn', { hasText: UI.hub.play }).first().click();
  await expect(page.locator('.route')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.route__ladder')).toContainText(UI.route.ladderNone);
  await page.locator('.route__ladder').click();
  await expect(page.locator('.departures')).toBeVisible();
  await expect(page.locator('.departure')).toHaveCount(21);
  await expect(page.locator('.departure.is-locked')).toHaveCount(19);
  await page.locator('.departure').nth(1).click();
  await expect(page.locator('.departures')).toBeHidden();
  await expect(page.locator('.route__ladder')).toContainText('+15 min');
  const chosen = await page.evaluate(() => (JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { save: { ladder: { chosen: number } } }).save.ladder.chosen);
  expect(chosen).toBe(1);
  await page.locator('.route .btn', { hasText: UI.route.play }).click();
  await expect(page.locator('.hud__toast')).toContainText('+15 min', { timeout: 30_000 });
  expect(problems).toEqual([]);
});

test('śmierć: ekran „Co cię zajebało” pokazuje ostatnie trafienia ze źródłem', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'logic test, one project is enough');
  const problems = watch(page);
  await page.goto('./?debug=1&seed=4&stacja=fabryczna');
  await page.waitForFunction(() => (window as unknown as { __game?: { state: string } }).__game?.state === 'playing', undefined, { timeout: 60_000 });
  // A pigeon right on Piotrek: its touch is the hit the screen must name.
  await page.waitForFunction(
    () => {
      const g = (window as unknown as { __game: { log: { hitCount: number }; player: { pos: { x: number; z: number } }; enemies: { spawn(t: number, x: number, z: number, h: number, d: number, r: { next(): number }): void } } }).__game;
      if (g.log.hitCount > 0) return true;
      g.enemies.spawn(0, g.player.pos.x, g.player.pos.z, 1, 1, { next: () => 0.5 });
      return false;
    },
    undefined,
    { timeout: 60_000, polling: 500 },
  );
  await page.evaluate(() => {
    (window as unknown as { __game: { player: { hp: number } } }).__game.player.hp = 0;
  });
  await expect(page.locator('.summary')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.summary__death')).toContainText(UI.death.title);
  await expect(page.locator('.summary__hits li').first()).toContainText('Gołąb dworcowy');
  expect(problems).toEqual([]);
});
