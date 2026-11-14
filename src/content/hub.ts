// The hub: the forecourt of Łódź Fabryczna at dusk, with the recyklomat, the display case and the big
// station screen showing the attract-mode run. Built by the same World code as the arenas.

import { scatter } from './stations/shared';
import type { StationDef } from './stations/types';

export const HUB: StationDef = {
  id: 'hub',
  name: 'Punkt skupu przy Fabrycznej',
  sky: ['#1b2150', '#5a3f78', '#f08a55', '#3b2a3a'],
  fog: { color: '#c7735e', near: 34, far: 95 },
  sun: { color: '#ffb47a', intensity: 2.1, dir: [-0.5, 0.45, 0.6] },
  hemi: { sky: '#ffd2b4', ground: '#6b5a72', intensity: 1.7 },
  ground: { grass: '#566b3a', grassDark: '#3f5230', plaza: '#8b8a8f', plazaLine: '#6f6e74', gravel: '#7a6d64' },
  radius: 26,
  props: [
    { kind: 'hall', at: [0, 0, -20], size: [34, 9, 9], sign: 'ŁÓDŹ FABRYCZNA' },
    { kind: 'kiosk', at: [-7.5, 0, -5.5], rot: 0.5 },
    { kind: 'bench', at: [-5, 0, -2.4], rot: 0.35 },
    { kind: 'bench', at: [6.2, 0, -3.4], rot: -0.5 },
    { kind: 'lamp', at: [-5.4, 0, 0.4] },
    { kind: 'lamp', at: [5.2, 0, 1.6] },
    { kind: 'lamp', at: [-9, 0, -9] },
    { kind: 'lamp', at: [9, 0, -9] },
    { kind: 'box', at: [3.7, 0, -1.3], size: [0.9, 0.36, 0.6], color: '#2f6b3a', top: '#3a7d47', rot: -0.45 },
    { kind: 'box', at: [3.75, 0.36, -1.3], size: [0.8, 0.32, 0.5], color: '#2f6b3a', top: '#3a7d47', rot: -0.35 },
    { kind: 'sign', at: [9.5, 2.3, -6.8], size: [3.4, 0.9], text: 'PUNKT SKUPU', rot: -0.6, bg: '#1f7a3a' },
    { kind: 'sign', at: [-10, 2.6, -7.6], size: [3.2, 0.9], text: 'LINIA 17', rot: 0.6 },
    ...scatter(17, 14, 'tree', 17, [[-6, -14, 6, -4]]),
    ...scatter(14, 10, 'bush', 29, [[-6, -14, 6, 8]]),
  ],
  bins: [],
  coffee: [],
  chests: [],
};

/** Where things stand in the hub (metres). Piotrek face the camera from the middle. */
export const HUB_LAYOUT = {
  recyklomat: { at: [2.05, 0, -0.55] as const, rot: -0.5 },
  gablota: { at: [-1.95, 0, -0.75] as const, rot: 0.42 },
  screen: { at: [0, 3.1, -10.5] as const, width: 8.6 },
  /** Where the inventory floats the inspected item: beside Piotrek, clear of the panel. */
  inspect: [-0.72, 1.42, 1.35] as const,
  /** Camera framings per menu: position and target. */
  views: {
    // The menu covers the left third: frame the scene to the right of it.
    main: { pos: [-1.55, 1.8, 6.4], target: [-1.25, 1.75, -1.8] },
    recyklomat: { pos: [2.6, 1.62, 3.0], target: [3.15, 1.3, -0.5] },
    inventory: { pos: [-0.2, 1.52, 3.4], target: [0.75, 1.2, 0.15] },
    route: { pos: [0, 2.6, 8.2], target: [0, 4, -10] },
  },
};

export type HubView = keyof typeof HUB_LAYOUT.views;
