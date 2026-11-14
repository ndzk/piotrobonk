import { baseArena, lamps, row, scatter } from './shared';
import type { Prop, StationDef, V3 } from './types';

/** Painted bay markings: thin pads on the tarmac, 2.6 m apart. */
function bays(axis: 'x' | 'z', from: number, to: number, at: number, depth: number): Prop[] {
  const n = Math.max(1, Math.round(Math.abs(to - from) / 2.6)) + 1;
  return row(axis === 'x' ? [from, 0, at] : [at, 0, from], axis === 'x' ? [to, 0, at] : [at, 0, to], n, (p: V3): Prop => ({
    kind: 'box',
    at: p,
    size: axis === 'x' ? [0.14, 0.07, depth] : [depth, 0.07, 0.14],
    color: '#cfc8b8',
    top: '#e4ddcc',
  }));
}

/** A parked car: body, cabin and four wheels, pointing down `yaw` (0 = east, PI/2 = north). */
function car(x: number, z: number, yaw: number, color: string): Prop[] {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const at = (y: number, l: number, w: number): V3 => [x + l * c + w * s, y, z - l * s + w * c];
  const out: Prop[] = [
    { kind: 'box', at: at(0.34, 0, 0), size: [4.2, 0.56, 1.76], color, top: color, rot: yaw },
    { kind: 'box', at: at(0.9, -0.25, 0), size: [2.1, 0.58, 1.52], color, top: '#2b3038', rot: yaw },
    { kind: 'box', at: at(1.48, -0.25, 0), size: [1.9, 0.06, 1.4], color: '#2b3038', rot: yaw },
  ];
  for (const l of [-1.4, 1.4]) {
    for (const w of [-0.84, 0.84]) out.push({ kind: 'box', at: at(0, l, w), size: [1.05, 0.36, 0.22], color: '#1e2126', rot: yaw });
  }
  return out;
}

/** The enamel nameboard beside the platform, read from the forecourt. */
function nameBoard(x: number, y: number, z: number, text: string): Prop[] {
  return [
    { kind: 'pipe', at: [x - 2.3, y, z], r: 0.08, h: 2.85, color: '#8a8f98', sides: 8 },
    { kind: 'pipe', at: [x + 2.3, y, z], r: 0.08, h: 2.85, color: '#8a8f98', sides: 8 },
    { kind: 'box', at: [x, y + 2.85, z], size: [5.2, 1, 0.14], color: '#e4ded0', top: '#cfc8b8' },
    { kind: 'sign', at: [x, y + 3.35, z - 0.09], size: [5, 0.86], text, rot: Math.PI, bg: '#e4ded0', fg: '#1b2030' },
  ];
}

/** A line of nested shopping trolleys under a bay roof. */
function trolleys(x: number, z: number, count: number): Prop[] {
  return row([x, 0, z], [x + (count - 1) * 0.42, 0, z], count, (at: V3): Prop => ({ kind: 'box', at, size: [0.62, 0.95, 0.95], color: '#9aa0aa', top: '#b6bcc6' }));
}

