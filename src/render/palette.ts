// CSS colour strings are parsed with a regex; the game asks for the same few every frame, so parse once.

import { Color } from 'three';

const colorCache = new Map<string, Color>();

/** The shared Color for a hex string. Never mutate the result. */
export function colorOf(hex: string): Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

const hexCache = new Map<string, number>();

export function hexOf(hex: string): number {
  let v = hexCache.get(hex);
  if (v === undefined) {
    v = colorOf(hex).getHex();
    hexCache.set(hex, v);
  }
  return v;
}
