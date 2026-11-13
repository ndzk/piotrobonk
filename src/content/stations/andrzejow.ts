import { baseArena, lamps, row, scatter, seeded } from './shared';
import type { Prop, StationDef } from './types';

const STEEL = '#5c636d';
const STEEL_TOP = '#767f8a';
const RUST = '#8a4a32';

/** A heap of scrap: boxes of junk tumbled into a mound. */
function heap(x: number, z: number, seed: number, n = 7, spread = 2.6): Prop[] {
  const rnd = seeded(seed);
  const colors = ['#6b4a3a', '#7a7066', '#8a5a3a', '#55606b', '#9a4a3a', '#5e564e', '#7d6a4a'];
  const out: Prop[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const s = 1.5 - t * 0.7;
    const r = spread * (1 - t);
    out.push({
      kind: 'box',
      at: [x + (rnd() - 0.5) * r * 2, t * 1.9, z + (rnd() - 0.5) * r * 2],
      size: [s + rnd() * 0.9, 0.5 + rnd() * 0.7, s + rnd() * 0.9],
      color: colors[Math.floor(rnd() * colors.length)] ?? RUST,
      top: '#8d8378',
    });
  }
  return out;
}

/** A shipping container: ribbed box with a darker door end. */
function container(x: number, y: number, z: number, color: string, alongZ = false): Prop[] {
  const [w, d] = alongZ ? [2.9, 12] : [12, 2.9];
  const out: Prop[] = [
    { kind: 'box', at: [x, y, z], size: [w, 2.6, d], color, top: '#6f6a62' },
    { kind: 'box', at: [x, y + 2.6, z], size: [w - 0.3, 0.14, d - 0.3], color: '#5b564f' },
  ];
  // Corrugation: a few proud ribs down the long side, and the dark doors at one end.
  for (let i = 0; i < 5; i++) {
    const o = (i - 2) * 2.1;
    if (alongZ) out.push({ kind: 'box', at: [x + 1.47, y + 0.2, z + o], size: [0.12, 2.2, 0.7], color, top: '#4a453f' });
    else out.push({ kind: 'box', at: [x + o, y + 0.2, z + 1.47], size: [0.7, 2.2, 0.12], color, top: '#4a453f' });
  }
  const doors: Prop = alongZ
    ? { kind: 'box', at: [x, y + 0.15, z - 6.1], size: [2.7, 2.3, 0.2], color: '#4a4039', top: '#5b5048' }
    : { kind: 'box', at: [x - 6.1, y + 0.15, z], size: [0.2, 2.3, 2.7], color: '#4a4039', top: '#5b5048' };
  out.push(doors);
  return out;
}

/** Yard hoarding: corrugated sheet between the fence posts, so the scrapyard keeps its secrets. */
function hoarding(x0: number, z0: number, x1: number, z1: number): Prop[] {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const out: Prop[] = [
    { kind: 'fence', from: [x0, z0], to: [x1, z1], h: 3.2, color: STEEL },
    { kind: 'box', at: [(x0 + x1) / 2, 0.25, (z0 + z1) / 2], size: alongX ? [len, 2.5, 0.3] : [0.3, 2.5, len], color: '#6a7068', top: '#8a9289' },
  ];
  for (let i = 1; i * 4 < len; i++) {
    const t = (i * 4) / len;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    out.push({ kind: 'box', at: [x, 0.25, z], size: alongX ? [0.25, 2.5, 0.42] : [0.42, 2.5, 0.25], color: '#555b54', top: '#8a9289' });
  }
  return out;
}

/** Stolen rails stacked in a bundle, ready for the smelter. */
function railBundle(x: number, z: number): Prop[] {
  const out: Prop[] = [];
  for (let i = 0; i < 3; i++) out.push({ kind: 'box', at: [x, 0, z + (i - 1) * 1.45], size: [13, 0.3, 1.3], color: '#7a4530', top: '#8f8a82' });
  for (let i = 0; i < 2; i++) out.push({ kind: 'box', at: [x, 0.3, z + (i - 0.5) * 1.45], size: [13, 0.3, 1.3], color: '#7a4530', top: '#8f8a82' });
  out.push({ kind: 'box', at: [x, 0.6, z], size: [13, 0.3, 1.3], color: '#7a4530', top: '#8f8a82' });
  return out;
}

/** Cubes of crushed metal, baled and stacked against the fence. */
function bales(x: number, z: number, cols: number, rows: number, seed: number): Prop[] {
  const rnd = seeded(seed);
  const colors = ['#8a4a32', '#6b6f78', '#7a5a3a', '#4f5a66'];
  const out: Prop[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      out.push({ kind: 'box', at: [x + c * 1.5, r * 1.4, z + (rnd() - 0.5) * 0.3], size: [1.4, 1.4, 1.4], color: colors[Math.floor(rnd() * colors.length)] ?? RUST, top: '#9a948c' });
    }
  }
  return out;
}

