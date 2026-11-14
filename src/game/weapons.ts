import { Color, Matrix4, type Scene } from 'three';
import type { WeaponStats } from '../content/items';
import { TUNING } from '../content/tuning';
import type { SfxId } from '../content/sfx';
import type { Rng } from '../core/rng';
import type { Enemies } from './enemies';
import type { Pickups } from './pickups';
import type { Player } from './player';
import { Projectiles, Shot, type ShotEvents } from './projectiles';
import { weaponStats, type Loadout, type OwnedWeapon, type Stats } from './progress';
import type { WeaponFx } from './weapon-fx';
import { colorOf, hexOf } from '../render/palette';

export interface Combat {
  enemies: Enemies;
  player: Player;
  pickups: Pickups;
  stats: Stats;
  rng: Rng;
  fx: WeaponFx;
  time: number;
  /** Applies a hit (damage numbers, flashes, kills, statistics). Returns true if it killed. */
  hit(i: number, amount: number, crit: boolean, dirX: number, dirZ: number, knockback: number, weapon: OwnedWeapon): boolean;
  swoosh(x: number, y: number, z: number, angle: number, arc: number, radius: number, color: string): void;
  /** Once per attack, so shake and hitstop do not stack per enemy. */
  attacked(hits: number, crit: boolean, sound: SfxId | null): void;
  ground(x: number, z: number, y: number): number;
  /** Explosions and strikes break bins. */
  blast(x: number, z: number, r: number): void;
  /** Explosion visuals: flash, smoke and scorch. */
  boom(x: number, y: number, z: number, r: number): void;
  /** Muzzle flash of Gnat z CS. */
  muzzle(x: number, y: number, z: number, angle: number): void;
}

const PUDDLES = 64;
const matrix = new Matrix4();
const puddleTint = new Color();
const SWING_SFX: SfxId = 'swing';

/** Ticks every owned weapon: timers, continuous auras and orbits, puddles, and all projectiles. */
export class Arsenal {
  private readonly timers = new Float32Array(4);
  private readonly burst = new Uint8Array(4);
  private readonly burstTimer = new Float32Array(4);
  readonly shots: Projectiles;
  // Puddles (Kawa z Automatu): x, z, y, radius, life, maxLife, damage, slot, slow.
  private puddleN = 0;
  private readonly puddle = new Float32Array(PUDDLES * 9);
  private load: Loadout | null = null;
  private c: Combat | null = null;
  private readonly auraSlots = new Set<number>();
  /** Uids already struck by the current lightning attack (reused, no per-attack allocation). */
  private readonly chainUsed: number[] = [];
  /** Projectile hits of this step, per weapon slot: one feedback burst per step, not one per bullet. */
  private readonly shotHits = new Int32Array(4);
  /** Uids already arced to by the current Sieć Trakcyjna attack. */
  private readonly arcHit = new Set<number>();
  private readonly shotCrit = new Uint8Array(4);
  private orbitAngle = 0;

  constructor(
    scene: Scene,
    private readonly fx: WeaponFx,
  ) {
    this.shots = new Projectiles(scene);
  }

  reset(): void {
    this.timers.fill(0.4);
    this.burst.fill(0);
    this.puddleN = 0;
    this.shots.clear();
  }

  private crit(c: Combat): boolean {
    return c.rng.next() < c.stats.crit;
  }

  private dmg(c: Combat, base: number, crit: boolean): number {
    return base * c.stats.might * (crit ? TUNING.combat.critMultiplier : 1);
  }

