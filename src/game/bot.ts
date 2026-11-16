import { PASSIVES, WEAPONS } from '../content/items';
import { TUNING } from '../content/tuning';
import { Rng } from '../core/rng';
import type { Game } from './game';
import { BEAM, MARK, SHOT, SPOOL_R, WAVE } from './hazards';
import type { Input } from './input';
import { Kind } from './pickups';
import type { Card } from './progress';

/**
 * ?bot=1 and the balance simulation (scripts/sim.ts): an AI that plays the run. Four skill levels stand in for
 * four kinds of player, so the difficulty can be measured against each of them:
 * - `afk` stands still and takes random cards (the floor: a run must not be survivable by doing nothing);
 * - `weak` reacts slowly, sees a boss's warning late, never sees projectiles, takes random cards;
 * - `medium` reacts in a fifth of a second, dodges ground warnings and waves, takes sensible cards;
 * - `good` reacts fast, reads everything on screen a second ahead, slides and jumps out of trouble on purpose,
 *   and plans its build around an evolution (with a seeded taste in weapons, so its builds vary).
 * Every choice comes from its own seeded stream: a run repeats exactly.
 */
export type BotSkill = 'afk' | 'weak' | 'medium' | 'good';

export interface Profile {
  /** Seconds between two decisions (reaction time). */
  react: number;
  /** How far ahead it looks, seconds. */
  horizon: number;
  /** Radians of error in the direction it means to run. */
  aim: number;
  /** Share of a ground warning that has to pass before it notices it (0: at once). */
  notice: number;
  /** Metres within which it sees projectiles (0: never). */
  shots: number;
  waves: boolean;
  beams: boolean;
  lanes: boolean;
  /** Extra metres of distance it keeps from bodies and blasts. */
  margin: number;
  /** How much of an enemy's reach (speed × time) it allows for: 0 assumes they stand still, 1 the worst case. */
  intercept: number;
  /** Slides and jumps on purpose to get out of trouble. */
  evade: boolean;
  /** Chance per wave it jumps over it in time. */
  hop: number;
  /** random; simple (new weapons first); plan (an evolution build that never neglects armour and healing). */
  cards: 'random' | 'simple' | 'plan';
  /** 0: ignores the map; 1: chests and food; 2: also coffee machines, bins, keeping the XP. */
  errands: number;
  /** Seconds it looks at the cards before picking. */
  think: number;
  /** Share of the slap bar's window it hits (the finale's QTE). */
  qte: number;
}

const PROFILES: Record<BotSkill, Profile> = {
  afk: { react: 1e9, horizon: 0, aim: 0, notice: 2, shots: 0, waves: false, beams: false, lanes: false, margin: 0, intercept: 0, evade: false, hop: 0, cards: 'random', errands: 0, think: 0.8, qte: 0.3 },
  weak: { react: 0.42, horizon: 0.35, aim: 0.5, notice: 0.75, shots: 0, waves: false, beams: false, lanes: false, margin: 0, intercept: 0.25, evade: false, hop: 0.05, cards: 'random', errands: 0, think: 1, qte: 0.3 },
  medium: { react: 0.2, horizon: 0.6, aim: 0.18, notice: 0.3, shots: 4, waves: true, beams: true, lanes: true, margin: 0.15, intercept: 0.35, evade: false, hop: 0.45, cards: 'simple', errands: 1, think: 0.6, qte: 0.4 },
  good: { react: 0.06, horizon: 1.0, aim: 0.04, notice: 0, shots: 14, waves: true, beams: true, lanes: true, margin: 0.2, intercept: 0.5, evade: true, hop: 0.9, cards: 'plan', errands: 2, think: 0.45, qte: 0.6 },
};

/** Directions it considers (plus standing still). */
const DIRS = 24;
const DIR_X = new Float32Array(DIRS + 1);
const DIR_Z = new Float32Array(DIRS + 1);
for (let k = 0; k < DIRS; k++) {
  DIR_X[k] = Math.sin((k / DIRS) * Math.PI * 2);
  DIR_Z[k] = Math.cos((k / DIRS) * Math.PI * 2);
}
const PR = TUNING.player.radius;
/** How close a weapon of each kind needs Piotrek to be to the thing it hits (metres from its edge). */
const REACH: Record<string, number> = { swing: 2.6, aura: 2, orbit: 2, cone: 4.2, boomerang: 8, puddle: 6.5, chain: 9, lob: 8, gun: 12, strike: 10, line: 10 };
/** Cost of a sure hit (scaled by its damage) against the pull of goals. */
const HIT = 40;

