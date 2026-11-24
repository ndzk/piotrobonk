// Builds the simulation worker (the real game code bundled for Node) and plays jobs on a pool of threads.
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../..');
export const SIM_DIR = join(root, '.sim');
/** The bundle's name: SIM_WORKER=other keeps a second run from rebuilding the one a long run is still loading. */
const NAME = process.env.SIM_WORKER ?? 'worker';

/** Bundles scripts/sim/worker.ts with everything it imports from src/ into .sim/worker.mjs (three stays external). */
export async function buildWorker(): Promise<string> {
  await build({
    root,
    configFile: false,
    publicDir: false,
    logLevel: 'error',
    define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
    build: {
      ssr: join(root, 'scripts/sim/worker.ts'),
      outDir: SIM_DIR,
      emptyOutDir: false,
      target: 'node22',
      minify: false,
      rollupOptions: { output: { entryFileNames: `${NAME}.mjs` } },
    },
  });
  return join(SIM_DIR, `${NAME}.mjs`);
}

export interface PoolOptions {
  threads?: number;
  onResult?: (done: number, total: number) => void;
}

/** Runs every job on `threads` workers and returns the results in job order. */
export async function runPool<R extends { id: number }>(file: string, jobs: { id: number }[], opts: PoolOptions = {}): Promise<R[]> {
  const threads = Math.max(1, Math.min(jobs.length, opts.threads ?? Math.max(1, availableParallelism() - 1)));
  const results: R[] = new Array<R>(jobs.length);
  const index = new Map(jobs.map((j, i) => [j.id, i]));
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: threads }, () => {
      const w = new Worker(file);
      return new Promise<void>((ok, fail) => {
        const feed = (): void => {
          if (next >= jobs.length) {
            void w.terminate().then(() => {
              ok();
            });
            return;
          }
          w.postMessage(jobs[next++]);
        };
        w.on('message', (r: R) => {
          results[index.get(r.id) ?? 0] = r;
          done++;
          opts.onResult?.(done, jobs.length);
          feed();
        });
        w.on('error', fail);
        feed();
      });
    }),
  );
  return results;
}
