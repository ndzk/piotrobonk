// Replays and the simulation's state. A replay is a run's starting point plus the input of every frame as the
// game read it; played again in the headless simulation it must give the same state, checked by a hash every
// `every` steps against the one the browser had. The same walk over the state takes snapshots and puts them
// back, which is how the planning bots look ahead.

import { frameClock } from '../core/clock';
import type { Difficulty } from '../core/save';
import type { ModifierId } from '../content/difficulty';
import type { Game } from './game';
import type { Gear, GearItem } from './gear';
import type { Input } from './input';

/**
 * Fields of `Game` that are not the simulation: drawing, sound, screens, the page, the save, frame timing and
 * the replay hooks themselves. Everything else reachable from the game is state.
 */
const NOT_STATE = new Set([
  'renderer', 'ui', 'opts', 'input', 'playerInput', 'demoInput', 'scene', 'cam', 'fx', 'bossUi', 'threats', 'clearedScreen', 'train', 'chestScreen',
  'particles', 'numbers', 'shadows', 'swooshes', 'hud', 'levelUp', 'pauseScreen', 'summary', 'debug', 'demoSave', 'target', 'gearMats', 'portraits',
  'finaleUi', 'dialogue', 'call', 'credits', 'bartek', 'bartekRig', 'drops', 'shards', 'puddle', 'markers', 'markerV', 'camHead', 'flyingCup', 'cupVel',
  'slapAt', 'camFocus', 'cupAt', 'camLook', 'save', 'fps', 'simMs', 'renderMs', 'onInput', 'onStep', 'onOutside', 'onRunStart', 'inFrame',
  // What the bots read, filled in by a getter right before each read; what only drawing writes.
  'laneView', 'chargeView', 'hudState', 'eliteBeacon', 'threatList', 'threatScore', 'threatNights', 'windUpLeft', 'trainShot',
]);

/** Things the walk never goes into: functions, three.js objects, the DOM and audio, weak collections. */
function opaque(v: object): boolean {
  if (typeof v === 'function') return true;
  const o = v as Record<string, unknown>;
  if (o.cosmetic === true) return true;
  if (o.isObject3D || o.isMaterial || o.isBufferGeometry || o.isTexture || o.isBufferAttribute || o.isInterleavedBuffer || o.isRenderTarget || o.isColor) return true;
  if (typeof EventTarget === 'function' && v instanceof EventTarget) return true;
  return v instanceof WeakMap || v instanceof WeakSet || v instanceof Promise;
}

/**
 * An object's own fields that are state: all of them but the ones it lists in `notState` (buffers rewritten
 * before every read, what only drawing writes).
 */
function keysOf(rec: Record<string, unknown>): string[] {
  const keys = Object.keys(rec);
  const not = rec.notState;
  return Array.isArray(not) ? keys.filter((k) => k !== 'notState' && !(not as unknown[]).includes(k)) : keys;
}

/** The game's own fields that are simulation state, in a fixed order. */
export function stateFields(game: Game): string[] {
  return Object.keys(game).filter((k) => !NOT_STATE.has(k));
}

// ---------- Hashing ----------

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

/** FNV-1a over the state's values, structure included (lengths, keys, which object is shared where). */
class Hasher {
  h = 0x811c9dc5;
  private seen = new Map<object, number>();

  int(x: number): void {
    this.h = Math.imul(this.h ^ (x | 0), 16777619);
  }

  num(x: number): void {
    f64[0] = Number.isNaN(x) ? NaN : x;
    this.int(u32[0]);
    this.int(u32[1]);
  }

  str(s: string): void {
    this.int(s.length);
    for (let k = 0; k < s.length; k++) this.int(s.charCodeAt(k));
  }

  value(v: unknown): void {
    switch (typeof v) {
      case 'number':
        this.int(1);
        this.num(v);
        return;
      case 'string':
        this.int(2);
        this.str(v);
        return;
      case 'boolean':
        this.int(v ? 3 : 4);
        return;
      case 'undefined':
        this.int(5);
        return;
      case 'bigint':
      case 'symbol':
        this.int(6);
        return;
      default:
        break;
    }
    if (v === null) {
      this.int(7);
      return;
    }
    const o = v as object;
    const id = this.seen.get(o);
    if (id !== undefined) {
      this.int(8);
      this.int(id);
      return;
    }
    this.seen.set(o, this.seen.size);
    if (opaque(o)) {
      this.int(9);
      return;
    }
    if (ArrayBuffer.isView(o)) {
      const a = o as unknown as ArrayLike<number>;
      this.int(10);
      this.int(a.length);
      for (let k = 0; k < a.length; k++) this.num(a[k]);
      return;
    }
    if (Array.isArray(o)) {
      this.int(11);
      this.int(o.length);
      for (const x of o) this.value(x);
      return;
    }
    if (o instanceof Map) {
      this.int(12);
      this.int(o.size);
      for (const [k, x] of o) {
        this.value(k);
        this.value(x);
      }
      return;
    }
    if (o instanceof Set) {
      this.int(13);
      this.int(o.size);
      for (const x of o) this.value(x);
      return;
    }
    this.int(14);
    const rec = o as Record<string, unknown>;
    for (const k of keysOf(rec)) {
      this.str(k);
      this.value(rec[k]);
    }
  }
}

