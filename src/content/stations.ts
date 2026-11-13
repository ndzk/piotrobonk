// Arenas around the stations of line 17. Coordinates in metres: x east, z south, y up; the player starts at 0,0.
// Props are built into merged geometry; `solid` ones (boxes, buildings, crates, kiosks) collide and can be
// stood on, ramps are walkable slopes.

export type V3 = [number, number, number];

export type Prop =
  | { kind: 'box'; at: V3; size: V3; color: string; top?: string }
  | { kind: 'ramp'; from: [number, number]; to: [number, number]; width: number; h0: number; h1: number; color: string }
  | { kind: 'platform'; at: V3; size: V3; edge: string; top: string }
  | { kind: 'canopy'; at: V3; size: V3; posts: number; color: string; roof: string }
  | { kind: 'tracks'; z: number[]; from: number; to: number; missing: number }
  | { kind: 'hall'; at: V3; size: V3; sign: string }
  | { kind: 'garages'; at: V3; count: number; size: V3; doors: string[] }
  | { kind: 'crate'; at: V3; size: number }
  | { kind: 'kiosk'; at: V3; rot: number }
  | { kind: 'bench'; at: V3; rot: number }
  | { kind: 'lamp'; at: V3 }
  | { kind: 'bush'; at: V3; r: number }
  | { kind: 'tree'; at: V3; h: number }
  | { kind: 'shed'; at: V3; size: V3; color: string; roof: string }
  | { kind: 'fence'; from: [number, number]; to: [number, number]; h: number; color: string };

export interface StationDef {
  id: string;
  name: string;
  /** Sky gradient top → horizon → below horizon. */
  sky: [string, string, string, string];
  fog: { color: string; near: number; far: number };
  sun: { color: string; intensity: number; dir: V3 };
  hemi: { sky: string; ground: string; intensity: number };
  ground: { grass: string; grassDark: string; plaza: string; plazaLine: string; gravel: string };
  /** Arena radius: a fence keeps the player inside. */
  radius: number;
  props: Prop[];
  /** Breakable rubbish bins (bottles, sometimes food). */
  bins: V3[];
  /** Coffee machines (shrines: stand next to one for a buff). */
  coffee: V3[];
  /** Where paid chests may appear. */
  chests: V3[];
}

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
  sky: ['#1b2150', '#5a3f78', '#f08a55', '#3b2a3a'],
  fog: { color: '#c7735e', near: 30, far: 105 },
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
    { kind: 'bush', at: [-16, 0, 10], r: 1.4 },
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
    ...lampRow(-30, 30, 6, 15),
    ...ring(52, 26, 'tree', 0.4),
    ...ring(46, 34, 'bush', 0.9),
  ],
};
