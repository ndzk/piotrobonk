// "Codzienny kurs": one seed and one station a day, the same for everyone, and a result that travels as a
// link (?wynik=…) and opens as a card. The link carries the raw numbers; the score is always recomputed from
// them, so editing it by hand gets you nothing a checksum would not already have refused.

import { LADDER, type ModifierId } from '../content/difficulty';
import { hashSeed, Rng } from './rng';

export interface DailyPlan {
  /** The day in Poland, YYYY-MM-DD. */
  day: string;
  seed: number;
  station: string;
  /** The day's one ladder modifier on top of Normalnie (never the last rung's night). */
  modifier: ModifierId;
}

export interface DailyResult {
  day: string;
  station: string;
  kills: number;
  level: number;
  /** Seconds survived (or until the boss went down). */
  time: number;
  cleared: boolean;
  /** Weapon ids, in slot order. */
  weapons: string[];
  /** The player's highest rung of the delay ladder beaten (0: none), shown on the card. */
  rung: number;
  /** A run from before the day had a modifier (a version 1 link): the card shows none. */
  plain?: boolean;
}

/** The day as it is in Łódź: the run changes at Polish midnight wherever the player is. */
export function dayOf(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Today's run. `stations` is the line in order; the finale is not a daily stop. */
export function dailyPlan(day: string, stations: readonly string[]): DailyPlan {
  const seed = hashSeed(`piotrobonk:kurs:${day}`);
  const pool = stations.slice(0, -1);
  const rng = new Rng(seed);
  const station = pool[rng.int(0, pool.length)];
  // Its own stream: the station picked by every earlier version stays the same for the same day.
  const mods = LADDER.filter((m) => m.id !== 'odwolany');
  const modifier = mods[new Rng(hashSeed(`piotrobonk:kurs:${day}:utrudnienie`)).int(0, mods.length)].id;
  return { day, seed, station, modifier };
}

/** Points: every kill, a level is worth a small crowd, and the boss is worth most of all. */
export function dailyScore(r: Pick<DailyResult, 'kills' | 'level' | 'cleared'>): number {
  return r.kills + r.level * 25 + (r.cleared ? 1500 : 0);
}

/** 2 added the sharer's highest rung of the delay ladder; links of version 1 still open (with none). */
const VERSION = 2;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const toBase64Url = (text: string): string => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (code: string): string => atob(code.replace(/-/g, '+').replace(/_/g, '/'));

/** The result as a short, URL-safe code: `<base64url>.<checksum>`. Ids are plain ASCII. */
export function encodeResult(r: DailyResult): string {
  const body = toBase64Url(JSON.stringify([VERSION, r.day, r.station, r.kills, r.level, Math.round(r.time), r.cleared ? 1 : 0, r.weapons.join('.'), r.rung]));
  return `${body}.${hashSeed(body).toString(36)}`;
}

/** Reads a code back, or null for anything broken, edited, from a newer version or naming unknown things. */
export function decodeResult(code: string, stations: readonly string[], weapons: readonly string[]): DailyResult | null {
  const parts = code.split('.');
  if (parts.length !== 2) return null;
  const [body, check] = parts;
  if (!body || hashSeed(body).toString(36) !== check) return null;
  try {
    const data = JSON.parse(fromBase64Url(body)) as unknown;
    if (!Array.isArray(data) || !((data[0] === 1 && data.length === 8) || (data[0] === VERSION && data.length === 9))) return null;
    const [, day, station, kills, level, time, cleared, list, rungRaw = 0] = data as unknown[];
    const count = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
    if (typeof day !== 'string' || !DAY.test(day) || typeof station !== 'string' || !stations.includes(station)) return null;
    // The checksum is public, so a hand-made link could name any station: it must be that day's.
    if (dailyPlan(day, stations).station !== station) return null;
    if (!count(kills, 1e6) || !count(level, 999) || !count(time, 86_400) || (cleared !== 0 && cleared !== 1) || typeof list !== 'string' || !count(rungRaw, LADDER.length)) return null;
    const ids = list === '' ? [] : list.split('.');
    if (ids.length > 12 || ids.some((w) => !weapons.includes(w))) return null;
    return { day, station, kills, level, time, cleared: cleared === 1, weapons: ids, rung: rungRaw, ...(data[0] === 1 ? { plain: true } : {}) };
  } catch {
    return null;
  }
}
