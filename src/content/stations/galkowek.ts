import { baseArena, row, scatter } from './shared';
import type { Prop, StationDef, V3 } from './types';

/** A criss-crossed stack of concrete sleepers; top sits at layers * 0.24 - 0.02. */
function sleepers(x: number, z: number, layers: number, y0 = 0): Prop[] {
  const out: Prop[] = [];
  for (let i = 0; i < layers; i++) {
    const y = y0 + i * 0.24;
    for (let k = 0; k < 5; k++) {
      const o = (k - 2) * 0.36;
      out.push(
        i % 2
          ? { kind: 'box', at: [x + o, y, z], size: [0.3, 0.22, 2.6], color: '#6e6a63', top: '#857f76' }
          : { kind: 'box', at: [x, y, z + o], size: [2.6, 0.22, 0.3], color: '#6e6a63', top: '#857f76' },
      );
    }
  }
  return out;
}

/** A heap of ballast: three steps, so it can also be walked up. Top at 1.65. */
function heap(x: number, z: number, w: number): Prop[] {
  return [0, 1, 2].map(
    (i): Prop => ({ kind: 'box', at: [x, i * 0.55, z], size: [w - i * 1.7, 0.55, w - i * 1.7], color: '#6b6158', top: i === 2 ? '#8e8277' : '#7e746a' }),
  );
}

