// Difficulty: the three kursy and, after the first finish of the line, the ladder of delays ("Opóźnienie +15 min"
// … "+5 h"). Every rung adds one readable mechanical modifier on top of Normalnie and keeps the ones below it,
// like Ascension in Slay the Spire. The numbers behind each modifier live in src/content/tuning.ts; the
// decisions and the measurements are in BALANCE.md.

export type Kurs = 'spokojny' | 'normalnie' | 'opoznienie';

export type ModifierId =
  | 'kanar'
  | 'tlok'
  | 'klima'
  | 'biletomat'
  | 'afiksy2'
  | 'prace'
  | 'sklad'
  | 'espresso'
  | 'spoznieni'
  | 'golebie'
  | 'bezUlgi'
  | 'rozklad'
  | 'kontrola'
  | 'siedzenia'
  | 'hamulec'
  | 'ostatni'
  | 'afiksy3'
  | 'automaty'
  | 'peron'
  | 'odwolany';

export interface Modifier {
  id: ModifierId;
  /** Short, the way it is announced on the departure board. */
  name: string;
  /** What it does, in one sentence. */
  text: string;
}

/** The rungs in order: rung n (1-based) is +15·n minutes and carries the modifiers of rungs 1…n. */
export const LADDER: Modifier[] = [
  // The heavy modifiers (each measured alone on Normalnie, BALANCE.md) come every two or three rungs, with the
  // light ones between them: every rung costs a little.
  { id: 'klima', name: 'Brak klimy', text: 'Co pół minuty regeneracja staje na 15 sekund.' },
  { id: 'prace', name: 'Prace torowe', text: 'Na placu co chwilę wyrastają strefy robót.' },
  { id: 'ostatni', name: 'Ostatni pociąg wcześniej', text: 'Nocne Kanary przychodzą o jedną trzecią szybciej.' },
  { id: 'kanar', name: 'Kanar na każdej stacji', text: 'Co 2 minuty wsiada elitarny kanar. Nic po sobie nie zostawia.' },
  { id: 'biletomat', name: 'Awaria biletomatu', text: 'Bez losowań kart, tylko jedno wyrzucenie.' },
  { id: 'hamulec', name: 'Ostry hamulec', text: 'Wrogowie biją o ćwierć mocniej.' },
  { id: 'espresso', name: 'Bartek pije podwójne espresso', text: 'Bossowie atakują szybciej i krócej ostrzegają.' },
  { id: 'golebie', name: 'Sezon na gołębie', text: 'Naloty gołębi co dwie minuty.' },
  { id: 'tlok', name: 'Przepełniony skład', text: 'Fale są o 15% gęstsze.' },
  { id: 'afiksy2', name: 'Elity z podwójnym afiksem', text: 'Każda elita ma dwie cechy.' },
  { id: 'kontrola', name: 'Kontrola w każdym wagonie', text: 'Kontrola biletów co półtorej minuty.' },
  { id: 'bezUlgi', name: 'Bez ulgi', text: 'Każde leczenie działa o ćwierć słabiej.' },
  { id: 'siedzenia', name: 'Twarde siedzenia', text: 'Wrogowie mają o ćwierć więcej zdrowia.' },
  { id: 'spoznieni', name: 'Godzina szczytu', text: 'Dwa razy więcej spóźnionych pasażerów.' },
  { id: 'peron', name: 'Tłok na peronie', text: 'Okrążenia wrogów są o 30% liczniejsze i ciaśniejsze.' },
  { id: 'rozklad', name: 'Zepsuty rozkład', text: 'Szczyty fal trwają dłużej, przerwy są krótsze.' },
  { id: 'sklad', name: 'Pociąg skrócony', text: 'Arena kurczy się do trzech czwartych.' },
  { id: 'afiksy3', name: 'Elity z potrójnym afiksem', text: 'Każda elita ma trzy cechy.' },
  { id: 'automaty', name: 'Automaty zepsute', text: 'Na stacji nie ma kawy z automatu.' },
  { id: 'odwolany', name: 'ODWOŁANY', text: 'Wszystko naraz, a do tego noc: widać tylko to, co blisko.' },
];

