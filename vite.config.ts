import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
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
        transformIndexHtml: (html: string) =>
          html.replace('</head>', `  <meta name="piotrobonk-version" content="${pkg.version} ${sha}" />\n  </head>`),
      },
      ...(offline ? [viteSingleFile()] : []),
    ],
    test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
  };
});