  update(dt: number, load: Loadout, c: Combat): void {
    this.load = load;
    this.c = c;
    this.orbitAngle += dt;
    this.auraSlots.clear();
    for (let slot = 0; slot < load.weapons.length; slot++) {
      const w = load.weapons[slot];
      const s = weaponStats(w);
      const kind = w.def.kind;
      if (kind === 'aura') {
        this.auraSlots.add(slot);
        this.aura(slot, w, s, c, dt);
        continue;
      }
      if (kind === 'orbit') {
        this.orbit(slot, w, s, c);
        continue;
      }
      // Guns fire bursts: remaining shots of the current trigger pull come out in quick succession.
      if (this.burst[slot] > 0) {
        this.burstTimer[slot] -= dt;
        if (this.burstTimer[slot] <= 0) {
          this.burst[slot]--;
          this.burstTimer[slot] = 0.08;
          this.gunShot(slot, w, s, c);
        }
      }
      this.timers[slot] -= dt;
      if (this.timers[slot] > 0) continue;
      this.timers[slot] = s.cooldown * c.stats.cooldown;
      switch (kind) {
        case 'swing':
          this.swing(w, s, c);
          break;
        case 'boomerang':
          this.boomerang(slot, w, s, c);
          break;
        case 'puddle':
          this.throwCups(slot, w, s, c);
          break;
        case 'chain':
          this.chain(w, s, c);
          break;
        case 'cone':
          this.cone(w, s, c);
          break;
        case 'lob':
          this.lob(slot, w, s, c);
          break;
        case 'gun':
          if (this.gunShot(slot, w, s, c)) {
            this.burst[slot] = s.count + c.stats.amount - 1;
            this.burstTimer[slot] = 0.08;
            c.attacked(0, false, 'shot');
          } else {
            // Nothing in range: try again soon instead of playing a shot into an empty plaza.
            this.timers[slot] = 0.12;
          }
          break;
        case 'strike':
          this.strike(w, s, c);
          break;
        case 'line':
          this.line(slot, w, s, c);
          break;
        default:
          break;
      }
    }
    this.updatePuddles(dt, c);
    this.shotHits.fill(0);
    this.shotCrit.fill(0);
    this.shots.update(dt, c.time, c.enemies, c.player.pos.x, c.player.pos.y, c.player.pos.z, this.shotEvents);
    for (let slot = 0; slot < this.shotHits.length; slot++) {
      if (this.shotHits[slot] > 0) c.attacked(this.shotHits[slot], this.shotCrit[slot] === 1, null);
    }
  }

  /** A random enemy that stands on the ground (puddles do nothing to pigeons). */
  private pickGround(e: Enemies, found: number, c: Combat): number {
    const start = Math.floor(c.rng.next() * found);
    for (let k = 0; k < found; k++) {
      const i = e.found[(start + k) % found];
      if (!e.isFlying(i)) return i;
    }
    return -1;
  }

  private aim(c: Combat, range: number): number {
    const p = c.player.pos;
    const t = c.enemies.nearest(p.x, p.z, range);
    return t >= 0 ? Math.atan2(c.enemies.x[t] - p.x, c.enemies.z[t] - p.z) : c.player.facing;
  }

