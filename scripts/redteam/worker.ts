// Red team worker: the real Game from scripts/sim/worker.ts, with jobs of its own (boss benches with gear and
// coffee buffs, logged attack sequences; new exploit bots). Balance is never touched: no tweak, no ptune.
import { game, input, tick, attachPlanner, dps } from '../sim/worker';
import { parentPort } from 'node:worker_threads';
import { hashSeed, Rng } from '../../src/core/rng';
import { PASSIVES, type PassiveStat } from '../../src/content/items';
import { weaponDef, weaponMaxLevel } from '../../src/game/progress';
import { noGear } from '../../src/game/gear';
import type { BuildPlan, PlannerKind } from '../../src/game/bots/planner';
import type { Loadout } from '../sim/types';
import { clearTimers } from '../sim/shim';

// The sim worker answers its own jobs on import: this one answers instead.
parentPort?.removeAllListeners('message');

export interface RtJob {
  id: number;
  seed: number;
  station: string;
  cap: number;
  /** Boss bench: the loadout (levels as given, or max levels from ids), coffee buffs, a CS gun on Gnat. */
  boss?: { planner: PlannerKind; levels?: Loadout; weapons?: string[]; passives?: string[]; buffs?: { stat: PassiveStat; value: number }[]; gun?: string; mortal: boolean; close?: number; kurs?: 'spokojny' | 'normalnie' | 'opoznienie' };
  /** A dumb strategy from the start of a run, cards at random or by a plan. */
  exploit?: { kind: string; cards?: string[]; radius?: number; mag?: number; hop?: boolean; slide?: boolean; alone?: string; kurs?: 'normalnie' | 'opoznienie'; period?: number; back?: number; at?: [number, number]; path?: [number, number][]; climb?: boolean; godTrip?: number; tp?: [number, number, number] };
  /** A full run by a planner with a build plan and a CS gun. */
  full?: { planner: PlannerKind; build?: BuildPlan; gun?: string };
  /** Round 9: log Piotrek's spot every `trace` s: [t, x, y, z, enemies within 2,5 m, their mean height over Piotrek, hp]. */
  trace?: number;
}

export interface RtResult {
  id: number;
  station: string;
  outcome: 'won' | 'dead' | 'timeout';
  time: number;
  bossFrom: number;
  bossTo: number;
  /** Boss attacks as they were wound up: phase, name, kind, game time. */
  attacks: [number, string, string, number][];
  phaseAt: number[];
  stunShare: number;
  /** Longest unbroken stun of the boss, seconds. */
  stunLongest: number;
  shieldLeaks: number;
  /** Times the boss changed pool slot (swap-remove compaction), and stuns that started inside the immunity
   * window (the previous stun plus 2 s, Enemies.stunFor): Enemies.stunDr is not moved with the boss. */
  slotMoves?: number;
  earlyStuns?: number;
  /** Damage sent at the boss before its damage limit (Boss.limit) and what landed; seconds it showed `limited`. */
  raw?: number;
  landed?: number;
  limitedFor?: number;
  /** Share of the fight the boss was marked vulnerable (Kontrola: ×1,5 damage taken). */
  vulnShare?: number;
  /** Each phase change: [new phase, boss health just before it, the threshold it was meant to start at]. */
  gates?: [number, number, number][];
  weapons: string[];
  level: number;
  ms: number;
  /** Round 5: Piotrek's furthest and mean distance from the arena's centre (did the bot move at all?). */
  maxR?: number;
  meanR?: number;
  path?: number;
  minSpan10?: number;
  end?: number[];
  /** Round 8: the most camping waves in a row (Game.campWaves), camping waves sent, and enemies alive at the end. */
  campMax?: number;
  campSent?: number;
  alive?: number;
  /** Round 8: damage Piotrek took in each 30 s of the run. */
  hurt30?: number[];
  trail?: number[][];
}

