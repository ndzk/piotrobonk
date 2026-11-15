// Shared by the e2e specs: a console/network watcher that fails on any error or warning, and the "ready"
// wait (the game has drawn its first frames).
import type { Page } from '@playwright/test';

// Under SwiftShader (CI, no GPU) headless Chrome reads the canvas back to composite it and logs these driver
// warnings itself: the read-back stall, and on Windows a blit of the canvas onto itself (three.js only blits
// when resolving multisampled render targets, which the game never creates). Neither appears with a real GPU,
// where the check stays fully strict.
const SWIFTSHADER_NOISE = /GL Driver Message .*GPU stall due to ReadPixels|glBlitFramebuffer: Blit feedback loop/;

// Skin and case pictures come from Steam's CDN: the tests get a stand-in instead (no outside server in a
// test, and no Valve picture in the test output either).
const STEAM = 'https://community.akamai.steamstatic.com/**';
const PICTURE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

export function watch(page: Page): string[] {
  void page.route(STEAM, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PICTURE }));
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

export async function ready(page: Page): Promise<void> {
  // A cold start in CI (software GL, two cores, shaders compiled from scratch) takes 20-40 s.
  await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 60_000 });
}

