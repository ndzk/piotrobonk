import { baseArena, lamps, row, scatter } from './shared';
import type { Prop, StationDef, V3 } from './types';

const KERB = '#8d8a84';
const KERB_TOP = '#a6a39c';
const SHELTER = '#4e5a6e';
const SHELTER_ROOF = '#6d7a92';

/** A replacement bus: long body, window bands, a lit destination board at the front. */
function bus(x: number, z: number, color: string, alongZ = false): Prop[] {
  const at = (a: number, y: number, c: number): V3 => (alongZ ? [x + c, y, z + a] : [x + a, y, z + c]);
  const size = (l: number, h: number, w: number): V3 => (alongZ ? [w, h, l] : [l, h, w]);
  return [
    { kind: 'box', at: at(0, 0.35, 0), size: size(11, 2.5, 2.7), color, top: '#d8dae0' },
    { kind: 'box', at: at(0, 0, 0.95), size: size(10.4, 0.4, 0.55), color: '#24272e' },
    { kind: 'box', at: at(0, 0, -0.95), size: size(10.4, 0.4, 0.55), color: '#24272e' },
    { kind: 'box', at: at(0, 1.5, 1.37), size: size(9.6, 1.1, 0.12), color: '#2f4354', top: '#44607a' },
    { kind: 'box', at: at(0, 1.5, -1.37), size: size(9.6, 1.1, 0.12), color: '#2f4354', top: '#44607a' },
    { kind: 'box', at: at(5.56, 1.3, 0), size: size(0.12, 1.5, 2.4), color: '#2f4354', top: '#44607a' },
    { kind: 'box', at: at(5.5, 2.85, 0), size: size(0.3, 0.3, 2.6), color: '#e8d87a' },
    { kind: 'box', at: at(-3.5, 2.85, 0), size: size(1.4, 0.3, 1.6), color: '#b9bcc2' },
  ];
}

/** Bus shelter: glazed roof on two posts with a back wall and a bench. */
function shelter(x: number, z: number, back: number): Prop[] {
  return [
    { kind: 'canopy', at: [x, 0, z], size: [8, 2.6, 3], posts: 2, color: SHELTER, roof: SHELTER_ROOF },
    { kind: 'box', at: [x, 0, z + back * 1.35], size: [8, 2.6, 0.25], color: SHELTER, top: SHELTER_ROOF },
    { kind: 'bench', at: [x, 0, z + back * 0.9], rot: 0 },
  ];
}

/** The yellow ZKA timetable on two posts. */
function timetable(x: number, y: number, z: number): Prop[] {
  return [
    { kind: 'box', at: [x - 1, y, z], size: [0.14, 2.2, 0.14], color: '#4c5566' },
    { kind: 'box', at: [x + 1, y, z], size: [0.14, 2.2, 0.14], color: '#4c5566' },
    { kind: 'box', at: [x, y + 1.1, z], size: [2.6, 1.3, 0.14], color: '#e3c23c', top: '#f0d868' },
  ];
}

/** Firewood stacked at the edge of the forest. */
function logpile(x: number, z: number, rows: number): Prop[] {
  return row<Prop>([x, 0, z], [x, (rows - 1) * 0.45, z], rows, (at, i) => ({
    kind: 'box',
    at: [at[0] + (i % 2) * 0.12, at[1], at[2]],
    size: [5, 0.45, 1.6],
    color: i % 2 ? '#6b4f36' : '#7a5a3e',
    top: '#9a7a52',
  }));
}

