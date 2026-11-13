// Renders the dev character sheet (dev/characters.html) to ref/porownanie.png for side-by-side review
// with the reference photos. ref/ is gitignored: neither the photos nor this image ever reach the repo.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const out = process.argv[2] ?? 'ref/porownanie.png';
const query = process.argv[3] ? `?view=${process.argv[3]}` : '';
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`http://localhost:5199/dev/characters.html${query}`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 60_000 });
  await page.locator('#sheet').screenshot({ path: out });
  console.log(`saved ${out}`);
  if (problems.length) console.log(problems.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
