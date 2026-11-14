import { baseArena, row, scatter } from './shared';
import type { Prop, StationDef, V3 } from './types';

/** A semaphore: mast, head and two or three lamp faces. */
function semaphore(x: number, z: number, lights: string[], h = 5): Prop[] {
  const out: Prop[] = [
    { kind: 'box', at: [x, 0, z], size: [0.9, 0.3, 0.9], color: '#55504a', top: '#656059' },
    { kind: 'pipe', at: [x, 0.3, z], r: 0.13, h, color: '#3c4350', sides: 8 },
    { kind: 'box', at: [x, h - 0.6, z], size: [0.72, 0.5 + lights.length * 0.52, 0.56], color: '#2b3038', top: '#363c46' },
  ];
  lights.forEach((c, i) => {
    out.push({ kind: 'box', at: [x, h - 0.35 + i * 0.52, z + 0.28], size: [0.36, 0.36, 0.1], color: c });
  });
  return out;
}

/** A line of grey relay cabinets along the track. */
function cabinets(x: number, z: number, count: number): Prop[] {
  return row([x, 0, z], [x + (count - 1) * 1.7, 0, z], count, (at: V3, i): Prop => ({
    kind: 'box',
    at,
    size: [1.4, 1.7 + (i % 2) * 0.25, 0.9],
    color: i % 3 === 1 ? '#5c6b5a' : '#6b7078',
    top: '#3a4048',
  }));
}

/** Platform loudspeaker on a mast, horns facing both ways down the platform. */
function speakers(x: number, z: number): Prop[] {
  return [
    { kind: 'pipe', at: [x, 1, z], r: 0.11, h: 4, color: '#4a5260', sides: 8 },
    { kind: 'box', at: [x - 0.45, 4.3, z], size: [0.7, 0.5, 0.5], color: '#9aa0aa', top: '#b0b6c0' },
    { kind: 'box', at: [x + 0.45, 4.3, z], size: [0.7, 0.5, 0.5], color: '#9aa0aa', top: '#b0b6c0' },
  ];
}