/** The passive each base weapon evolves with. */
const EVOLVES: Record<string, string> = {};
for (const w of WEAPONS) if (w.evolution) EVOLVES[w.id] = w.evolution.passive;

/** What a passive is worth to a planning player, before its evolution bonus. */
const PASSIVE_VALUE: Record<string, number> = {
  kurtka: 4.2,
  kanapka: 3.6,
  energetyk: 4.6,
  okulary: 3.8,
  'bilet-ulgowy': 5.2,
  klapki: 3.4,
  zdrapka: 2.8,
  nerka: 2.4,
  tabela: 3,
  termos: 2.6,
};

/** What the bot decided last (the simulation's trace prints it). */
export const botDebug = { best: 0, worst: 0, score: 0, goal: 0, n: 0 };

/** `tune` overrides parts of the skill's profile (the balance simulation compares variants with it). */
export function attachBot(input: Input, game: Game, seed: number, skill: BotSkill = 'medium', tune: Partial<Profile> = {}): void {
  const prof: Profile = { ...PROFILES[skill], ...tune };
  const rng = new Rng(seed ^ 0x2b07);
  // A planning player's taste in weapons: which ones it reaches for first (seeded, so builds vary per run).
  const taste = new Map<string, number>();
  for (const w of WEAPONS) if (!w.evolved) taste.set(w.id, 0.55 + rng.next() * 0.9);
  let cardDelay = 0;
  let decideIn = 0;
  let moveX = 0;
  let moveZ = 0;
  let orbit = rng.next() < 0.5 ? -1 : 1;
  let orbitTimer = 4;
  // Options: run in one of DIRS directions, stand (DIRS), or slide in one of DIRS directions (DIRS + 1 + k).
  const OPTIONS = DIRS * 2 + 1;
  const cost = new Float32Array(OPTIONS);
  const scores = new Float32Array(OPTIONS);
  let lastBest = -1;

  // The enemies that matter for one decision, gathered once: the nearest NEAR within 14 m (by distance).
  const NEAR = 72;
  const nearI = new Int32Array(NEAR);
  const nearD = new Float32Array(NEAR);
  let nearN = 0;
  const gather = (px: number, pz: number): void => {
    const e = game.enemies;
    const n = e.query(px, pz, 14);
    nearN = 0;
    for (let k = 0; k < n; k++) {
      const d = e.foundD2[k];
      // Insertion into a sorted window: the list stays short, so this beats sorting the query.
      let j: number;
      if (nearN < NEAR) j = nearN++;
      else if (d >= nearD[NEAR - 1]) continue;
      else j = NEAR - 1;
      while (j > 0 && nearD[j - 1] > d) {
        nearD[j] = nearD[j - 1];
        nearI[j] = nearI[j - 1];
        j--;
      }
      nearD[j] = d;
      nearI[j] = e.found[k];
    }
  };

  /** How bad it would be to stand at (x, z) `t` seconds from now (enemies from the last `gather`). */
  const danger = (x: number, z: number, t: number, px: number, pz: number, vx: number, vz: number): number => {
    let c = 0;
    const p = game.player;
    const e = game.enemies;
    const hurt = 1 + (1 - p.hp / p.maxHp) * 1.5;
    for (let k = 0; k < nearN; k++) {
      const i = nearI[k];
      const dy = e.y[i] - p.pos.y;
      if (dy < -1.2 || dy > 2.4) continue;
      const def = e.types[e.type[i]].def;
      let ex = e.x[i];
      let ez = e.z[i];
      if (def.behavior === 'charger') {
        // A bus: its painted lane is the danger while it winds up and while it charges; its body otherwise.
        const st = e.chargeState[i];
        const dx = x - ex;
        const dz = z - ez;
        const along = dx * e.chargeX[i] + dz * e.chargeZ[i];
        const across = Math.abs(dx * e.chargeZ[i] - dz * e.chargeX[i]);
        const live = st === 1 || (st === 0 && e.chargeT[i] < (prof.lanes ? 1.4 : 0.4));
        if (live && along > -3.6 && along < TUNING.combat.busWarnLength && across < 1.35 + PR + prof.margin + 0.3) c += HIT * (e.damage[i] / 10) * hurt;
        else if (dx * dx + dz * dz < (3.6 + PR) ** 2) c += HIT * 0.4;
        continue;
      }
      const charging = def.behavior === 'boss' ? game.bossCharge : null;
      // Where it can be by then: a boss on its charge goes straight down its lane; anyone else may be anywhere
      // within its speed × t (the share of that the bot allows for is its skill: good players never run
      // somewhere an enemy can get to first).
      let reach = 0;
      if (charging && charging.left > 0) {
        const go = Math.min(t, charging.left) * 17;
        ex += charging.x * go;
        ez += charging.z * go;
      } else if (e.stun[i] <= 0) reach = e.speed[i] * (e.slow[i] > 0 ? 0.5 : 1) * t * prof.intercept;
      const gap = Math.hypot(x - ex, z - ez) - (e.radius[i] + PR + prof.margin * 0.5) - reach;
      if (gap < 0) {
        if (!(e.stun[i] > 0 && TUNING.combat.stunnedHarmless)) c += HIT * 0.5 * (e.damage[i] / 10) * hurt * Math.min(1, 0.35 - gap / 1.5);
      } else c += 0.5 / (gap * gap + 0.5);
    }
    const hz = game.hazards;
    for (let m = 0; m < hz.markN; m++) {
      const o = m * MARK;
      const age = hz.mark[o + 3];
      const tele = hz.mark[o + 4];
      if (age < tele * prof.notice) continue;
      const from = tele - age;
      const until = from + Math.max(hz.mark[o + 6], 0.25);
      if (t < from - 0.05 || t > until) continue;
      const r = hz.mark[o + 2] + PR + prof.margin;
      if ((x - hz.mark[o]) ** 2 + (z - hz.mark[o + 1]) ** 2 < r * r) c += HIT * (0.4 + hz.mark[o + 5] / 20) * hurt;
    }
    if (prof.waves) {
      for (let w = 0; w < hz.waveN; w++) {
        const o = w * WAVE;
        if (hz.wave[o + 6]) continue;
        const r = hz.wave[o + 3] + hz.wave[o + 5] * t;
        if (r > hz.wave[o + 2]) continue;
        const d = Math.hypot(x - hz.wave[o], z - hz.wave[o + 1]);
        if (Math.abs(d - r) < PR + 0.8 + prof.margin) c += HIT * 0.5 * (hz.wave[o + 4] / 20);
      }
    }
    if (prof.beams) {
      for (let b = 0; b < hz.beamN; b++) {
        const o = b * BEAM;
        const left = hz.beam[o + 3];
        if (left > t + 0.2) continue;
        const ang = hz.beam[o] + hz.beam[o + 5] * Math.max(0, t - Math.max(0, left));
        const dx = x - hz.beam[o + 6];
        const dz = z - hz.beam[o + 7];
        const along = dx * Math.sin(ang) + dz * Math.cos(ang);
        const across = dx * Math.cos(ang) - dz * Math.sin(ang);
        if (along > 0 && along < hz.beam[o + 1] && Math.abs(across) < 1.4 + PR + prof.margin) c += HIT * 0.6 * (hz.beam[o + 4] / 15);
      }
    }
    if (prof.shots > 0) {
      // Closest approach of each projectile to the path from here to (x, z) over the next t seconds.
      for (let s = 0; s < hz.shotN; s++) {
        const o = s * SHOT;
        const sx = hz.shot[o];
        const sz = hz.shot[o + 2];
        if ((sx - px) ** 2 + (sz - pz) ** 2 > prof.shots * prof.shots) continue;
        if (Math.abs(p.pos.y + 0.9 - hz.shot[o + 1]) > 1.3) continue;
        const rx = px - sx;
        const rz = pz - sz;
        const rvx = vx - hz.shot[o + 3];
        const rvz = vz - hz.shot[o + 5];
        const v2 = rvx * rvx + rvz * rvz || 1;
        const tau = Math.max(0, Math.min(t, -(rx * rvx + rz * rvz) / v2));
        const cx = rx + rvx * tau;
        const cz = rz + rvz * tau;
        const r = PR + (hz.shot[o + 9] === 2 ? SPOOL_R : 0.3) + prof.margin;
        if (cx * cx + cz * cz < r * r) c += HIT * 0.5 * (hz.shot[o + 7] / 15) * hurt;
      }
    }
    if (prof.lanes) {
      const lane = game.chargeLane;
      if (lane.left > 0 && t > lane.left - 0.4) {
        const dx = x - lane.x;
        const dz = z - lane.z;
        const along = dx * Math.sin(lane.angle) + dz * Math.cos(lane.angle);
        const across = dx * Math.cos(lane.angle) - dz * Math.sin(lane.angle);
        if (along > -2 && along < lane.length + 2 && Math.abs(across) < lane.width / 2 + PR + prof.margin) c += HIT * 0.8;
      }
    }
    // The fence: a player caught against it has half the directions to run in.
    const edge = Math.hypot(x, z) - (game.world.radius - 9);
    if (edge > 0) c += edge * edge * 0.12;
    return c;
  };

  /** Where it wants to go: a goal direction (or none) and how much it wants it. */
  const goal = { x: 0, z: 0, w: 0 };
  const pickGoal = (): void => {
    const p = game.player.pos;
    const health = game.player.hp / game.player.maxHp;
    goal.w = 0;
    const want = (x: number, z: number, w: number): void => {
      const dx = x - p.x;
      const dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3 || w <= goal.w) return;
      goal.x = dx / d;
      goal.z = dz / d;
      goal.w = w;
    };
    const pk = game.pickups;
    if (prof.errands >= 1 && health < 0.65) {
      let best = -1;
      let bestD = 30 * 30;
      for (let i = 0; i < pk.count; i++) {
        if (pk.kindOf(i) !== Kind.Food) continue;
        const d2 = (pk.posX(i) - p.x) ** 2 + (pk.posZ(i) - p.z) ** 2;
        if (d2 < bestD) {
          bestD = d2;
          best = i;
        }
      }
      if (best >= 0) want(pk.posX(best), pk.posZ(best), 1.2 + (0.65 - health) * 1.2);
    }
    if (prof.errands >= 1) {
      for (const c of game.interact.chests) {
        if (!c.active || c.open >= 0 || c.price > game.bottles || Math.abs(c.y - p.y) > 1.5) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < 40) want(c.x, c.z, (c.price === 0 ? 1.5 : 1.1) * (1 - d / 60));
      }
    }
    const calm = game.enemies.query(p.x, p.z, 6) < 5 && game.bossIndex < 0;
    if (prof.errands >= 2 && calm && health > 0.5) {
      for (const c of game.interact.coffees) {
        if (c.used || Math.abs(c.y - p.y) > 1.5) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < 26) want(c.x, c.z, 0.9 * (1 - d / 40));
      }
      for (const b of game.interact.bins) {
        if (!b.alive || Math.abs(b.y - p.y) > 1.2) continue;
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        if (d < 14) want(b.x, b.z, 0.6 * (1 - d / 20));
      }
    }
    // Experience lying around: the nearest coin within reach of a short detour.
    if (prof.errands >= 1 && goal.w < 0.5) {
      let best = -1;
      let bestD = (prof.errands >= 2 ? 14 : 8) ** 2;
      for (let i = 0; i < pk.count; i++) {
        if (pk.kindOf(i) === Kind.Food) continue;
        const d2 = (pk.posX(i) - p.x) ** 2 + (pk.posZ(i) - p.z) ** 2;
        if (d2 < bestD) {
          bestD = d2;
          best = i;
        }
      }
      if (best >= 0) want(pk.posX(best), pk.posZ(best), 0.45);
    }
    // The boss: within reach of its weapons while healthy, further off when hurt (a seated Bartek never
    // comes to you). A melee build has to go in close; anything that shoots keeps its distance.
    const bi = game.bossIndex;
    if (bi >= 0 && goal.w < 1) {
      const e = game.enemies;
      const dx = e.x[bi] - p.x;
      const dz = e.z[bi] - p.z;
      const d = Math.hypot(dx, dz) || 1;
      let reach = 0;
      for (const w of game.load.weapons) reach = Math.max(reach, REACH[w.def.kind]);
      const range = (health > 0.45 ? Math.min(7.5, reach - 0.4) : Math.max(reach, 8)) + e.radius[bi];
      const pull = Math.max(-1, Math.min(1, (d - range) / 4));
      goal.x = (dx / d) * Math.sign(pull);
      goal.z = (dz / d) * Math.sign(pull);
      goal.w = Math.abs(pull) * 0.9;
    }
  };

  // Stuck: it wants to move but has not, so the way it pushes is a wall; it is avoided for a moment.
  let stuckFor = 0;
  let avoidX = 0;
  let avoidZ = 0;
  let avoidLeft = 0;
  let lastX = 0;
  let lastZ = 0;

  const decide = (): void => {
    const g = game;
    const p = g.player;
    const px = p.pos.x;
    const pz = p.pos.z;
    const py = p.pos.y;
    const speed = TUNING.player.runSpeed * g.botStats.speed;
    const health = p.hp / p.maxHp;
    const world = g.world;
    pickGoal();
    // Circling: a slow orbit of the arena, the way a player keeps a crowd in front of them.
    orbitTimer -= prof.react;
    if (orbitTimer <= 0) {
      orbitTimer = 5 + rng.next() * 6;
      orbit = rng.next() < 0.5 ? -1 : 1;
    }
    const r = Math.hypot(px, pz) || 1;
    const ring = world.radius * 0.45;
    // Back towards the middle, harder the further out (the open middle is where a crowd can be outrun).
    const inward = Math.max(0, Math.min(2.5, (r - ring) / (world.radius * 0.18)));
    const ox = (-pz / r) * orbit + (-px / r) * inward;
    const oz = (px / r) * orbit + (-pz / r) * inward;
    // Crowd centre within 10 m: keep it in front, never walk into it.
    const e = g.enemies;
    const n = e.query(px, pz, 10);
    let cx = 0;
    let cz = 0;
    for (let k = 0; k < n; k++) {
      const i = e.found[k];
      cx += e.x[i] - px;
      cz += e.z[i] - pz;
    }
    const cl = Math.hypot(cx, cz);
    gather(px, pz);
    const h = Math.max(0.2, prof.horizon);
    const samples = prof.horizon >= 0.8 ? 4 : 3;
    let best = DIRS;
    let bestScore = -Infinity;
    let worst = Infinity;
    const canSlide = prof.evade && p.slideReady && Math.hypot(p.vel.x, p.vel.z) > 1.5;
    for (let v = 0; v < OPTIONS; v++) {
      const slide = v > DIRS;
      if (slide && !canSlide) {
        scores[v] = -Infinity;
        continue;
      }
      const k = slide ? v - DIRS - 1 : v;
      const still = v === DIRS;
      const dx = still ? 0 : DIR_X[k];
      const dz = still ? 0 : DIR_Z[k];
      let c = 0;
      // March along the option: where a wall or the fence stops Piotrek, they stand (and get caught).
      let fx = px;
      let fz = pz;
      let stopped = still;
      for (let s = 1; s <= samples; s++) {
        const t = (h * s) / samples;
        // A slide covers about 11 m/s for 0,6 s, then it is running again.
        const dist = slide ? (t < 0.6 ? 11 * t : 6.6 + speed * (t - 0.6)) : speed * t;
        if (!stopped) {
          const nx = px + dx * dist;
          const nz = pz + dz * dist;
          // Anything a step does not clear stops the march: jumping fences mid-fight is how bots die.
          if (world.blocked(nx, py, nz, PR)) stopped = true;
          else {
            fx = nx;
            fz = nz;
          }
        }
        const vel = stopped ? 0 : dist / t;
        c += danger(fx, fz, t, px, pz, dx * vel, dz * vel) * (1.3 - s * (0.6 / samples));
      }
      // Corners and the fence: little room to run once there.
      if (prof.horizon >= 0.5) {
        let walls = 0;
        for (let q = 0; q < 4; q++) if (world.blocked(fx + DIR_X[q * (DIRS / 4)] * 2.5, py, fz + DIR_Z[q * (DIRS / 4)] * 2.5, PR)) walls++;
        c += walls * 0.9;
      }
      if (avoidLeft > 0 && dx * avoidX + dz * avoidZ > 0.5) c += 8;
      // A slide is a resource (it has a cooldown and tires): only worth it when it buys real safety.
      if (slide) c += 1.2;
      let want = 0;
      if (!still) {
        if (stopped && fx === px && fz === pz) want -= 3;
        // Momentum: turning round costs the speed Piotrek have, and a dithering bot stands in the crowd.
        if (moveX !== 0 || moveZ !== 0) want += (dx * moveX + dz * moveZ) * 0.45;
        want += (dx * ox + dz * oz) * 0.35;
        if (goal.w > 0) want += (dx * goal.x + dz * goal.z) * goal.w;
        if (cl > 0.1 && n > 2) {
          // Away from a crowd when hurt, alongside it when healthy (weapons reach it, bodies do not).
          const away = -(dx * cx + dz * cz) / cl;
          want += away * (health < 0.5 ? 0.6 : 0.15) * Math.min(1, n / 12);
        }
      } else want -= 0.25;
      cost[v] = c;
      if (!slide) worst = Math.min(worst, c);
      const score = want - c;
      scores[v] = score;
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    // Hysteresis: keep the way it was going unless another is clearly better.
    if (lastBest >= 0 && lastBest <= DIRS && best !== lastBest && best <= DIRS && scores[lastBest] > bestScore - 0.35) {
      best = lastBest;
      bestScore = scores[lastBest];
    }
    lastBest = best;
    botDebug.best = best;
    botDebug.worst = worst;
    botDebug.score = bestScore;
    botDebug.goal = goal.w;
    botDebug.n = n;
    if (best === DIRS) {
      moveX = 0;
      moveZ = 0;
    } else {
      const k = best > DIRS ? best - DIRS - 1 : best;
      const a = Math.atan2(DIR_X[k], DIR_Z[k]) + (rng.next() - 0.5) * 2 * prof.aim;
      moveX = Math.sin(a);
      moveZ = Math.cos(a);
      if (best > DIRS) input.press('slide');
    }
    hurdle();
  };

  /** A fence or a ledge right ahead that a jump clears: jump it (every frame, so the timing is right). */
  const hurdle = (): void => {
    const p = game.player;
    if (!p.onGround || (moveX === 0 && moveZ === 0)) return;
    const w = game.world;
    for (let d = 0.7; d < 1.3; d += 0.5) {
      const x = p.pos.x + moveX * d;
      const z = p.pos.z + moveZ * d;
      if (w.blocked(x, p.pos.y, z, PR) && !w.blocked(x, p.pos.y, z, PR, 1.15)) {
        input.press('jump');
        return;
      }
    }
  };

  /** Called every frame: notices being pinned against something it did not see. */
  const watchStuck = (dt: number): void => {
    const p = game.player.pos;
    avoidLeft -= dt;
    const moved = Math.hypot(p.x - lastX, p.z - lastZ);
    lastX = p.x;
    lastZ = p.z;
    if ((moveX !== 0 || moveZ !== 0) && moved < 0.6 * dt) stuckFor += dt;
    else stuckFor = 0;
    if (stuckFor > 0.35) {
      stuckFor = 0;
      avoidX = moveX;
      avoidZ = moveZ;
      avoidLeft = 1.2;
      decideIn = 0;
      input.press('jump');
    }
  };

  /** A wave about to reach Piotrek: jump it (when the skill allows and the dice agree). */
  const hopWaves = (): void => {
    const hz = game.hazards;
    const p = game.player;
    if (!p.onGround) return;
    for (let w = 0; w < hz.waveN; w++) {
      const o = w * WAVE;
      if (hz.wave[o + 6]) continue;
      const d = Math.hypot(p.pos.x - hz.wave[o], p.pos.z - hz.wave[o + 1]);
      const gap = d - hz.wave[o + 3];
      const eta = gap / Math.max(1, hz.wave[o + 5]);
      if (gap > 0 && eta < 0.16 && eta > 0.04) {
        if (rng.next() < prof.hop) input.press('jump');
        return;
      }
    }
  };

  const cardValue = (c: Card): number => {
    const load = game.load;
    if (c.kind === 'fallback') return 0;
    const rarity = c.rarity === 'legendary' ? 1.5 : c.rarity === 'epic' ? 1.3 : c.rarity === 'rare' ? 1.15 : 1;
    if (c.kind === 'weapon') {
      const like = taste.get(c.id) ?? 1;
      if (c.level === 1) return (load.weapons.length < 3 ? 6.5 : 4.2) * like;
      // Push the weapons that will evolve, harder the closer they are.
      const evo = EVOLVES[c.id] && load.passives.some((x) => x.def.id === EVOLVES[c.id]) ? 1.6 : 0;
      return (4.6 + c.level * 0.25 + evo) * like * rarity;
    }
    const pas = PASSIVES.find((x) => x.id === c.id);
    let v = PASSIVE_VALUE[c.id] ?? 2.5;
    if (load.weapons.some((w) => EVOLVES[w.def.id] === c.id)) v += 2.6;
    if (pas?.stat === 'armor' || pas?.stat === 'regen') v += (1 - game.player.hp / game.player.maxHp) * 2 + 3.5;
    return v * rarity;
  };

  const chooseCard = (inp: Input): void => {
    const cards = game.offered;
    if (!cards.length) return;
    let pick = 0;
    if (prof.cards === 'random') pick = Math.floor(rng.next() * cards.length);
    else if (prof.cards === 'simple') {
      // New weapons first, then weapon upgrades, then survival passives.
      const order = ['kanapka', 'kurtka', 'klapki', 'energetyk', 'okulary', 'nerka', 'zdrapka', 'bilet-ulgowy', 'tabela', 'termos'];
      let rank = Infinity;
      cards.forEach((c, i) => {
        const r = c.kind === 'weapon' ? (c.level === 1 ? 0 : 1) : 2 + Math.max(0, order.indexOf(c.id));
        if (r < rank) {
          rank = r;
          pick = i;
        }
      });
    } else {
      let best = -1;
      cards.forEach((c, i) => {
        const v = cardValue(c);
        if (v > best) {
          best = v;
          pick = i;
        }
      });
      // Nothing worth having: a reroll while there are some left.
      if (best < 3.4 && game.cardCounters.rerolls > 0) {
        inp.press('reroll');
        return;
      }
    }
    inp.press(pick === 0 ? 'card1' : pick === 1 ? 'card2' : 'card3');
  };

  input.override = (inp) => {
    const dt = 1 / 60;
    if (game.state === 'levelup') {
      cardDelay += dt;
      if (cardDelay > prof.think) {
        cardDelay = 0;
        chooseCard(inp);
      }
      return;
    }
    // The finale: slap when the cursor is in the window, then read on through the dialogue and the credits.
    if (game.state === 'finale') {
      const w = game.slapWindow;
      if (w) {
        if (Math.abs(w.pos - w.centre) < w.width * prof.qte) inp.press('confirm');
        return;
      }
    }
    if (game.state === 'chest') {
      cardDelay += dt;
      if (cardDelay > 1.6) {
        cardDelay = 0;
        // Interact closes the chest's screen like Esc does (and, unlike Enter, needs no focused button).
        inp.press('interact');
      }
      return;
    }
    if (game.state === 'cleared' || game.state === 'finale' || game.state === 'credits') {
      cardDelay += dt;
      if (cardDelay > 1.6) {
        cardDelay = 0;
        inp.press('confirm');
      }
      return;
    }
    cardDelay = 0;
    if (game.state !== 'playing') return;
    if (skill === 'afk') return;
    decideIn -= dt;
    watchStuck(dt);
    if (decideIn <= 0) {
      decideIn = prof.react * (0.75 + rng.next() * 0.5);
      decide();
    }
    if (prof.waves) hopWaves();
    hurdle();
    // Errands: open what it walked up to.
    if (prof.errands >= 1) {
      const p = game.player.pos;
      for (const c of game.interact.chests) {
        if (c.active && c.open < 0 && c.price <= game.bottles && (c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 2.4) inp.press('interact');
      }
    }
    // World direction to camera-relative stick input.
    const yaw = game.cam.yaw;
    inp.moveY = moveX * -Math.sin(yaw) + moveZ * -Math.cos(yaw);
    inp.moveX = moveX * Math.cos(yaw) + moveZ * -Math.sin(yaw);
    // Turn the camera behind the direction of travel (nicer attract-mode footage; spawns come from off-screen).
    if (moveX !== 0 || moveZ !== 0) {
      let d = Math.atan2(-moveX, -moveZ) - game.cam.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      game.cam.yaw += d * 0.03;
    }
  };
}