const DT = 1 / 60;
/** Round 3: what went into Boss.limit and what came out (the boss object lives on across jobs: wrapped once). */
const acc = { raw: 0, landed: 0 };
function wrapLimit(b: unknown): void {
  const bb = b as { limit(a: number): number; rtWrapped?: boolean };
  if (bb.rtWrapped) return;
  const orig = bb.limit.bind(bb);
  bb.limit = (a: number): number => {
    const r = orig(a);
    acc.raw += a;
    acc.landed += r;
    return r;
  };
  bb.rtWrapped = true;
}
const gun = (id?: string) => (id ? { uid: 0, weapon: id, name: id, look: { finish: 'solid' as const, palette: ['#888888'], float: 0, seed: 0 }, stattrak: false, rarity: 3 as const } : null);

interface BossView {
  winding: { kind: string; name?: string; spawn?: string } | null;
  windLeft: number;
  phaseNumber: number;
  shielded: boolean;
  health: number;
}

function loop(job: RtJob, before: (() => void) | null, bench: boolean): RtResult {
  const t0 = performance.now();
  let outcome: RtResult['outcome'] = 'timeout';
  const attacks: RtResult['attacks'] = [];
  const phaseAt: number[] = [];
  let prevW: unknown = null;
  let prevWl = 0;
  let prevPhase = -1;
  let prevHp = -1;
  let fightFrames = 0;
  let stunFrames = 0;
  let stunRun = 0;
  let stunLongest = 0;
  // Game time, not frames: menus (a chest mid-fight) and hitstop freeze the simulation while frames go on.
  let lastT = game.time;
  let shieldLeaks = 0;
  let frames = 0;
  let prevBi = -1;
  let slotMoves = 0;
  let earlyStuns = 0;
  let prevStun = 0;
  let immuneUntil = -1e9;
  let limitedFor = 0;
  let vulnFrames = 0;
  const gates: [number, number, number][] = [];
  let prevHealth = 1;
  let maxR = 0;
  let sumR = 0;
  // Round 6: metres walked, and the least distance between two points 10 s apart (moving, or stuck on something?).
  let path = 0;
  let px0 = game.player.pos.x;
  let pz0 = game.player.pos.z;
  const ring: [number, number][] = [];
  let minSpan = Infinity;
  acc.raw = acc.landed = 0;
  let campMax = 0;
  let campSent = 0;
  let prevCamp = 0;
  const hurt30: number[] = [];
  let prevPhp = game.player.hp;
  const trail: number[][] = [];
  let nextTrace = 0;
  while (game.time < job.cap && frames < job.cap * 60 * 3) {
    tick(DT * 1000);
    before?.();
    game.frame(DT);
    frames++;
    const pr = Math.hypot(game.player.pos.x, game.player.pos.z);
    maxR = Math.max(maxR, pr);
    sumR += pr;
    path += Math.hypot(game.player.pos.x - px0, game.player.pos.z - pz0);
    px0 = game.player.pos.x;
    pz0 = game.player.pos.z;
    if (frames % 60 === 0) {
      ring.push([px0, pz0]);
      if (ring.length > 10) {
        const [ox, oz] = ring.shift() ?? [px0, pz0];
        if (game.time > 20) minSpan = Math.min(minSpan, Math.hypot(px0 - ox, pz0 - oz));
      }
    }
    if (bench) game.xp = 0;
    const cw = (game as unknown as { campWaves: number }).campWaves;
    if (cw > prevCamp) campSent++;
    prevCamp = cw;
    campMax = Math.max(campMax, cw);
    const lost = prevPhp - game.player.hp;
    if (lost > 0) {
      const slot = Math.floor(game.time / 30);
      while (hurt30.length <= slot) hurt30.push(0);
      hurt30[slot] += lost;
    }
    prevPhp = game.player.hp;
    if (job.trace && game.time >= nextTrace) {
      nextTrace = game.time + job.trace;
      const pp = game.player.pos;
      const n = game.enemies.query(pp.x, pp.z, 2.5);
      let dy = 0;
      // Round 11: of those, how many are inside something solid (a deck, a roof slab), and how many of those are within
      // touching height of Piotrek (contact: dy >= -height).
      let inSolid = 0;
      let inSolidNear = 0;
      for (let k = 0; k < n; k++) {
        const i = game.enemies.found[k];
        dy += game.enemies.y[i] - pp.y;
        if (game.world.solidAt(game.enemies.x[i], game.enemies.y[i] + 0.3, game.enemies.z[i])) {
          inSolid++;
          if (game.enemies.y[i] - pp.y >= -game.enemies.heightOf(i)) inSolidNear++;
        }
      }
      trail.push([Math.round(game.time), Math.round(pp.x * 10) / 10, Math.round(pp.y * 10) / 10, Math.round(pp.z * 10) / 10, n, n ? Math.round((dy / n) * 10) / 10 : 0, Math.round(game.player.hp), game.enemies.count, inSolid, inSolidNear]);
    }
    const b = (game as unknown as { boss: BossView | null }).boss;
    const bi = game.bossIndex;
    const dtg = game.time - lastT;
    lastT = game.time;
    if (b && bi >= 0) {
      wrapLimit(b);
      if ((b as unknown as { limited: boolean }).limited) limitedFor += dtg;
      if (dtg > 0) {
        fightFrames += dtg;
        if (game.enemies.vulnerable[bi] > 0) vulnFrames += dtg;
        if (game.enemies.stun[bi] > 0) {
          stunFrames += dtg;
          stunRun += dtg;
          stunLongest = Math.max(stunLongest, stunRun);
        } else stunRun = 0;
      }
      if (prevBi >= 0 && bi !== prevBi) slotMoves++;
      prevBi = bi;
      const st = game.enemies.stun[bi];
      // A new stun: it went up (a fresh one or an extension), not just ticking down.
      if (st > prevStun + 1e-6) {
        if (game.time < immuneUntil - 1e-3) earlyStuns++;
        immuneUntil = game.time + st + 2;
      }
      prevStun = st;
      const w = b.winding;
      if (w && (w !== prevW || b.windLeft > prevWl + 1e-9)) attacks.push([b.phaseNumber, w.name ?? (w.kind === 'summon' ? `summon:${w.spawn ?? ''}` : w.kind), w.kind, Math.round(game.time * 10) / 10]);
      prevW = w;
      prevWl = b.windLeft;
      if (b.phaseNumber !== prevPhase) {
        const ph = (b as unknown as { phases: { at: number }[] }).phases;
        if (prevPhase >= 0) gates.push([b.phaseNumber, Math.round(prevHealth * 10000) / 10000, ph[b.phaseNumber]?.at ?? -1]);
        phaseAt.push(Math.round(game.time * 10) / 10);
        prevPhase = b.phaseNumber;
      }
      prevHealth = b.health;
      const hp = game.enemies.hp[bi];
      if (b.shielded && prevHp >= 0 && hp < prevHp - 1e-6) shieldLeaks++;
      prevHp = hp;
    }
    const s = game.state;
    if (s === 'dying' || s === 'dead') {
      outcome = 'dead';
      break;
    }
    if (s === 'cleared' || s === 'call' || s === 'finale' || game.knockedOut) {
      outcome = 'won';
      break;
    }
  }
  return {
    id: job.id,
    station: job.station,
    outcome,
    time: Math.round(game.time * 10) / 10,
    bossFrom: game.log.bossFrom,
    bossTo: game.log.bossTo,
    attacks,
    phaseAt,
    stunShare: fightFrames ? stunFrames / fightFrames : 0,
    stunLongest,
    shieldLeaks,
    slotMoves,
    earlyStuns,
    raw: Math.round(acc.raw),
    landed: Math.round(acc.landed),
    limitedFor: Math.round(limitedFor),
    gates,
    vulnShare: fightFrames ? vulnFrames / fightFrames : 0,
    weapons: game.load.weapons.map((w) => `${w.def.id}:${String(w.level)}`),
    level: game.level,
    ms: Math.round(performance.now() - t0),
    maxR: Math.round(maxR * 10) / 10,
    meanR: Math.round((sumR / Math.max(1, frames)) * 10) / 10,
    path: Math.round(path),
    minSpan10: Math.round(minSpan * 10) / 10,
    end: [Math.round(game.player.pos.x * 10) / 10, Math.round(game.player.pos.y * 10) / 10, Math.round(game.player.pos.z * 10) / 10],
    campMax,
    campSent,
    alive: game.enemies.count,
    hurt30: hurt30.map((h) => Math.round(h)),
    trail: job.trace ? trail : undefined,
  };
}

