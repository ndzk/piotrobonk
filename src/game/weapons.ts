import { TUNING } from '../content/tuning';
import type { Rng } from '../core/rng';
import type { Enemies } from './enemies';
import type { Player } from './player';
import { weaponStats, type Loadout, type OwnedWeapon, type Stats } from './progress';

export interface Combat {
  enemies: Enemies;
  player: Player;
  stats: Stats;
  rng: Rng;
  /** Applies a hit: damage numbers, flashes, kills, statistics. */
  hit(i: number, amount: number, crit: boolean, dirX: number, dirZ: number, knockback: number, weapon: OwnedWeapon): void;
  swoosh(x: number, y: number, z: number, angle: number, arc: number, radius: number): void;
  /** Once per attack, so shake and hitstop do not stack per enemy. */
  attacked(hits: number, crit: boolean): void;
}

/** Ticks every owned weapon; fires when its cooldown is up. */
export class Arsenal {
  private readonly timers = new Map<string, number>();

  reset(): void {
    this.timers.clear();
  }

  update(dt: number, load: Loadout, c: Combat): void {
    for (const w of load.weapons) {
      const t = (this.timers.get(w.def.id) ?? 0.4) - dt;
      if (t > 0) {
        this.timers.set(w.def.id, t);
        continue;
      }
      const s = weaponStats(w);
      this.timers.set(w.def.id, s.cooldown * c.stats.cooldown);
      switch (w.def.id) {
        case 'teczka':
          this.swing(w, c);
          break;
      }
    }
  }

  /** Teczka z Pracy: an arc in front of Piotrek, aimed at the nearest enemy; level 4 adds a back swing. */
  private swing(w: OwnedWeapon, c: Combat): void {
    const s = weaponStats(w);
    const p = c.player.pos;
    const e = c.enemies;
    const range = s.range * c.stats.area;
    const target = e.nearest(p.x, p.z, range + 7);
    const aim = target >= 0 ? Math.atan2(e.x[target] - p.x, e.z[target] - p.z) : c.player.facing;
    let hits = 0;
    let anyCrit = false;
    for (let k = 0; k < s.count; k++) {
      const angle = aim + k * Math.PI;
      c.swoosh(p.x, p.y + 0.9, p.z, angle, s.arc, range);
      const n = e.query(p.x, p.z, range + 0.6);
      for (let f = 0; f < n; f++) {
        const i = e.found[f];
        const dy = e.y[i] - p.y;
        if (dy < -2 || dy > 2.6) continue;
        const ex = e.x[i] - p.x;
        const ez = e.z[i] - p.z;
        const d = Math.sqrt(e.foundD2[f]) || 1;
        let diff = Math.atan2(ex, ez) - angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        // Enemies hugging Piotrek are always hit; further out the arc decides.
        const slack = Math.atan(e.radius[i] / d);
        if (d > 1 && Math.abs(diff) > s.arc / 2 + slack) continue;
        const crit = c.rng.next() < c.stats.crit;
        anyCrit ||= crit;
        hits++;
        c.hit(i, s.damage * (crit ? TUNING.combat.critMultiplier : 1), crit, ex / d, ez / d, s.knockback, w);
      }
    }
    c.player.swing(aim);
    c.attacked(hits, anyCrit);
  }
}
