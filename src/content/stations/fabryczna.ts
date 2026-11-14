import type { Prop, StationDef } from './types';

/** Props scattered on a ring around the arena, skipping the tracks and the buildings. */
function ring(radius: number, count: number, kind: 'tree' | 'bush', jitter: number): Prop[] {
  const out: Prop[] = [];
  let seed = radius * 7919 + count;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const a = ((i + rnd() * jitter) / count) * Math.PI * 2;
    const r = radius + (rnd() - 0.5) * 5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (z > 13 && z < 32) continue;
    if (x > -30 && x < 30 && z < -18) continue;
    if (x > 25 && x < 55 && z > -12 && z < 6) continue;
    out.push(kind === 'tree' ? { kind: 'tree', at: [x, 0, z], h: 5 + rnd() * 3 } : { kind: 'bush', at: [x, 0, z], r: 0.8 + rnd() * 0.8 });
  }
  return out;
}

const lampRow = (x0: number, x1: number, z: number, step: number): Prop[] => {
  const out: Prop[] = [];
  for (let x = x0; x <= x1; x += step) out.push({ kind: 'lamp', at: [x, 0, z] });
  return out;
};

export const FABRYCZNA: StationDef = {
  id: 'fabryczna',
  name: 'Łódź Fabryczna',
  // 1/9 on the line: the sun is still a hand above the roofs. Each station west to east takes one step
  // down into the night, ending at Koluszki.
  sky: ['#1b2150', '#5a3f78', '#f08a55', '#3b2a3a'],
  fog: { color: '#c7735e', near: 46, far: 126 },
  sun: { color: '#ffb47a', intensity: 2.3, dir: [-0.55, 0.42, 0.35] },
  hemi: { sky: '#ffd2b4', ground: '#6b5a72', intensity: 1.6 },
  ground: { grass: '#566b3a', grassDark: '#3f5230', plaza: '#8b8a8f', plazaLine: '#6f6e74', gravel: '#7a6d64' },
  radius: 60,
  bins: [
    [-14, 0, -18],
    [14, 0, -18],
    [-4, 0, 9],
    [6, 0, -9],
    [-22, 0, 3],
    [22, 0, 2],
    [-16, 0, 26],
    [16, 1, 26.6],
    [36, 0, 6],
    [-40, 0, -9],
    [-46, 0, 10],
    [8, 0, 44],
    [-30, 0, 36],
    [44, 0, -16],
  ],
  coffee: [
    [-6, 0, -21.6],
    [20, 1, 28.8],
    [-34, 0, -10],
  ],
  chests: [
    [0, 0, 0],
    [-24, 0, -10],
    [24, 0, 10],
    [-10, 0, 40],
    [30, 0, 44],
    [-46, 0, 0],
    [46, 0, -24],
    [26.6, 3.2, -26],
    [41, 2.6, -6],
    [-20, 1, 27.4],
    [0, 4.32, 27.4],
    [-40, 0, 26],
  ],
  props: [
    // Line 17 with the rails stolen in places; the island platform with a canopy and ramps.
    { kind: 'tracks', z: [17.5, 21.8], from: -60, to: 60, missing: 0.45 },
    { kind: 'platform', at: [0, 0, 27.4], size: [58, 1, 5.8], edge: '#f2d23a', top: '#9b989e' },
    { kind: 'ramp', from: [-34, 27.4], to: [-29, 27.4], width: 5.8, h0: 0, h1: 1, color: '#8d8a90' },
    { kind: 'ramp', from: [34, 27.4], to: [29, 27.4], width: 5.8, h0: 0, h1: 1, color: '#8d8a90' },
    { kind: 'canopy', at: [0, 1, 27.4], size: [46, 3.0, 5], posts: 8, color: '#3b4b6b', roof: '#5a6b8f' },
    // Crate steps up to the canopy roof at its east end.
    { kind: 'crate', at: [25.6, 1, 25.9], size: 1.1 },
    { kind: 'crate', at: [24.2, 1, 25.9], size: 1.1 },
    { kind: 'crate', at: [24.2, 2.1, 25.9], size: 1.0 },
    ...lampRow(-24, 24, 29.6, 12),

    // The new Fabryczna hall: glass front with the big sign, steps to the roof terrace at the side.
    { kind: 'hall', at: [0, 0, -34], size: [48, 8, 20], sign: 'ŁÓDŹ FABRYCZNA' },
    { kind: 'ramp', from: [26.6, -40], to: [26.6, -27.5], width: 4, h0: 0, h1: 3.2, color: '#a6a3a8' },
    { kind: 'box', at: [26.6, 0, -26], size: [4, 3.2, 3], color: '#8f8c92', top: '#a6a3a8' },
    { kind: 'ramp', from: [26.6, -24.5], to: [26.6, -19], width: 4, h0: 3.2, h1: 0, color: '#a6a3a8' },
    ...lampRow(-20, 20, -19, 10),
    { kind: 'bench', at: [-12, 0, -20.5], rot: 0 },
    { kind: 'bench', at: [12, 0, -20.5], rot: 0 },
    { kind: 'kiosk', at: [-9, 0, -6], rot: 0.35 },

    // The middle of the forecourt: the lift pavilion down to the platforms, with a ramp onto its roof.
    { kind: 'box', at: [-15, 0, 5], size: [6, 3, 5], color: '#8f8c92', top: '#a6a3a8' },
    { kind: 'box', at: [-15, 0.7, 7.56], size: [5, 1.7, 0.12], color: '#ffd29a' },
    { kind: 'box', at: [-15, 3, 5], size: [6.6, 0.3, 5.6], color: '#6f6c72', top: '#a6a3a8' },
    { kind: 'sign', at: [-15, 1.6, 2.42], size: [4.4, 0.9], text: 'PERONY 1–4 ↓', rot: Math.PI, bg: '#0d3b8c' },
    { kind: 'ramp', from: [-15, 14], to: [-15, 7.6], width: 3, h0: 0, h1: 3, color: '#a6a3a8' },
    // Its twin on the east side: the vent head, climbed by the pallets left against it.
    { kind: 'box', at: [15, 0, 3], size: [5, 2.4, 4.6], color: '#8f8c92', top: '#a6a3a8' },
    { kind: 'box', at: [15, 2.4, 3], size: [5.4, 0.3, 5], color: '#6f6c72', top: '#a6a3a8' },
    { kind: 'box', at: [15, 0.6, 5.36], size: [3.6, 1.2, 0.12], color: '#ffd29a' },
    { kind: 'crate', at: [11.6, 0, 3], size: 1.2 },
    { kind: 'crate', at: [11.6, 1.2, 3], size: 1.1 },
    { kind: 'crate', at: [10.4, 0, 3.5], size: 1.2 },
    // The dry fountain nobody has filled since the line closed.
    { kind: 'pipe', at: [9, 0, -14], r: 3.4, h: 0.72, color: '#9b989e', sides: 16 },
    { kind: 'pipe', at: [9, 0.72, -14], r: 2.9, h: 0.12, color: '#6b6a70', sides: 16 },
    { kind: 'pipe', at: [9, 0.72, -14], r: 1.0, h: 1.5, color: '#a6a3a8', sides: 12 },
    { kind: 'pipe', at: [9, 2.22, -14], r: 1.6, h: 0.22, color: '#8f8c92', sides: 12 },
    // Concrete planters: low enough to vault, tall enough to break a line of fire.
    { kind: 'box', at: [-7, 0, -15], size: [3.4, 0.8, 3.4], color: '#8f8c92', top: '#5b4733' },
    { kind: 'tree', at: [-7, 0.8, -15], h: 5.5 },
    { kind: 'box', at: [3, 0, 10], size: [3, 0.8, 3], color: '#8f8c92', top: '#5b4733' },
    { kind: 'bush', at: [3, 0.8, 10], r: 1.3 },
    { kind: 'box', at: [21, 0, -6], size: [3, 0.8, 3], color: '#8f8c92', top: '#5b4733' },
    { kind: 'tree', at: [21, 0.8, -6], h: 5 },
    { kind: 'box', at: [-22, 0, -5], size: [3, 0.8, 3], color: '#8f8c92', top: '#5b4733' },
    { kind: 'bush', at: [-22, 0.8, -5], r: 1.3 },
    // The departures board on the plaza, and the bollard line along the taxi lane.
    { kind: 'pipe', at: [-3, 0, 12.4], r: 0.09, h: 2.6, color: '#4c5566', sides: 8 },
    { kind: 'pipe', at: [1.6, 0, 12.4], r: 0.09, h: 2.6, color: '#4c5566', sides: 8 },
    { kind: 'box', at: [-0.7, 1.1, 12.4], size: [5.2, 1.5, 0.16], color: '#2f3744', top: '#4c5566' },
    { kind: 'sign', at: [-0.7, 1.85, 12.3], size: [4.9, 1.2], text: 'ODJAZDY · LINIA 17', rot: Math.PI, bg: '#0d3b8c' },
    { kind: 'pipe', at: [-2, 0, -10], r: 0.22, h: 0.95, color: '#4c5566', sides: 8 },
    { kind: 'pipe', at: [1, 0, -10.4], r: 0.22, h: 0.95, color: '#4c5566', sides: 8 },
    { kind: 'pipe', at: [4, 0, -10.8], r: 0.22, h: 0.95, color: '#4c5566', sides: 8 },
    { kind: 'pipe', at: [-5, 0, -9.6], r: 0.22, h: 0.95, color: '#4c5566', sides: 8 },
    { kind: 'crate', at: [-7, 0, 3.5], size: 1.3 },
    { kind: 'crate', at: [-8.2, 0, 4.2], size: 1.1 },

    // Garages east of the plaza with a plank ramp onto the flat roofs.
    { kind: 'garages', at: [41, 0, -6], count: 6, size: [4, 2.6, 6], doors: ['#6e7f8a', '#8a5a3b', '#4f6b52', '#8a8d93', '#7a3b3b', '#5b6c8a'] },
    { kind: 'ramp', from: [24.5, -6], to: [29, -6], width: 2.4, h0: 0, h1: 2.6, color: '#7b5a3a' },
    { kind: 'crate', at: [33, 0, 4.2], size: 1.2 },
    { kind: 'crate', at: [34.3, 0, 4.6], size: 1.0 },

    // Allotments (działki) to the west: sheds, low fences, bushes.
    { kind: 'shed', at: [-42, 0, -4], size: [3.2, 2.4, 2.6], color: '#7c8c5a', roof: '#4b3a33' },
    { kind: 'shed', at: [-36, 0, 6], size: [2.8, 2.2, 2.4], color: '#8a6b4a', roof: '#3f3a3a' },
    { kind: 'shed', at: [-47, 0, 8], size: [2.6, 2.3, 2.6], color: '#5a7a8c', roof: '#4b3a33' },
    { kind: 'fence', from: [-52, -12], to: [-30, -12], h: 1, color: '#7a6a55' },
    { kind: 'fence', from: [-30, -12], to: [-30, 12], h: 1, color: '#7a6a55' },
    { kind: 'fence', from: [-52, 12], to: [-30, 12], h: 1, color: '#7a6a55' },
    { kind: 'bush', at: [-38, 0, -8], r: 1.3 },
    { kind: 'bush', at: [-44, 0, 2], r: 1.1 },
    { kind: 'bush', at: [-33, 0, -1], r: 1.0 },
    { kind: 'bush', at: [-48, 0, -7], r: 1.4 },
    { kind: 'tree', at: [-40, 0, 1], h: 6 },
    { kind: 'tree', at: [-50, 0, -2], h: 7 },

    // Greenery around the plaza.
    { kind: 'bush', at: [14, 0, 8], r: 1.2 },
    { kind: 'bush', at: [-21, 0, 11], r: 1.4 },
    { kind: 'bush', at: [20, 0, -14], r: 1.1 },
    { kind: 'bush', at: [-22, 0, -14], r: 1.2 },
    { kind: 'tree', at: [18, 0, 11], h: 6.5 },
    { kind: 'tree', at: [-24, 0, 12], h: 7 },
    { kind: 'tree', at: [44, 0, 14], h: 6 },
    { kind: 'tree', at: [-6, 0, 44], h: 7 },
    { kind: 'tree', at: [30, 0, 46], h: 6 },
    { kind: 'tree', at: [-34, 0, 40], h: 6.5 },
    { kind: 'bush', at: [8, 0, 40], r: 1.5 },
    { kind: 'bush', at: [-20, 0, 36], r: 1.2 },
    ...lampRow(-27, 27, 6, 18),
    ...ring(52, 26, 'tree', 0.4),
    ...ring(46, 34, 'bush', 0.9),
  ],
};
