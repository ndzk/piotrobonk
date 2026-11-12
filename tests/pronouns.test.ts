// Piotrek use they/them. In Polish that means plural verbs: "Piotrek wrócili", never "Piotrek wrócił".
// Simple heuristic scan of every string literal in src/content/: after the nominative "Piotrek",
// until the end of the clause or the next capitalised name, flag masculine-singular forms.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONTENT_DIR = join(import.meta.dirname, '..', 'src', 'content');

const SINGULAR = new Set([
  'on', 'jego', 'jemu', 'mu', 'go', 'niego', 'niemu', 'nim', 'jest', 'był', 'sam', 'ma', 'idzie', 'chce',
  'musi', 'może', 'wraca', 'jedzie', 'zbiera', 'bije', 'zginął', 'poszedł', 'szedł', 'mógł', 'zmęczony', 'wkurwiony',
]);
// Words that end in "ł" but are not verbs.
const NOT_VERBS = new Set(['pół', 'dół', 'stół', 'kościół', 'kocioł', 'popiół', 'szał', 'dział', 'kanał', 'materiał',
  'orzeł', 'anioł', 'pomysł', 'zmysł', 'przemysł', 'węzeł', 'kozioł', 'muł', 'wół']);

function pronounIssues(text: string): string[] {
  const issues: string[] = [];
  for (const clause of text.split(/[.,!?;:…—–\n"„”()]/u)) {
    const words = clause.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const start = words.indexOf('Piotrek');
    if (start < 0) continue;
    for (const word of words.slice(start + 1)) {
      if (/^\p{Lu}/u.test(word)) break; // another name takes over the clause
      const w = word.toLowerCase();
      if (SINGULAR.has(w) || (w.endsWith('ł') && !NOT_VERBS.has(w))) issues.push(`„${w}” w: ${clause.trim()}`);
    }
  }
  return issues;
}

function contentStrings(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const file of readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })) {
    if (!/\.(ts|json)$/.test(file) || file.endsWith('.test.ts')) continue;
    const source = readFileSync(join(CONTENT_DIR, file), 'utf8');
    for (const m of source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/gsu)) out.push({ file, text: m[2] });
  }
  return out;
}

describe('zaimki Piotrka', () => {
  it('heuristic flags singular forms and accepts plural ones', () => {
    expect(pronounIssues('Piotrek wrócił z pracy.')).toHaveLength(1);
    expect(pronounIssues('Piotrek jest zmęczony')).toHaveLength(2);
    expect(pronounIssues('Piotrek wrócili z pracy, a Bartek się wkurwił.')).toEqual([]);
    expect(pronounIssues('Piotrek zebrali butelkę i Bartek im zazdrościł')).toEqual([]);
    expect(pronounIssues('Piotrek idą pół drogi pieszo')).toEqual([]);
  });

  it('src/content has no masculine-singular forms next to Piotrek', () => {
    const strings = contentStrings();
    expect(strings.length).toBeGreaterThan(0);
    const issues = strings.flatMap(({ file, text }) => pronounIssues(text).map((i) => `${file}: ${i}`));
    expect(issues).toEqual([]);
  });
});
