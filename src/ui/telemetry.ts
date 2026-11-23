// F2: the run's numbers as the game itself has them (kurs, multipliers, director, crowd against the cap, DPS per
// weapon, damage taken, the boss fight). For checking balance against the simulation's reports in a real run.
// Drawn and sampled outside the simulation: replays and snapshots leave it out.

import { num } from '../core/text';
import { h } from './dom';

export interface TelemetrySource {
  /** Game seconds of the run. */
  time(): number;
  /** Cumulative damage per weapon (name → damage), cumulative damage taken and healed. */
  sample(out: Map<string, number>): { taken: number; healed: number };
  /** The fixed lines (kurs, multipliers, director, crowd, boss). */
  lines(): string[];
}

/** How far back the rates look, in game seconds. */
const DPS_WINDOW = 10;
const TAKEN_WINDOW = 60;

interface Sample {
  t: number;
  dealt: Map<string, number>;
  taken: number;
  healed: number;
}

export class TelemetryPanel {
  readonly root = h('div', 'telemetry');
  private readonly text = h('pre', 'telemetry__text');
  /** One sample a game second, the last `TAKEN_WINDOW` of them in a ring (made once, reused: no garbage). */
  private readonly ring: Sample[] = Array.from({ length: TAKEN_WINDOW + 1 }, () => ({ t: 0, dealt: new Map<string, number>(), taken: 0, healed: 0 }));
  private count = 0;
  private head = 0;
  private next = 0;
  private sampledAt = -1;

  constructor(
    parent: HTMLElement,
    private readonly src: TelemetrySource,
  ) {
    this.root.append(this.text);
    this.root.hidden = true;
    parent.append(this.root);
  }

  toggle(): void {
    this.root.hidden = !this.root.hidden;
    this.next = 0;
  }

  /** A new run: nothing from the last one in the rates. */
  reset(): void {
    this.count = 0;
    this.head = 0;
    this.sampledAt = -1;
  }

  /** Every frame: a sample once a game second, the text four times a real second while shown. */
  update(now: number): void {
    const t = this.src.time();
    if (t < this.sampledAt) this.reset();
    if (t - this.sampledAt >= 1) {
      const s = this.ring[this.head];
      s.dealt.clear();
      const { taken, healed } = this.src.sample(s.dealt);
      s.t = t;
      s.taken = taken;
      s.healed = healed;
      this.head = (this.head + 1) % this.ring.length;
      this.count = Math.min(this.count + 1, this.ring.length);
      this.sampledAt = t;
    }
    if (this.root.hidden || now < this.next) return;
    this.next = now + 250;
    this.text.textContent = [...this.src.lines(), ...this.rates()].join('\n');
  }

  /** The k-th newest sample (0: the last one). */
  private at(k: number): Sample {
    return this.ring[(this.head - 1 - k + this.ring.length * 2) % this.ring.length];
  }

  /** The oldest sample at most `seconds` back. */
  private back(seconds: number): Sample {
    const last = this.at(0);
    for (let k = this.count - 1; k > 0; k--) if (last.t - this.at(k).t <= seconds) return this.at(k);
    return last;
  }

  private rates(): string[] {
    if (this.count === 0) return [];
    const last = this.at(0);
    const dpsFrom = this.back(DPS_WINDOW);
    const takenFrom = this.back(TAKEN_WINDOW);
    const span = Math.max(1, last.t - dpsFrom.t);
    let total = 0;
    const per: string[] = [];
    for (const [name, d] of last.dealt) {
      const dps = (d - (dpsFrom.dealt.get(name) ?? 0)) / span;
      total += dps;
      per.push(`  ${name}: ${num(dps, 0)}`);
    }
    const minutes = Math.max(1 / 60, (last.t - takenFrom.t) / 60);
    return [
      `DPS (ostatnie ${String(DPS_WINDOW)} s): ${num(total, 0)}`,
      ...per,
      `obrażenia otrzymane: ${num((last.taken - takenFrom.taken) / minutes, 0)}/min (razem ${num(last.taken, 0)})`,
      `leczenie: ${num((last.healed - takenFrom.healed) / minutes, 0)}/min`,
    ];
  }
}