  // ---------- Teczka: arc swing ----------
  private swing(w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const e = c.enemies;
    const range = s.range * c.stats.area;
    const aim = this.aim(c, range + 7);
    let hits = 0;
    let anyCrit = false;
    for (let k = 0; k < s.count; k++) {
      const angle = aim + (k * Math.PI * 2) / Math.max(1, s.count);
      c.swoosh(p.x, p.y + 0.9, p.z, angle, s.arc, range, w.def.color);
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
        if ((d > 1 || k > 0) && Math.abs(diff) > s.arc / 2 + Math.atan(e.radius[i] / d)) continue;
        const crit = this.crit(c);
        anyCrit ||= crit;
        hits++;
        c.hit(i, this.dmg(c, s.damage, crit), crit, ex / d, ez / d, s.knockback, w);
      }
    }
    // Teczka Prezesa: a shockwave beyond the swing.
    if (w.def.perks?.includes('shockwave')) {
      const outer = range * 1.7;
      c.fx.addRing(p.x, p.y, p.z, outer, colorOf(w.def.color));
      const n = e.query(p.x, p.z, outer);
      for (let f = 0; f < n; f++) {
        const i = e.found[f];
        const d = Math.sqrt(e.foundD2[f]) || 1;
        if (d < range) continue;
        hits++;
        c.hit(i, this.dmg(c, s.damage * 0.5, false), false, (e.x[i] - p.x) / d, (e.z[i] - p.z) / d, s.knockback, w);
      }
    }
    c.player.swing(aim);
    c.attacked(hits, anyCrit, SWING_SFX);
  }

  // ---------- Bilet: boomerangs ----------
  private boomerang(slot: number, w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const range = s.range;
    const aim = this.aim(c, range + 4);
    const n = s.count + c.stats.amount;
    // Speed so that the ticket reaches `range` at the turning point.
    const life = (2 * range) / s.speed;
    for (let k = 0; k < n; k++) {
      const a = aim + (k - (n - 1) / 2) * 0.32;
      this.shots.spawn(Shot.Ticket, slot, p.x, p.y + 1, p.z, Math.sin(a) * s.speed * 1.6, 0, Math.cos(a) * s.speed * 1.6, life, s.damage, s.area * c.stats.area, s.knockback, -1, 0, hexOf(w.def.color));
    }
    c.attacked(0, false, 'throw');
  }

  // ---------- Kawa: cups that leave puddles ----------
  private throwCups(slot: number, w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const e = c.enemies;
    const n = s.count + c.stats.amount;
    const found = e.query(p.x, p.z, s.range);
    for (let k = 0; k < n; k++) {
      let tx: number;
      let tz: number;
      const target = found > 0 ? this.pickGround(e, found, c) : -1;
      if (target >= 0) {
        tx = e.x[target];
        tz = e.z[target];
      } else {
        const a = c.rng.next() * Math.PI * 2;
        tx = p.x + Math.sin(a) * 3;
        tz = p.z + Math.cos(a) * 3;
      }
      this.lobTo(Shot.Cup, slot, c, tx, tz, 0.7, w.def.color);
    }
    c.attacked(0, false, 'throw');
  }

  private lobTo(kind: Shot, slot: number, c: Combat, tx: number, tz: number, time: number, color: string): void {
    const p = c.player.pos;
    const y0 = p.y + 1.4;
    const floor = c.ground(tx, tz, p.y + 3);
    const vy = (floor - y0 + 0.5 * 22 * time * time) / time;
    this.shots.spawn(kind, slot, p.x, y0, p.z, (tx - p.x) / time, vy, (tz - p.z) / time, time, 0, 0, 0, 0, floor, hexOf(color));
  }

  private updatePuddles(dt: number, c: Combat): void {
    const e = c.enemies;
    let hits = 0;
    let anyCrit = false;
    let k = 0;
    while (k < this.puddleN) {
      const o = k * 9;
      const pd = this.puddle;
      pd[o + 4] -= dt;
      if (pd[o + 4] <= 0) {
        const last = --this.puddleN;
        pd.copyWithin(o, last * 9, last * 9 + 9);
        continue;
      }
      const slot = pd[o + 7];
      const w = this.load?.weapons[slot];
      if (w) {
        const n = e.query(pd[o], pd[o + 1], pd[o + 3]);
        for (let f = 0; f < n; f++) {
          const i = e.found[f];
          if (e.isFlying(i)) continue;
          if (pd[o + 8]) e.slow[i] = 0.4;
          if (!e.tryHit(i, slot, c.time, TUNING.combat.puddleTick * c.stats.cooldown)) continue;
          const crit = this.crit(c);
          anyCrit ||= crit;
          hits++;
          c.hit(i, this.dmg(c, pd[o + 6], crit), crit, 0, 0, 0, w);
        }
      }
      k++;
    }
    if (hits) c.attacked(hits, anyCrit, null);
  }

  private addPuddle(x: number, y: number, z: number, slot: number, c: Combat): void {
    const w = this.load?.weapons[slot];
    if (!w || this.puddleN >= PUDDLES) return;
    const s = weaponStats(w);
    const o = this.puddleN++ * 9;
    const life = s.duration * c.stats.duration;
    const pd = this.puddle;
    pd[o] = x;
    pd[o + 1] = z;
    pd[o + 2] = y;
    pd[o + 3] = s.area * c.stats.area;
    pd[o + 4] = life;
    pd[o + 5] = life;
    pd[o + 6] = s.damage;
    pd[o + 7] = slot;
    pd[o + 8] = w.def.perks?.includes('slow') === true ? 1 : 0;
  }

  // ---------- Sos: aura ----------
  private aura(slot: number, w: OwnedWeapon, s: WeaponStats, c: Combat, dt: number): void {
    this.timers[slot] -= dt;
    if (this.timers[slot] > 0) return;
    this.timers[slot] = s.cooldown * c.stats.cooldown;
    const p = c.player.pos;
    const e = c.enemies;
    const r = s.range * c.stats.area;
    const n = e.query(p.x, p.z, r);
    let hits = 0;
    let anyCrit = false;
    for (let f = 0; f < n; f++) {
      const i = e.found[f];
      const dy = e.y[i] - p.y;
      if (dy < -2 || dy > 2.6) continue;
      const d = Math.sqrt(e.foundD2[f]) || 1;
      const crit = this.crit(c);
      anyCrit ||= crit;
      hits++;
      c.hit(i, this.dmg(c, s.damage, crit), crit, (e.x[i] - p.x) / d, (e.z[i] - p.z) / d, s.knockback, w);
    }
    if (hits) c.attacked(hits, anyCrit, null);
  }

  // ---------- Parasol: orbiting umbrellas ----------
  private orbit(slot: number, w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const e = c.enemies;
    const n = s.count + c.stats.amount;
    const r = s.range * c.stats.area;
    const hitR = s.area * c.stats.area;
    const slow = w.def.perks?.includes('slow') === true;
    const cd = s.cooldown * c.stats.cooldown;
    let hits = 0;
    let anyCrit = false;
    // One query around Piotrek, then an angular gate per umbrella. The gate widens as enemies come closer,
    // so an enemy hugging Piotrek is swept by the umbrellas instead of sitting in a dead zone.
    const found = e.query(p.x, p.z, r + hitR + 0.6);
    for (let f = 0; f < found; f++) {
      const i = e.found[f];
      const d = Math.sqrt(e.foundD2[f]);
      if (d > r + hitR + e.radius[i]) continue;
      const dy = e.y[i] - p.y;
      if (dy < -1.6 || dy > 2.2) continue;
      const half = Math.atan2(hitR + e.radius[i], Math.max(d, 0.5));
      const ea = Math.atan2(e.x[i] - p.x, e.z[i] - p.z);
      let hitAngle = -1;
      for (let k = 0; k < n; k++) {
        const a = this.orbitAngle * s.speed + (k * Math.PI * 2) / n;
        const diff = Math.abs(Math.atan2(Math.sin(ea - a), Math.cos(ea - a)));
        if (diff < half) {
          hitAngle = a;
          break;
        }
      }
      if (hitAngle < 0) continue;
      if (!e.tryHit(i, slot, c.time, cd)) continue;
      if (slow) e.slow[i] = 0.45;
      const crit = this.crit(c);
      anyCrit ||= crit;
      hits++;
      c.hit(i, this.dmg(c, s.damage, crit), crit, Math.sin(hitAngle), Math.cos(hitAngle), s.knockback, w);
    }
    if (hits) c.attacked(hits, anyCrit, null);
  }

  // ---------- Telefon: chain lightning ----------
  private chain(w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const e = c.enemies;
    const color = colorOf(w.def.color);
    const bolts = s.count + c.stats.amount;
    let hits = 0;
    let anyCrit = false;
    const used = this.chainUsed;
    used.length = 0;
    for (let b = 0; b < bolts; b++) {
      let from = -1;
      let fx = p.x;
      let fy = p.y + 1.4;
      let fz = p.z;
      for (let jump = 0; jump <= s.chains; jump++) {
        // Nearest enemy not hit by this attack yet.
        const n = e.query(fx, fz, jump === 0 ? s.range : s.area * c.stats.area);
        let best = -1;
        let bestD = Infinity;
        for (let f = 0; f < n; f++) {
          const i = e.found[f];
          if (i === from || used.includes(e.uid[i])) continue;
          if (e.foundD2[f] < bestD) {
            bestD = e.foundD2[f];
            best = i;
          }
        }
        if (best < 0) break;
        used.push(e.uid[best]);
        const tx = e.x[best];
        const ty = e.y[best] + 0.6;
        const tz = e.z[best];
        c.fx.addBolt(fx, fy, fz, tx, ty, tz, color, 0.07, 0.18);
        const crit = this.crit(c);
        anyCrit ||= crit;
        hits++;
        if (w.def.perks?.includes('stun')) e.stun[best] = Math.max(e.stun[best], s.duration * c.stats.duration);
        c.hit(best, this.dmg(c, s.damage, crit), crit, 0, 0, 1, w);
        from = best;
        fx = tx;
        fy = ty;
        fz = tz;
      }
    }
    c.attacked(hits, anyCrit, hits ? 'zap' : null);
  }

  // ---------- Gwizdek: stun cone ----------
  private cone(w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const e = c.enemies;
    const range = s.range * c.stats.area;
    const aim = this.aim(c, range + 3);
    const stun = s.duration * c.stats.duration;
    let hits = 0;
    for (let k = 0; k < s.count; k++) {
      const angle = aim + k * Math.PI;
      // Three arcs at growing radii read as a sound wave, not as another briefcase swing.
      c.swoosh(p.x, p.y + 1.15, p.z, angle, s.arc, range * 0.45, w.def.color);
      c.swoosh(p.x, p.y + 1.2, p.z, angle, s.arc * 0.95, range * 0.75, w.def.color);
      c.swoosh(p.x, p.y + 1.25, p.z, angle, s.arc * 0.9, range, w.def.color);
      const n = e.query(p.x, p.z, range);
      for (let f = 0; f < n; f++) {
        const i = e.found[f];
        const ex = e.x[i] - p.x;
        const ez = e.z[i] - p.z;
        const d = Math.sqrt(e.foundD2[f]) || 1;
        let diff = Math.atan2(ex, ez) - angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if ((d > 1 || k > 0) && Math.abs(diff) > s.arc / 2) continue;
        e.stun[i] = Math.max(e.stun[i], stun);
        if (w.def.perks?.includes('vulnerable')) e.vulnerable[i] = Math.max(e.vulnerable[i], stun);
        hits++;
        c.hit(i, this.dmg(c, s.damage, false), false, ex / d, ez / d, s.knockback, w);
      }
    }
    c.attacked(hits, false, 'whistle');
  }

  // ---------- Puszka: lobbed explosive can ----------
  private lob(slot: number, w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const e = c.enemies;
    const n = s.count + c.stats.amount;
    const target = e.nearest(p.x, p.z, s.range);
    const tx0 = target >= 0 ? e.x[target] : p.x + Math.sin(c.player.facing) * 5;
    const tz0 = target >= 0 ? e.z[target] : p.z + Math.cos(c.player.facing) * 5;
    const cluster = w.def.perks?.includes('cluster') ?? false;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + c.rng.next();
      const spread = k === 0 && !cluster ? 0 : cluster ? 2.6 : 1.8;
      this.lobTo(Shot.Can, slot, c, tx0 + Math.sin(a) * spread, tz0 + Math.cos(a) * spread, 0.6 + k * 0.05, w.def.color);
    }
    c.attacked(0, false, 'throw');
  }

  private explode(x: number, y: number, z: number, slot: number, c: Combat, scale = 1): void {
    const w = this.load?.weapons[slot];
    if (!w) return;
    const s = weaponStats(w);
    // Zgrzewka: the can bursts into three smaller charges around it.
    if (scale === 1 && w.def.perks?.includes('cluster')) {
      for (let k = 0; k < 3; k++) {
        const a = c.rng.next() * Math.PI * 2;
        const d = 1.4 + c.rng.next() * 1.6;
        const cx = x + Math.sin(a) * d;
        const cz = z + Math.cos(a) * d;
        this.explode(cx, c.ground(cx, cz, y + 2), cz, slot, c, 0.55);
      }
    }
    const e = c.enemies;
    const r = s.area * c.stats.area * scale;
    c.fx.addRing(x, y, z, r, colorOf('#ffb347'), 0.4);
    c.blast(x, z, r);
    c.fx.addRing(x, y, z, r * 0.6, colorOf('#fff2b0'), 0.25);
    c.boom(x, y, z, r);
    const n = e.query(x, z, r);
    let hits = 0;
    let anyCrit = false;
    for (let f = 0; f < n; f++) {
      const i = e.found[f];
      const d = Math.sqrt(e.foundD2[f]) || 1;
      const crit = this.crit(c);
      anyCrit ||= crit;
      hits++;
      c.hit(i, this.dmg(c, s.damage * scale, crit), crit, (e.x[i] - x) / d, (e.z[i] - z) / d, s.knockback, w);
    }
    c.attacked(hits, anyCrit, scale === 1 ? 'boom' : null);
  }

  // ---------- Gnat z CS ----------
  private gunShot(slot: number, w: OwnedWeapon, s: WeaponStats, c: Combat): boolean {
    const p = c.player.pos;
    const e = c.enemies;
    const t = e.nearest(p.x, p.z, s.range);
    if (t < 0) return false;
    const ox = p.x;
    const oy = p.y + 1.25;
    const oz = p.z;
    const dx = e.x[t] - ox;
    const dy = e.y[t] + 0.5 - oy;
    const dz = e.z[t] - oz;
    const d = Math.hypot(dx, dy, dz) || 1;
    const spread = (c.rng.next() - 0.5) * 0.04;
    const vx = (dx / d) * s.speed + spread * s.speed;
    const vz = (dz / d) * s.speed - spread * s.speed;
    this.shots.spawn(Shot.Bullet, slot, ox, oy, oz, vx, (dy / d) * s.speed, vz, s.range / s.speed, s.damage, s.area, s.knockback, s.pierce, 0, hexOf(w.def.color));
    c.player.aim(Math.atan2(dx, dz));
    c.muzzle(ox + (dx / d) * 0.55, oy, oz + (dz / d) * 0.55, Math.atan2(dx, dz));
    return true;
  }

  // ---------- Iskra z Trakcji: strikes from the catenary ----------
  private strike(w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const e = c.enemies;
    const n = e.query(p.x, p.z, s.range);
    const strikes = s.count + c.stats.amount;
    const r = s.area * c.stats.area;
    const color = colorOf(w.def.color);
    let hits = 0;
    let anyCrit = false;
    this.arcHit.clear();
    for (let k = 0; k < strikes; k++) {
      let x: number;
      let z: number;
      if (n > 0) {
        const i = e.found[Math.floor(c.rng.next() * n)];
        x = e.x[i];
        z = e.z[i];
      } else {
        const a = c.rng.next() * Math.PI * 2;
        const d = 2 + c.rng.next() * (s.range - 2);
        x = p.x + Math.sin(a) * d;
        z = p.z + Math.cos(a) * d;
      }
      const y = c.ground(x, z, p.y + 3);
      c.fx.addBolt(x + (c.rng.next() - 0.5) * 2, y + 14, z + (c.rng.next() - 0.5) * 2, x, y, z, color, 0.07, 0.22);
      c.fx.addRing(x, y, z, r, color, 0.3);
      c.blast(x, z, r);
      const hitN = e.query(x, z, r);
      for (let f = 0; f < hitN; f++) {
        const i = e.found[f];
        const crit = this.crit(c);
        anyCrit ||= crit;
        hits++;
        c.hit(i, this.dmg(c, s.damage, crit), crit, 0, 0, 2, w);
      }
      // Sieć Trakcyjna: each strike arcs on to the nearest enemies.
      if (w.def.perks?.includes('arc')) {
        const near = e.query(x, z, TUNING.combat.arcRadius);
        for (let jumps = 0; jumps < s.chains; jumps++) {
          let best = -1;
          let bestD = Infinity;
          for (let f = 0; f < near; f++) {
            const i = e.found[f];
            if (e.foundD2[f] < r * r || this.arcHit.has(e.uid[i]) || e.foundD2[f] >= bestD) continue;
            best = i;
            bestD = e.foundD2[f];
          }
          if (best < 0) break;
          this.arcHit.add(e.uid[best]);
          c.fx.addBolt(x, y + 0.5, z, e.x[best], e.y[best] + 0.5, e.z[best], color, 0.06, 0.15);
          c.hit(best, this.dmg(c, s.damage * 0.6, false), false, 0, 0, 1, w);
          hits++;
        }
      }
    }
    c.attacked(hits, anyCrit, 'zap');
  }

  // ---------- Rozkład Jazdy: piercing sheets ----------
  private line(slot: number, w: OwnedWeapon, s: WeaponStats, c: Combat): void {
    const p = c.player.pos;
    const n = s.count + c.stats.amount;
    const fan = w.def.perks?.includes('fan') ?? false;
    const base = c.player.facing;
    const life = s.range / s.speed;
    for (let k = 0; k < n; k++) {
      const a = fan ? base + (k / n) * Math.PI * 2 : base + (k - (n - 1) / 2) * 0.16;
      this.shots.spawn(Shot.Paper, slot, p.x, p.y + 1.1, p.z, Math.sin(a) * s.speed, 0, Math.cos(a) * s.speed, life, s.damage, s.area * c.stats.area, 2, s.pierce, 0, hexOf(w.def.color));
    }
    c.attacked(0, false, 'throw');
  }

  private readonly shotEvents: ShotEvents = {
    hit: (i, slot, damage, dirX, dirZ, knockback) => {
      const c = this.c;
      const w = this.load?.weapons[slot];
      if (!c || !w) return;
      const crit = this.crit(c);
      c.hit(i, this.dmg(c, damage, crit), crit, dirX, dirZ, knockback, w);
      this.shotHits[slot]++;
      if (crit) this.shotCrit[slot] = 1;
    },
    landed: (kind, x, y, z, slot) => {
      const c = this.c;
      if (!c) return;
      if (kind === Shot.Can) this.explode(x, y, z, slot, c);
      else {
        this.addPuddle(x, y, z, slot, c);
        c.attacked(0, false, 'splash');
      }
    },
    flying: (_kind, x, z, slot) => {
      const w = this.load?.weapons[slot];
      if (w?.def.perks?.includes('magnet')) this.c?.pickups.vacuum(x, z, 2.5);
    },
  };

  /** Draws orbitals, auras and puddles for the current loadout. */
  render(time: number, alpha: number, px: number, py: number, pz: number): void {
    const load = this.load;
    const c = this.c;
    if (!load || !c) return;
    let u = 0;
    for (let slot = 0; slot < load.weapons.length; slot++) {
      const w = load.weapons[slot];
      const s = weaponStats(w);
      if (w.def.kind === 'orbit') {
        const n = s.count + c.stats.amount;
        const r = s.range * c.stats.area;
        const angle = this.orbitAngle + alpha / TUNING.simHz;
        for (let k = 0; k < n && u < 16; k++) {
          const a = angle * s.speed + (k * Math.PI * 2) / n;
          // Canopy scaled to the hit radius, so what you see is what hits.
          this.fx.placeUmbrella(u++, px + Math.sin(a) * r, py + 0.9, pz + Math.cos(a) * r, time * 10 + k, Math.max(0.8, (s.area * c.stats.area) / 0.42), w.def.evolved === true);
        }
      } else if (w.def.kind === 'aura') {
        const m = this.fx.aura(slot, w.def.color);
        const r = s.range * c.stats.area * (1 + Math.sin(time * 5) * 0.03);
        m.position.set(px, py + 0.06, pz);
        m.scale.set(r, 1, r);
        m.rotation.y = time * 0.6;
      }
    }
    this.fx.finishUmbrellas(u);
    this.fx.hideAurasExcept(this.auraSlots);
    const pm = this.fx.puddles;
    for (let k = 0; k < this.puddleN; k++) {
      const o = k * 9;
      const pd = this.puddle;
      const t = pd[o + 4] / pd[o + 5];
      const r = pd[o + 3] * Math.min(1, (1 - t) * 8) * (t < 0.15 ? t / 0.15 : 1);
      const w = load.weapons[pd[o + 7]];
      pm.setMatrixAt(k, matrix.makeScale(r, 1, r).setPosition(pd[o], pd[o + 2] + 0.03, pd[o + 1]));
      // Pulsing and brightened: a dark coffee puddle tinted straight looks like a shadow on the plaza.
      puddleTint.copy(colorOf(w.def.color)).multiplyScalar(1.9 + Math.sin(time * 6 + k) * 0.25);
      pm.setColorAt(k, puddleTint);
    }
    pm.count = this.puddleN;
    pm.instanceMatrix.needsUpdate = true;
    if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    this.shots.render(time, alpha);
  }
}