export const LADDER_MAX = LADDER.length;

/** "+15 min", "+1 h 30 min", "+5 h". */
export function delayName(rung: number): string {
  const m = rung * 15;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `+${String(r)} min`;
  return r ? `+${String(h)} h ${String(r)} min` : `+${String(h)} h`;
}

/** Every modifier a rung carries (its own and all below it). Rung 0 carries none. */
export function modifiersOf(rung: number): Set<ModifierId> {
  return new Set(LADDER.slice(0, Math.max(0, Math.min(LADDER_MAX, rung))).map((m) => m.id));
}

export function modifier(id: ModifierId): Modifier {
  return LADDER.find((m) => m.id === id) ?? LADDER[0];
}

/** The base kursy on the selection screen. */
export const KURSY: { id: Kurs; name: string; text: string }[] = [
  { id: 'spokojny', name: 'Spokojny kurs', text: 'Do fabuły. Wrogowie słabsi i wolniejsi, boss atakuje rzadziej i dłużej ostrzega. Gra wybacza błędy.' },
  { id: 'normalnie', name: 'Normalnie', text: 'Tak, jak ta gra ma wyglądać. Wymagająco: przeżyje dobry build i dobre poruszanie się.' },
  { id: 'opoznienie', name: 'Opóźnienie 120 min', text: 'Dla ogarniętych. Szybsze fale, elity z dwiema cechami, boss z dodatkową fazą.' },
];

/**
 * Bottles a run brings home, by kurs and rung: harder pays more. A rung is worth 8 % more on top of
 * Normalnie, so "+5 h" pays 2,6×. The CS case odds are never touched.
 */
export function bottleMultiplier(kurs: Kurs, rung: number): number {
  const base = kurs === 'spokojny' ? 0.8 : kurs === 'opoznienie' ? 1.5 : 1;
  return Math.round((base + (kurs === 'normalnie' ? rung * 0.08 : 0)) * 100) / 100;
}

/** Titles for the profile and the share card, earned by the highest rung beaten (0: Opóźnienie 120 min beaten). */
export const TITLES: { rung: number; name: string }[] = [
  { rung: 0, name: 'Pasażer z ulgą' },
  { rung: 1, name: 'Pasażer bez klimy' },
  { rung: 4, name: 'Stały bywalec' },
  { rung: 8, name: 'Rozkładowy wyjadacz' },
  { rung: 12, name: 'Zawiadowca' },
  { rung: 16, name: 'Dyżurny ruchu' },
  { rung: 20, name: 'Kursowy po ODWOŁANYM' },
];

/** Frames (colours) for the profile and the share card, from the same rungs. */
export const FRAMES: { rung: number; name: string; color: string }[] = [
  { rung: 0, name: 'Peronowa', color: '#8a8f99' },
  { rung: 4, name: 'Brązowa', color: '#c47a3a' },
  { rung: 8, name: 'Srebrna', color: '#c9d2dc' },
  { rung: 12, name: 'Złota', color: '#ffcc33' },
  { rung: 16, name: 'Semaforowa', color: '#e2362c' },
  { rung: 20, name: 'ODWOŁANA', color: '#b56cff' },
];

/**
 * The title and frame a save has earned: its best rung beaten, and whether any station has been cleared on
 * Opóźnienie 120 min (the first title is for that; before it there is none).
 */
export function rankOf(best: number, hard: boolean): { title: string; frame: { name: string; color: string } } {
  let title = '';
  for (const t of TITLES) if (best >= t.rung && (t.rung > 0 || hard)) title = t.name;
  let frame = FRAMES[0];
  for (const f of FRAMES) if (best >= f.rung) frame = f;
  return { title, frame };
}
