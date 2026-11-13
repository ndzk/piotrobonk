// Pure run-progress logic (no DOM, no Three.js): XP curve, card offers with rarity, loadout and derived stats.
import { ARMOR_CAP, FALLBACK_CARD, PASSIVES, RARITY, WEAPONS, WEAPON_LINES, type PassiveDef, type PassiveStat, type Rarity, type WeaponDef, type WeaponStats } from '../content/items';
import { TUNING } from '../content/tuning';
import type { Rng } from '../core/rng';
import { fillCount, num } from '../core/text';

export { num };

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  const x = TUNING.xp;
  const n = level - 1;
  return Math.round(x.base + x.linear * n + x.curve * Math.pow(n, x.power));
}

export function rarityWeights(luck: number): Record<Rarity, number> {
  const w = TUNING.cards.weights;
  const s = TUNING.cards.luckShift * Math.max(0, luck);
  return {
    common: w.common * Math.max(0.15, 1 - s),
    rare: w.rare * (1 + s),
    epic: w.epic * (1 + 1.6 * s),
    legendary: w.legendary * (1 + 2.4 * s),
  };
}

export function rollRarity(rng: Rng, luck: number): Rarity {
  const w = rarityWeights(luck);
  let r = rng.next() * (w.common + w.rare + w.epic + w.legendary);
  for (const k of ['legendary', 'epic', 'rare', 'common'] as const) {
    r -= w[k];
    if (r < 0) return k;
  }
  return 'common';
}

export interface OwnedWeapon {
  def: WeaponDef;
  level: number;
  /** Rarity multiplier used for each level-up (index 0 = level 2). */
  mults: number[];
  /** Damage dealt this run, for the summary chart. */
  damage: number;
}

export interface OwnedPassive {
  def: PassiveDef;
  level: number;
  total: number;
}

/** A permanent buff for the rest of the run (coffee machines). */
export interface Buff {
  stat: PassiveStat;
  value: number;
}

export interface Loadout {
  weapons: OwnedWeapon[];
  passives: OwnedPassive[];
  banished: Set<string>;
  buffs: Buff[];
}

export function weaponDef(id: string): WeaponDef {
  const def = WEAPONS.find((w) => w.id === id);
  if (!def) throw new Error(`unknown weapon ${id}`);
  return def;
}

export function newLoadout(startWeapon = 'teczka'): Loadout {
  return { weapons: [{ def: weaponDef(startWeapon), level: 1, mults: [], damage: 0 }], passives: [], banished: new Set(), buffs: [] };
}

export const weaponMaxLevel = (def: WeaponDef): number => def.levels.length + 1;

const ZERO: WeaponStats = { damage: 0, cooldown: 1, range: 0, area: 0, arc: 0, knockback: 0, count: 1, speed: 0, duration: 0, pierce: 0, chains: 0 };

const statCache = new WeakMap<OwnedWeapon, { level: number; def: WeaponDef; stats: WeaponStats }>();

/** Stats at the weapon's current level. Cached per level: the game loop calls this every step. Do not mutate the result. */
export function weaponStats(w: OwnedWeapon): WeaponStats {
  const hit = statCache.get(w);
  if (hit && hit.level === w.level && hit.def === w.def) return hit.stats;
  const s = computeWeaponStats(w);
  statCache.set(w, { level: w.level, def: w.def, stats: s });
  return s;
}

function computeWeaponStats(w: OwnedWeapon): WeaponStats {
  const s: WeaponStats = { ...ZERO, ...w.def.base };
  for (let i = 0; i < w.level - 1; i++) {
    const lv = w.def.levels[i];
    const m = w.mults[i] ?? 1;
    for (const [k, v] of Object.entries(lv.add) as [keyof WeaponStats, number][]) s[k] += k === 'count' || k === 'pierce' || k === 'chains' ? v : v * m;
    for (const [k, v] of Object.entries(lv.mul ?? {}) as [keyof WeaponStats, number][]) s[k] *= 1 - (1 - v) * m;
  }
  return s;
}

export interface Card {
  kind: 'weapon' | 'passive' | 'fallback';
  id: string;
  name: string;
  description: string;
  /** Level after taking the card (1 = new). */
  level: number;
  rarity: Rarity;
  /** What the card changes, already scaled by rarity. */
  lines: string[];
}

const fill = (template: string, v: string, count = Number(v.replace(',', '.'))): string => fillCount(template, v, count);

