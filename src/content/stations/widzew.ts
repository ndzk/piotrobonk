import { baseArena, lamps, row, scatter } from './shared';
import type { Prop, StationDef, V3 } from './types';

const CONCRETE = '#9a9aa2';
const CONCRETE_TOP = '#b0b0b8';
const WINDOW = '#ffcf96';
const PANEL = '#8e929c';

/** A block of flats on the skyline: lit window bands on the faces that look at the station. */
function block(x: number, z: number, w: number, d: number, floors: number, sx: number, sz: number): Prop[] {
  const h = floors * 3 + 1.4;
  const out: Prop[] = [{ kind: 'box', at: [x, 0, z], size: [w, h, d], color: PANEL, top: '#6f737c' }];
  for (let f = 0; f < floors; f++) {
    const y = 2 + f * 3;
    if (sx) out.push({ kind: 'box', at: [x + sx * (w / 2 + 0.05), y, z], size: [0.2, 1.1, d - 2.5], color: WINDOW, top: PANEL });
    if (sz) out.push({ kind: 'box', at: [x, y, z + sz * (d / 2 + 0.05)], size: [w - 2.5, 1.1, 0.2], color: WINDOW, top: PANEL });
  }
  out.push({ kind: 'box', at: [x, h, z], size: [w + 0.5, 0.5, d + 0.5], color: '#6f737c', top: '#7d818a' });
  out.push({ kind: 'box', at: [x, h + 0.5, z], size: [3, 2.2, 3], color: '#6f737c', top: '#7d818a' });
  return out;
}

/** Parked cars in a bay: body and cabin, nose to the kerb. */
function cars(from: V3, to: V3, count: number, colors: string[]): Prop[] {
  const body = row<Prop>(from, to, count, (at, i) => ({ kind: 'box', at, size: [1.9, 1.25, 4.3], color: colors[i % colors.length] ?? '#888' }));
  const cabin = row<Prop>(from, to, count, (at, i) => ({ kind: 'box', at: [at[0], at[1] + 1.25, at[2] - 0.2], size: [1.7, 0.6, 2.2], color: '#2f3744', top: colors[i % colors.length] }));
  return [...body, ...cabin];
}

/** A city bus: long box, window band down each side, a dark windscreen end. */
function bus(x: number, z: number, color: string): Prop[] {
  return [
    { kind: 'box', at: [x, 0.35, z], size: [11, 2.5, 2.7], color, top: '#d8dae0' },
    { kind: 'box', at: [x, 0, z + 0.9], size: [10.2, 0.4, 0.5], color: '#2b2f38' },
    { kind: 'box', at: [x, 0, z - 0.9], size: [10.2, 0.4, 0.5], color: '#2b2f38' },
    { kind: 'box', at: [x, 1.5, z + 1.36], size: [9.6, 1.1, 0.12], color: '#2f4354' },
    { kind: 'box', at: [x, 1.5, z - 1.36], size: [9.6, 1.1, 0.12], color: '#2f4354' },
    { kind: 'box', at: [x + 5.55, 1.4, z], size: [0.12, 1.3, 2.4], color: '#2f4354' },
    { kind: 'box', at: [x - 5.4, 2.2, z], size: [1.6, 0.5, 1.4], color: '#e8d87a' },
  ];
}