/** Ballast under an extra running line, so it does not sit straight on the grass. */
function ballast(z: number, from: number, to: number): Prop[] {
  return row([from, 0, z], [to, 0, z], 5, (at: V3): Prop => ({ kind: 'box', at, size: [(to - from) / 4 + 0.5, 0.1, 4.6], color: '#5e5750', top: '#6d655c' }));
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

/** Concrete cable troughs running beside the rails. */
function troughs(x0: number, x1: number, z: number, count: number): Prop[] {
  return row([x0, 0, z], [x1, 0, z], count, (at: V3): Prop => ({ kind: 'box', at, size: [1.4, 0.32, 0.5], color: '#6e6a63', top: '#827c74' }));
}

/** Żakowice: the junction, at night and all signalling — a lit signal box, semaphores and a footbridge. */
export const ZAKOWICE: StationDef = {
  id: 'zakowice',
  name: 'Żakowice',
  // 8/9: night, with the moon up and the signal lamps doing the rest — kept bright enough to fight in.
  sky: ['#090f34', '#211a58', '#542e62', '#161122'],
  fog: { color: '#362b45', near: 45, far: 116 },
  sun: { color: '#8f6cae', intensity: 1.3, dir: [-0.2, 0.34, 0.6] },
  hemi: { sky: '#9379be', ground: '#393164', intensity: 1.9 },
  ground: { grass: '#26331e', grassDark: '#1d2817', plaza: '#4e4d5b', plazaLine: '#3c3b46', gravel: '#443d40' },
  radius: 54,
  bins: [
    [-5, 0, 7],
    [9, 0, -8],
    [-18, 0, 14],
    [19, 0, 5],
    [-3, 1, 28.4],
    [14.5, 1, 28.4],
    [-30, 0, -4],
    [26, 0, -14],
    [-24, 0, 16],
    [14.2, 0, 3],
    [-12, 0, -22],
    [36, 0, 10],
  ],
  coffee: [
    [-13, 1, 28.6],
    [-23.5, 3.2, 13.2],
    [20, 0, -20],
  ],
  chests: [
    [0, 0, 0],
    [-11, 0, 5],
    [12, 0, -12],
    [-24, 6.2, 8],
    [-21.5, 3.2, 12.8],
    [-8, 5.6, 20],
    [-8, 5.6, 32],
    [0, 4.12, 27.4],
    [-12, 1, 27.4],
    [-38, 0, -8],
    [32, 0, -20],
    [-34, 0, 34],
    [30, 0, 36],
  ],
  props: [
    // Four running lines through the junction, the middle pair stripped for scrap.
    ...baseArena({ trackZ: [17.5, 21.8], platformZ: 27.4, platformLength: 46, missing: 0.6, platformEdge: '#f2d23a', platformTop: '#787674', lampStep: 11, canopy: { length: 12, height: 2.8, color: '#2f3a52', roof: '#4a5674' } }),
    ...ballast(13.4, -36, 36),
    { kind: 'tracks', z: [13.4], from: -36, to: 36, missing: 0.25 },
    ...ballast(33.2, -34, 34),
    ...ballast(37, -30, 30),
    { kind: 'tracks', z: [33.2], from: -34, to: 34, missing: 0.2 },
    { kind: 'tracks', z: [37], from: -30, to: 30, missing: 0.3 },
    { kind: 'hall', at: [6, 0, -32], size: [26, 6, 14], sign: 'ŻAKOWICE' },

    // The signal box: brick below, glazed box above, outside stair to the balcony and crates to the roof.
    { kind: 'box', at: [-24, 0, 8], size: [8, 3.2, 6], color: '#7a5a46', top: '#5e4434' },
    { kind: 'box', at: [-24, 3.2, 8], size: [9, 2.6, 7], color: '#cbc2b2', top: '#a79e90' },
    { kind: 'box', at: [-24, 4.1, 11.56], size: [8.2, 1.5, 0.12], color: '#ffd9a0' },
    { kind: 'box', at: [-24, 4.1, 4.44], size: [8.2, 1.5, 0.12], color: '#ffd9a0' },
    { kind: 'box', at: [-28.56, 4.1, 8], size: [0.12, 1.5, 6.2], color: '#ffd9a0' },
    { kind: 'box', at: [-19.44, 4.1, 8], size: [0.12, 1.5, 6.2], color: '#ffd9a0' },
    ...row([-27.8, 4.1, 11.62], [-20.2, 4.1, 11.62], 6, (at: V3): Prop => ({ kind: 'box', at, size: [0.16, 1.5, 0.08], color: '#4a5260' })),
    { kind: 'box', at: [-24, 5.8, 8], size: [9.8, 0.4, 7.8], color: '#39404e', top: '#48515f' },
    { kind: 'box', at: [-24, 1.1, 11.06], size: [1.1, 2.1, 0.12], color: '#3f3328' },
    { kind: 'box', at: [-24, 2.85, 12.7], size: [9, 0.35, 2.4], color: '#8a8f98', top: '#9aa0aa' },
    { kind: 'box', at: [-28.4, 3.2, 12.7], size: [0.14, 1, 2.4], color: '#4a5260' },
    { kind: 'box', at: [-19.6, 3.2, 12.7], size: [0.14, 1, 2.4], color: '#4a5260' },
    { kind: 'box', at: [-24, 3.2, 13.85], size: [8.8, 1, 0.14], color: '#4a5260' },
    { kind: 'ramp', from: [-21.5, 19], to: [-21.5, 13.6], width: 1.8, h0: 0, h1: 3.2, color: '#8a8f98' },
    { kind: 'crate', at: [-26.5, 3.2, 12.6], size: 1.1 },
    { kind: 'crate', at: [-25.3, 3.2, 12.6], size: 1.1 },
    { kind: 'crate', at: [-25.3, 4.3, 12.6], size: 1 },
    { kind: 'lamp', at: [-30, 0, 13] },
    { kind: 'lamp', at: [-17, 0, 13] },

    // Footbridge over the whole throat: ramp up, deck across four tracks, ramp down on the far side.
    { kind: 'ramp', from: [-8, 2], to: [-8, 13], width: 3, h0: 0, h1: 5.6, color: '#8a8f98' },
    ...row([-8, 5.2, 13.5], [-8, 5.2, 34.5], 6, (at: V3): Prop => ({ kind: 'box', at, size: [3, 0.4, 4.3], color: '#6e737c', top: '#8a8f98' })),
    ...row([-9.43, 5.6, 13.5], [-9.43, 5.6, 34.5], 6, (at: V3): Prop => ({ kind: 'box', at, size: [0.14, 1, 4.3], color: '#4a5260' })),
    ...row([-6.57, 5.6, 13.5], [-6.57, 5.6, 34.5], 6, (at: V3): Prop => ({ kind: 'box', at, size: [0.14, 1, 4.3], color: '#4a5260' })),
    { kind: 'ramp', from: [-8, 36.8], to: [-8, 45], width: 3, h0: 5.6, h1: 0, color: '#8a8f98' },
    { kind: 'pipe', at: [-8, 0, 15.45], r: 0.22, h: 5.2, color: '#5a606a' },
    { kind: 'pipe', at: [-8, 0, 19.65], r: 0.22, h: 5.2, color: '#5a606a' },
    { kind: 'pipe', at: [-8, 0, 30.95], r: 0.22, h: 5.2, color: '#5a606a' },
    { kind: 'pipe', at: [-8, 0, 35.1], r: 0.22, h: 5.2, color: '#5a606a' },
    { kind: 'pipe', at: [-8, 0, 1.64], r: 0.08, h: 3.5, color: '#4a5260', sides: 8 },
    { kind: 'box', at: [-8, 2.6, 1.64], size: [2.8, 0.9, 0.12], color: '#4a5260' },
    { kind: 'sign', at: [-8, 3.05, 1.72], size: [2.6, 0.7], text: 'PERON 2 · KŁADKA', bg: '#0d3b8c' },
    { kind: 'lamp', at: [-11.5, 0, 6] },
    { kind: 'lamp', at: [-11.5, 0, 42] },

    // Semaphores down both ends of the station and between the lines.
    ...semaphore(-32, 15.4, ['#e2463c', '#f2c13a']),
    ...semaphore(-20, 15.4, ['#e2463c', '#4ce07a', '#f2c13a'], 5.6),
    ...semaphore(-13, 15.4, ['#4ce07a']),
    ...semaphore(6, 15.4, ['#e2463c', '#f2c13a']),
    ...semaphore(26, 15.4, ['#e2463c', '#4ce07a'], 5.6),
    ...semaphore(-28, 24.2, ['#4ce07a', '#e2463c'], 4.2),
    ...semaphore(-2, 24.2, ['#e2463c'], 4.2),
    ...semaphore(22, 24.2, ['#f2c13a', '#e2463c'], 4.2),
    ...semaphore(-30, 31.4, ['#e2463c', '#4ce07a']),
    ...semaphore(0, 31.4, ['#4ce07a', '#f2c13a']),
    ...semaphore(28, 31.4, ['#e2463c']),
    ...semaphore(-36, 11.4, ['#e2463c', '#f2c13a'], 5.6),
    ...semaphore(34, 11.4, ['#4ce07a', '#e2463c'], 5.6),

    // Relay cabinets and cable troughs: the station's wiring, all above ground.
    ...cabinets(-34, 9.6, 5),
    ...cabinets(20, 9.6, 6),
    ...cabinets(-16, 40.5, 4),
    ...cabinets(-12, 40.5, 5),
    ...troughs(-40, 40, 10.8, 24),
    ...troughs(-30, 30, 39.6, 18),
    { kind: 'box', at: [-14, 0, 6.6], size: [3.4, 2.6, 2.4], color: '#7e8490', top: '#3a4048' },
    { kind: 'box', at: [-14, 2.6, 6.6], size: [3.8, 0.2, 2.8], color: '#4a5260' },
    { kind: 'box', at: [36, 0, 6.6], size: [3, 2.4, 2.2], color: '#6b7078', top: '#3a4048' },

    // Platform: loudspeakers, benches, a crate step onto the canopy roof (4.12).
    ...speakers(-13, 29.2),
    ...speakers(13, 29.2),
    ...speakers(22, 29.2),
    { kind: 'bench', at: [-6, 1, 26.6], rot: 0 },
    { kind: 'bench', at: [2, 1, 26.6], rot: 0 },
    ...nameBoard(-12, 1, 25.2, 'ŻAKOWICE'),
    { kind: 'kiosk', at: [11, 1, 27.4], rot: 0 },
    { kind: 'crate', at: [8.2, 1, 26.2], size: 1.2 },
    { kind: 'crate', at: [7, 1, 26.2], size: 1.2 },
    { kind: 'crate', at: [7, 2.2, 26.2], size: 1.1 },

    // Forecourt: the old lamp row, a few cabinets and the bus shelter by the station.
    { kind: 'canopy', at: [-10, 0, -18], size: [7, 2.4, 3], posts: 3, color: '#3b4452', roof: '#5a6476' },
    { kind: 'bench', at: [-10, 0, -18.8], rot: 0 },
    { kind: 'lamp', at: [-26, 0, -14] },
    { kind: 'lamp', at: [-4, 0, -14] },
    { kind: 'lamp', at: [26, 0, -14] },
    { kind: 'lamp', at: [-30, 0, 2] },
    { kind: 'lamp', at: [30, 0, 2] },
    { kind: 'bench', at: [14, 0, -20], rot: 0 },
    { kind: 'bench', at: [20, 0, -20], rot: 0 },
    ...row([-26, 0, -20.5], [-21, 0, -20.5], 4, (at: V3): Prop => ({ kind: 'box', at, size: [0.1, 0.8, 1.6], color: '#6b7078' })),
    { kind: 'box', at: [28, 0, -8], size: [2.2, 2.2, 2], color: '#5c6b5a', top: '#3a4048' },
    { kind: 'box', at: [30.6, 0, -8], size: [2.2, 2.2, 2], color: '#6b7078', top: '#3a4048' },
    { kind: 'bush', at: [-20, 0, -6], r: 1.3 },
    { kind: 'bush', at: [22, 0, -4], r: 1.2 },
    { kind: 'bush', at: [-8, 0, -24], r: 1.4 },

    // The middle of the forecourt: the relay room and the old brick cabin, cable drums, a ground frame
    // and two more semaphores — cover to fight round, and two flat roofs to get onto.
    { kind: 'box', at: [9, 0, -4], size: [5.5, 2.8, 4], color: '#7e8490', top: '#3a4048' },
    { kind: 'box', at: [9, 2.8, -4], size: [5.9, 0.25, 4.4], color: '#4a5260', top: '#5a6476' },
    { kind: 'box', at: [9, 0.7, -2.04], size: [3.8, 1.2, 0.12], color: '#ffd9a0' },
    { kind: 'sign', at: [9, 2.25, -1.92], size: [4, 0.6], text: 'PKP PLK · ZAKAZ WSTĘPU', bg: '#8a2f2f' },
    { kind: 'crate', at: [5.4, 0, -5.4], size: 1.3 },
    { kind: 'crate', at: [5.4, 1.3, -5.4], size: 1.2 },
    { kind: 'crate', at: [6.5, 0, -4.1], size: 1.2 },
    { kind: 'box', at: [-20, 0, -12], size: [7, 2.6, 5], color: '#7a5a46', top: '#5e4434' },
    { kind: 'box', at: [-20, 2.6, -12], size: [7.4, 0.3, 5.4], color: '#4a5260', top: '#5a6476' },
    { kind: 'box', at: [-20, 0, -9.56], size: [1.2, 2.1, 0.12], color: '#3f3328' },
    { kind: 'crate', at: [-15.6, 0, -12], size: 1.3 },
    { kind: 'crate', at: [-15.6, 1.3, -12], size: 1.2 },
    { kind: 'pipe', at: [-9, 0, -5], r: 1.3, h: 1.5, color: '#6b4a30', sides: 12 },
    { kind: 'pipe', at: [-9, 1.5, -5], r: 1.3, h: 0.14, color: '#5a3e28', sides: 12 },
    { kind: 'pipe', at: [-12, 0, -6.4], r: 1.15, h: 1.4, color: '#7a5838', sides: 12 },
    { kind: 'box', at: [5, 0, 6], size: [3.4, 0.9, 1.2], color: '#55504a', top: '#656059' },
    ...row([3.8, 0.9, 6], [6.2, 0.9, 6], 4, (at: V3): Prop => ({ kind: 'box', at, size: [0.14, 1.1, 0.2], color: '#8a3f3f', top: '#a04e4e' })),
    ...semaphore(16, 2, ['#e2463c', '#f2c13a'], 5.6),
    ...semaphore(-16, 2, ['#4ce07a']),
    { kind: 'tree', at: [-34, 0, -20], h: 6.5 },
    { kind: 'tree', at: [34, 0, -26], h: 7 },
    { kind: 'tree', at: [-40, 0, 2], h: 6 },
    { kind: 'tree', at: [42, 0, 0], h: 6.5 },
    ...scatter(48, 26, 'tree', 1042, [
      [-48, 8, 48, 44],
      [-34, -40, 34, -22],
    ]),
    ...scatter(40, 18, 'bush', 2066, [
      [-48, 8, 48, 44],
      [-34, -40, 34, -22],
    ]),
  ],
};
