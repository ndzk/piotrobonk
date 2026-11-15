// Run progress persisted in localStorage: which stations are rebuilt, the bottle bank, the best time
// per station and the global "czas do domu". Every key is prefixed "piotrobonk:" (github.io is one origin).

import type { StatKey } from '../content/achievements';

export type Difficulty = 'spokojny' | 'normalnie' | 'opoznienie';

export interface StationProgress {
  /** Hardest difficulty this station has been cleared on, or null while it is still unfinished. */
  cleared: Difficulty | null;
  /** Fastest clear in seconds (0 = never cleared). */
  bestTime: number;
  /** Most kills in one run here. */
  bestKills: number;
}

/** A CS skin in the inventory. `uid` is unique per save; `seed` varies the pattern like CS's paint seed. */
export interface OwnedSkin {
  uid: number;
  /** Skin id from the snapshot. */
  skin: string;
  float: number;
  seed: number;
  stattrak: boolean;
  /** StatTrak™ kills, counted in runs. */
  kills: number;
}

/** What is put on: the gun skin of Gnat z CS, a ★ knife instead of the briefcase, ★ gloves, and wraps. */
export interface Equip {
  gun: number | null;
  knife: number | null;
  gloves: number | null;
  /** Game weapon id → uid of the skin whose pattern it wears ("Parasol (AWP | Asiimov)"). */
  wraps: Record<string, number>;
}

export interface Save {
  /** Bottles in the bank: brought home from runs, spent in the recyklomat. */
  bottles: number;
  /** Bottles brought back since the hub last showed the recyklomat swallowing them (an animation only). */
  deposit: number;
  inventory: OwnedSkin[];
  nextUid: number;
  equip: Equip;
  casesOpened: number;
  contracts: number;
  /** State of the case RNG: reloading the page cannot reroll an opening. */
  caseRng: number;
  /** A case or contract result not yet shown (the page was closed mid-roulette): revealed on the next visit. */
  pendingReveal: number | null;
  /** Skins not looked at in the inventory yet ("NOWE"). */
  unseen: number[];
  /** Cases on the house: one for every station rebuilt for the first time. */
  freeCases: number;
  /** The intro cutscene has been seen (it plays before the first trip). */
  introSeen: boolean;
  /** Stations whose video call from Bartek D. has been taken. */
  callsSeen: string[];
  /** Times the whole line has been finished (Bartek slapped). */
  finished: number;
  /** "Czas do domu" when the line was first finished, in seconds (0 = not yet). */
  homeTime: number;
  /** Things in the hub's display case ('filizanka': Bartek's cup). */
  trophies: string[];
  /** Lifetime counters (statistics, achievements). */
  stats: Partial<Record<StatKey, number>>;
  /** Achievement id → when it was earned (ms since 1970). */
  achievements: Record<string, number>;
  /** Met in play, for the compendium: enemy ids killed, bosses fought, evolutions made. */
  seen: { enemies: string[]; bosses: string[]; evolutions: string[] };
  /** Every skin id that has ever been in the inventory: the compendium's collection. */
  collected: string[];
  /** Codzienny kurs: the best result of each day (the last 30 days kept), as a share code. */
  daily: Record<string, { score: number; code: string }>;
  /** Seconds spent in runs, all of them: the "Czas do domu" counter. */
  totalTime: number;
  /** Runs started, runs survived. */
  runs: number;
  deaths: number;
  difficulty: Difficulty;
  /** Keyed by station id. A station is unlocked when the one before it is cleared. */
  stations: Record<string, StationProgress>;
}

const KEY = 'piotrobonk:save';
/**
 * 1: stations and the bank (stage 3). 2: skins, equipment and the recyklomat (stage 4). 3: the story
 * (stage 5). 4: statistics, achievements, the compendium and the daily run (stage 6).
 */
export const SAVE_VERSION = 4;
const DIFFICULTIES: Difficulty[] = ['spokojny', 'normalnie', 'opoznienie'];

export const emptyStation = (): StationProgress => ({ cleared: null, bestTime: 0, bestKills: 0 });