export const BEDON: StationDef = {
  id: 'bedon',
  name: 'Bedoń',
  // 5/9: the sun is down behind the pines, the sky still burning over the turning circle.
  sky: ['#121947', '#3b2d6c', '#b0544f', '#281e31'],
  fog: { color: '#7a4b53', near: 44, far: 114 },
  sun: { color: '#da6a63', intensity: 1.7, dir: [-0.35, 0.4, 0.45] },
  hemi: { sky: '#cf9398', ground: '#4f3f64', intensity: 1.5 },
  ground: { grass: '#3a4b2a', grassDark: '#2b3a20', plaza: '#6b6870', plazaLine: '#545159', gravel: '#5d534f' },
  radius: 54,
  bins: [
    [-9, 0, 5],
    [9, 0, 5],
    [-15, 0, -20],
    [12, 0, -20],
    [-2.5, 0, 11],
    [8, 1, 26],
    [-10, 1, 29],
    [-24, 0, -4],
    [22, 0, -6],
    [-30, 0, 8],
    [22, 0, -26],
    [-20, 0, 10],
    [4, 0, -24],
  ],
  coffee: [
    [-13, 0, 4],
    [-2, 1, 29],
    [-26, 2.85, -2],
  ],
  chests: [
    [0, 0, 0],
    [-20, 0, -14],
    [18, 0, 8],
    [-23, 2.85, -2],
    [-14, 2.85, -2],
    [14, 2.85, -10],
    [15, 3.3, -30],
    [6, 4.12, 27.4],
    [-13, 1, 27.4],
    [13, 1, 27.4],
    [-34, 0, 12],
    [32, 0, 10],
    [28, 0, -24],
    [-10, 0, 40],
  ],
  props: [
    // The halt: a short canopy on a low platform, and hardly any rail left to stand beside.
    ...baseArena({
      trackZ: [17.5, 21.8],
      platformZ: 27.4,
      platformLength: 34,
      missing: 0.45,
      platformEdge: '#e5cf52',
      platformTop: '#8a878d',
      lampStep: 11,
      canopy: { length: 16, height: 2.8, color: '#3d4a5e', roof: '#5a6680' },
    }),
    { kind: 'crate', at: [11, 1, 26.2], size: 1.1 },
    { kind: 'crate', at: [9.7, 1, 26.3], size: 1.1 },
    { kind: 'crate', at: [9.7, 2.1, 26.3], size: 1.0 },
    { kind: 'bench', at: [-5, 1, 29.6], rot: 0 },
    ...timetable(4, 1, 29.8),

    // Asphalt turning circle for the replacement buses, kerbed round a scrap of forest left in the middle.
    { kind: 'box', at: [0, 0, -20], size: [14.6, 0.25, 0.7], color: KERB, top: KERB_TOP },
    { kind: 'box', at: [0, 0, -6], size: [14.6, 0.25, 0.7], color: KERB, top: KERB_TOP },
    { kind: 'box', at: [-7, 0, -13], size: [0.7, 0.25, 14.6], color: KERB, top: KERB_TOP },
    { kind: 'box', at: [7, 0, -13], size: [0.7, 0.25, 14.6], color: KERB, top: KERB_TOP },
    { kind: 'tree', at: [-3, 0, -16], h: 7.5 },
    { kind: 'tree', at: [3.5, 0, -10.5], h: 6 },
    { kind: 'bush', at: [3, 0, -17], r: 1.3 },
    { kind: 'bush', at: [-4, 0, -10], r: 1.1 },
    { kind: 'bush', at: [0, 0, -13], r: 1.4 },
    { kind: 'lamp', at: [-6, 0, -9] },
    { kind: 'lamp', at: [6, 0, -17] },

    // Buses waiting out the closure, and the pallets somebody left beside them.
    ...bus(-26, -2, '#c4442f'),
    ...bus(-14, -2, '#e0d04a'),
    ...bus(-20, -7.5, '#4a6fa8'),
    ...bus(14, -10, '#3f7a5a', true),
    { kind: 'crate', at: [-20.4, 0, -4.6], size: 1.2 },
    { kind: 'crate', at: [-20.4, 1.2, -4.6], size: 1.3 },
    { kind: 'crate', at: [-21.8, 0, -4.4], size: 1.2 },
    { kind: 'crate', at: [12.3, 0, -16.4], size: 1.2 },
    { kind: 'crate', at: [12.3, 1.2, -16.4], size: 1.3 },
    { kind: 'crate', at: [12.4, 0, -15], size: 1.1 },

    // Shelters and the timetable nobody has updated since the rails went missing.
    ...shelter(-13, 4, 1),
    ...shelter(13, 4, 1),
    ...shelter(-20, -20, -1),
    ...timetable(-9, 0, 5.4),
    ...timetable(17, 0, 5.4),
    ...lamps(-24, 20, 7, 14),
    { kind: 'bench', at: [-6, 0, 10], rot: 0 },
    { kind: 'bench', at: [6, 0, 10], rot: 0 },
    { kind: 'kiosk', at: [22, 0, 2], rot: -0.4 },

    // The middle: timber the forestry left stacked on the apron while the line is shut — cover to duck
    // behind, a stack to climb, and pines that were never cleared from the waiting area.
    ...logpile(-4, 8, 4),
    ...logpile(9, -5, 3),
    { kind: 'box', at: [4, 0, 13], size: [5, 2.2, 3], color: '#6b4f36', top: '#9a7a52' },
    { kind: 'box', at: [4, 2.2, 13], size: [5, 0.45, 3], color: '#7a5a3e', top: '#9a7a52' },
    { kind: 'crate', at: [0.6, 0, 13], size: 1.3 },
    { kind: 'crate', at: [0.6, 1.3, 13], size: 1.2 },
    { kind: 'tree', at: [-10, 0, -11], h: 8 },
    { kind: 'tree', at: [18, 0, -2], h: 7.5 },
    { kind: 'tree', at: [-11, 0, 9], h: 7 },
    { kind: 'bush', at: [-9, 0, -7], r: 1.4 },
    { kind: 'bush', at: [7.5, 0, -3], r: 1.2 },
    { kind: 'pipe', at: [-13, 0, -9], r: 0.9, h: 1.4, color: '#6b4f36', sides: 10 },
    { kind: 'pipe', at: [-15, 0, -10.4], r: 0.9, h: 1.4, color: '#7a5a3e', sides: 10 },
    { kind: 'pipe', at: [-2, 0, 14.5], r: 0.1, h: 2.8, color: '#4c5566', sides: 8 },
    { kind: 'pipe', at: [2.4, 0, 14.5], r: 0.1, h: 2.8, color: '#4c5566', sides: 8 },
    { kind: 'box', at: [0.2, 1.3, 14.5], size: [5, 1.5, 0.16], color: '#3d4a5e', top: '#5a6680' },
    { kind: 'sign', at: [0.2, 2.05, 14.4], size: [4.7, 1.2], text: 'ZKA · PRZYSTANEK ZASTĘPCZY', rot: Math.PI, bg: '#e3c23c', fg: '#1b2030' },

    // The halt building, with a ramp onto the lamp-room roof at its east end.
    { kind: 'hall', at: [0, 0, -32], size: [24, 5, 12], sign: 'BEDOŃ' },
    { kind: 'box', at: [16, 0, -30], size: [7, 3, 9], color: '#b7b2a8', top: '#9b968d' },
    { kind: 'ramp', from: [16, -20], to: [16, -25.5], width: 3.2, h0: 0, h1: 3.3, color: '#a6a39a' },
    { kind: 'box', at: [16, 3, -30], size: [7.4, 0.3, 9.4], color: '#8e8a82', top: '#a6a39c' },
    { kind: 'box', at: [-16, 0, -30], size: [7, 2.8, 9], color: '#b7b2a8', top: '#9b968d' },
    { kind: 'box', at: [-16, 2.8, -30], size: [7.4, 0.3, 9.4], color: '#8e8a82', top: '#a6a39c' },
    ...logpile(-23, -27, 4),
    ...logpile(24, -30, 3),

    // Bedoń is in the woods: the forest comes right up to the kerb.
    { kind: 'tree', at: [-10, 0, 14], h: 7 },
    { kind: 'tree', at: [10, 0, 14], h: 6.5 },
    { kind: 'tree', at: [-24, 0, 12], h: 8 },
    { kind: 'tree', at: [26, 0, 10], h: 7.5 },
    { kind: 'tree', at: [-28, 0, -10], h: 8 },
    { kind: 'tree', at: [28, 0, -14], h: 7 },
    { kind: 'tree', at: [-18, 0, -28], h: 7.5 },
    { kind: 'tree', at: [8, 0, -26], h: 6.5 },
    { kind: 'bush', at: [-16, 0, 11], r: 1.4 },
    { kind: 'bush', at: [16, 0, 11], r: 1.3 },
    { kind: 'bush', at: [-26, 0, -14], r: 1.5 },
    { kind: 'bush', at: [24, 0, -18], r: 1.2 },
    ...scatter(36, 26, 'tree', 1021, [
      [-26, 13, 26, 34],
      [-26, -40, 26, -4],
      [-34, -8, -8, 4],
    ]),
    ...scatter(44, 32, 'tree', 1022, [[-30, 13, 30, 34]]),
    ...scatter(50, 34, 'tree', 1023, [[-30, 13, 30, 34]]),
    ...scatter(58, 36, 'tree', 1024),
    ...scatter(64, 34, 'tree', 1025),
    ...scatter(40, 24, 'bush', 2033, [
      [-30, 13, 30, 34],
      [-26, -40, 26, -4],
    ]),
  ],
};
