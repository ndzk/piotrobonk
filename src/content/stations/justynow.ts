import { baseArena, lamps, row, scatter } from './shared';
import type { Prop, StationDef, V3 } from './types';

/** A fenced allotment plot; the named side is left open, so the player can walk in. */
function plot(x0: number, z0: number, x1: number, z1: number, open: 'n' | 's' | 'e' | 'w', color: string): Prop[] {
  const out: Prop[] = [];
  if (open !== 'n') out.push({ kind: 'fence', from: [x0, z0], to: [x1, z0], h: 1, color });
  if (open !== 's') out.push({ kind: 'fence', from: [x0, z1], to: [x1, z1], h: 1, color });
  if (open !== 'w') out.push({ kind: 'fence', from: [x0, z0], to: [x0, z1], h: 1, color });
  if (open !== 'e') out.push({ kind: 'fence', from: [x1, z0], to: [x1, z1], h: 1, color });
  return out;
}

/** Rows of dug soil: thin pads, low enough to walk straight over. */
function beds(cx: number, z0: number, count: number, w: number): Prop[] {
  return row([cx, 0, z0], [cx, 0, z0 + (count - 1) * 3.2], count, (at: V3): Prop => ({ kind: 'box', at, size: [w, 0.07, 2.2], color: '#5b4733', top: '#6d5742' }));
}

/** A red-and-white barrier boom across the lane, at the given height. */
function boom(cx: number, z: number, y: number): Prop[] {
  return row([cx - 2.4, y, z], [cx + 2.4, y, z], 3, (at: V3, i): Prop => ({ kind: 'box', at, size: [2.4, 0.18, 0.2], color: i % 2 ? '#e8e2d6' : '#c9332b' }));
}

/** Old wooden telegraph pole with two crossarms, the kind still standing along the line. */
function telegraph(x: number, z: number): Prop[] {
  return [
    { kind: 'pipe', at: [x, 0, z], r: 0.16, r1: 0.12, h: 6.4, color: '#5b4634', sides: 7 },
    { kind: 'box', at: [x, 5.5, z], size: [0.16, 0.12, 2.4], color: '#4a3a2c' },
    { kind: 'box', at: [x, 6.0, z], size: [0.16, 0.12, 1.8], color: '#4a3a2c' },
  ];
}

/** The enamel nameboard on the platform, read from the track side. */
function nameBoard(x: number, y: number, z: number, text: string): Prop[] {
  return [
    { kind: 'pipe', at: [x - 2.3, y, z], r: 0.08, h: 2.85, color: '#8a8f98', sides: 8 },
    { kind: 'pipe', at: [x + 2.3, y, z], r: 0.08, h: 2.85, color: '#8a8f98', sides: 8 },
    { kind: 'box', at: [x, y + 2.85, z], size: [5.2, 1, 0.14], color: '#e4ded0', top: '#cfc8b8' },
    { kind: 'sign', at: [x, y + 3.35, z - 0.09], size: [5, 0.86], text, rot: Math.PI, bg: '#e4ded0', fg: '#1b2030' },
  ];
}

/** Pigeon-house on a post: a shed body with a shingle roof, perched over the gardens. */
function dovecote(x: number, z: number): Prop[] {
  return [
    { kind: 'pipe', at: [x, 0, z], r: 0.22, h: 2.6, color: '#6b533a', sides: 8 },
    { kind: 'box', at: [x, 2.5, z], size: [2.7, 0.14, 2.7], color: '#8a7352', top: '#9c8560' },
    { kind: 'shed', at: [x, 2.64, z], size: [1.9, 1.7, 1.9], color: '#ded7c6', roof: '#7a4a38' },
    { kind: 'box', at: [x - 0.9, 2.64, z + 1.2], size: [0.24, 0.3, 0.3], color: '#e8e4dc' },
    { kind: 'box', at: [x + 1.0, 2.64, z + 1.1], size: [0.24, 0.3, 0.3], color: '#cfd4da' },
  ];
}

