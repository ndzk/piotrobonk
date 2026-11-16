// Threats off screen: an arrow at the edge of the screen for whatever is about to hurt Piotrek from where the
// camera does not look (a scooter or the bus aiming, a fan with a flare up, a cat about to jump, an elite, the
// last train's inspectors). Every attack is telegraphed; this makes sure the telegraph is seen.

import { h } from './dom';

export type ThreatKind = 'charge' | 'throw' | 'leap' | 'elite' | 'night';

export interface Threat {
  kind: ThreatKind;
  /** Screen position (CSS pixels, unzoomed) at the edge, and the arrow's angle. */
  x: number;
  y: number;
  angle: number;
}

const MAX = 8;
const GLYPH: Record<ThreatKind, string> = { charge: '!', throw: '✦', leap: '▼', elite: '★', night: '☾' };

export class ThreatMarkers {
  private readonly els: HTMLElement[] = [];
  private readonly kinds: (ThreatKind | null)[] = [];
  /** Text size zooms #ui: positions in screen pixels are divided by it. */
  zoom = 1;

  constructor(parent: HTMLElement) {
    const root = h('div', 'threats');
    for (let i = 0; i < MAX; i++) {
      const el = h('div', 'threat');
      el.append(h('span', 'threat__arrow'), h('span', 'threat__glyph'));
      el.hidden = true;
      this.els.push(el);
      this.kinds.push(null);
      root.append(el);
    }
    parent.append(root);
  }

  /** Shows the first `count` threats (the rest hide). Called every frame with a preallocated list. */
  set(list: readonly Threat[], count: number): void {
    for (let i = 0; i < MAX; i++) {
      const el = this.els[i];
      if (i >= count) {
        if (!el.hidden) el.hidden = true;
        continue;
      }
      const t = list[i];
      if (el.hidden) el.hidden = false;
      if (this.kinds[i] !== t.kind) {
        this.kinds[i] = t.kind;
        el.className = `threat threat--${t.kind}`;
        const glyph = el.lastElementChild;
        if (glyph) glyph.textContent = GLYPH[t.kind];
      }
      el.style.transform = `translate(${String(Math.round(t.x / this.zoom))}px, ${String(Math.round(t.y / this.zoom))}px)`;
      el.style.setProperty('--angle', `${String(Math.round((t.angle * 180) / Math.PI))}deg`);
    }
  }

  hide(): void {
    this.set([], 0);
  }
}

export const THREAT_MAX = MAX;