export const newEquip = (): Equip => ({ gun: null, knife: null, gloves: null, wraps: {} });

export const newSave = (): Save => ({
  bottles: 0,
  deposit: 0,
  inventory: [],
  nextUid: 1,
  equip: newEquip(),
  casesOpened: 0,
  contracts: 0,
  caseRng: Math.floor(Math.random() * 2 ** 32),
  pendingReveal: null,
  unseen: [],
  freeCases: 0,
  introSeen: false,
  callsSeen: [],
  finished: 0,
  homeTime: 0,
  trophies: [],
  stats: {},
  achievements: {},
  seen: { enemies: [], bosses: [], evolutions: [] },
  collected: [],
  daily: {},
  totalTime: 0,
  runs: 0,
  deaths: 0,
  difficulty: 'normalnie',
  stations: {},
});

const num = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v: unknown, lo: number, hi: number, d = 0): number => Math.round(num(v, lo, hi, d));
const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set((v as unknown[]).filter((x): x is string => typeof x === 'string'))] : []);
const record = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** The enemies of the first stations: a player from before the compendium has met them already. */
const EARLY_ENEMIES = ['golab', 'szczur', 'robotnik', 'zlomiarz', 'autobus'];
const BOSS_OF: Record<string, string> = {
  fabryczna: 'biletomat',
  niciarniana: 'pajeczyca',
  widzew: 'kanar',
  andrzejow: 'krol-zlomu',
  bedon: 'zka',
  justynow: 'golab-matka',
  galkowek: 'kierownik',
  zakowice: 'megafon',
  koluszki: 'bartek',
};

/**
 * Counters: finite, non-negative numbers only. A save from before them (version < 4) starts from what its
 * progress proves: a slap for every finish, a boss for every cleared station.
 */
function readStats(v: unknown, version: number | undefined, stations: Record<string, StationProgress>, finished: number): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const [k, n] of Object.entries(record(v))) if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k as StatKey] = Math.min(n, 1e12);
  if (version !== undefined && version < 4) {
    const cleared = Object.entries(stations).filter(([id, p]) => p.cleared && BOSS_OF[id]).length;
    out.bossKills = Math.max(out.bossKills ?? 0, cleared);
    out.slaps = Math.max(out.slaps ?? 0, finished);
  }
  return out;
}

/** The daily results, newest 30 days only, each a score and its share code. */
function readDaily(v: unknown): Record<string, { score: number; code: string }> {
  const days = Object.entries(record(v))
    .filter(([day, r]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && typeof record(r).score === 'number' && typeof record(r).code === 'string')
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 30);
  return Object.fromEntries(days.map(([day, r]) => [day, { score: num(record(r).score, 0, 1e9), code: String(record(r).code).slice(0, 400) }]));
}

function readSkin(v: unknown): OwnedSkin | null {
  if (typeof v !== 'object' || v === null) return null;
  const s = v as Partial<OwnedSkin>;
  if (typeof s.skin !== 'string' || typeof s.uid !== 'number' || !Number.isInteger(s.uid) || s.uid < 1) return null;
  return { uid: s.uid, skin: s.skin, float: num(s.float, 0, 1, 0.5), seed: int(s.seed, 0, 999), stattrak: s.stattrak === true, kills: int(s.kills, 0, 1e9) };
}

function readEquip(v: unknown, owned: Set<number>): Equip {
  const e = (typeof v === 'object' && v !== null ? v : {}) as { gun?: unknown; knife?: unknown; gloves?: unknown; wraps?: unknown };
  const slot = (u: unknown): number | null => (typeof u === 'number' && owned.has(u) ? u : null);
  const wraps: Record<string, number> = {};
  if (typeof e.wraps === 'object' && e.wraps !== null) {
    for (const [weapon, u] of Object.entries(e.wraps)) {
      const uid = slot(u);
      if (uid !== null) wraps[weapon] = uid;
    }
  }
  return { gun: slot(e.gun), knife: slot(e.knife), gloves: slot(e.gloves), wraps };
}

