// Achievements: what the player has to do, and how it is checked against the lifetime counters and the save.
// Texts follow the game's rule: Piotrek take plural verbs ("Piotrek doszli"), never a masculine singular.

import { progressOf, type Save } from '../core/save';

/** Lifetime counters kept in the save, bumped by the game as things happen. */
export type StatKey =
  | 'kills'
  | 'bossKills'
  | 'elites'
  | 'evolutions'
  | 'chests'
  | 'coffees'
  | 'bins'
  | 'bottlesEarned'
  | 'pigeons'
  | 'lemurs'
  | 'inspectors'
  | 'bestLevel'
  | 'dailyRuns'
  | 'dailyClears'
  /** Different days with a codzienny kurs played. */
  | 'dailyDays'
  | 'starsDropped'
  | 'slaps'
  | 'lastMinute';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Hidden until earned (shown as "???" in the list). */
  secret?: boolean;
  /** Progress towards it, 0..1, from the lifetime counters and the save. */
  progress: (stats: Readonly<Partial<Record<StatKey, number>>>, save: Save) => number;
}

const atLeast =
  (key: StatKey, n: number) =>
  (stats: Readonly<Partial<Record<StatKey, number>>>): number =>
    Math.min(1, (stats[key] ?? 0) / n);
const cleared = (id: string) => (_: unknown, save: Save) => (progressOf(save, id).cleared ? 1 : 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'pierwszy-run', name: 'Ruszyli', description: 'Wyrusz w pierwszą trasę.', progress: (_, s) => Math.min(1, s.runs) },
  { id: 'biletomat', name: 'Reszta się nie należy', description: 'Pokonaj Biletomat Który Nie Wydaje Reszty.', progress: cleared('fabryczna') },
  { id: 'pajeczyca', name: 'Na włosku', description: 'Pokonaj Przędzalnianą Pajęczycę.', progress: cleared('niciarniana') },
  { id: 'kanar', name: 'Bilet do kontroli', description: 'Pokonaj Kanara Prime.', progress: cleared('widzew') },
  { id: 'krol-zlomu', name: 'Skup zamknięty', description: 'Pokonaj Króla Skupu Złomu.', progress: cleared('andrzejow') },
  { id: 'zka', name: 'Ostatni kurs', description: 'Pokonaj ZKA Ostatni Kurs.', progress: cleared('bedon') },
  { id: 'golab-matka', name: 'Gniazdo opróżnione', description: 'Pokonaj Gołębia Matkę.', progress: cleared('justynow') },
  { id: 'kierownik', name: 'Prace torowe zakończone przed terminem', description: 'Pokonaj Kierownika Robót PLK.', progress: cleared('galkowek') },
  { id: 'megafon', name: 'Komunikat odwołany', description: 'Pokonaj Megafon Komunikatów.', progress: cleared('zakowice') },
  { id: 'lisc', name: 'Wyjebany liść', description: 'Daj Bartkowi D. liścia pod Dino.', progress: (_, s) => Math.min(1, s.finished) },
  { id: 'opoznienie', name: 'Opóźnienie 120 minut', description: 'Odbuduj Koluszki na kursie „Opóźnienie”.', progress: (_, s) => (progressOf(s, 'koluszki').cleared === 'opoznienie' ? 1 : 0) },
  {
    id: 'cala-linia',
    name: 'Cała siedemnastka',
    description: 'Odbuduj każdą stację na kursie „Opóźnienie”.',
    progress: (_, s) => ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'].filter((id) => progressOf(s, id).cleared === 'opoznienie').length / 9,
  },
  { id: 'szybki-dom', name: 'Prawie 20 minut', description: 'Skończ linię, zanim „Czas do domu” przekroczy 2 godziny.', progress: (_, s) => (s.homeTime > 0 && s.homeTime <= 7200 ? 1 : 0), secret: true },
  { id: 'zabojstwa-1', name: 'Rozgrzewka', description: 'Pokonaj 1000 wrogów (w sumie).', progress: atLeast('kills', 1000) },
  { id: 'zabojstwa-2', name: 'Masowa komunikacja', description: 'Pokonaj 25 000 wrogów (w sumie).', progress: atLeast('kills', 25_000) },
  { id: 'zabojstwa-3', name: 'Komunikacja zastępcza', description: 'Pokonaj 100 000 wrogów (w sumie).', progress: atLeast('kills', 100_000) },
  { id: 'golebie', name: 'Plac bez gołębi', description: 'Przegoń 2000 gołębi.', progress: atLeast('pigeons', 2000) },
  { id: 'kanarzy', name: 'Bez biletu', description: 'Pokonaj 200 kanarów.', progress: atLeast('inspectors', 200) },
  { id: 'lemury', name: 'Dolewki nie będzie', description: 'Ubij 50 lemurów z dolewką.', progress: atLeast('lemurs', 50), secret: true },
  { id: 'elity', name: 'Kierownictwo', description: 'Pokonaj 50 elitarnych wrogów.', progress: atLeast('elites', 50) },
  { id: 'ewolucja', name: 'Ewolucja gatunku', description: 'Zrób pierwszą ewolucję broni.', progress: atLeast('evolutions', 1) },
  { id: 'ewolucje', name: 'Darwin z Widzewa', description: 'Zrób 25 ewolucji broni (w sumie).', progress: atLeast('evolutions', 25) },
  { id: 'poziom', name: 'Awans społeczny', description: 'Dobij do 40. poziomu w jednym runie.', progress: atLeast('bestLevel', 40) },
  { id: 'skrzynki-mapa', name: 'Szabrownik', description: 'Otwórz 100 skrzynek na trasie.', progress: atLeast('chests', 100) },
  { id: 'kawa', name: 'Kofeina w żyłach', description: 'Wypij 50 kaw z automatów.', progress: atLeast('coffees', 50) },
  { id: 'kosze', name: 'Grzebanie w śmieciach', description: 'Rozwal 200 koszy.', progress: atLeast('bins', 200) },
  { id: 'kaucja', name: 'Kaucja zwrotna', description: 'Zbierz 5000 butelek (2500 zł kaucji).', progress: atLeast('bottlesEarned', 5000) },
  { id: 'skrzynka', name: 'Klucz pasuje', description: 'Otwórz pierwszą skrzynkę w recyklomacie.', progress: (_, s) => Math.min(1, s.casesOpened) },
  { id: 'hazard', name: 'Jeszcze jedna', description: 'Otwórz 100 skrzynek w recyklomacie.', progress: (_, s) => Math.min(1, s.casesOpened / 100) },
  { id: 'gwiazdka', name: '★ w końcu', description: 'Wylosuj nóż albo rękawice ★.', progress: atLeast('starsDropped', 1) },
  { id: 'kontrakt', name: 'Kontrakt podpisany', description: 'Zrób pierwszy kontrakt wymiany.', progress: (_, s) => Math.min(1, s.contracts) },
  { id: 'kurs', name: 'Codzienny dojazd', description: 'Zagraj codzienny kurs.', progress: atLeast('dailyRuns', 1) },
  { id: 'kurs-7', name: 'Bilet miesięczny', description: 'Zagraj codzienny kurs w 7 różnych dni.', progress: atLeast('dailyDays', 7) },
  { id: 'kurs-boss', name: 'Kurs ukończony', description: 'Pokonaj bossa w codziennym kursie.', progress: atLeast('dailyClears', 1) },
  { id: 'smierci', name: 'Pociąg nie przyjedzie', description: 'Padnij 25 razy. Bywa.', progress: (_, s) => Math.min(1, s.deaths / 25), secret: true },
  // The delay ladder: a rung counts once any station's boss falls on it.
  { id: 'drabinka-1', name: 'Pierwsze opóźnienie', description: 'Pokonaj bossa z opóźnieniem +15 min.', progress: (_, s) => Math.min(1, s.ladder.best) },
  { id: 'drabinka-4', name: 'Godzina w plecy', description: 'Pokonaj bossa z opóźnieniem +1 h.', progress: (_, s) => Math.min(1, s.ladder.best / 4) },
  { id: 'drabinka-8', name: 'Dwie godziny w plecy', description: 'Pokonaj bossa z opóźnieniem +2 h.', progress: (_, s) => Math.min(1, s.ladder.best / 8) },
  { id: 'drabinka-12', name: 'Trzy godziny w plecy', description: 'Pokonaj bossa z opóźnieniem +3 h.', progress: (_, s) => Math.min(1, s.ladder.best / 12) },
  { id: 'drabinka-16', name: 'Cztery godziny w plecy', description: 'Pokonaj bossa z opóźnieniem +4 h.', progress: (_, s) => Math.min(1, s.ladder.best / 16) },
  { id: 'odwolany', name: 'Pociąg ODWOŁANY', description: 'Pokonaj bossa z opóźnieniem +5 h, nocą i ze wszystkim naraz.', progress: (_, s) => Math.min(1, s.ladder.best / 20) },
  { id: 'ostatni-pociag', name: 'Zdążyli na ostatni', description: 'Pokonaj bossa na kursie „Opóźnienie” w ostatniej minucie przed Nocnymi Kanarami.', progress: atLeast('lastMinute', 1), secret: true },
];

export const achievement = (id: string): AchievementDef | undefined => ACHIEVEMENTS.find((a) => a.id === id);