function weaponLines(def: WeaponDef, nextLevel: number, mult: number): string[] {
  const lv = def.levels[nextLevel - 2];
  const out: string[] = [];
  const a = lv.add;
  if (a.damage) out.push(fill(WEAPON_LINES.damage, num(a.damage * mult)));
  if (a.range) out.push(fill(WEAPON_LINES.range, num(a.range * mult, 2)));
  if (a.area) out.push(fill(WEAPON_LINES.area, num(a.area * mult, 2)));
  if (a.arc) out.push(fill(WEAPON_LINES.arc, String(Math.round((a.arc * mult * 180) / Math.PI))));
  if (a.knockback) out.push(fill(WEAPON_LINES.knockback, num(a.knockback * mult)));
  if (a.speed) out.push(fill(WEAPON_LINES.speed, num(a.speed * mult)));
  if (a.duration) out.push(fill(WEAPON_LINES.duration, num(a.duration * mult)));
  if (a.pierce) out.push(fill(WEAPON_LINES.pierce, String(a.pierce)));
  if (a.chains) out.push(fill(WEAPON_LINES.chains, String(a.chains)));
  if (a.count) out.push(lv.text);
  if (lv.mul?.cooldown) out.push(fill(WEAPON_LINES.cooldown, String(Math.round((1 - lv.mul.cooldown) * mult * 100))));
  return out;
}

/** True when a weapon level only changes whole-number stats, so rarity would not change anything. */
function countOnly(def: WeaponDef, nextLevel: number): boolean {
  const lv = def.levels[nextLevel - 2];
  return !lv.mul && Object.keys(lv.add).every((k) => k === 'count' || k === 'pierce' || k === 'chains');
}

export function passiveLine(def: PassiveDef, value: number): string {
  return fill(def.text, def.percent ? num(value * 100, 0) : num(value, 2));
}

export function offerCards(load: Loadout, rng: Rng, luck: number, count = 3): Card[] {
  type Option = { weight: number; make: (r: Rarity) => Card };
  const opts: Option[] = [];
  const mult = (r: Rarity): number => TUNING.cards.multiplier[r];
  for (const w of load.weapons) {
    if (w.level >= weaponMaxLevel(w.def) || load.banished.has(w.def.id)) continue;
    const plain = countOnly(w.def, w.level + 1);
    opts.push({
      weight: 1.25,
      make: (r) => {
        const rarity = plain ? 'common' : r;
        return { kind: 'weapon', id: w.def.id, name: w.def.name, description: w.def.description, level: w.level + 1, rarity, lines: weaponLines(w.def, w.level + 1, mult(rarity)) };
      },
    });
  }
  if (load.weapons.length < TUNING.cards.weaponSlots) {
    for (const def of WEAPONS) {
      if (def.evolved || load.weapons.some((w) => w.def.id === def.id || w.def.id === def.evolution?.into) || load.banished.has(def.id)) continue;
      opts.push({ weight: 1, make: () => ({ kind: 'weapon', id: def.id, name: def.name, description: def.description, level: 1, rarity: 'common', lines: [WEAPON_LINES.newWeapon] }) });
    }
  }
  const durationUsed = load.weapons.some((w) => w.def.usesDuration);
  for (const def of PASSIVES) {
    if (load.banished.has(def.id)) continue;
    // Do not offer a passive that nothing would benefit from yet.
    if (def.stat === 'duration' && !durationUsed) continue;
    const owned = load.passives.find((p) => p.def.id === def.id);
    if (owned && owned.level >= def.maxLevel) continue;
    if (!owned && load.passives.length >= TUNING.cards.passiveSlots) continue;
    // Whole-number passives (extra projectiles) are never scaled by rarity, like count-only weapon levels.
    const plain = def.stat === 'amount';
    opts.push({
      weight: owned ? 1 : 0.9,
      make: (r) => {
        const rarity = plain ? 'common' : r;
        return { kind: 'passive', id: def.id, name: def.name, description: def.description, level: (owned?.level ?? 0) + 1, rarity, lines: [passiveLine(def, def.perLevel * mult(rarity))] };
      },
    });
  }
  const cards: Card[] = [];
  while (cards.length < count && opts.length) {
    const total = opts.reduce((s, o) => s + o.weight, 0);
    let r = rng.next() * total;
    let idx = 0;
    for (; idx < opts.length - 1; idx++) {
      r -= opts[idx]?.weight ?? 0;
      if (r < 0) break;
    }
    const [o] = opts.splice(idx, 1);
    cards.push(o.make(rollRarity(rng, luck)));
  }
  if (!cards.length) {
    cards.push({ kind: 'fallback', id: FALLBACK_CARD.id, name: FALLBACK_CARD.name, description: FALLBACK_CARD.description, level: 1, rarity: 'common', lines: [fill(FALLBACK_CARD.text, String(FALLBACK_CARD.heal))] });
  }
  return cards;
}

