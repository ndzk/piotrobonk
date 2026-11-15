import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { NEWS } from '../src/content/changelog';

// The same commits vite.config.ts puts into the build's changelog.
function subjects(): string[] {
  try {
    return execSync('git log -n 120 --no-merges --pretty=format:%s', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

describe('Co nowego', () => {
  it('każdy commit ma polski wpis w src/content/changelog.ts (albo null, gdy to tylko narzędzia)', () => {
    const missing = subjects().filter((s) => !(s in NEWS));
    expect(missing).toEqual([]);
  });

  it('wpisy są zdaniami, bez angielskich resztek', () => {
    for (const text of Object.values(NEWS)) {
      if (text === null) continue;
      expect(text).toMatch(/[.!]$/);
      expect(text).not.toMatch(/\b(Add|Fix|the|and|review|stage)\b/);
    }
  });
});
