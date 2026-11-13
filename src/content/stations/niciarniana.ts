import { baseArena, lamps, scatter, seeded } from './shared';
import type { Prop, StationDef } from './types';

const BRICK = '#8e4231';
const BRICK_DARK = '#5e2b20';
const BRICK_TOP = '#4b231b';
const GLASS = '#ffd09a';
const STEEL = '#7d8490';

/** Tall arched windows along a brick face looking south (−z); `z` is the face itself. */
function windows(x0: number, x1: number, z: number, count: number, y: number, h: number, w = 1.7): Prop[] {
  const out: Prop[] = [];
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? x0 : x0 + ((x1 - x0) * i) / (count - 1);
    out.push({ kind: 'box', at: [x, y, z - 0.1], size: [w, h, 0.3], color: GLASS, top: BRICK_DARK });
    out.push({ kind: 'box', at: [x, y + h, z - 0.1], size: [w - 0.55, 0.75, 0.3], color: GLASS, top: BRICK_DARK });
    out.push({ kind: 'box', at: [x, y - 0.35, z - 0.14], size: [w + 0.5, 0.35, 0.38], color: BRICK_DARK });
  }
  return out;
}

/** North-light saw-tooth roof: a dark ridge with a glazed south slope, the roof every spinning mill has. */
function sawtooth(x0: number, x1: number, zs: number[], y: number): Prop[] {
  const out: Prop[] = [];
  for (const z of zs) {
    out.push({ kind: 'box', at: [(x0 + x1) / 2, y, z], size: [x1 - x0, 1.5, 1.5], color: BRICK_DARK, top: BRICK_TOP });
    out.push({ kind: 'box', at: [(x0 + x1) / 2, y, z - 1.1], size: [x1 - x0 - 1, 1.1, 0.7], color: GLASS, top: STEEL });
  }
  return out;
}

/** A stack of thread spools on a pallet: crates in a pyramid. */
function spools(x: number, z: number, seed: number, rows = 3): Prop[] {
  const rnd = seeded(seed);
  const out: Prop[] = [];
  for (let r = 0; r < rows; r++) {
    const n = rows - r;
    for (let i = 0; i < n; i++) {
      const s = 1.05 - r * 0.07;
      out.push({ kind: 'crate', at: [x + (i - (n - 1) / 2) * 1.2 + (rnd() - 0.5) * 0.2, r * 1.0, z + (rnd() - 0.5) * 0.4], size: s });
    }
  }
  return out;
}

/** The chimney of the boiler house: stacked, narrowing brick with a white band near the top. */
function chimney(x: number, z: number): Prop[] {
  return [
    { kind: 'box', at: [x, 0, z], size: [5.4, 2.6, 5.4], color: BRICK_DARK, top: '#6b3226' },
    { kind: 'box', at: [x, 2.6, z], size: [4.2, 8, 4.2], color: BRICK, top: BRICK_TOP },
    { kind: 'box', at: [x, 10.6, z], size: [3.6, 8, 3.6], color: BRICK, top: BRICK_TOP },
    { kind: 'box', at: [x, 18.6, z], size: [3.1, 5.4, 3.1], color: BRICK, top: BRICK_TOP },
    { kind: 'box', at: [x, 24, z], size: [3.2, 1.1, 3.2], color: '#d9cfc2', top: '#bdb2a4' },
    { kind: 'box', at: [x, 25.1, z], size: [2.9, 2.2, 2.9], color: BRICK, top: '#2b1a14' },
  ];
}