function readStation(v: unknown): StationProgress {
  if (typeof v !== 'object' || v === null) return emptyStation();
  const s = v as Partial<StationProgress>;
  return {
    cleared: typeof s.cleared === 'string' && DIFFICULTIES.includes(s.cleared) ? s.cleared : null,
    bestTime: num(s.bestTime, 0, 1e6),
    bestKills: num(s.bestKills, 0, 1e7),
  };
}

/** Loads the save, repairing anything missing or malformed (and when storage is blocked). */
export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const data = JSON.parse(raw) as { rev?: unknown };
    lastRev = typeof data.rev === 'number' ? data.rev : 0;
    return readSave(data);
  } catch {
    return newSave();
  }
}

/** Revision of the save this tab last read or wrote. A higher one in storage means another tab moved on. */
let lastRev = 0;

/**
 * Reads any saved version, repairing what is missing or malformed. Version 1 had no inventory: it gets an
 * empty one and keeps everything else. A save from a newer build (an older tab left open) starts over
 * rather than being half-read.
 */
export function readSave(data: unknown): Save {
  try {
    const d = (typeof data === 'object' && data !== null ? data : {}) as { version?: number; save?: Partial<Save> };
    if (typeof d.version === 'number' && d.version > SAVE_VERSION) return newSave();
    const s = d.save ?? {};
    const stations: Record<string, StationProgress> = {};
    if (s.stations) {
      for (const [id, v] of Object.entries(s.stations)) stations[id] = readStation(v);
    }
    const inventory: OwnedSkin[] = [];
    const seen = new Set<number>();
    for (const v of Array.isArray(s.inventory) ? (s.inventory as unknown[]) : []) {
      const skin = readSkin(v);
      if (skin && !seen.has(skin.uid)) {
        seen.add(skin.uid);
        inventory.push(skin);
      }
    }
    const fresh = newSave();
    return {
      deposit: int(s.deposit, 0, 1e9),
      inventory,
      // Never hand out a uid that is already taken, whatever the stored counter says.
      nextUid: Math.max(int(s.nextUid, 1, 2 ** 31, 1), ...inventory.map((x) => x.uid + 1)),
      equip: readEquip(s.equip, seen),
      casesOpened: int(s.casesOpened, 0, 1e9),
      contracts: int(s.contracts, 0, 1e9),
      caseRng: typeof s.caseRng === 'number' && Number.isFinite(s.caseRng) ? s.caseRng >>> 0 : fresh.caseRng,
      pendingReveal: typeof s.pendingReveal === 'number' && seen.has(s.pendingReveal) ? s.pendingReveal : null,
      freeCases: int(s.freeCases, 0, 1000),
      // A player from before the story existed already knows why they walk: no intro forced on them.
      introSeen: s.introSeen === true || (d.version !== undefined && d.version < 3 && num(s.runs, 0, 1e6) > 0),
      callsSeen: strings(s.callsSeen),
      finished: int(s.finished, 0, 1e6),
      homeTime: num(s.homeTime, 0, 1e9),
      trophies: strings(s.trophies),
      stats: readStats(s.stats, d.version, stations, int(s.finished, 0, 1e6)),
      achievements: Object.fromEntries(Object.entries(record(s.achievements)).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]))),
      seen: readSeen(s.seen, d.version, stations, num(s.runs, 0, 1e6)),
      // The collection keeps everything ever owned; what is owned now is in it by definition.
      collected: [...new Set([...strings(s.collected), ...inventory.map((x) => x.skin)])],
      daily: readDaily(s.daily),
      unseen: Array.isArray(s.unseen) ? (s.unseen as unknown[]).filter((u): u is number => typeof u === 'number' && seen.has(u)) : [],
      bottles: num(s.bottles, 0, 1e9),
      totalTime: num(s.totalTime, 0, 1e9),
      runs: num(s.runs, 0, 1e6),
      deaths: num(s.deaths, 0, 1e6),
      difficulty: typeof s.difficulty === 'string' && DIFFICULTIES.includes(s.difficulty) ? s.difficulty : 'normalnie',
      stations,
    };
  } catch {
    return newSave();
  }
}