function bossJob(job: RtJob): RtResult {
  const c = job.boss!;
  const seed = hashSeed(`${String(job.seed)}:${job.station}`);
  game.gear = { ...noGear(), gun: gun(c.gun) };
  const planner = attachPlanner(input, game, seed, c.planner, null, {});
  // Round 7: the planner as it is, but never further than `close` metres from the boss (a player who keeps
  // Kontrola's 10 m cone and the short weapons on it; the planner itself parks at its longest weapon's reach).
  const drive = input.override;
  if (c.close)
    input.override = (inp) => {
      drive?.(inp);
      const bi = game.bossIndex;
      if (game.state !== 'playing' || bi < 0) return;
      const dx = game.enemies.x[bi] - game.player.pos.x;
      const dz = game.enemies.z[bi] - game.player.pos.z;
      if (Math.hypot(dx, dz) > (c.close ?? 0)) steer(dx, dz);
    };
  game.start(seed, job.station, c.kurs ?? 'normalnie', null, 0, null);
  const g = game as unknown as { bossAt: number; refreshStats(): void; updateSlots(): void; arsenal: { reset(): void } };
  game.god = !c.mortal;
  if (c.levels) {
    game.load.weapons = c.levels.weapons.map((w) => ({ def: weaponDef(w.id), level: w.level, mults: [...w.mults], damage: 0 }));
    game.load.passives = c.levels.passives.flatMap((x) => {
      const def = PASSIVES.find((p) => p.id === x.id);
      return def ? [{ def, level: x.level, total: x.total }] : [];
    });
  } else {
    game.load.weapons = (c.weapons ?? []).map((id) => {
      const def = weaponDef(id);
      const max = weaponMaxLevel(def);
      return { def, level: max, mults: new Array<number>(max - 1).fill(1), damage: 0 };
    });
    game.load.passives = (c.passives ?? []).flatMap((id) => {
      const def = PASSIVES.find((p) => p.id === id);
      return def ? [{ def, level: def.maxLevel, total: def.perLevel * def.maxLevel }] : [];
    });
  }
  game.load.buffs = [...(c.buffs ?? [])];
  g.arsenal.reset();
  g.refreshStats();
  g.updateSlots();
  game.time = g.bossAt - 3;
  return loop(job, () => planner.beforeFrame(), true);
}