export const ANDRZEJOW: StationDef = {
  id: 'andrzejow',
  name: 'Łódź Andrzejów',
  sky: ['#161c48', '#4a3a74', '#c76a58', '#2f2436'],
  fog: { color: '#99615a', near: 30, far: 98 },
  sun: { color: '#f58f67', intensity: 1.9, dir: [-0.4, 0.42, 0.4] },
  hemi: { sky: '#e4b3a2', ground: '#574c66', intensity: 1.45 },
  ground: { grass: '#44572f', grassDark: '#334226', plaza: '#7e7a72', plazaLine: '#655f59', gravel: '#6f645a' },
  radius: 56,
  bins: [
    [-10, 0, -14],
    [10, 0, -14],
    [-20, 0, 4],
    [16, 0, 8],
    [-3, 0, 12],
    [6, 1, 26],
    [-12, 1, 29],
    [-28, 0, -8],
    [26, 0, -20],
    [41, 0, 6],
    [23, 0, -4],
    [-38, 0, 8],
    [36, 5.2, -16],
  ],
  coffee: [
    [-9, 0, -17.5],
    [-4, 1, 29],
    [31, 5.2, -16],
  ],
  chests: [
    [0, 0, 0],
    [-18, 0, -10],
    [-30, 0, 10],
    [18, 10.8, -8],
    [38, 5.2, -16],
    [8, 4.22, 27.4],
    [-15, 1, 27.4],
    [16, 1, 27.4],
    [41, 0, -20],
    [36, 0, 8],
    [-42, 0, -8],
    [-46, 0, 10],
    [16, 0, 6],
    [-8, 0, 42],
  ],
  props: [
    // A bare halt: short canopy, and the rails beside it half gone — this is where they ended up.
    ...baseArena({
      trackZ: [17.5, 21.8],
      platformZ: 27.4,
      platformLength: 38,
      missing: 0.4,
      platformEdge: '#d8c24a',
      platformTop: '#8b857e',
      lampStep: 12,
      canopy: { length: 18, height: 2.9, color: '#4a4036', roof: '#6b5a48' },
    }),
    { kind: 'crate', at: [12, 1, 26.2], size: 1.1 },
    { kind: 'crate', at: [10.7, 1, 26.3], size: 1.1 },
    { kind: 'crate', at: [10.7, 2.1, 26.3], size: 1.0 },
    { kind: 'bench', at: [-6, 1, 29.6], rot: 0 },
    ...railBundle(-24, 14.5),

    // Skup złomu Bartka D.: a tall hoarding with a gate wide enough for a lorry full of rail.
    ...hoarding(12, -22, 46, -22),
    ...hoarding(46, -22, 46, -1),
    ...hoarding(46, 5, 46, 10),
    ...hoarding(12, 10, 30, 10),
    ...hoarding(38, 10, 46, 10),
    ...hoarding(12, -22, 12, -14),
    ...hoarding(12, 2, 12, 10),
    { kind: 'box', at: [12, 0, -14], size: [0.7, 4.4, 0.7], color: STEEL, top: STEEL_TOP },
    { kind: 'box', at: [12, 0, 2], size: [0.7, 4.4, 0.7], color: STEEL, top: STEEL_TOP },
    { kind: 'box', at: [12, 4.4, -6], size: [0.7, 0.5, 16.7], color: STEEL, top: STEEL_TOP },
    { kind: 'box', at: [12.6, 0, 4.2], size: [0.25, 2.8, 3.6], color: '#7a6a3a', top: '#9a8a4a' },
    { kind: 'box', at: [46, 0, -1], size: [0.7, 4, 0.7], color: STEEL, top: STEEL_TOP },
    { kind: 'box', at: [46, 0, 5], size: [0.7, 4, 0.7], color: STEEL, top: STEEL_TOP },

    // Containers stacked two high, with a pile of pallets to climb them.
    ...container(34, 0, -16, '#2f5f7a'),
    ...container(34, 2.6, -16, '#9a4433'),
    ...container(38, 0, -6, '#3f6b4a'),
    ...container(44, 0, -13, '#7a6a3a', true),
    ...row<Prop>([24.2, 0, -16], [24.2, 3.6, -16], 4, (at) => ({ kind: 'crate', at, size: 1.2 })),
    ...row<Prop>([25.4, 0, -16], [25.4, 2.4, -16], 3, (at) => ({ kind: 'crate', at, size: 1.2 })),
    ...row<Prop>([26.6, 0, -16], [26.6, 1.2, -16], 2, (at) => ({ kind: 'crate', at, size: 1.2 })),
    { kind: 'crate', at: [27.8, 0, -16], size: 1.2 },

    // The crane: a yellow tower and a boom you can walk up from the containers.
    { kind: 'box', at: [18, 0, -8], size: [4.6, 1.2, 4.6], color: STEEL, top: '#4a5058' },
    { kind: 'box', at: [18, 1.2, -8], size: [3.4, 9, 3.4], color: '#c8a23a', top: '#8a6f28' },
    { kind: 'box', at: [18, 1.2, -9.75], size: [3.6, 9, 0.3], color: '#8a6f28', top: '#8a6f28' },
    { kind: 'box', at: [18, 1.2, -6.25], size: [3.6, 9, 0.3], color: '#8a6f28', top: '#8a6f28' },
    { kind: 'box', at: [18, 5.4, -8], size: [3.8, 0.4, 3.8], color: '#8a6f28', top: '#8a6f28' },
    { kind: 'box', at: [18, 10.2, -8], size: [4, 0.6, 4], color: '#4a5058', top: '#6b7280' },
    { kind: 'box', at: [15.2, 6.4, -8], size: [2.2, 1.8, 2.4], color: '#3c4450', top: '#6b7280' },
    { kind: 'box', at: [14.2, 8.2, -8], size: [2.6, 1.6, 2.8], color: '#4a5058', top: '#6b7280' },
    { kind: 'ramp', from: [29.5, -16], to: [20.6, -8.6], width: 1.9, h0: 5.2, h1: 10.8, color: '#b08f32' },
    { kind: 'box', at: [24.8, 4.6, -12.4], size: [0.4, 0.5, 0.4], color: '#4a5058' },

    // Heaps of scrap, bales of crushed metal and bundles of stolen rail.
    ...heap(20, -19, 4001),
    ...heap(30, 6, 4002, 8, 3),
    ...heap(41, -4, 4003),
    ...heap(16, -2, 4004, 6, 2.2),
    ...heap(-26, -16, 4005, 5, 2),
    ...bales(31, -21, 4, 2, 5001),
    ...bales(42, 1.5, 3, 2, 5002),
    ...railBundle(22, -11),
    ...railBundle(36, -1),
    ...railBundle(26, 7),

    // Weighbridge on the yard road, with the weighman's hut beside it.
    { kind: 'box', at: [38, 0, 2], size: [9, 0.3, 5.5], color: '#6f747c', top: '#929aa4' },
    { kind: 'box', at: [38, 0, -1], size: [9, 0.45, 0.35], color: '#c8a23a', top: '#e0bb4a' },
    { kind: 'box', at: [38, 0, 5], size: [9, 0.45, 0.35], color: '#c8a23a', top: '#e0bb4a' },
    { kind: 'shed', at: [44.5, 0, 7.5], size: [3.4, 2.6, 3], color: '#8a8070', roof: '#4b3a33' },
    { kind: 'lamp', at: [33, 0, 4] },
    { kind: 'lamp', at: [44, 0, -8] },
    { kind: 'lamp', at: [20, 0, -20] },

    // The halt building and its scruffy forecourt.
    { kind: 'hall', at: [0, 0, -30], size: [24, 5.5, 11], sign: 'ŁÓDŹ ANDRZEJÓW' },
    { kind: 'kiosk', at: [-11, 0, -8], rot: -0.3 },
    { kind: 'bench', at: [-6, 0, -16], rot: 0 },
    { kind: 'bench', at: [6, 0, -16], rot: 0 },
    { kind: 'shed', at: [-26, 0, -4], size: [3.2, 2.4, 2.8], color: '#7c8c5a', roof: '#4b3a33' },
    { kind: 'shed', at: [-33, 0, 4], size: [3, 2.3, 2.6], color: '#8a6b4a', roof: '#3f3a3a' },
    { kind: 'fence', from: [-42, -12], to: [-22, -12], h: 1.1, color: '#7a6a55' },
    { kind: 'fence', from: [-42, 12], to: [-22, 12], h: 1.1, color: '#7a6a55' },
    { kind: 'fence', from: [-42, -12], to: [-42, 12], h: 1.1, color: '#7a6a55' },
    ...lamps(-20, 20, -18, 13),
    ...lamps(-26, 2, 10, 14),
    { kind: 'crate', at: [-14, 0, 6], size: 1.2 },
    { kind: 'crate', at: [-12.9, 0, 6.4], size: 1.0 },

    // Weeds and birches taking the rest back.
    { kind: 'tree', at: [-16, 0, 12], h: 6.5 },
    { kind: 'tree', at: [5, 0, 13], h: 6 },
    { kind: 'tree', at: [-30, 0, -18], h: 7 },
    { kind: 'bush', at: [-9, 0, 8], r: 1.3 },
    { kind: 'bush', at: [13, 0, -10], r: 1.1 },
    { kind: 'bush', at: [-20, 0, -6], r: 1.2 },
    { kind: 'bush', at: [24, 0, 12], r: 1.4 },
    ...scatter(48, 26, 'tree', 1014, [
      [-42, 13, 42, 34],
      [-30, -40, 30, -18],
      [10, -24, 50, 12],
    ]),
    ...scatter(40, 22, 'bush', 2022, [
      [-42, 13, 42, 34],
      [10, -24, 50, 12],
    ]),
  ],
};
