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

export interface Save {
  /** Bottles banked across runs (the hub currency of stage 4). */
  bottles: number;
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
const VERSION = 1;
const DIFFICULTIES: Difficulty[] = ['spokojny', 'normalnie', 'opoznienie'];

export const emptyStation = (): StationProgress => ({ cleared: null, bestTime: 0, bestKills: 0 });

export const newSave = (): Save => ({ bottles: 0, totalTime: 0, runs: 0, deaths: 0, difficulty: 'normalnie', stations: {} });

const num = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

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
    const data = JSON.parse(raw) as { version?: number; save?: Partial<Save> };
    const s = data.save ?? {};
    const stations: Record<string, StationProgress> = {};
    if (s.stations) {
      for (const [id, v] of Object.entries(s.stations)) stations[id] = readStation(v);
    }
    return {
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
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, save: s }));
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
