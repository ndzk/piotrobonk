// The link preview (og:image, 1200×630) for Discord, Twitch and the rest: the real title screen of the
// build, shot in headless Chromium. CI runs it on the finished dist/ before the Pages upload.
// Usage: node scripts/og-image.ts [distDir]
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const dist = process.argv[2] ?? 'dist';
const server = await preview({ preview: { port: 4174, strictPort: true }, build: { outDir: dist }, logLevel: 'error' });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:4174/');
  await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 90_000 });
  // A preview is a poster, not a screen to use: no "click to start", no key list, no version line.
  // Toasts (offline ready, a new version, achievements) are the visit's, not the game's: none in the poster.
  await page.addStyleTag({ content: '.start, .version, .update, .achv-toast { display: none !important; } .title__logo { font-size: 128px !important; } .board__status { animation: none !important; opacity: 1 !important; }' });
  // The scene behind the title settles for a moment (fades, first shadow frames).
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dist}/og.png` });
  console.log(`${dist}/og.png`);
} finally {
  await browser.close();
  await server.close();
}