export function applyCard(load: Loadout, card: Card): void {
  const m = TUNING.cards.multiplier[card.rarity];
  if (card.kind === 'weapon') {
    const owned = load.weapons.find((w) => w.def.id === card.id);
    if (owned) {
      owned.mults[owned.level - 1] = m;
      owned.level++;
    } else {
      const def = WEAPONS.find((w) => w.id === card.id);
      if (def) load.weapons.push({ def, level: 1, mults: [], damage: 0 });
    }
  } else if (card.kind === 'passive') {
    const def = PASSIVES.find((p) => p.id === card.id);
    if (!def) return;
    const owned = load.passives.find((p) => p.def.id === card.id);
    if (owned) {
      owned.level++;
      owned.total += def.perLevel * m;
    } else load.passives.push({ def, level: 1, total: def.perLevel * m });
  }
}

export interface Stats {
  /** Damage multiplier. */
  might: number;
  /** Extra projectiles / swings / orbitals for every weapon. */
  amount: number;
  /** XP multiplier. */
  growth: number;
  maxHp: number;
  speed: number;
  /** Cooldown multiplier (< 1 = faster). */
  cooldown: number;
  area: number;
  duration: number;
  luck: number;
  armor: number;
  regen: number;
  magnet: number;
  crit: number;
}

export function computeStats(load: Loadout): Stats {
  const sum = (stat: PassiveStat): number =>
    load.passives.filter((p) => p.def.stat === stat).reduce((s, p) => s + p.total, 0) + load.buffs.filter((b) => b.stat === stat).reduce((s, b) => s + b.value, 0);
  const luck = sum('luck');
  return {
    might: 1 + sum('might'),
    amount: Math.round(sum('amount')),
    growth: 1 + sum('growth'),
    maxHp: TUNING.player.maxHp + sum('maxHp'),
    speed: 1 + sum('speed'),
    cooldown: 1 / (1 + sum('haste')),
    area: 1 + sum('area'),
    duration: 1 + sum('duration'),
    luck,
    armor: sum('armor'),
    regen: sum('regen'),
    magnet: 1 + sum('magnet'),
    crit: TUNING.combat.baseCrit + luck * 0.1,
  };
}

/** Damage the player takes from a hit after armour (a blocked fraction, capped). */
export function damageTaken(raw: number, armor: number): number {
  return Math.max(TUNING.combat.minDamage, raw * (1 - Math.min(ARMOR_CAP, armor)));
}

export function rarityName(r: Rarity): string {
  return RARITY[r].name;
}

// ---------- Evolutions and chests ----------

/** Owned weapons that can evolve now: max level, not evolved yet, and the paired passive is owned. */
export function evolvable(load: Loadout): OwnedWeapon[] {
  return load.weapons.filter((w) => {
    const e = w.def.evolution;
    return e !== undefined && w.level >= weaponMaxLevel(w.def) && load.passives.some((p) => p.def.id === e.passive);
  });
}

export function evolve(w: OwnedWeapon): void {
  const into = w.def.evolution?.into;
  if (!into) return;
  w.def = weaponDef(into);
  w.level = 1;
  w.mults = [];
}

export type ChestReward = { kind: 'evolution'; weapon: OwnedWeapon; from: string } | { kind: 'upgrades'; cards: Card[]; bottles: number };

/**
 * Opens a chest: an evolution if one is ready, otherwise 1, 3 or 5 upgrades of things already owned
 * (like a Vampire Survivors chest), plus bottles when nothing can be upgraded.
 */
export function openChest(load: Loadout, rng: Rng, luck: number): ChestReward {
  const ready = evolvable(load);
  if (ready.length) {
    const w = ready[Math.floor(rng.next() * ready.length)];
    const from = w.def.name;
    evolve(w);
    return { kind: 'evolution', weapon: w, from };
  }
  const roll = rng.next();
  const n = roll < 0.06 + luck * 0.1 ? 5 : roll < 0.36 + luck * 0.3 ? 3 : 1;
  const cards: Card[] = [];
  for (let k = 0; k < n; k++) {
    // Only things already owned, like a Vampire Survivors chest.
    const owned = offerCards({ ...load, banished: new Set(), weapons: load.weapons, passives: load.passives }, rng, luck, 99).filter((c) => c.kind !== 'fallback' && c.level > 1);
    const card = owned[Math.floor(rng.next() * owned.length)] as Card | undefined;
    if (!card) break;
    applyCard(load, card);
    cards.push(card);
  }
  return { kind: 'upgrades', cards, bottles: cards.length ? 0 : 5 + Math.floor(rng.next() * 6) };
}

/** Bottles a map chest costs after `opened` chests this run. */
export function chestPrice(opened: number, base: number, step: number): number {
  return base + opened * step;
}