/** One hash per state field of the game (named by `stateFields`), then the camera's aim and the frame clock. */
export function stateHashes(game: Game, fields = stateFields(game)): number[] {
  const g = game as unknown as Record<string, unknown>;
  const out: number[] = [];
  for (const f of fields) {
    const h = new Hasher();
    h.value(g[f]);
    out.push(h.h >>> 0);
  }
  const h = new Hasher();
  h.num(game.cam.yaw);
  h.num(game.cam.pitch);
  h.num(frameClock.now);
  for (const d of frameClock.due) h.num(d.at - frameClock.now);
  out.push(h.h >>> 0);
  return out;
}

/** All of the state in one number. */
export function stateHash(game: Game): number {
  const h = new Hasher();
  for (const x of stateHashes(game)) h.int(x);
  return h.h >>> 0;
}

/** Every value under one state field, by path (for finding what differs when two hashes do). */
export function stateDump(game: Game, field: string): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new Map<object, string>();
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'function') {
      out.set(path, '(function)');
      return;
    }
    if (typeof v !== 'object' || v === null) {
      out.set(path, typeof v === 'string' ? JSON.stringify(v) : String(v));
      return;
    }
    const at = seen.get(v);
    if (at !== undefined) {
      out.set(path, `→ ${at}`);
      return;
    }
    seen.set(v, path);
    if (opaque(v)) return;
    if (ArrayBuffer.isView(v)) {
      const a = v as unknown as ArrayLike<number>;
      for (let k = 0; k < a.length; k++) out.set(`${path}[${String(k)}]`, String(a[k]));
      return;
    }
    if (Array.isArray(v)) {
      (v as unknown[]).forEach((x, k) => {
        walk(x, `${path}[${String(k)}]`);
      });
      return;
    }
    if (v instanceof Map || v instanceof Set) {
      let k = 0;
      for (const x of v instanceof Map ? (v as Map<unknown, unknown>).values() : (v as Set<unknown>).values()) walk(x, `${path}{${String(k++)}}`);
      return;
    }
    const rec = v as Record<string, unknown>;
    for (const k of keysOf(rec)) walk(rec[k], `${path}.${k}`);
  };
  walk((game as unknown as Record<string, unknown>)[field], field);
  return out;
}

// ---------- Recording ----------

/** Numbers per recorded frame: dt, move x/y, held, latched, look x/y, pad look x/y, camera yaw/pitch. */
export const FRAME = 11;

export interface Replay {
  v: 1;
  /** The build that recorded it: `version sha`. */
  build: string;
  seed: number;
  station: string;
  difficulty: Difficulty;
  rung: number;
  daily: string | null;
  extra: ModifierId | null;
  gear: { gun: GearItem | null; knife: GearItem | null; gloves: GearItem | null; wraps: [string, GearItem][] };
  /** The camera settings (mouse look turns by them): sensitivity, inverted y. */
  look: [number, boolean];
  /** When the boss comes, as it was at the first frame (a dev flag can bring it early). */
  bossAt: number;
  /** Steps between state checks. */
  every: number;
  frames: number[];
  /** Frames before which the game was paused from outside (the tab hid, the pointer lock was lost). */
  outside: number[];
  /** Names of the per-field hashes, then "camera". */
  fields: string[];
  /** Per check: the step, then one hash per field. */
  checks: number[];
  /** Every value of the state at one step, by path (finding what differs, when asked for). */
  dump?: { step: number; values: Record<string, string> };
}

/** Every value of every state field, by path. */
export function fullDump(game: Game): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of stateFields(game)) for (const [p, v] of stateDump(game, f)) out[p] = v;
  out['camera.yaw'] = String(game.cam.yaw);
  out['camera.pitch'] = String(game.cam.pitch);
  return out;
}

/** Records the next run the game starts (and every frame and check of it) until `stop`. */
export class Recorder {
  replay: Replay | null = null;

