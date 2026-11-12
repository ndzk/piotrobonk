// Piotrek use they/them. In Polish that means plural verbs ("Piotrek wrócili", "Piotrek idą"), and the player,
// who is Piotrek, is never addressed with gendered past forms ("zebrałeś"). This is a heuristic scan of every
// player-facing string: all values exported from src/content/ plus the static HTML pages.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Other characters. A string that names one of them may legitimately use masculine forms about them.
const OTHERS = new Set(
  'bartek bartka bartkowi bartkiem bartku kanar kanara kanarowi kanarem kanarzy złomiarz złomiarza złomiarze król króla kierownik kierownika konduktor konduktora gołąb gołębia szczur szczura lemur lemura biletomat biletomatu autobus autobusu megafon megafonu robotnik robotnika ktoś nikt kto ktokolwiek'.split(
    ' ',
  ),
);
// Words ending in "ł" / "łem" that are nouns or adverbs, not masculine verbs.
const NOT_VERBS = new Set(
  'pół dół stół kościół kocioł popiół szał dział kanał materiał orzeł anioł pomysł zmysł przemysł węzeł kozioł muł wół upał zapał ogół kieł stołem pomysłem dołem kołem orłem węzłem masłem mydłem piekłem szkłem dziełem czołem działem kanałem materiałem przemysłem zmysłem kościołem popiołem skrzydłem źródłem światłem ciałem wiosłem krzesłem hasłem kotłem upałem zapałem szałem ogółem'.split(
    ' ',
  ),
);
// Masculine-singular words that must never follow "Piotrek".
const SINGULAR = new Set('on jego jemu mu go niego niemu nim jest był byłby sam zmęczony wkurwiony ma idzie chce musi może'.split(' '));
// Words skipped when looking for the predicate right after "Piotrek".
const SKIP = new Set(
  'nie się już też także znowu znów jeszcze wreszcie właśnie tylko nawet zaraz potem teraz dziś dzisiaj wtedy zawsze nigdy chyba pewnie raczej serio ledwo prawie sobie to aż no'.split(
    ' ',
  ),
);
// "Piotrek i Bartek…": a compound subject is plural anyway.
const CONJUNCTIONS = new Set(['i', 'oraz', 'ani', 'albo', 'lub', 'czy', 'z', 'ze']);
// Plural predicates: 3rd person present (-ą), past (-li/-ły), conditional, plural participles; plus explicit adjectives.
const PLURAL_ENDING = /(ą|li|ły|liby|łyby|eni|ani)$/u;
const PLURAL_WORDS = new Set('gotowi szczęśliwi głodni zajebiści biedni smutni sami'.split(' '));

const words = (text: string): string[] => text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
const mascPast = (w: string): boolean => w.endsWith('ł') && w.length > 2 && !NOT_VERBS.has(w);

/** `otherSpeaker`: the line is spoken by someone else (e.g. Bartek), so their own "-łem" is fine. */
export function pronounIssues(text: string, otherSpeaker = false): string[] {
  const found = new Set<string>();
  const all = words(text);
  for (const w of all) {
    if (NOT_VERBS.has(w)) continue;
    if (/ł(eś|byś)$/u.test(w)) found.add(w);
    if (!otherSpeaker && /ł(em|bym)$/u.test(w)) found.add(w);
  }
  if (all.includes('piotrek')) {
    if (!all.some((w) => OTHERS.has(w))) for (const w of all) if (mascPast(w)) found.add(w);
    for (const sentence of text.toLowerCase().split(/[.!?…:;\n]+/u)) {
      const at = sentence.search(/(?<!\p{L})piotrek(?!\p{L})/u);
      if (at < 0) continue;
      const rest = sentence.slice(at + 'piotrek'.length);
      const after = words(rest);
      const vocative = /^\s*[,—–-]/u.test(rest);
      const head = after.find((w) => !SKIP.has(w));
      if (!vocative && head !== undefined && !CONJUNCTIONS.has(head) && !OTHERS.has(head)) {
        if (!PLURAL_ENDING.test(head) && !PLURAL_WORDS.has(head)) found.add(head);
      }
      for (const w of after) {
        if (OTHERS.has(w)) break;
        if (SINGULAR.has(w) || mascPast(w)) found.add(w);
      }
    }
  }
  return [...found];
}

