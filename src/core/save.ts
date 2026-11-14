// Run progress persisted in localStorage: which stations are rebuilt, the bottle bank, the best time
// per station and the global "czas do domu". Every key is prefixed "piotrobonk:" (github.io is one origin).

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
/** 1: stations and the bank (stage 3). 2: skins, equipment and the recyklomat (stage 4). */
export const SAVE_VERSION = 2;
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
  totalTime: 0,
  runs: 0,
  deaths: 0,
  difficulty: 'normalnie',
  stations: {},
});

const num = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v: unknown, lo: number, hi: number, d = 0): number => Math.round(num(v, lo, hi, d));

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
    return readSave(JSON.parse(raw));
  } catch {
    return newSave();
  }
}

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

export function saveSave(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: SAVE_VERSION, save: s }));
  } catch {
    // Private mode or storage disabled: progress just does not persist.
  }
}

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