/** Koluszki: the end of the line in the dead of night — the junction, and the Dino across the car park. */
export const KOLUSZKI: StationDef = {
  id: 'koluszki',
  name: 'Koluszki',
  // 9/9: the dead of night. The moon and the shop sign are the light; the hemi carries the legibility.
  sky: ['#070b2c', '#1a1550', '#3e2a60', '#110e1f'],
  fog: { color: '#251f3c', near: 46, far: 124 },
  sun: { color: '#7b74c0', intensity: 1.2, dir: [-0.15, 0.32, 0.65] },
  hemi: { sky: '#8679c8', ground: '#343069', intensity: 2.05 },
  ground: { grass: '#202c1b', grassDark: '#192214', plaza: '#434353', plazaLine: '#34343f', gravel: '#3b363b' },
  radius: 58,
  bins: [
    [-6, 0, 8],
    [8, 0, 8],
    [0.5, 0.06, -22],
    [29.6, 0.06, -20],
    [-7, 1, 28.4],
    [12, 1, 28.4],
    [-14, 0, -20],
    [-40, 0, -14],
    [-18, 0, 8],
    [34, 0, 4],
    [20, 0, 10],
    [-30, 0, 34],
    [38, 0, -30],
  ],
  coffee: [
    [-4, 1, 28.6],
    [1, 0.06, -23.2],
    [21, 1.2, -42],
  ],
  chests: [
    [0, 0, 0],
    [-13, 0, 4],
    [16, 0.06, -14],
    [14, 1.2, -41],
    [15.9, 3.5, -43.4],
    [0, 4.32, 27.4],
    [-20, 1, 27.4],
    [-28, 0, -18],
    [-44, 0, 2],
    [-2, 2.52, -25],
    [34, 2.52, -25],
    [40, 0, -22],
    [-24, 0, 36],
    [26, 0, 38],
  ],
  props: [
    // The junction: the main line, a pair of through roads north of the platform and a dead-end siding.
    ...baseArena({ trackZ: [17.5, 21.8], platformZ: 27.4, platformLength: 50, missing: 0.65, platformEdge: '#f2d23a', platformTop: '#737170', lampStep: 10, canopy: { length: 28, height: 3, color: '#2a3350', roof: '#44507a' } }),
    ...row([-40, 0, 33.2], [40, 0, 33.2], 5, (at: V3): Prop => ({ kind: 'box', at, size: [21, 0.1, 4.6], color: '#59524c', top: '#6a615a' })),
    ...row([-40, 0, 37], [40, 0, 37], 5, (at: V3): Prop => ({ kind: 'box', at, size: [21, 0.1, 4.6], color: '#59524c', top: '#6a615a' })),
    { kind: 'tracks', z: [33.2], from: -42, to: 42, missing: 0.2 },
    { kind: 'tracks', z: [37], from: -42, to: 42, missing: 0.35 },
    { kind: 'tracks', z: [43], from: -22, to: 24, missing: 0.5 },
    { kind: 'box', at: [25, 0, 43], size: [1.4, 1.1, 3], color: '#6b4a30', top: '#8a5f3c' },
    ...lamps(-30, 30, 40.5, 20),

    // The station building, and the lit shop sign that carries the far side of the night.
    { kind: 'hall', at: [-28, 0, -28], size: [30, 8, 16], sign: 'KOLUSZKI' },
    { kind: 'hall', at: [16, 0, -32], size: [26, 7, 15], sign: 'DINO' },
    // The shop's own sign, in its green, covering the station-blue board the hall draws.
    { kind: 'sign', at: [16, 6, -24.05], size: [20.6, 2.4], text: 'DINO', bg: '#0e7a3c' },
    { kind: 'sign', at: [16, 3.7, -24.42], size: [7, 0.62], text: 'CZYNNE 6:00 – 22:00', bg: '#13331f', fg: '#9ad8b0' },
    { kind: 'sign', at: [-5.5, 2.3, -6], size: [3.4, 1], text: 'PARKING DINO', rot: Math.PI / 2, bg: '#0e7a3c' },
    { kind: 'box', at: [-5.62, 1.8, -6], size: [0.12, 1.2, 3.6], color: '#4a5260' },
    { kind: 'pipe', at: [-5.6, 0, -6], r: 0.09, h: 1.8, color: '#4a5260', sides: 8 },

    // Car park: tarmac, painted bays and lamps, with the 20 m in front of the shop left clear.
    { kind: 'box', at: [16, 0, -11], size: [48, 0.06, 30], color: '#3c3b42', top: '#47464e' },
    { kind: 'box', at: [-8.3, 0, -11], size: [0.5, 0.16, 30], color: '#857f76', top: '#9a948a' },
    { kind: 'box', at: [40.3, 0, -11], size: [0.5, 0.16, 30], color: '#857f76', top: '#9a948a' },
    { kind: 'box', at: [16, 0, 4.3], size: [49, 0.16, 0.5], color: '#857f76', top: '#9a948a' },
    ...bays('z', -23, -7, -5, 5),
    ...bays('z', -23, -7, 35, 5),
    ...bays('x', 8, 34, 1.6, 5),
    ...car(-5, -21.5, 0, '#8a3b3b'),
    ...car(-5, -16.3, 0, '#3b5a8a'),
    ...car(-5.3, -8.5, 0.14, '#6b6f78'),
    ...car(35, -20, 0, '#4f6b52'),
    ...car(35, -12.2, 0, '#8a7a3b'),
    ...car(11.9, 1.6, Math.PI / 2, '#7a7f88'),
    ...car(19.7, 1.9, 1.42, '#8a4f2b'),
    ...car(30.1, 1.6, Math.PI / 2, '#3b4f6b'),
    ...lamps(-22, -6, -4, 8, 'z'),
    ...lamps(-22, -6, 35, 8, 'z'),
    ...lamps(4, 36, 6, 16),
    { kind: 'lamp', at: [1.5, 0, -20] },
    { kind: 'lamp', at: [30.5, 0, -20] },

    // Trolley bays: little lit roofs flanking the shop front, with a crate up onto each roof (2.52).
    { kind: 'canopy', at: [-2, 0, -25], size: [5.5, 2.2, 2.6], posts: 2, color: '#5c6b5a', roof: '#8a9a88' },
    ...trolleys(-3, -25, 6),
    { kind: 'crate', at: [2.2, 0, -25], size: 1.4 },
    { kind: 'canopy', at: [34, 0, -25], size: [5.5, 2.2, 2.6], posts: 2, color: '#5c6b5a', roof: '#8a9a88' },
    ...trolleys(33, -25, 6),
    { kind: 'crate', at: [30.2, 0, -25], size: 1.4 },
    ...row([33, 0, -5.4], [39, 0, -5.4], 4, (at: V3): Prop => ({ kind: 'pipe', at, r: 0.12, h: 0.9, color: '#c9b02e', sides: 8 })),
    ...row([-7, 0, -3], [-7, 0, -9], 3, (at: V3): Prop => ({ kind: 'pipe', at, r: 0.12, h: 0.9, color: '#c9b02e', sides: 8 })),

    // Behind the shop: the delivery dock, its ramp and a stack of pallets to climb.
    { kind: 'box', at: [16, 0, -42], size: [14, 1.2, 5], color: '#6b6861', top: '#817d74' },
    { kind: 'box', at: [16, 1.2, -44.4], size: [14, 0.25, 0.3], color: '#d8c43a' },
    { kind: 'ramp', from: [25, -42], to: [30.5, -42], width: 3.4, h0: 1.2, h1: 0, color: '#6b6861' },
    { kind: 'crate', at: [14.6, 1.2, -43.4], size: 1.2 },
    { kind: 'crate', at: [15.9, 1.2, -43.4], size: 1.2 },
    { kind: 'crate', at: [15.9, 2.4, -43.4], size: 1.1 },
    { kind: 'box', at: [23, 1.2, -42], size: [2.4, 2.4, 2.2], color: '#8a8f98', top: '#3a4048' },
    { kind: 'lamp', at: [9, 0, -44] },
    { kind: 'lamp', at: [29, 0, -45] },
    { kind: 'box', at: [6, 0, -43], size: [2.6, 2.4, 2.4], color: '#4f6b52', top: '#3a4048' },
    { kind: 'box', at: [3.2, 0, -43], size: [2.6, 2.4, 2.4], color: '#6b4f4f', top: '#3a4048' },

    // Station forecourt west of the shop: bus stop, benches and the taxi rank.
    { kind: 'canopy', at: [-28, 0, -14], size: [9, 2.5, 3], posts: 3, color: '#3b4452', roof: '#5a6476' },
    { kind: 'bench', at: [-30, 0, -14.8], rot: 0 },
    { kind: 'bench', at: [-25, 0, -14.8], rot: 0 },
    { kind: 'kiosk', at: [-17, 0, -14], rot: 0.5 },
    ...car(-40, -12, Math.PI / 2, '#d8c43a'),
    ...car(-36, -12, Math.PI / 2, '#d8c43a'),
    ...lamps(-46, -14, -8, 10),
    { kind: 'lamp', at: [-34, 0, 6] },
    { kind: 'lamp', at: [-14, 0, 6] },
    { kind: 'lamp', at: [10, 0, 10] },

    // Crates up to the canopy roof (4.32) at the east end of the platform.
    { kind: 'crate', at: [16.6, 1, 26.2], size: 1.2 },
    { kind: 'crate', at: [15.4, 1, 26.2], size: 1.2 },
    { kind: 'crate', at: [15.4, 2.2, 26.2], size: 1.1 },
    { kind: 'bench', at: [-10, 1, 26.6], rot: 0 },
    { kind: 'bench', at: [6, 1, 26.6], rot: 0 },
    { kind: 'bench', at: [20, 1, 26.6], rot: 0 },
    ...nameBoard(-28, 0, 26, 'KOLUSZKI'),

    // The middle of the car park, which was bare tarmac: the parking pylon, a smoking shelter with a
    // crate up onto its roof, the bottle banks and another row of bays with cars in them.
    { kind: 'pipe', at: [8, 0, -4], r: 0.35, h: 5, color: '#4a5260', sides: 10 },
    { kind: 'box', at: [8, 5, -4], size: [3.4, 2.6, 0.4], color: '#0e7a3c', top: '#13331f' },
    { kind: 'sign', at: [8, 6.5, -3.78], size: [3.2, 1.1], text: 'DINO', bg: '#0e7a3c' },
    { kind: 'sign', at: [8, 5.3, -3.78], size: [3.2, 0.8], text: 'PARKING 2 GODZ.', bg: '#13331f', fg: '#9ad8b0' },
    { kind: 'canopy', at: [1, 0, 11], size: [6, 2.5, 3], posts: 2, color: '#5c6b5a', roof: '#8a9a88' },
    { kind: 'box', at: [1, 0, 12.35], size: [6, 2.5, 0.25], color: '#5c6b5a', top: '#8a9a88' },
    { kind: 'bench', at: [1, 0, 11.8], rot: 0 },
    { kind: 'crate', at: [4.8, 0, 11], size: 1.3 },
    { kind: 'crate', at: [4.8, 1.3, 11], size: 1.2 },
    { kind: 'pipe', at: [6, 0, -9], r: 1.1, h: 2.2, color: '#2f6b4a', sides: 12 },
    { kind: 'pipe', at: [8.6, 0, -9.8], r: 1.1, h: 2.2, color: '#3b5a8a', sides: 12 },
    { kind: 'box', at: [11.2, 0, -9], size: [2, 2, 1.8], color: '#6b6f78', top: '#3a4048' },
    ...bays('z', -23, -7, 14, 5),
    ...car(14, -21.5, 0, '#6b4f4f'),
    ...car(14, -16.3, 0, '#9aa0aa'),
    ...car(14, -11, 0, '#3b5a8a'),
    { kind: 'box', at: [24, 0, -18], size: [3, 0.85, 3], color: '#6b6861', top: '#4f6b52' },
    { kind: 'bush', at: [24, 0.85, -18], r: 1.3 },
    { kind: 'box', at: [-1, 0, -12.5], size: [3, 0.85, 3], color: '#6b6861', top: '#4f6b52' },
    { kind: 'bush', at: [-1, 0.85, -12.5], r: 1.3 },

    // The edges: hedges, trees and the fence line.
    { kind: 'bush', at: [-12, 0, 10], r: 1.3 },
    { kind: 'bush', at: [24, 0, 12], r: 1.4 },
    { kind: 'bush', at: [-44, 0, -6], r: 1.2 },
    { kind: 'bush', at: [44, 0, -26], r: 1.3 },
    { kind: 'tree', at: [-46, 0, -22], h: 7 },
    { kind: 'tree', at: [46, 0, -12], h: 6.5 },
    { kind: 'tree', at: [44, 0, -36], h: 7 },
    { kind: 'tree', at: [-44, 0, 10], h: 6 },
    ...scatter(52, 26, 'tree', 1049, [
      [-52, 12, 52, 48],
      [-10, -48, 44, 8],
      [-48, -40, -8, -16],
    ]),
    ...scatter(44, 18, 'bush', 2077, [
      [-52, 12, 52, 48],
      [-10, -48, 44, 8],
      [-48, -40, -8, -16],
    ]),
  ],
};