export const NICIARNIANA: StationDef = {
  id: 'niciarniana',
  name: 'Łódź Niciarniana',
  sky: ['#1d2352', '#60427a', '#ee8458', '#3a2a3c'],
  fog: { color: '#bd6f5f', near: 34, far: 104 },
  sun: { color: '#ffae76', intensity: 2.2, dir: [-0.5, 0.45, 0.3] },
  hemi: { sky: '#ffcdb0', ground: '#6a566e', intensity: 1.55 },
  ground: { grass: '#4e6336', grassDark: '#3a4c2c', plaza: '#8a7b74', plazaLine: '#6e615c', gravel: '#7b6a60' },
  radius: 56,
  bins: [
    [-10, 0, -16],
    [10, 0, -16],
    [-19, 0, -4],
    [19, 0, -2],
    [-3.5, 0, 10],
    [12.4, 1, 26],
    [-12.4, 1, 29],
    [-27, 0, 8],
    [26, 0, -14],
    [-40, 1.2, 1],
    [34, 1.2, -6],
    [-6, 0, -21],
    [17, 0, 12],
  ],
  coffee: [
    [-7, 0, -22.6],
    [4, 1, 29],
    [-40, 1.2, 5.5],
  ],
  chests: [
    [0, 0, 0],
    [-18, 0, -12],
    [20, 0, 8],
    [-30, 0, 13],
    [28, 0, 12],
    [-45, 0, -6],
    [44, 0, -2],
    [-40, 1.2, -2],
    [40, 1.2, -5.5],
    [-29, 4, 31],
    [8, 4.32, 27.4],
    [-20, 1, 27.4],
    [19, 1, 27.4],
    [20, 0, 47],
  ],
  props: [
    // Line 17 squeezed between the mill wall and the tracks: the platform is barely wider than the canopy.
    ...baseArena({
      trackZ: [17.5, 21.8],
      platformZ: 27.4,
      platformLength: 44,
      missing: 0.3,
      platformEdge: '#f2d23a',
      platformTop: '#8f8277',
      lampStep: 11,
      canopy: { length: 26, height: 3.0, color: '#5a3b33', roof: '#7a4a3c' },
    }),
    // Crate steps from the platform onto the canopy roof (roof top 4.32).
    { kind: 'crate', at: [15.6, 1, 26.2], size: 1.1 },
    { kind: 'crate', at: [14.2, 1, 26.3], size: 1.1 },
    { kind: 'crate', at: [14.2, 2.1, 26.3], size: 1.0 },

    // The spinning mill: a long brick hall right behind the platform, arched windows and a saw-tooth roof.
    { kind: 'box', at: [-8, 0, 38], size: [44, 9.5, 11], color: BRICK, top: BRICK_TOP },
    ...windows(-27, 11, 32.5, 9, 2.4, 4.4),
    { kind: 'box', at: [-8, 7.6, 32.4], size: [44, 0.6, 0.5], color: BRICK_DARK },
    { kind: 'box', at: [-8, 9.5, 38], size: [45, 0.7, 12], color: BRICK_DARK, top: BRICK_TOP },
    ...sawtooth(-29.5, 13.5, [35.4, 38.2, 41], 10.2),
    // East end block: the water tower corner of the mill.
    { kind: 'box', at: [25, 0, 36], size: [15, 13, 10], color: BRICK, top: BRICK_TOP },
    ...windows(19, 31, 31, 4, 3, 5),
    { kind: 'box', at: [25, 13, 36], size: [16, 0.8, 11], color: BRICK_DARK, top: BRICK_TOP },
    { kind: 'box', at: [25, 13.8, 36], size: [6, 3.4, 6], color: '#6d7580', top: '#878f9b' },
    { kind: 'box', at: [25, 17.2, 36], size: [6.8, 0.6, 6.8], color: '#4a525c' },
    // The west annex with the goods door, and a ramp up onto its roof.
    { kind: 'box', at: [-29, 0, 34.5], size: [9, 3.6, 8], color: BRICK_DARK, top: '#6b3226' },
    { kind: 'box', at: [-29, 0, 30.4], size: [4.4, 3, 0.4], color: '#3a2a22' },
    { kind: 'ramp', from: [-34.8, 29.5], to: [-34.8, 37], width: 3.4, h0: 0, h1: 4, color: '#6b5a48' },
    { kind: 'box', at: [-29, 3.6, 34.5], size: [9.6, 0.4, 8.6], color: '#6b3226', top: '#7d4133' },
    ...spools(-30.5, 33.5, 311, 2),
    ...chimney(-39, 37),

    // Goods yard on the dirt west of the plaza: a loading dock with a plank ramp and bales of yarn.
    { kind: 'box', at: [-41, 0, 1], size: [15, 1.2, 10], color: '#8b7f72', top: '#a1958a' },
    { kind: 'box', at: [-41, 1.2, -3.6], size: [15, 0.25, 0.3], color: '#c4b398' },
    { kind: 'ramp', from: [-41, 11], to: [-41, 6.4], width: 5, h0: 0, h1: 1.2, color: '#7b5a3a' },
    { kind: 'shed', at: [-48.5, 1.2, 1], size: [3.4, 2.4, 3], color: '#7c6a52', roof: '#4b3a33' },
    ...spools(-38, 2.5, 707),
    ...spools(-44, -1, 909, 2),
    { kind: 'crate', at: [-34.5, 0, 8], size: 1.2 },
    { kind: 'crate', at: [-33.2, 0, 8.6], size: 1.0 },
    { kind: 'crate', at: [-34.5, 1.2, 8], size: 1.0 },
    // Brick wall closing the yard off from the open ground.
    { kind: 'box', at: [-41, 0, -8.5], size: [22, 2.6, 0.6], color: BRICK, top: BRICK_TOP },
    { kind: 'box', at: [-52, 0, 1], size: [0.6, 2.6, 19], color: BRICK, top: BRICK_TOP },

    // Station building: the white booking hall wedged between two brick wings of the old weaving shed.
    { kind: 'hall', at: [0, 0, -30], size: [26, 6.5, 12], sign: 'ŁÓDŹ NICIARNIANA' },
    { kind: 'box', at: [-21, 0, -30], size: [16, 5.4, 12], color: BRICK, top: BRICK_TOP },
    { kind: 'box', at: [21, 0, -30], size: [16, 5.4, 12], color: BRICK, top: BRICK_TOP },
    ...windows(-27, -15, -24, 4, 1.8, 2.8, 1.5),
    ...windows(15, 27, -24, 4, 1.8, 2.8, 1.5),
    { kind: 'box', at: [-21, 5.4, -30], size: [16.6, 0.6, 12.6], color: BRICK_DARK, top: BRICK_TOP },
    { kind: 'box', at: [21, 5.4, -30], size: [16.6, 0.6, 12.6], color: BRICK_DARK, top: BRICK_TOP },

    // Goods shed east of the forecourt: a loading ramp at lorry-bed height, stacked with spools.
    { kind: 'box', at: [38, 0, -14], size: [16, 6.5, 12], color: BRICK, top: BRICK_TOP },
    { kind: 'box', at: [38, 6.5, -14], size: [16.6, 0.7, 12.6], color: BRICK_DARK, top: BRICK_TOP },
    ...windows(32, 44, -20, 4, 2, 3.2, 1.5),
    { kind: 'box', at: [38, 0, -5.5], size: [16, 1.2, 5], color: '#8b7f72', top: '#a1958a' },
    { kind: 'box', at: [38, 1.2, -3.2], size: [16, 0.25, 0.3], color: '#c4b398' },
    { kind: 'box', at: [38, 1.2, -7.6], size: [10, 2.8, 0.5], color: '#3a2a22', top: BRICK_DARK },
    { kind: 'ramp', from: [30.5, -5.5], to: [34.5, -5.5], width: 4, h0: 0, h1: 1.2, color: '#7b5a3a' },
    ...spools(41, -5.5, 515, 2),
    { kind: 'crate', at: [34, 1.2, -4.6], size: 1.1 },
    { kind: 'crate', at: [35.2, 1.2, -4.4], size: 0.9 },
    { kind: 'lamp', at: [30, 0, -10] },
    { kind: 'lamp', at: [46, 0, -2] },

    // Forecourt: kiosk, benches, a few spool pallets waiting for a lorry that never comes.
    { kind: 'kiosk', at: [-9, 0, -7], rot: 0.35 },
    { kind: 'bench', at: [-7, 0, -17.5], rot: 0 },
    { kind: 'bench', at: [7, 0, -17.5], rot: 0 },
    { kind: 'bench', at: [-16, 0, 4], rot: 0 },
    { kind: 'bench', at: [16, 0, 4], rot: 0 },
    ...spools(24, -6, 101, 2),
    ...spools(-24, 10, 202, 2),
    { kind: 'crate', at: [12.5, 0, 9.5], size: 1.2 },
    { kind: 'crate', at: [13.8, 0, 9.9], size: 1.0 },
    ...lamps(-21, 21, -19, 14),
    ...lamps(-28, 20, 7, 16),
    { kind: 'bench', at: [-4, 1, 29.6], rot: 0 },
    { kind: 'bench', at: [8, 1, 29.6], rot: 0 },

    // Greenery: a few trees survived between the mill and the ring fence.
    { kind: 'tree', at: [-15, 0, 10], h: 6.5 },
    { kind: 'tree', at: [17, 0, -14], h: 6 },
    { kind: 'tree', at: [-30, 0, -14], h: 7 },
    { kind: 'bush', at: [12, 0, 9], r: 1.3 },
    { kind: 'bush', at: [-12, 0, -11], r: 1.1 },
    { kind: 'bush', at: [22, 0, 10], r: 1.4 },
    { kind: 'bush', at: [-26, 0, -18], r: 1.2 },
    ...scatter(48, 26, 'tree', 1000, [
      [-42, 13, 42, 46],
      [-34, -40, 34, -18],
      [-56, -14, -28, 14],
    ]),
    ...scatter(40, 20, 'bush', 2000, [
      [-42, 13, 42, 46],
      [-34, -40, 34, -18],
      [-56, -14, -28, 14],
    ]),
  ],
};