  constructor(
    private readonly game: Game,
    private readonly build: string,
    private readonly every = 60,
    /** Also dump every value at this step (−1: never). */
    private readonly dumpStep = -1,
  ) {
    game.onRunStart = () => {
      this.begin();
    };
  }

  /** A run started: recording starts over with it. */
  private begin(): void {
    const g = this.game;
    const gear: Gear = g.gear;
    const fields = stateFields(g);
    this.replay = {
      v: 1,
      build: this.build,
      seed: g.seed,
      station: g.stationDef.id,
      difficulty: g.difficulty,
      rung: g.rung,
      daily: g.daily,
      extra: g.extra,
      gear: { gun: gear.gun, knife: gear.knife, gloves: gear.gloves, wraps: [...gear.wraps] },
      look: [g.cam.sensitivity, g.cam.invertY],
      bossAt: 0,
      every: this.every,
      frames: [],
      outside: [],
      fields: [...fields, 'camera'],
      checks: [],
    };
    const r = this.replay;
    const i = (g as unknown as { input: Input }).input;
    g.onInput = (dt) => {
      if (r.frames.length === 0) r.bossAt = (g as unknown as { bossAt: number }).bossAt;
      r.frames.push(dt, i.moveX, i.moveY, i.bits(0), i.bits(1), i.lookX, i.lookY, i.padLookX, i.padLookY, g.cam.yaw, g.cam.pitch);
    };
    g.onStep = () => {
      if (g.steps % this.every === 0) r.checks.push(g.steps, ...stateHashes(g, fields));
      if (g.steps === this.dumpStep) r.dump = { step: g.steps, values: fullDump(g) };
    };
    g.onOutside = () => {
      r.outside.push(r.frames.length / FRAME);
    };
  }

  stop(): Replay | null {
    this.game.onInput = this.game.onStep = this.game.onOutside = this.game.onRunStart = null;
    return this.replay;
  }
}

/** Where a played-back replay first disagreed with the recording (null: it never did). */
export interface Mismatch {
  step: number;
  fields: string[];
}

