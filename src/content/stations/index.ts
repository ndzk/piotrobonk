// The route: line 17 from Łódź Fabryczna to Koluszki, in travel order.

import { ANDRZEJOW } from './andrzejow';
import { BEDON } from './bedon';
import { FABRYCZNA } from './fabryczna';
import { GALKOWEK } from './galkowek';
import { JUSTYNOW } from './justynow';
import { KOLUSZKI } from './koluszki';
import { NICIARNIANA } from './niciarniana';
import type { StationDef } from './types';
import { WIDZEW } from './widzew';
import { ZAKOWICE } from './zakowice';

export * from './types';
export { FABRYCZNA };

export const STATIONS: StationDef[] = [FABRYCZNA, NICIARNIANA, WIDZEW, ANDRZEJOW, BEDON, JUSTYNOW, GALKOWEK, ZAKOWICE, KOLUSZKI];

export function station(id: string): StationDef {
  const def = STATIONS.find((s) => s.id === id);
  if (!def) throw new Error(`unknown station ${id}`);
  return def;
}

/** Index of a station on the route (−1 when unknown). */
export const stationIndex = (id: string): number => STATIONS.findIndex((s) => s.id === id);