function fullJob(job: RtJob): RtResult {
  const c = job.full!;
  const seed = hashSeed(`${String(job.seed)}:${job.station}`);
  game.gear = { ...noGear(), gun: gun(c.gun) };
  const planner = attachPlanner(input, game, seed, c.planner, c.build ?? null, {});
  game.start(seed, job.station, 'normalnie', null, 0, null);
  return loop(job, () => planner.beforeFrame(), false);
}

/** A world direction as the camera-relative stick (as src/game/bots/exploits.ts does). */
function steer(dx: number, dz: number): void {
  const m = Math.hypot(dx, dz);
  if (m < 1e-6) {
    input.moveX = 0;
    input.moveY = 0;
    return;
  }
  const yaw = game.cam.yaw;
  input.moveY = (dx / m) * -Math.sin(yaw) + (dz / m) * -Math.cos(yaw);
  input.moveX = (dx / m) * Math.cos(yaw) + (dz / m) * -Math.sin(yaw);
}

function exploitJob(job: RtJob): RtResult {
  const c = job.exploit!;
  const seed = hashSeed(`${String(job.seed)}:${job.station}`);
  const rng = new Rng(seed ^ 0x7ed7ea);
  game.gear = noGear();
  let wait = 0;
  let along = 1;
  let wander = 0;
  let heading = 0;
  let tower: { x: number; z: number; y: number } | null = null;
  let wp = 0;
  let arrived = 0;
  input.override = (inp) => {
    inp.moveX = 0;
    inp.moveY = 0;
    const s = game.state;
    if (s === 'levelup' || s === 'chest' || s === 'cleared' || s === 'credits' || s === 'finale') {
      wait += DT;
      if (wait < (s === 'levelup' ? 0.5 : 1.6)) return;
      wait = 0;
      if (s === 'levelup') {
        let k = Math.floor(rng.next() * Math.max(1, game.offered.length));
        if (c.cards) {
          let best = 1e9;
          game.offered.forEach((o, i) => {
            const at = c.cards!.indexOf(o.id);
            if (at >= 0 && at < best) {
              best = at;
              k = i;
            }
          });
        }
        inp.press(k === 0 ? 'card1' : k === 1 ? 'card2' : 'card3');
      } else inp.press(s === 'chest' ? 'interact' : 'confirm');
      return;
    }
    wait = 0;
    if (s !== 'playing') return;
    const p = game.player.pos;
    const R = game.world.radius;
    const r = Math.hypot(p.x, p.z) || 1;
    const circle = (ring: number): void => steer(-p.z / r + (-p.x / r) * (r - ring) * 0.3, p.x / r + (-p.z / r) * (r - ring) * 0.3);
    switch (c.kind) {
      case 'stoi':
        return;
      // Bunny hops round the square (air strafing keeps the speed up): the kite at double speed.
      case 'hopkolko':
        circle(R * 0.55);
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      // The big lap near the fence, running.
      case 'duzekolko':
        circle(R * 0.78);
        return;
      // The lap with a slide whenever it is ready (slides start through bodies).
      case 'slajd':
        circle(R * 0.55);
        if (game.player.slideReady) inp.press('slide');
        return;
      // Away from whatever is closest, hopping: the panicking newcomer.
      case 'ucieczka': {
        const e = game.enemies;
        const n = e.query(p.x, p.z, c.radius ?? 10);
        let ax = 0;
        let az = 0;
        for (let k = 0; k < n; k++) {
          const i = e.found[k];
          const d2 = Math.max(0.25, e.foundD2[k]);
          ax -= (e.x[i] - p.x) / d2;
          az -= (e.z[i] - p.z) / d2;
        }
        // In from the fence.
        ax -= (p.x / r) * Math.max(0, r / R - 0.6) * 2;
        az -= (p.z / r) * Math.max(0, r / R - 0.6) * 2;
        if (Math.hypot(ax, az) < 1e-6) circle(R * 0.5);
        else steer(ax, az);
        if (c.slide && game.player.slideReady) inp.press('slide');
        if (c.hop === false) return;
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
      // Towards the emptiest ground: 16 headings, each scored by the bodies (1/d²) around the spot `look` m
      // ahead and the fence; hopping, sliding when ready. Still never looks at a telegraph or a projectile.
      case 'pustka': {
        const e = game.enemies;
        const look = c.radius ?? 4;
        const n = e.query(p.x, p.z, 20);
        let best = Infinity;
        let bx = 0;
        let bz = 0;
        for (let d = 0; d < 16; d++) {
          const a = (d / 16) * Math.PI * 2;
          const tx = p.x + Math.sin(a) * look;
          const tz = p.z + Math.cos(a) * look;
          let s = 0;
          for (let k = 0; k < n; k++) {
            const i = e.found[k];
            s += 1 / ((e.x[i] - tx) ** 2 + (e.z[i] - tz) ** 2 + 0.5);
          }
          const tr = Math.hypot(tx, tz) / R;
          if (tr > 0.75) s += (tr - 0.75) * 4;
          if (s < best) {
            best = s;
            bx = tx - p.x;
            bz = tz - p.z;
          }
        }
        steer(bx, bz);
        if (c.slide && game.player.slideReady) inp.press('slide');
        if (c.hop === false) return;
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
      // A drunk walk: a new random heading every 1,5 s (in from the fence), hopping.
      case 'losowo': {
        wander -= DT;
        if (wander <= 0 || r > R * 0.8) {
          wander = 1.5;
          heading = r > R * 0.8 ? Math.atan2(-p.x, -p.z) + (rng.next() - 0.5) : rng.next() * Math.PI * 2;
        }
        steer(Math.sin(heading), Math.cos(heading));
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
      // Round 4: a figure eight through the middle (a lemniscate, 24 s a loop), hopping, sliding when ready.
      case 'osemka': {
        const t = (game.time / 24) * Math.PI * 2;
        const a = R * 0.5;
        const tx = (a * Math.cos(t)) / (1 + Math.sin(t) ** 2);
        const tz = (a * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2);
        steer(tx - p.x, tz - p.z);
        if (game.player.slideReady) inp.press('slide');
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
      // Round 4: the lap with both bunny hops and slides.
      case 'hopslajd':
        circle(R * (c.radius ?? 0.55));
        if (game.player.slideReady) inp.press('slide');
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      // Round 5: hopslajd as it was meant (circle() is a zero vector at the start, the centre: a nudge first).
      case 'slamlap':
        if (Math.hypot(p.x, p.z) < 1) steer(1, 0);
        else circle(R * (c.radius ?? 0.55));
        if (game.player.slideReady) inp.press('slide');
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      // Round 5: ground slams in place (hop, slide in the air) while drifting slowly round a small ring, so the
      // camping rule (5 m in 10 s) never fires: stick at `mag` of full.
      case 'slamdrift':
        if (Math.hypot(p.x, p.z) < 1) steer(1, 0);
        else circle(R * (c.radius ?? 0.2));
        input.moveX *= c.mag ?? 0.4;
        input.moveY *= c.mag ?? 0.4;
        if (game.player.slideReady) inp.press('slide');
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      // Round 7: one heading for the whole run (from the seed), pushed into whatever wall or fence it meets,
      // hopping and sliding when ready (round 7's slamlap long-livers were wedged on something like this).
      // Round 8: `period` > 0 turns round for `back` s every `period` s (a clock, not a look at the game): the camping
      // anchor (5 m) moves twice a cycle, so the growing camping waves never start.
      case 'sciana': {
        if (wander === 0) {
          wander = 1;
          heading = c.radius ?? rng.next() * Math.PI * 2;
        }
        const out = (c.period ?? 0) > 0 && game.time % (c.period ?? 1) < (c.back ?? 1) ? -1 : 1;
        steer(out * Math.sin(heading), out * Math.cos(heading));
        if (game.player.slideReady) inp.press('slide');
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
      // Round 8: standing in place, but every `period` s `back` s out along one heading and `back` s back (a clock):
      // the camping rule's anchor is left twice a cycle. Hops and slides only if asked.
      case 'tam': {
        if (wander === 0) {
          wander = 1;
          heading = c.radius ?? rng.next() * Math.PI * 2;
        }
        const t = game.time % (c.period ?? 9);
        const b = c.back ?? 1;
        if (t < 2 * b) steer((t < b ? 1 : -1) * Math.sin(heading), (t < b ? 1 : -1) * Math.cos(heading));
        if (c.slide && game.player.slideReady) inp.press('slide');
        if (!c.hop) return;
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
      // Round 9: walk to a fixed spot `at` (no look at the game), then stand there; hops and slides only if asked.
      case 'punkt': {
        const [tx, tz] = c.at ?? [0, 0];
        if (Math.hypot(tx - p.x, tz - p.z) > 0.6) steer(tx - p.x, tz - p.z);
        if (c.slide && game.player.slideReady) inp.press('slide');
        if (!c.hop) return;
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
      // Round 10: a dense cell path [x, z, floor] (r10-cover.mjs --dense): walk cell to cell, jump only when the next
      // floor is above the feet, then stand on the last cell. `godTrip` as in trasa.
      case 'wspin': {
        const path = c.path as unknown as [number, number, number][];
        const k = Math.min(wp, path.length - 1);
        const [tx, tz, tf] = path[k];
        const d = Math.hypot(tx - p.x, tz - p.z);
        if (d < 0.3 && Math.abs(p.y - tf) < 0.5 && wp < path.length - 1) wp++;
        if (d > 0.15) steer(tx - p.x, tz - p.z);
        if (c.godTrip) game.god = game.time < c.godTrip;
        // Round 11: `hop` bunny-hops in place once on the last cell (perched is false in the air: enemies.ts).
        const up = (tf > p.y + 0.3 && wp < path.length) || (!!c.hop && wp >= path.length - 1 && d < 0.3);
        if (up && game.player.onGround) inp.press('jump');
        if (up) inp.hold('jump', true);
        return;
      }
      // Round 9: waypoints `path` in order (by Piotrek's own position only), then stand on the last one.
      case 'trasa': {
        const path = c.path ?? [[0, 0]];
        const [tx, tz] = path[Math.min(wp, path.length - 1)];
        if (Math.hypot(tx - p.x, tz - p.z) > 0.5) steer(tx - p.x, tz - p.z);
        else if (wp < path.length - 1) wp++;
        // Round 10: `climb` hops only on the way (onto a platform or a roof), then stands still at the last waypoint.
        // Round 10: `tp` [x, y, z] puts Piotrek on the spot at the start (a hold test of the spot alone).
        if (c.tp && !arrived && game.time < 0.5) {
          game.player.pos.x = c.tp[0];
          game.player.pos.y = c.tp[1];
          game.player.pos.z = c.tp[2];
          wp = path.length - 1;
        }
        const away = wp < path.length - 1 || Math.hypot(tx - p.x, tz - p.z) > 1;
        const hop = c.hop || (c.climb && away && !arrived);
        // Round 10: `godTrip` (seconds) keeps Piotrek unhurt for the trip only, whether they got there or not.
        if (c.godTrip) game.god = game.time < c.godTrip;
        if (!away && !arrived) arrived = game.time;
        if (hop && game.player.onGround) inp.press('jump');
        if (hop) inp.hold('jump', true);
        return;
      }
      // Round 4: a lap whose radius breathes between 0,2 R and 0,75 R every 30 s, hopping.
      case 'spirala':
        circle(R * (0.475 + 0.275 * Math.sin((game.time / 30) * Math.PI * 2)));
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      // Round 4: a zigzag (±60° every 0,7 s) on a straight heading, turned back in at the fence; hop and slide.
      case 'zygzak': {
        if (r > R * 0.8) heading = Math.atan2(-p.x, -p.z) + (rng.next() - 0.5);
        const zz = heading + (Math.floor(game.time / 0.7) % 2 ? 1 : -1) * (Math.PI / 3);
        steer(Math.sin(zz), Math.cos(zz));
        if (game.player.slideReady) inp.press('slide');
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
      // Round 4: the highest surface anywhere (not only one jump up), walked at and jumped at until reached.
      case 'wieza': {
        if (!tower) {
          tower = { x: 0, z: 0, y: -1 };
          for (let x = -R; x <= R; x += 1)
            for (let z = -R; z <= R; z += 1) {
              if (x * x + z * z > (R * 0.9) ** 2) continue;
              const y = game.world.groundAt(x, z, 0.35, 12);
              if (y > tower.y + 0.05) tower = { x, z, y };
            }
        }
        const dx = tower.x - p.x;
        const dz = tower.z - p.z;
        if (Math.hypot(dx, dz) > 0.6) steer(dx, dz);
        if (p.y < tower.y - 0.1 && game.player.onGround) inp.press('jump');
        return;
      }
      // Back and forth on a 30 m line through the middle, hopping (a lane the spawns ahead keep missing?).
      case 'wahadlo': {
        if (p.x > R * 0.5) along = -1;
        if (p.x < -R * 0.5) along = 1;
        steer(along, -p.z * 0.3);
        if (game.player.onGround) inp.press('jump');
        inp.hold('jump', true);
        return;
      }
    }
  };
  game.start(seed, job.station, c.kurs ?? 'normalnie', null, 0, null);
  if (!c.alone) return loop(job, null, false);
  // alone.ts's test with this movement instead of standing: the weapon maxed and alone, immortal to minute 8.
  const def = weaponDef(c.alone);
  const max = weaponMaxLevel(def);
  game.load.weapons = [{ def, level: max, mults: new Array<number>(max - 1).fill(1), damage: 0 }];
  const g = game as unknown as { bossAt: number; refreshStats(): void; updateSlots(): void; arsenal: { reset(): void } };
  g.arsenal.reset();
  g.refreshStats();
  g.updateSlots();
  g.bossAt = 1e9;
  game.god = true;
  return loop(job, () => {
    game.xp = 0;
    if (game.time >= 480) game.god = false;
  }, true);
}

parentPort?.on('message', (job: RtJob) => {
  if ('dps' in job) {
    parentPort?.postMessage(dps(job as unknown as import('../sim/types').DpsJob));
    return;
  }
  clearTimers();
  input.flush();
  input.override = null;
  // Game.start never resets god mode: an immortal bench job would leave the next job on this thread immortal.
  game.god = false;
  const r = job.boss ? bossJob(job) : job.full ? fullJob(job) : exploitJob(job);
  parentPort?.postMessage(r);
});
