import { expect, test } from '@playwright/test';

// Under SwiftShader (CI, no GPU) headless Chrome reads the canvas back to composite it and logs this driver
// warning itself. It never appears with a real GPU, where the test stays fully strict.
const SWIFTSHADER_NOISE = /GL Driver Message .*GPU stall due to ReadPixels/;

test('scena tytułowa startuje bez błędów i ostrzeżeń w konsoli', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (process.env.CI && SWIFTSHADER_NOISE.test(msg.text())) return;
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));

  await page.goto('./');
  await expect(page.locator('#scene')).toBeVisible();
  await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 30_000 });
  await expect(page.locator('.title__logo')).toHaveText('PIOTROBONK');
  await expect(page.locator('.fatal')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(problems).toEqual([]);
  // Screenshot last: reading back a WebGL canvas makes Chrome log a "GPU stall due to ReadPixels" driver warning.
  await page.screenshot({ path: test.info().outputPath('title.png') });
});
