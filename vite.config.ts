import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

/** The in-game changelog: the last commits, newest first, as [date, subject]. CI checks out the full history. */
function changelog(): [string, string][] {
  const log = git('log -n 120 --no-merges --date=short --pretty=format:%ad%x09%s');
  if (log === 'dev') return [];
  return log
    .split('\n')
    .map((line) => line.split('\t') as [string, string])
    .filter(([date, subject]) => date && subject);
}

export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  const sha = git('rev-parse HEAD');
  return {
    // Relative base: works under /piotrobonk/ on github.io and at the root of a custom domain.
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __GIT_SHA__: JSON.stringify(sha.slice(0, 7)),
      __CHANGELOG__: JSON.stringify(changelog()),
    },
    build: {
      target: 'es2022',
      outDir: offline ? 'dist-offline' : 'dist',
      manifest: !offline,
      // Budget enforced on gzip size by scripts/check-size.ts instead.
      chunkSizeWarningLimit: 4096,
    },
    // Offline release zip: one self-contained index.html that runs from file://.
    plugins: [
      {
        // CI polls this tag on the live site to know when a deploy has gone live.
        name: 'piotrobonk-version-meta',
        // The link preview needs absolute addresses: the live site (or SITE_URL for a custom domain).
        transformIndexHtml: (html: string) =>
          html
            .replaceAll('%SITE%', process.env.SITE_URL ?? pkg.homepage.replace(/\/?$/, '/'))
            .replace('</head>', `  <meta name="piotrobonk-version" content="${pkg.version} ${sha}" />\n  </head>`),
      },
      ...(offline ? [viteSingleFile()] : []),
      // Installable and fully playable offline. Every cache name starts with "piotrobonk:" (all of
      // github.io is one origin). No navigation fallback: an unknown address still gets the 404 page. The
      // offline zip (file://) has no service worker; the virtual module then registers nothing.
      VitePWA({
        disable: offline,
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          id: './',
          name: 'PIOTROBONK',
          short_name: 'PIOTROBONK',
          description: 'Ktoś rozkradł tory na linii 17. Piotrek idą z Łodzi Fabrycznej do Koluszek i na każdej stacji muszą pokonać bossa.',
          lang: 'pl',
          dir: 'ltr',
          start_url: './',
          scope: './',
          display: 'fullscreen',
          display_override: ['fullscreen', 'standalone'],
          orientation: 'landscape',
          background_color: '#0b0f24',
          theme_color: '#141a45',
          categories: ['games'],
          // The link preview doubles as the install sheet's picture (CI renders it into dist/ before upload).
          screenshots: [{ src: 'og.png', sizes: '1200x630', type: 'image/png', form_factor: 'wide', label: 'PIOTROBONK: ekran tytułowy' }],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          cacheId: 'piotrobonk:sw',
          globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
      }),
    ],
    test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
  };
});