/**
 * What the compendium has unlocked. Saves from before it (version < 4) get what their progress implies:
 * the early enemies once a run was played, and the boss of every station already cleared.
 */
function readSeen(v: unknown, version: number | undefined, stations: Record<string, StationProgress>, runs: number): Save['seen'] {
  const r = record(v);
  const seen = { enemies: strings(r.enemies), bosses: strings(r.bosses), evolutions: strings(r.evolutions) };
  if (version !== undefined && version < 4) {
    if (runs > 0) seen.enemies.push(...EARLY_ENEMIES);
    const cleared = Object.entries(stations).filter(([, p]) => p.cleared);
    for (const [id] of cleared) if (BOSS_OF[id]) seen.bosses.push(BOSS_OF[id]);
    // Kanarzy come into every arena after a few minutes, long before any boss falls; lemurs only to Bartek.
    if (cleared.length > 0) seen.enemies.push('kontroler');
    if ('koluszki' in stations && stations.koluszki.cleared) seen.enemies.push('lemur');
    seen.enemies = [...new Set(seen.enemies)];
    seen.bosses = [...new Set(seen.bosses)];
  }
  return seen;
}

/** Adds to a lifetime counter. */
export function bump(save: Save, key: StatKey, by = 1): void {
  save.stats[key] = (save.stats[key] ?? 0) + by;
}

/** Marks something as met for the compendium (once). */
export function see(list: string[], id: string): void {
  if (!list.includes(id)) list.push(id);
}

export type SaveResult = 'ok' | 'stale' | 'newer' | 'blocked';

/**
 * Writes the save, unless that would destroy newer progress: when another tab (or a newer build) has
 * written since this tab last read, nothing is written and the caller hears why.
 */
export function saveSave(s: Save): SaveResult {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Only the version and the revision matter here, and this runs on every save (mid-run achievements
      // too): read them off the front of the string instead of parsing a save with hundreds of skins.
      const head = /^\{"version":(\d+),"rev":(\d+)/.exec(raw.slice(0, 64));
      const stored = head ? { version: Number(head[1]), rev: Number(head[2]) } : (JSON.parse(raw) as { version?: unknown; rev?: unknown });
      if (typeof stored.version === 'number' && stored.version > SAVE_VERSION) return 'newer';
      if (typeof stored.rev === 'number' && stored.rev > lastRev) return 'stale';
    }
    lastRev++;
    localStorage.setItem(KEY, JSON.stringify({ version: SAVE_VERSION, rev: lastRev, save: s }));
    return 'ok';
  } catch {
    // Private mode or storage disabled: progress just does not persist.
    return 'blocked';
  }
}

/** True when `key` is the save (for the storage event another tab fires). */
export const isSaveKey = (key: string | null): boolean => key === KEY;

export function progressOf(save: Save, id: string): StationProgress {
  return save.stations[id] ?? emptyStation();
}

/** A station is open when it is the first one, or the station before it has been cleared. */
export function unlocked(save: Save, order: string[], id: string): boolean {
  const i = order.indexOf(id);
  if (i <= 0) return i === 0;
  return progressOf(save, order[i - 1]).cleared !== null;
}

/** The furthest station the player may travel to. */
export function furthest(save: Save, order: string[]): string {
  let last = order[0];
  for (const id of order) {
    if (!unlocked(save, order, id)) break;
    last = id;
  }
  return last;
}

/** Records a cleared station (keeps the best time and the hardest difficulty). */
export function recordClear(save: Save, id: string, difficulty: Difficulty, time: number, kills: number): void {
  const p = progressOf(save, id);
  const rank = (d: Difficulty | null): number => (d === null ? -1 : DIFFICULTIES.indexOf(d));
  save.stations[id] = {
    cleared: rank(difficulty) > rank(p.cleared) ? difficulty : p.cleared,
    bestTime: p.bestTime === 0 ? time : Math.min(p.bestTime, time),
    bestKills: Math.max(p.bestKills, kills),
  };
}
