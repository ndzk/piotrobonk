// Helpers shared by the station arenas: scatter rings, rows of props, simple clusters.

import type { Prop, V3 } from './types';

/** Tiny deterministic generator, so an arena looks the same in every run and in every build. */
export function seeded(seed: number): () => number {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Trees or bushes scattered on a ring, skipping rectangles that must stay clear. */
export function scatter(radius: number, count: number, kind: 'tree' | 'bush', seed: number, skip: [number, number, number, number][] = []): Prop[] {
  const rnd = seeded(seed);
  const out: Prop[] = [];
  for (let i = 0; i < count; i++) {
    const a = ((i + rnd() * 0.8) / count) * Math.PI * 2;
    const r = radius + (rnd() - 0.5) * 5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (skip.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) continue;
    out.push(kind === 'tree' ? { kind: 'tree', at: [x, 0, z], h: 5 + rnd() * 3 } : { kind: 'bush', at: [x, 0, z], r: 0.8 + rnd() * 0.8 });
  }
  return out;
}

/** A row of lamps along x (or along z when `axis` is 'z'). */
export function lamps(from: number, to: number, at: number, step: number, axis: 'x' | 'z' = 'x'): Prop[] {
  const out: Prop[] = [];
  for (let v = from; v <= to; v += step) out.push({ kind: 'lamp', at: axis === 'x' ? [v, 0, at] : [at, 0, v] });
  return out;
}

/** Evenly spaced props along a line, built by a callback. */
export function row<T extends Prop>(from: V3, to: V3, count: number, make: (at: V3, i: number) => T): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    out.push(make([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t], i));
  }
  return out;
}

export interface BaseArena {
  /** Where the tracks run (z), and the platform beside them. */
  trackZ: [number, number];
  platformZ: number;
  platformLength: number;
  canopy?: { length: number; height: number; color: string; roof: string };
  /** How much of the rails is missing (0..1): Bartek D. sold them for scrap. */
  missing: number;
  platformEdge: string;
  platformTop: string;
  lampStep: number;
}

/** Platform, canopy, ramps, lamps and the stolen track: the parts every station on line 17 shares. */
export function baseArena(o: BaseArena): Prop[] {
  const half = o.platformLength / 2;
  const out: Prop[] = [
    { kind: 'tracks', z: o.trackZ, from: -60, to: 60, missing: o.missing },
    { kind: 'platform', at: [0, 0, o.platformZ], size: [o.platformLength, 1, 5.8], edge: o.platformEdge, top: o.platformTop },
    { kind: 'ramp', from: [-half + 2, o.platformZ], to: [-half + 7, o.platformZ], width: 5.8, h0: 0, h1: 1, color: o.platformTop },
    { kind: 'ramp', from: [half - 2, o.platformZ], to: [half - 7, o.platformZ], width: 5.8, h0: 0, h1: 1, color: o.platformTop },
    ...lamps(-half + 10, half - 10, o.platformZ + 2.2, o.lampStep),
  ];
  if (o.canopy) out.splice(4, 0, { kind: 'canopy', at: [0, 1, o.platformZ], size: [o.canopy.length, o.canopy.height, 5], posts: Math.round(o.canopy.length / 6), color: o.canopy.color, roof: o.canopy.roof });
  return out;
}