interface Line {
  where: string;
  text: string;
  otherSpeaker: boolean;
}

function collect(value: unknown, where: string, otherSpeaker: boolean, out: Line[]): void {
  if (typeof value === 'string') out.push({ where, text: value, otherSpeaker });
  else if (Array.isArray(value)) value.forEach((v, i) => { collect(v, `${where}[${i}]`, otherSpeaker, out); });
  else if (value && typeof value === 'object') {
    const speaker = (value as { speaker?: unknown }).speaker;
    const other = typeof speaker === 'string' ? speaker !== 'piotrek' : otherSpeaker;
    for (const [k, v] of Object.entries(value)) collect(v, `${where}.${k}`, other, out);
  }
}

function htmlText(file: string): string[] {
  const html = readFileSync(join(import.meta.dirname, '..', file), 'utf8').replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ');
  return [...html.matchAll(/content="([^"]*)"|>([^<]+)</g)].map((m) => m.slice(1).join('').trim()).filter(Boolean);
}

describe('zaimki Piotrka', () => {
  it.each([
    'Piotrek wrócił z pracy.',
    'Piotrek jest zmęczony',
    'Piotrek biegnie',
    'Piotrek strzela',
    'Piotrek ginie',
    'Piotrek idą do Łodzi i tam zginął',
    'Piotrek wstali. Potem poszedł do domu',
    'Piotrek, zmęczony, poszedł spać',
    'PIOTREK ZGINĄŁ',
    'Piotrek ZGINĄŁ',
    'Zginąłeś',
    'Zebrałeś 12 butelek',
    'Wróciłem',
    'Piotrek byłby szczęśliwy',
  ])('flags: %s', (text) => {
    expect(pronounIssues(text)).not.toEqual([]);
  });

  it.each([
    'Piotrek wrócili z pracy, a Bartek się wkurwił.',
    'Piotrek zebrali butelkę i Bartek im zazdrościł',
    'Piotrek idą pół drogi pieszo',
    'Piotrek nie mają już siły',
    'Piotrek i Bartek pokłócili się',
    'PIOTREK ZEBRALI 12 BUTELEK',
    'Piotrek są zmęczeni',
    'Piotrek wkurwieni idą dalej',
    'Piotrek będą w domu za 20 minut',
    'Piotrek, oddawaj kasę!',
    'Bartek ukradł szyny, bo go bolała dupa',
    'Ogółem: 12 butelek',
  ])('accepts: %s', (text) => {
    expect(pronounIssues(text)).toEqual([]);
  });

  it('lets other speakers use their own masculine first person, but not about the player', () => {
    expect(pronounIssues('Ukradłem wam tory.', true)).toEqual([]);
    expect(pronounIssues('Widziałeś to?', true)).not.toEqual([]);
  });

  it('every player-facing string passes', () => {
    const lines: Line[] = [];
    const modules = import.meta.glob<Record<string, unknown>>(['../src/content/**/*.ts', '!../src/content/**/*.test.ts'], {
      eager: true,
    });
    for (const [file, mod] of Object.entries(modules)) collect(mod, file, false, lines);
    for (const file of ['index.html', 'public/404.html']) for (const text of htmlText(file)) lines.push({ where: file, text, otherSpeaker: false });
    expect(lines.length).toBeGreaterThan(10);
    const issues = lines.flatMap((l) => pronounIssues(l.text, l.otherSpeaker).map((w) => `${l.where}: „${w}” w „${l.text}”`));
    expect(issues).toEqual([]);
  });
});