/** New rails on dunnage, bundled four and three. */
function railBundle(x: number, z: number, len: number, color: string): Prop[] {
  return [
    { kind: 'box', at: [x - len / 2 + 1.4, 0, z], size: [1.2, 0.3, 2.4], color: '#5e5852' },
    { kind: 'box', at: [x + len / 2 - 1.4, 0, z], size: [1.2, 0.3, 2.4], color: '#5e5852' },
    ...row([x, 0.3, z - 0.85], [x, 0.3, z + 0.85], 4, (at: V3): Prop => ({ kind: 'box', at, size: [len, 0.17, 0.15], color, top: '#c6c0b8' })),
    ...row([x, 0.47, z - 0.55], [x, 0.47, z + 0.55], 3, (at: V3): Prop => ({ kind: 'box', at, size: [len - 1, 0.17, 0.15], color, top: '#c6c0b8' })),
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

/** A run of orange plastic barriers fencing off a works segment. */
function barriers(axis: 'x' | 'z', from: number, to: number, at: number, y = 0): Prop[] {
  const n = Math.max(1, Math.round(Math.abs(to - from) / 2.6));
  const out: Prop[] = [];
  for (let i = 0; i < n; i++) {
    const v = from + ((to - from) * (i + 0.5)) / n;
    const lower: V3 = axis === 'x' ? [2.3, 0.62, 0.22] : [0.22, 0.62, 2.3];
    const upper: V3 = axis === 'x' ? [2.3, 0.33, 0.22] : [0.22, 0.33, 2.3];
    const pos: V3 = axis === 'x' ? [v, y, at] : [at, y, v];
    out.push({ kind: 'box', at: pos, size: lower, color: '#cf6418', top: '#e07a26' });
    out.push({ kind: 'box', at: [pos[0], y + 0.62, pos[2]], size: upper, color: '#e4ded2', top: '#f0ebe0' });
  }
  return out;
}

/** Parked excavator: tracks, slewing deck, cab, and a boom that doubles as a walkway. */
function excavator(x: number, z: number): Prop[] {
  return [
    { kind: 'box', at: [x, 0, z - 1.2], size: [4.8, 0.95, 1.1], color: '#2b2f35', top: '#3b414a' },
    { kind: 'box', at: [x, 0, z + 1.2], size: [4.8, 0.95, 1.1], color: '#2b2f35', top: '#3b414a' },
    { kind: 'box', at: [x, 0.95, z], size: [4, 0.55, 3.1], color: '#cf6418', top: '#e07a26' },
    { kind: 'box', at: [x - 1.2, 1.5, z - 0.55], size: [1.8, 1.9, 1.9], color: '#e07a26', top: '#2a2e34' },
    { kind: 'box', at: [x - 2.12, 2.1, z - 0.55], size: [0.12, 0.9, 1.5], color: '#4a5a6c' },
    { kind: 'box', at: [x - 1.9, 1.5, z + 1], size: [1.4, 1.2, 1.1], color: '#2b2f35', top: '#3b414a' },
    { kind: 'ramp', from: [x + 1.2, z], to: [x + 6.4, z], width: 1.1, h0: 1.5, h1: 4.4, color: '#cf6418' },
    { kind: 'ramp', from: [x + 6.4, z], to: [x + 8.6, z], width: 0.85, h0: 4.4, h1: 1.9, color: '#e07a26' },
    { kind: 'box', at: [x + 8.8, 0.9, z], size: [1.4, 1.1, 1.7], color: '#4a4f58', top: '#5c626c' },
    { kind: 'crate', at: [x - 3.6, 0, z + 1.6], size: 1.1 },
  ];
}

/** Parked dumper with the tailgate down: a ramp up into the bed. */
function dumper(x: number, z: number): Prop[] {
  const out: Prop[] = [];
  for (const dx of [-2.2, 2.1]) {
    for (const dz of [-1.3, 1.3]) out.push({ kind: 'box', at: [x + dx, 0, z + dz], size: [1.2, 0.85, 0.6], color: '#24272c' });
  }
  out.push(
    { kind: 'box', at: [x, 0.6, z], size: [6.4, 0.5, 2.6], color: '#3a3f49', top: '#474d58' },
    { kind: 'box', at: [x - 2.1, 1.1, z], size: [2, 1.7, 2.4], color: '#cf6418', top: '#2a2e34' },
    { kind: 'box', at: [x - 3.16, 1.8, z], size: [0.12, 0.8, 1.9], color: '#4a5a6c' },
    { kind: 'box', at: [x + 1.5, 1.1, z], size: [4.4, 0.4, 2.8], color: '#6b4a30', top: '#7d5838' },
    { kind: 'box', at: [x + 1.5, 1.5, z - 1.35], size: [4.4, 0.75, 0.2], color: '#7d5838' },
    { kind: 'box', at: [x + 1.5, 1.5, z + 1.35], size: [4.4, 0.75, 0.2], color: '#7d5838' },
    { kind: 'box', at: [x - 0.8, 1.5, z], size: [0.2, 0.9, 2.8], color: '#7d5838' },
    { kind: 'ramp', from: [x + 3.8, z], to: [x + 7.6, z], width: 2.2, h0: 1.5, h1: 0, color: '#5e4a38' },
  );
  return out;
}

/** The yellow works board at the compound gate, facing the forecourt. */
function worksBoard(x: number, z: number): Prop[] {
  return [
    { kind: 'pipe', at: [x - 1.8, 0, z], r: 0.09, h: 3.2, color: '#6b7078', sides: 8 },
    { kind: 'pipe', at: [x + 1.8, 0, z], r: 0.09, h: 3.2, color: '#6b7078', sides: 8 },
    { kind: 'box', at: [x, 1.3, z], size: [4.2, 2.2, 0.18], color: '#e0b92f', top: '#eccc45' },
    { kind: 'sign', at: [x, 3.15, z + 0.11], size: [3.9, 0.5], text: 'PKP PLK · ZAMKNIĘCIE TOROWE', bg: '#e0b92f', fg: '#1b2030' },
    { kind: 'sign', at: [x, 2.35, z + 0.11], size: [3.9, 0.9], text: 'ROBOTY TOROWE', bg: '#cf6418', fg: '#ffffff' },
    { kind: 'sign', at: [x, 1.65, z + 0.11], size: [3.9, 0.5], text: 'WSTĘP WZBRONIONY', bg: '#e0b92f', fg: '#1b2030' },
  ];
}

/** Cable drums and concrete pipe sections stood on end, the way a works yard stores them. */
function drums(x: number, z: number): Prop[] {
  return [
    { kind: 'pipe', at: [x, 0, z], r: 1.3, h: 1.5, color: '#6b4a30', sides: 12 },
    { kind: 'pipe', at: [x, 1.5, z], r: 1.3, h: 0.14, color: '#5a3e28', sides: 12 },
    { kind: 'pipe', at: [x + 2.9, 0, z - 0.6], r: 1.15, h: 1.4, color: '#7a5838', sides: 12 },
    { kind: 'pipe', at: [x + 2.9, 1.4, z - 0.6], r: 1.15, h: 0.14, color: '#5a3e28', sides: 12 },
  ];
}

/** Gałkówek: a PLK track-works site that never ends — sleepers, ballast, barriers and idle plant. */
export const GALKOWEK: StationDef = {
  id: 'galkowek',
  name: 'Gałkówek',
  // 7/9: last light gone, blue hour over the works — the floodlights carry it from here.
  sky: ['#0c123c', '#292060', '#71375f', '#1c1627'],
  fog: { color: '#4a3348', near: 44, far: 112 },
  sun: { color: '#a3608f', intensity: 1.42, dir: [-0.25, 0.36, 0.55] },
  hemi: { sky: '#a37ca8', ground: '#3f3360', intensity: 1.7 },
  ground: { grass: '#2c3b22', grassDark: '#212e1a', plaza: '#595763', plazaLine: '#45434d', gravel: '#4d4445' },
  radius: 52,
  bins: [
    [-6, 0, 4],
    [8, 0, -6],
    [-16, 0, -18],
    [14.5, 0, -2],
    [-5, 1, 28.4],
    [12, 1, 28.4],
    [28, 0, 9],
    [-30, 0, -10],
    [-40, 0, 4],
    [38, 0, -17],
    [20, 0, 16],
    [-20, 0, 32],
  ],
  coffee: [
    [-9, 1, 28.6],
    [17.8, 0, -4.6],
    [-33.5, 0, -14],
  ],
  chests: [
    [0, 0, 0],
    [-12, 0, 8],
    [10, 0, -14],
    [23.4, 1.5, 9],
    [27.9, 4.4, 2],
    [21, 2.14, -11],
    [0, 4.02, 27.4],
    [-26, 1.65, -3],
    [40, 1.65, 3],
    [-42, 0, -6],
    [34, 0, -12],
    [-16, 0, 34],
    [8, 0, 36],
  ],
  props: [
    // The line itself, half taken up: the platform is fenced off at its east end.
    ...baseArena({ trackZ: [17.5, 21.8], platformZ: 27.4, platformLength: 40, missing: 0.55, platformEdge: '#f2d23a', platformTop: '#7d7a77', lampStep: 10, canopy: { length: 16, height: 2.7, color: '#44391f', roof: '#6a5a2e' } }),
    { kind: 'hall', at: [0, 0, -31], size: [26, 6, 14], sign: 'GAŁKÓWEK' },
    ...barriers('z', 24.6, 30.2, 13.5, 1),
    { kind: 'crate', at: [9.9, 1, 26.2], size: 1.2 },
    { kind: 'crate', at: [8.7, 1, 26.2], size: 1.2 },
    { kind: 'crate', at: [8.7, 2.2, 26.2], size: 1.1 },
    { kind: 'bench', at: [-11, 1, 26.6], rot: 0 },
    ...nameBoard(-14, 1, 25.2, 'GAŁKÓWEK'),
    ...sleepers(17.5, 28.6, 3, 1),
    ...sleepers(17.5, 26.2, 2, 1),
    { kind: 'crate', at: [14, 1, 28.8], size: 1.2 },

    // A third track going in south of the running lines, still mostly bare sleepers.
    { kind: 'tracks', z: [11.6], from: -42, to: 42, missing: 0.85 },
    ...row([-32, 0, 11.6], [32, 0, 11.6], 5, (at: V3): Prop => ({ kind: 'box', at, size: [17, 0.1, 4.6], color: '#6a6158', top: '#7b7168' })),

    // East compound: materials, plant and floodlights behind orange barriers.
    ...barriers('x', 14, 46, -17),
    ...barriers('z', -17, -5, 14),
    ...barriers('z', 1, 11, 14),
    ...barriers('x', 16, 46, 11),
    ...worksBoard(14, -2.6),
    ...sleepers(21, -11, 9),
    ...sleepers(24.5, -11, 5),
    ...sleepers(21, -7, 5),
    ...sleepers(24.5, -7, 6),
    ...railBundle(35, -13.5, 16, '#8a7a68'),
    ...railBundle(35, -9.5, 16, '#7d6a58'),
    ...heap(40, 3, 5.6),
    ...heap(33.5, 5.5, 4.4),
    ...heap(44, -4, 4.8),
    ...drums(19, -2),
    ...drums(18, 7),
    { kind: 'pipe', at: [27, 0, -2.5], r: 0.9, h: 2.2, color: '#8a857c', sides: 12 },
    { kind: 'pipe', at: [29, 0, -3.4], r: 0.9, h: 2.2, color: '#7e7970', sides: 12 },
    { kind: 'pipe', at: [30.4, 0, -1.6], r: 0.9, h: 2.2, color: '#858077', sides: 12 },
    { kind: 'box', at: [12.4, 0, -5.6], size: [2.3, 0.62, 0.22], color: '#cf6418', top: '#e07a26', rot: 0.85 },
    { kind: 'box', at: [12.4, 0.62, -5.6], size: [2.3, 0.33, 0.22], color: '#e4ded2', rot: 0.85 },
    ...excavator(22, 2),
    ...dumper(30, 9),
    { kind: 'lamp', at: [16, 0, -15.5] },
    { kind: 'lamp', at: [44, 0, -15.5] },
    { kind: 'lamp', at: [16, 0, 9.5] },
    { kind: 'lamp', at: [44, 0, 9.5] },
    { kind: 'crate', at: [18, 0, -14], size: 1.2 },
    { kind: 'crate', at: [19.3, 0, -14.4], size: 1 },
    { kind: 'crate', at: [26.5, 0, -15], size: 1.3 },

    // West side: a cable trench dug along the line, spoil heaped on both sides.
    { kind: 'box', at: [-30, 0, -6], size: [30, 0.07, 3.6], color: '#4e3f30', top: '#5e4c3a' },
    ...barriers('x', -45, -15, -9),
    ...barriers('x', -45, -15, -3),
    ...heap(-42, -11.5, 4.4),
    ...heap(-34, -11.5, 4),
    ...heap(-26, -11.5, 4.4),
    ...heap(-38, -0.6, 4),
    ...heap(-30, -0.6, 4.4),
    ...heap(-21, -0.6, 4),
    ...sleepers(-24, -15, 5),
    ...sleepers(-27.5, -15, 7),
    ...railBundle(-36, -15.5, 14, '#8a7a68'),
    { kind: 'lamp', at: [-18, 0, -12] },
    { kind: 'lamp', at: [-38, 0, -13.5] },
    { kind: 'lamp', at: [-24, 0, 2] },
    { kind: 'lamp', at: [-42, 0, 2] },
    { kind: 'crate', at: [-44, 0, -2], size: 1.3 },
    { kind: 'crate', at: [-45.3, 0, -3.2], size: 1.1 },
    { kind: 'box', at: [-36, 0, 4], size: [2.6, 2.4, 2.4], color: '#9aa0aa', top: '#b0b6c0' },
    { kind: 'box', at: [-32.6, 0, 4], size: [2.6, 2.4, 2.4], color: '#8a6b4a', top: '#a07d58' },
    { kind: 'box', at: [-34.3, 2.4, 4], size: [2.6, 2.4, 2.4], color: '#6b7a8a', top: '#808f9e' },

    // Spoil and kit spilling out across the forecourt, plus the mess hut by the station.
    { kind: 'box', at: [-14, 0, -24], size: [6, 2.6, 3], color: '#d8d2c4', top: '#8a8578' },
    { kind: 'box', at: [-14, 2.6, -24], size: [6.4, 0.22, 3.4], color: '#5e5852', top: '#6e685f' },
    { kind: 'ramp', from: [-20.5, -24], to: [-16, -24], width: 2, h0: 0, h1: 2.82, color: '#6b7078' },
    { kind: 'box', at: [-10.4, 0, -24], size: [1.6, 2.2, 2.6], color: '#cf6418', top: '#e07a26' },
    { kind: 'lamp', at: [-18, 0, -20] },
    { kind: 'lamp', at: [12, 0, -20] },
    ...heap(8, -16, 4),
    ...sleepers(-8, -15, 4),
    { kind: 'crate', at: [-4, 0, -17], size: 1.2 },
    { kind: 'bush', at: [-21, 0, 8], r: 1.2 },
    { kind: 'bush', at: [9, 0, -10], r: 1.3 },
    // Clutter spilling across the forecourt: the works have been here for years.
    ...sleepers(-12, 4, 3),
    ...sleepers(-9.5, 4, 4),
    ...heap(13, -9, 4.2),
    ...barriers('z', -13, -5, 10),
    ...barriers('x', -13, -5, 10),
    { kind: 'crate', at: [-7, 0, -9], size: 1.3 },
    { kind: 'crate', at: [-8.4, 0, -10.1], size: 1.1 },
    { kind: 'crate', at: [-7, 1.3, -9], size: 1.1 },

    // The middle of the forecourt is a works compound too: the site cabin with crates up its side,
    // a floodlight mast, more spoil and the pipe sections waiting to go in the trench.
    { kind: 'box', at: [-12, 0, -13], size: [6, 2.6, 4], color: '#d8d2c4', top: '#8a8578' },
    { kind: 'box', at: [-12, 2.6, -13], size: [6.4, 0.22, 4.4], color: '#5e5852', top: '#6e685f' },
    { kind: 'box', at: [-12, 0.5, -11.04], size: [4.4, 1.2, 0.12], color: '#ffd9a0' },
    { kind: 'sign', at: [-12, 2.1, -10.92], size: [4.2, 0.6], text: 'KIEROWNIK ROBÓT', bg: '#cf6418' },
    { kind: 'crate', at: [-7.4, 0, -12.4], size: 1.3 },
    { kind: 'crate', at: [-7.4, 1.3, -12.4], size: 1.2 },
    { kind: 'crate', at: [-8.6, 0, -13.8], size: 1.2 },
    { kind: 'box', at: [4.5, 0, -7], size: [2.4, 2.4, 2.2], color: '#cf6418', top: '#e07a26' },
    { kind: 'box', at: [1.0, 0, -7.6], size: [2.4, 2.4, 2.2], color: '#9aa0aa', top: '#b0b6c0' },
    { kind: 'pipe', at: [-16, 0, 6], r: 0.3, h: 8, color: '#6b7078', sides: 10 },
    { kind: 'box', at: [-16, 8, 6], size: [2.6, 0.3, 0.8], color: '#4a5058', top: '#6b7280' },
    { kind: 'box', at: [-17, 7.3, 6], size: [0.9, 0.7, 0.7], color: '#e8e2cc', top: '#4a5058' },
    { kind: 'box', at: [-15, 7.3, 6], size: [0.9, 0.7, 0.7], color: '#e8e2cc', top: '#4a5058' },
    ...heap(-12, -4, 4.4),
    ...heap(4, -11, 4.2),
    { kind: 'pipe', at: [-4.5, 0, -13.5], r: 1.1, h: 2.0, color: '#8a857c', sides: 12 },
    { kind: 'pipe', at: [-2.2, 0, -14.8], r: 1.1, h: 2.0, color: '#7e7970', sides: 12 },
    ...drums(-6, -20),
    { kind: 'tree', at: [-24, 0, 34], h: 6.5 },
    { kind: 'tree', at: [14, 0, 34], h: 6 },
    { kind: 'tree', at: [-34, 0, -30], h: 7 },
    { kind: 'tree', at: [30, 0, -28], h: 6.5 },
    ...scatter(46, 26, 'tree', 1035, [
      [-48, 13, 48, 33],
      [12, -20, 48, 14],
      [-48, -20, -14, 6],
    ]),
    ...scatter(38, 18, 'bush', 2055, [
      [-48, 13, 48, 33],
      [12, -20, 48, 14],
      [-48, -20, -14, 6],
    ]),
  ],
};
