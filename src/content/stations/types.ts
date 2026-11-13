// Arenas around the stations of line 17. Coordinates in metres: x east, z south, y up; the player starts at 0,0.
// Props are built into merged geometry; `solid` ones (boxes, buildings, crates, kiosks) collide and can be
// stood on, ramps are walkable slopes.

export type V3 = [number, number, number];

export type Prop =
  | { kind: 'box'; at: V3; size: V3; color: string; top?: string; rot?: number }
  /** Round column: chimney, bollard, spool, pipe. `r1` tapers the top. */
  | { kind: 'pipe'; at: V3; r: number; h: number; color: string; r1?: number; sides?: number; solid?: boolean }
  /** A board with text on it (timetable, gate sign, shop front). */
  | { kind: 'sign'; at: V3; size: [number, number]; text: string; rot?: number; bg?: string; fg?: string }
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