export const WIDZEW: StationDef = {
  id: 'widzew',
  name: 'Łódź Widzew',
  sky: ['#1a2050', '#53407b', '#dd7a5e', '#36283c'],
  fog: { color: '#a96a60', near: 36, far: 118 },
  sun: { color: '#ff9f72', intensity: 2.0, dir: [-0.45, 0.5, 0.25] },
  hemi: { sky: '#f3c3ae', ground: '#5f5570', intensity: 1.5 },
  ground: { grass: '#4a5f36', grassDark: '#374a2b', plaza: '#8d8c92', plazaLine: '#70707a', gravel: '#79706a' },
  radius: 62,
  bins: [
    [-11, 0, -14],
    [11, 0, -14],
    [-21, 0, 2],
    [21, 0, 4],
    [-3, 0, 10],
    [14, 1, 25.6],
    [-14, 1, 29.2],
    [30, 0, -14],
    [46, 0, -2],
    [-30, 0, -8],
    [26, 0, -20],
    [-40, 7, 6],
    [-6, 0, -22],
    [36, 0, 4],
  ],
  coffee: [
    [-8, 0, -21],
    [-2, 1, 29.2],
    [-40, 7, -8],
  ],
  chests: [
    [0, 0, 0],
    [-22, 0, -16],
    [24, 0, 14],
    [-40, 7, 20],
    [-40, 7, -14],
    [12, 5.12, 27.4],
    [-24, 1, 27.4],
    [22, 1, 27.4],
    [0, 4.82, -18],
    [34, 0, -10],
    [32, 0, -26],
    [-50, 0, 24],
    [52, 0, 22],
    [-14, 0, 44],
  ],
  props: [
    // The long island platform under a high canopy, with the rails lifted in patches.
    ...baseArena({
      trackZ: [17.5, 21.8],
      platformZ: 27.4,
      platformLength: 54,
      missing: 0.35,
      platformEdge: '#f2d23a',
      platformTop: '#9b989e',
      lampStep: 13,
      canopy: { length: 44, height: 3.8, color: '#36455f', roof: '#55668c' },
    }),
    // Pallet staircase at the east end of the platform up onto the canopy roof (top 5.12).
    { kind: 'crate', at: [26, 1, 26.4], size: 1.1 },
    { kind: 'crate', at: [24.7, 1, 26.4], size: 1.1 },
    { kind: 'crate', at: [24.7, 2.1, 26.4], size: 1.0 },
    { kind: 'crate', at: [23.4, 1, 26.4], size: 1.1 },
    { kind: 'crate', at: [23.4, 2.1, 26.4], size: 1.0 },
    { kind: 'crate', at: [23.4, 3.1, 26.4], size: 1.0 },
    { kind: 'bench', at: [-8, 1, 29.6], rot: 0 },
    { kind: 'bench', at: [8, 1, 29.6], rot: 0 },
    { kind: 'bench', at: [-20, 1, 25.2], rot: 0 },

    // The road viaduct: a concrete deck on piers crossing the tracks, with a ramp up at either end.
    { kind: 'ramp', from: [-40, -30], to: [-40, -18], width: 9, h0: 0, h1: 7, color: '#8f8f96' },
    { kind: 'ramp', from: [-40, 42], to: [-40, 30], width: 9, h0: 0, h1: 7, color: '#8f8f96' },
    ...row<Prop>([-40, 6.1, -12], [-40, 6.1, 24], 4, (at) => ({ kind: 'box', at, size: [9, 0.9, 12], color: CONCRETE, top: '#7e7e86' })),
    ...row<Prop>([-40, 0, -16], [-40, 0, 8], 3, (at) => ({ kind: 'box', at, size: [2.6, 6.1, 2.6], color: CONCRETE, top: CONCRETE_TOP })),
    { kind: 'box', at: [-40, 0, 26], size: [2.6, 6.1, 2.6], color: CONCRETE, top: CONCRETE_TOP },
    { kind: 'box', at: [-40, 0, -18.6], size: [10, 6.1, 2.2], color: CONCRETE, top: CONCRETE_TOP },
    { kind: 'box', at: [-40, 0, 30.6], size: [10, 6.1, 2.2], color: CONCRETE, top: CONCRETE_TOP },
    { kind: 'box', at: [-44.3, 7, 6], size: [0.4, 1, 48], color: '#b4b4bc', top: '#c8c8d0' },
    { kind: 'box', at: [-35.7, 7, 6], size: [0.4, 1, 48], color: '#b4b4bc', top: '#c8c8d0' },
    ...row<Prop>([-40, 7, -14], [-40, 7, 26], 8, (at) => ({ kind: 'box', at, size: [0.3, 0.07, 2.4], color: '#e8e4d8' })),
    ...cars([-42, 7, 2], [-42, 7, 10], 2, ['#b23a2e', '#6b6f78']),
    { kind: 'box', at: [-37.8, 7, -6], size: [1.9, 1.25, 4.3], color: '#2f4e7a' },
    { kind: 'box', at: [-37.8, 8.25, -6.2], size: [1.7, 0.6, 2.2], color: '#2f3744', top: '#2f4e7a' },
    { kind: 'lamp', at: [-44.6, 7, -4] },
    { kind: 'lamp', at: [-44.6, 7, 18] },

    // Station building and the entrance canopy over the forecourt.
    { kind: 'hall', at: [0, 0, -34], size: [34, 9, 18], sign: 'ŁÓDŹ WIDZEW' },
    { kind: 'canopy', at: [0, 0, -18], size: [22, 4.5, 8], posts: 4, color: '#4a5260', roof: '#76808f' },
    { kind: 'crate', at: [14.8, 0, -15], size: 1.2 },
    { kind: 'crate', at: [13.5, 0, -15], size: 1.2 },
    { kind: 'crate', at: [13.5, 1.2, -15], size: 1.2 },
    { kind: 'crate', at: [12.2, 0, -15], size: 1.2 },
    { kind: 'crate', at: [12.2, 1.2, -15], size: 1.2 },
    { kind: 'crate', at: [12.2, 2.4, -15], size: 1.2 },
    { kind: 'kiosk', at: [-12, 0, -9], rot: 0.4 },
    { kind: 'bench', at: [-6, 0, -13], rot: 0 },
    { kind: 'bench', at: [6, 0, -13], rot: 0 },
    { kind: 'bench', at: [-18, 0, 6], rot: 0 },
    { kind: 'bench', at: [18, 0, 6], rot: 0 },
    ...lamps(-24, 24, -22, 12),
    ...lamps(-26, 26, 8, 13),

    // Bus loop east of the forecourt: a kerbed island, two shelters and buses waiting for the ZKA run.
    { kind: 'box', at: [40, 0, -12.5], size: [17, 0.22, 0.7], color: CONCRETE, top: CONCRETE_TOP },
    { kind: 'box', at: [40, 0, 0.5], size: [17, 0.22, 0.7], color: CONCRETE, top: CONCRETE_TOP },
    { kind: 'box', at: [31.8, 0, -6], size: [0.7, 0.22, 13], color: CONCRETE, top: CONCRETE_TOP },
    { kind: 'box', at: [48.2, 0, -6], size: [0.7, 0.22, 13], color: CONCRETE, top: CONCRETE_TOP },
    { kind: 'tree', at: [36, 0, -6], h: 6 },
    { kind: 'tree', at: [44, 0, -9], h: 5.5 },
    { kind: 'bush', at: [40, 0, -3], r: 1.3 },
    { kind: 'bush', at: [45, 0, -3], r: 1.1 },
    { kind: 'lamp', at: [40, 0, -6] },
    { kind: 'canopy', at: [38, 0, -19.5], size: [8, 2.6, 3], posts: 2, color: '#4a5260', roof: '#76808f' },
    { kind: 'box', at: [38, 0, -20.8], size: [8, 2.6, 0.2], color: '#5c6472', top: '#76808f' },
    { kind: 'bench', at: [38, 0, -19.9], rot: 0 },
    { kind: 'canopy', at: [42, 0, 7.5], size: [8, 2.6, 3], posts: 2, color: '#4a5260', roof: '#76808f' },
    { kind: 'box', at: [42, 0, 8.8], size: [8, 2.6, 0.2], color: '#5c6472', top: '#76808f' },
    { kind: 'bench', at: [42, 0, 7.9], rot: 0 },
    ...bus(40, -15.6, '#c4442f'),
    ...bus(44, 3.6, '#2f6fa8'),

    // Park and ride: two rows of cars on the far side of the forecourt.
    ...cars([22, 0, -31], [42, 0, -31], 7, ['#b23a2e', '#2f4e7a', '#d8d4cc', '#3a5a40', '#6b6f78', '#c8a23a', '#8a3a5a']),
    ...cars([22, 0, -23.5], [42, 0, -23.5], 7, ['#44586b', '#a8a49c', '#7a2f2f', '#2f6b5a', '#c8c4bc', '#4a3f6b', '#b2652f']),
    { kind: 'box', at: [32, 0, -27.3], size: [24, 0.22, 1.2], color: CONCRETE, top: CONCRETE_TOP },
    { kind: 'bush', at: [24, 0, -27.3], r: 1.1 },
    { kind: 'bush', at: [32, 0, -27.3], r: 1.2 },
    { kind: 'bush', at: [40, 0, -27.3], r: 1.1 },
    { kind: 'box', at: [45.5, 0, -27], size: [0.3, 2.4, 0.3], color: '#4c5566' },
    { kind: 'box', at: [45.5, 2.4, -27], size: [2.6, 0.9, 0.2], color: '#2f6fa8', top: '#4a86bd' },
    ...lamps(-34, -18, 24, 16, 'z'),
    { kind: 'lamp', at: [20, 0, -27] },
    { kind: 'lamp', at: [44, 0, -27] },

    // Blocks of flats on the skyline beyond the fence, windows already lit.
    ...block(-58, -36, 16, 14, 7, 1, 1),
    ...block(-18, -68, 18, 14, 8, 0, 1),
    ...block(24, -64, 14, 14, 6, -1, 1),
    ...block(62, -24, 14, 16, 8, -1, 0),
    ...block(-66, 10, 16, 14, 6, 1, 0),
    ...block(-34, -60, 12, 12, 5, 1, 1),

    // Street trees and the usual scruffy greenery.
    { kind: 'tree', at: [-16, 0, 10], h: 6.5 },
    { kind: 'tree', at: [16, 0, 10], h: 6.5 },
    { kind: 'tree', at: [-28, 0, -6], h: 7 },
    { kind: 'tree', at: [28, 0, 12], h: 6 },
    { kind: 'bush', at: [-14, 0, 6], r: 1.3 },
    { kind: 'bush', at: [14, 0, 6], r: 1.3 },
    { kind: 'bush', at: [-26, 0, 10], r: 1.2 },
    ...scatter(54, 22, 'tree', 1007, [
      [-46, 13, 46, 34],
      [-46, -46, 46, -14],
      [-50, -34, -30, 46],
      [18, -40, 52, 10],
    ]),
    ...scatter(46, 18, 'bush', 2011, [
      [-46, 13, 46, 34],
      [-46, -46, 46, -14],
      [-50, -34, -30, 46],
      [18, -40, 52, 10],
    ]),
  ],
};