/** Paths whose values differ between the recording's dump and this game's state (at most `max`). */
function dumpDiff(rec: Record<string, string>, now: Record<string, string>, max = 40): string[] {
  const out: string[] = [];
  for (const p of new Set([...Object.keys(rec), ...Object.keys(now)])) {
    if (rec[p] === now[p]) continue;
    out.push(`${p}: ${rec[p] ?? '(none)'} / ${now[p] ?? '(none)'}`);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Plays a replay on a game that is ready to start (the input must be one that only a bot drives). `tick` runs
 * before every frame with its dt (the headless simulation moves its clock there). Gives the first check
 * whose state differs, or null when every check matched; `checked` counts the checks compared.
 */
export function playBack(game: Game, rep: Replay, tick: (dt: number) => void): { mismatch: Mismatch | null; checked: number; steps: number; diff: string[] } {
  game.gear = { gun: rep.gear.gun, knife: rep.gear.knife, gloves: rep.gear.gloves, wraps: new Map(rep.gear.wraps) };
  [game.cam.sensitivity, game.cam.invertY] = rep.look;
  const input = (game as unknown as { input: Input }).input;
  let f = 0;
  input.override = (inp) => {
    const a = rep.frames;
    const o = f * FRAME;
    inp.replayFrame(a[o + 1], a[o + 2], a[o + 3], a[o + 4], a[o + 5], a[o + 6], a[o + 7], a[o + 8]);
    game.cam.yaw = a[o + 9];
    game.cam.pitch = a[o + 10];
  };
  game.start(rep.seed, rep.station, rep.difficulty, rep.daily, rep.rung, rep.extra);
  (game as unknown as { bossAt: number }).bossAt = rep.bossAt;
  const fields = rep.fields.slice(0, -1);
  const per = rep.fields.length + 1;
  let check = 0;
  let checked = 0;
  // In an object: the step hook sets them, and the loop below reads them.
  const st: { mismatch: Mismatch | null; diff: string[] } = { mismatch: null, diff: [] };
  game.onStep = () => {
    if (rep.dump && game.steps === rep.dump.step) st.diff = dumpDiff(rep.dump.values, fullDump(game));
    if (st.mismatch || game.steps % rep.every !== 0) return;
    const o = check * per;
    if (o >= rep.checks.length) return;
    check++;
    if (rep.checks[o] !== game.steps) {
      st.mismatch = { step: game.steps, fields: ['(step)'] };
      return;
    }
    const now = stateHashes(game, fields);
    const bad = rep.fields.filter((_, k) => now[k] !== rep.checks[o + 1 + k]);
    checked++;
    if (bad.length) st.mismatch = { step: game.steps, fields: bad };
  };
  const outside = new Set(rep.outside);
  const n = rep.frames.length / FRAME;
  // On to the dump's step even past a mismatch (it says what differs there).
  for (f = 0; f < n && (!st.mismatch || (rep.dump && game.steps < rep.dump.step)); f++) {
    if (outside.has(f)) game.pause();
    const dt = rep.frames[f * FRAME];
    tick(dt);
    game.frame(dt);
  }
  game.onStep = null;
  input.override = null;
  if (!st.mismatch && check * per < rep.checks.length) st.mismatch = { step: game.steps, fields: ['(ended early)'] };
  return { mismatch: st.mismatch, checked, steps: game.steps, diff: st.diff };
}

// ---------- Snapshots ----------

/** One object's contents at the moment of a snapshot. */
type Saved = { o: object; kind: 0; props: [string, unknown][] } | { o: unknown[]; kind: 1; items: unknown[] } | { o: { set(a: ArrayLike<number>): void }; kind: 2; copy: ArrayLike<number> & { slice(): unknown } } | { o: Map<unknown, unknown>; kind: 3; entries: [unknown, unknown][] } | { o: Set<unknown>; kind: 4; items: unknown[] };

export interface Snapshot {
  saved: Saved[];
  yaw: number;
  pitch: number;
}

/**
 * Everything the simulation can change, copied one object at a time (identity kept: restoring writes the
 * old contents back into the same objects, so every reference in the game stays valid).
 */
export function snapshot(game: Game, fields = stateFields(game)): Snapshot {
  const seen = new Set<object>();
  const saved: Saved[] = [];
  const visit = (v: unknown): void => {
    if (typeof v !== 'object' || v === null || seen.has(v)) return;
    seen.add(v);
    if (opaque(v)) return;
    if (ArrayBuffer.isView(v)) {
      const t = v as unknown as { set(a: ArrayLike<number>): void; slice(): ArrayLike<number> & { slice(): unknown } };
      saved.push({ o: t, kind: 2, copy: t.slice() });
      return;
    }
    if (Array.isArray(v)) {
      const items = [...(v as unknown[])];
      saved.push({ o: v as unknown[], kind: 1, items });
      for (const x of items) visit(x);
      return;
    }
    if (v instanceof Map) {
      const entries = [...(v as Map<unknown, unknown>)];
      saved.push({ o: v as Map<unknown, unknown>, kind: 3, entries });
      for (const [k, x] of entries) {
        visit(k);
        visit(x);
      }
      return;
    }
    if (v instanceof Set) {
      const items = [...(v as Set<unknown>)];
      saved.push({ o: v as Set<unknown>, kind: 4, items });
      for (const x of items) visit(x);
      return;
    }
    const rec = v as Record<string, unknown>;
    const props = keysOf(rec).map((k): [string, unknown] => [k, rec[k]]);
    saved.push({ o: v, kind: 0, props });
    for (const [, x] of props) visit(x);
  };
  const g = game as unknown as Record<string, unknown>;
  // The game's own fields first (only the state ones), then everything they reach.
  const own: [string, unknown][] = fields.map((f) => [f, g[f]]);
  saved.push({ o: game, kind: 0, props: own });
  seen.add(game);
  for (const [, x] of own) visit(x);
  visit(frameClock);
  return { saved, yaw: game.cam.yaw, pitch: game.cam.pitch };
}

/** Puts a snapshot back (it can be restored any number of times). */
export function restore(game: Game, snap: Snapshot): void {
  for (const s of snap.saved) {
    switch (s.kind) {
      case 0: {
        const rec = s.o as Record<string, unknown>;
        // Properties added since go (the game's own object keeps its non-state fields).
        if (s.o !== game) {
          const keep = new Set(s.props.map(([k]) => k));
          for (const k of keysOf(rec)) if (!keep.has(k)) Reflect.deleteProperty(rec, k);
        }
        for (const [k, x] of s.props) rec[k] = x;
        break;
      }
      case 1:
        s.o.length = 0;
        for (const x of s.items) s.o.push(x);
        break;
      case 2:
        s.o.set(s.copy);
        break;
      case 3:
        s.o.clear();
        for (const [k, x] of s.entries) s.o.set(k, x);
        break;
      case 4:
        s.o.clear();
        for (const x of s.items) s.o.add(x);
        break;
    }
  }
  game.cam.yaw = snap.yaw;
  game.cam.pitch = snap.pitch;
}