/** Justynów: a village halt among the allotments — sheds, fences, a dovecote and a dirt lane crossing. */
export const JUSTYNOW: StationDef = {
  id: 'justynow',
  name: 'Justynów',
  sky: ['#111742', '#3a2f6b', '#9c5660', '#261e31'],
  fog: { color: '#7a5b67', near: 34, far: 112 },
  sun: { color: '#d87a66', intensity: 1.6, dir: [-0.3, 0.38, 0.5] },
  hemi: { sky: '#c49a9c', ground: '#473f5c', intensity: 1.35 },
  ground: { grass: '#415a2f', grassDark: '#2e4024', plaza: '#7a7369', plazaLine: '#635d55', gravel: '#6b6056' },
  radius: 50,
  bins: [
    [-4, 0, 9],
    [7, 0, -7],
    [13.2, 0, 2],
    [-15, 0, -7],
    [-6, 1, 28.4],
    [11, 1, 28.4],
    [-31.5, 0, 6],
    [-22, 0, -15],
    [24, 0, -5.2],
    [27.5, 0, 2],
    [-12, 0, -24],
    [40, 0, -13],
  ],
  coffee: [
    [12.5, 1, 28.6],
    [-37.2, 0, 10],
    [35.6, 2.82, 9.2],
  ],
  chests: [
    [0, 0, 0],
    [-9, 0, 4],
    [19, 0, -11.5],
    [34, 2.82, 7],
    [-12.1, 2.5, 8],
    [0, 3.92, 27.4],
    [-10, 1, 27.4],
    [-34, 0, -8],
    [-20, 0, -18],
    [38, 0, 1],
    [8, 0, 37],
    [-26, 0, 32],
    [-42, 0, -2],
  ],
  props: [
    // Line 17 and the low halt platform with a tiny wooden shelter instead of a station building.
    ...baseArena({ trackZ: [17.5, 21.8], platformZ: 27.4, platformLength: 32, missing: 0.5, platformEdge: '#f2d23a', platformTop: '#8c857c', lampStep: 9, canopy: { length: 9, height: 2.6, color: '#6a4f33', roof: '#8a5c3a' } }),
    { kind: 'lamp', at: [-13, 0, 29.6] },
    { kind: 'lamp', at: [13, 0, 29.6] },
    { kind: 'bench', at: [-9, 1, 26.6], rot: 0 },
    { kind: 'bench', at: [8, 1, 26.6], rot: 0 },
    ...nameBoard(10, 1, 25.2, 'JUSTYNÓW'),
    { kind: 'kiosk', at: [-14, 0, 14.5], rot: -0.4 },
    // Hay bales stacked at the shelter: the step up onto its roof (3.92).
    { kind: 'crate', at: [6.6, 1, 26.2], size: 1.2 },
    { kind: 'crate', at: [5.4, 1, 26.2], size: 1.2 },
    { kind: 'crate', at: [5.4, 2.2, 26.2], size: 1.1 },

    // The dirt lane west of the halt, with a level crossing over both tracks.
    { kind: 'box', at: [-34, 0, -1], size: [7, 0.07, 30], color: '#6b5440', top: '#7b6350' },
    { kind: 'box', at: [-34, 0, 25.5], size: [7, 0.07, 7], color: '#6b5440', top: '#7b6350' },
    { kind: 'box', at: [-34, 0, 16.2], size: [7, 0.34, 0.75], color: '#6e6660', top: '#847c74' },
    { kind: 'box', at: [-34, 0, 17.5], size: [7, 0.34, 1.2], color: '#6e6660', top: '#847c74' },
    { kind: 'box', at: [-34, 0, 18.8], size: [7, 0.34, 0.75], color: '#6e6660', top: '#847c74' },
    { kind: 'box', at: [-34, 0, 19.65], size: [7, 0.12, 0.9], color: '#6b6058', top: '#7d7168' },
    { kind: 'box', at: [-34, 0, 20.5], size: [7, 0.34, 0.75], color: '#6e6660', top: '#847c74' },
    { kind: 'box', at: [-34, 0, 21.8], size: [7, 0.34, 1.2], color: '#6e6660', top: '#847c74' },
    { kind: 'box', at: [-34, 0, 23.1], size: [7, 0.34, 0.75], color: '#6e6660', top: '#847c74' },
    { kind: 'pipe', at: [-38.2, 0, 14.4], r: 0.17, h: 1.3, color: '#e2dcd0', sides: 8 },
    { kind: 'box', at: [-38.2, 1.3, 14.4], size: [0.95, 0.34, 0.26], color: '#2e3139' },
    { kind: 'box', at: [-38.5, 1.38, 14.28], size: [0.26, 0.2, 0.06], color: '#e24a3c' },
    { kind: 'box', at: [-37.9, 1.38, 14.28], size: [0.26, 0.2, 0.06], color: '#e24a3c' },
    ...boom(-34.6, 14.4, 1.05),
    { kind: 'pipe', at: [-29.8, 0, 24.9], r: 0.17, h: 1.3, color: '#e2dcd0', sides: 8 },
    ...boom(-33.4, 24.9, 1.05),
    { kind: 'lamp', at: [-39.5, 0, 12.5] },
    { kind: 'lamp', at: [-29, 0, -6] },

    // Allotments east of the halt: fenced plots with beds, sheds and fruit trees.
    ...plot(12, -18, 26, -4, 'w', '#8a7a60'),
    ...beds(19, -15, 3, 12),
    { kind: 'shed', at: [23.6, 0, -16.2], size: [2.8, 2.2, 2.4], color: '#7c8c5a', roof: '#4b3a33' },
    { kind: 'tree', at: [14.5, 0, -6.4], h: 4.2 },
    { kind: 'tree', at: [18, 0, -6.4], h: 4.6 },
    { kind: 'tree', at: [21.5, 0, -6.4], h: 4.1 },
    { kind: 'bush', at: [25, 0, -9], r: 1.1 },
    { kind: 'crate', at: [15, 0, -17], size: 1.4 },

    ...plot(12, 0, 26, 12, 'n', '#8a7a60'),
    ...beds(19, 3, 3, 12),
    { kind: 'shed', at: [23.6, 0, 9.4], size: [2.6, 2.1, 2.4], color: '#8a6b4a', roof: '#3f3a3a' },
    { kind: 'tree', at: [14.5, 0, 10.6], h: 4.4 },
    { kind: 'tree', at: [18, 0, 10.6], h: 4 },
    { kind: 'bush', at: [25, 0, 2], r: 1.2 },
    { kind: 'bush', at: [13.5, 0, 6], r: 1 },

    ...plot(30, -12, 44, 2, 'w', '#8a7a60'),
    ...beds(37, -9, 3, 12),
    { kind: 'shed', at: [41.5, 0, -10.4], size: [3, 2.3, 2.6], color: '#5a7a8c', roof: '#4b3a33' },
    { kind: 'tree', at: [32.5, 0, 0.2], h: 4.5 },
    { kind: 'tree', at: [36, 0, 0.2], h: 4.2 },
    { kind: 'tree', at: [39.5, 0, 0.2], h: 4.6 },
    { kind: 'crate', at: [42, 0, -2], size: 1.4 },

    // The village lane north of the halt, with three cottages and their gardens behind it.
    { kind: 'box', at: [-6, 0, -18], size: [52, 0.07, 5.5], color: '#6b5440', top: '#7b6350' },
    { kind: 'shed', at: [-22, 0, -26], size: [9, 3.4, 7], color: '#d8cdb6', roof: '#8a4a38' },
    ...plot(-28, -32, -16, -22, 's', '#8a7a60'),
    { kind: 'shed', at: [-26, 0, -30.5], size: [2.6, 2.1, 2.4], color: '#7c8c5a', roof: '#4b3a33' },
    { kind: 'tree', at: [-18.5, 0, -30.5], h: 5.4 },
    { kind: 'shed', at: [-4, 0, -26], size: [8, 3.2, 6.4], color: '#c6b89c', roof: '#6b4a38' },
    ...plot(-10, -31, 2, -22, 's', '#8a7a60'),
    { kind: 'shed', at: [0.4, 0, -29.5], size: [2.4, 2, 2.2], color: '#8a6b4a', roof: '#3f3a3a' },
    { kind: 'bush', at: [-8.5, 0, -29.6], r: 1.3 },
    { kind: 'shed', at: [13, 0, -26], size: [9, 3.3, 7], color: '#cfc3a6', roof: '#7c4438' },
    ...plot(7, -32, 19, -22, 's', '#8a7a60'),
    { kind: 'shed', at: [17.2, 0, -30.2], size: [2.6, 2.1, 2.4], color: '#5a7a8c', roof: '#4b3a33' },
    { kind: 'tree', at: [9.5, 0, -30.4], h: 5.2 },
    { kind: 'tree', at: [-13, 0, -24.5], h: 5.6 },
    { kind: 'tree', at: [4.5, 0, -24.2], h: 5 },
    { kind: 'tree', at: [23, 0, -25], h: 5.8 },
    { kind: 'bush', at: [-31, 0, -22], r: 1.4 },
    // Roadside shrine where the lanes meet.
    { kind: 'shed', at: [-29.5, 0, -14.5], size: [1.3, 2.3, 1.1], color: '#e4ded0', roof: '#5a6b8a' },

    // The dovecote over the near gardens, and a cowshed with a plank up onto its roof.
    ...dovecote(-19, 6),
    { kind: 'box', at: [34, 0, 8], size: [7, 2.6, 5], color: '#8a6a46', top: '#6b4a33' },
    { kind: 'box', at: [34, 2.6, 8], size: [7.4, 0.22, 5.4], color: '#5e4432', top: '#70513c' },
    { kind: 'ramp', from: [26.4, 8], to: [31, 8], width: 2.2, h0: 0, h1: 2.82, color: '#7b5a3a' },
    { kind: 'bush', at: [30, 0, 11.5], r: 1.3 },

    // Haystack: four bales and one on top, climbable.
    { kind: 'crate', at: [-12.8, 0, 7.2], size: 1.3 },
    { kind: 'crate', at: [-11.3, 0, 7.2], size: 1.3 },
    { kind: 'crate', at: [-12.8, 0, 8.7], size: 1.3 },
    { kind: 'crate', at: [-11.3, 0, 8.7], size: 1.3 },
    { kind: 'crate', at: [-12.05, 1.3, 7.95], size: 1.2 },

    // Loose bales out in the meadow: square ones and rolls stood on end.
    { kind: 'crate', at: [-6, 0, -14], size: 1.4 },
    { kind: 'crate', at: [-8.4, 0, -15.6], size: 1.4 },
    { kind: 'pipe', at: [4, 0, 36], r: 0.8, h: 1.3, color: '#b09450', sides: 12 },
    { kind: 'pipe', at: [5.9, 0, 35.2], r: 0.8, h: 1.3, color: '#a68a48', sides: 12 },
    { kind: 'pipe', at: [-24, 0, 33], r: 0.8, h: 1.3, color: '#b09450', sides: 12 },
    { kind: 'pipe', at: [-40, 0, -14], r: 0.8, h: 1.3, color: '#a68a48', sides: 12 },
    { kind: 'pipe', at: [-41.6, 0, -12.6], r: 0.8, h: 1.3, color: '#b09450', sides: 12 },
    { kind: 'pipe', at: [28, 0, 7], r: 0.8, h: 1.3, color: '#a68a48', sides: 12 },

    // Orchard rows and the hedges along the lane.
    ...row([-30, 0, -10], [-30, 0, -2], 3, (at: V3): Prop => ({ kind: 'tree', at, h: 4.4 })),
    ...row([-38.5, 0, -12], [-38.5, 0, -2], 3, (at: V3): Prop => ({ kind: 'tree', at, h: 4.2 })),
    ...row([-29.5, 0, 2], [-29.5, 0, 11], 4, (at: V3): Prop => ({ kind: 'bush', at, r: 1.1 })),
    ...row([-38.5, 0, 2], [-38.5, 0, 11], 4, (at: V3): Prop => ({ kind: 'bush', at, r: 1.1 })),
    { kind: 'bush', at: [-6, 0, 12.4], r: 1.4 },
    { kind: 'bush', at: [20, 0, 13.5], r: 1.2 },
    // Telegraph poles still standing along the line.
    ...telegraph(-40, 13.4),
    ...telegraph(-24, 13.4),
    ...telegraph(-8, 13.4),
    ...telegraph(8, 13.4),
    ...telegraph(24, 13.4),
    ...telegraph(40, 13.4),
    { kind: 'tree', at: [-4, 0, 34], h: 6 },
    { kind: 'tree', at: [22, 0, 34], h: 6.5 },
    ...lamps(-24, 16, -15.4, 13),
    ...scatter(44, 24, 'tree', 1028, [
      [-46, 13, 46, 32],
      [-41, -16, -27, 30],
      [26, -16, 46, 14],
      [-34, -36, 26, -14],
    ]),
    ...scatter(37, 18, 'bush', 2044, [
      [-46, 13, 46, 32],
      [-41, -16, -27, 30],
      [26, -16, 46, 14],
      [-34, -36, 26, -14],
    ]),
  ],
};
