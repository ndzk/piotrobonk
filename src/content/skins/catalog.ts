// Counter-Strike weapons as the game uses them: what Gnat z CS does with each gun (data, tune freely),
// the shape its procedural model is built from, and the knives and gloves that ★ items turn into.
// Names of weapons and skins stay as in CS: that is how everybody in Poland says them anyway.

import type { SfxId } from '../sfx';

/** How a gun fires. Multipliers apply to Gnat z CS's own stats at its current level. */
export interface GunProfile {
  /** Card and inventory line: what this gun does differently. */
  text: string;
  damage: number;
  /** Time between trigger pulls. */
  cooldown: number;
  /** Shots per trigger pull, on top of the level's extra shots. */
  burst: number;
  /** Seconds between the shots of a burst. */
  burstGap: number;
  /** Pellets per shot (shotguns). */
  pellets: number;
  /** Random spread per shot, radians. */
  spread: number;
  /** Extra enemies a bullet passes through; -1 = everything in its path. */
  pierce: number;
  range: number;
  speed: number;
  knockback: number;
  /** Tracer thickness (snipers draw a long bright line). */
  tracer: number;
  /** Seconds a hit stuns (the Zeus). */
  stun: number;
  sound: SfxId;
}

export type GunClass = 'pistol' | 'autoPistol' | 'dual' | 'heavyPistol' | 'smg' | 'rifle' | 'scopedRifle' | 'sniper' | 'autoSniper' | 'shotgun' | 'lmg' | 'taser';

const base: GunProfile = { text: '', damage: 1, cooldown: 1, burst: 1, burstGap: 0.08, pellets: 1, spread: 0.03, pierce: 0, range: 1, speed: 1, knockback: 1, tracer: 1, stun: 0, sound: 'shot' };

export const GUN_CLASSES: Record<GunClass, GunProfile> = {
  pistol: { ...base, text: 'Pojedyncze strzały, równe tempo.' },
  autoPistol: { ...base, text: 'Szybkie strzały z biodra, rozrzut.', damage: 0.62, cooldown: 0.55, spread: 0.08, range: 0.85 },
  dual: { ...base, text: 'Dwa pistolety: zawsze dwa strzały naraz.', damage: 0.72, cooldown: 1.25, burst: 2, burstGap: 0.06 },
  heavyPistol: { ...base, text: 'Ciężkie pojedyncze strzały, odrzut i przebicie.', damage: 2.6, cooldown: 2.2, pierce: 1, knockback: 3.5, tracer: 1.6, sound: 'shotHeavy' },
  smg: { ...base, text: 'Seria za serią, mniejsze obrażenia, krótszy zasięg.', damage: 0.46, cooldown: 0.4, spread: 0.09, range: 0.8, sound: 'shotAuto' },
  rifle: { ...base, text: 'Serie po trzy strzały, daleki zasięg.', damage: 0.6, cooldown: 1.5, burst: 3, burstGap: 0.075, spread: 0.035, range: 1.25, speed: 1.15, sound: 'shotAuto' },
  scopedRifle: { ...base, text: 'Seria z lunetą: daleko i z przebiciem.', damage: 0.62, cooldown: 1.7, burst: 3, burstGap: 0.085, spread: 0.02, range: 1.5, speed: 1.25, pierce: 1, sound: 'shotAuto' },
  sniper: { ...base, text: 'Jeden strzał, przebija na wylot cały rząd.', damage: 4.5, cooldown: 3.6, pierce: -1, range: 1.8, speed: 1.9, knockback: 4, tracer: 3, sound: 'shotHeavy' },
  autoSniper: { ...base, text: 'Półautomat z lunetą: mocno, daleko, przebija dwóch.', damage: 2, cooldown: 1.6, pierce: 2, range: 1.55, speed: 1.6, knockback: 2, tracer: 2, sound: 'shotHeavy' },
  shotgun: { ...base, text: 'Śrut w stożku, przebija pierwszego w tłumie.', damage: 0.45, cooldown: 1.7, pellets: 6, spread: 0.24, range: 0.85, pierce: 1, knockback: 2.4, sound: 'shotHeavy' },
  lmg: { ...base, text: 'Spray bez końca, rozrzut jak po trzech piwach.', damage: 0.3, cooldown: 0.2, spread: 0.17, range: 1.05, sound: 'shotAuto' },
  taser: { ...base, text: 'Paralizator: z bliska, mocno, ogłusza.', damage: 4, cooldown: 3, range: 0.4, knockback: 3, tracer: 2, stun: 1.2, sound: 'zap' },
};

/** Box-model recipe for a gun (metres, the model points along +z). */
export interface GunShape {
  /** Receiver length and height. */
  body: number;
  height: number;
  barrel: number;
  stock: 'none' | 'solid' | 'skeleton' | 'bullpup';
  mag: 'pistol' | 'curved' | 'straight' | 'drum' | 'box' | 'tube' | 'none' | 'top';
  scope: boolean;
  silencer: boolean;
  /** Second, mirrored pistol (Dual Berettas). */
  dual?: boolean;
  /** Front handguard / pump. */
  guard: number;
}

export interface CsWeapon {
  class: GunClass;
  shape: GunShape;
  /** Per-gun tweaks on top of the class. */
  tweak?: Partial<GunProfile>;
}

const pistol = (body: number, extra: Partial<GunShape> = {}): GunShape => ({ body, height: 0.085, barrel: 0.03, stock: 'none', mag: 'pistol', scope: false, silencer: false, guard: 0, ...extra });
const rifle = (body: number, barrel: number, mag: GunShape['mag'], extra: Partial<GunShape> = {}): GunShape => ({ body, height: 0.11, barrel, stock: 'solid', mag, scope: false, silencer: false, guard: 0.18, ...extra });

export const CS_WEAPONS: Record<string, CsWeapon> = {
  glock: { class: 'pistol', shape: pistol(0.19), tweak: { cooldown: 0.85 } },
  usp_silencer: { class: 'pistol', shape: pistol(0.2, { silencer: true }), tweak: { spread: 0.015, damage: 1.1, cooldown: 1.05 } },
  hkp2000: { class: 'pistol', shape: pistol(0.19) },
  p250: { class: 'pistol', shape: pistol(0.18), tweak: { damage: 1.15, cooldown: 1.1 } },
  fiveseven: { class: 'pistol', shape: pistol(0.21), tweak: { pierce: 1 } },
  tec9: { class: 'autoPistol', shape: pistol(0.24, { mag: 'straight', barrel: 0.05 }) },
  cz75a: { class: 'autoPistol', shape: pistol(0.2) },
  elite: { class: 'dual', shape: pistol(0.2, { dual: true }) },
  deagle: { class: 'heavyPistol', shape: pistol(0.26, { height: 0.11, barrel: 0.04 }) },
  revolver: { class: 'heavyPistol', shape: pistol(0.24, { height: 0.1, barrel: 0.08, mag: 'drum' }), tweak: { cooldown: 2.4, damage: 2.8 } },
  mac10: { class: 'smg', shape: rifle(0.22, 0.04, 'pistol', { stock: 'none', guard: 0, height: 0.1 }), tweak: { cooldown: 0.36 } },
  mp9: { class: 'smg', shape: rifle(0.26, 0.05, 'pistol', { stock: 'skeleton', guard: 0 }) },
  mp7: { class: 'smg', shape: rifle(0.27, 0.05, 'pistol', { stock: 'skeleton', guard: 0.06 }) },
  mp5sd: { class: 'smg', shape: rifle(0.3, 0.12, 'curved', { silencer: true, guard: 0.12 }), tweak: { spread: 0.06 } },
  ump45: { class: 'smg', shape: rifle(0.32, 0.06, 'straight', { stock: 'skeleton', guard: 0.1 }), tweak: { damage: 0.62, cooldown: 0.52 } },
  bizon: { class: 'smg', shape: rifle(0.3, 0.1, 'tube', { stock: 'skeleton', guard: 0.08 }), tweak: { burst: 2, cooldown: 0.7, damage: 0.4 } },
  p90: { class: 'smg', shape: rifle(0.36, 0.05, 'top', { stock: 'bullpup', guard: 0 }), tweak: { cooldown: 0.3, damage: 0.38 } },
  ak47: { class: 'rifle', shape: rifle(0.4, 0.22, 'curved', { guard: 0.16 }), tweak: { damage: 0.56, spread: 0.045 } },
  m4a1: { class: 'rifle', shape: rifle(0.38, 0.2, 'straight') },
  m4a1_silencer: { class: 'rifle', shape: rifle(0.38, 0.16, 'straight', { silencer: true }), tweak: { spread: 0.02, burst: 2, cooldown: 1.1, damage: 0.65 } },
  galilar: { class: 'rifle', shape: rifle(0.4, 0.2, 'curved') },
  famas: { class: 'rifle', shape: rifle(0.36, 0.14, 'straight', { stock: 'bullpup' }), tweak: { burstGap: 0.05 } },
  aug: { class: 'scopedRifle', shape: rifle(0.36, 0.16, 'straight', { stock: 'bullpup', scope: true }) },
  sg556: { class: 'scopedRifle', shape: rifle(0.4, 0.2, 'curved', { scope: true }) },
  awp: { class: 'sniper', shape: rifle(0.46, 0.36, 'box', { scope: true, height: 0.12, guard: 0.12 }) },
  ssg08: { class: 'sniper', shape: rifle(0.42, 0.34, 'box', { scope: true, height: 0.1 }), tweak: { damage: 3, cooldown: 2.1, pierce: 2, tracer: 2 } },
  scar20: { class: 'autoSniper', shape: rifle(0.44, 0.28, 'box', { scope: true }) },
  g3sg1: { class: 'autoSniper', shape: rifle(0.46, 0.3, 'curved', { scope: true }) },
  nova: { class: 'shotgun', shape: rifle(0.36, 0.28, 'tube', { guard: 0.12 }) },
  xm1014: { class: 'shotgun', shape: rifle(0.38, 0.28, 'tube', { guard: 0.1 }), tweak: { cooldown: 1.05, pellets: 5, damage: 0.4 } },
  mag7: { class: 'shotgun', shape: rifle(0.3, 0.16, 'box', { stock: 'skeleton', guard: 0.1 }), tweak: { pellets: 7, spread: 0.3, cooldown: 1.9 } },
  sawedoff: { class: 'shotgun', shape: rifle(0.26, 0.2, 'tube', { stock: 'none', guard: 0.1 }), tweak: { pellets: 9, spread: 0.38, range: 0.7, damage: 0.42 } },
  negev: { class: 'lmg', shape: rifle(0.46, 0.26, 'box', { height: 0.13, guard: 0.14 }), tweak: { cooldown: 0.16, damage: 0.26, spread: 0.2 } },
  m249: { class: 'lmg', shape: rifle(0.48, 0.28, 'box', { height: 0.13, guard: 0.14 }) },
  taser: { class: 'taser', shape: pistol(0.16, { height: 0.08, mag: 'none' }) },
};

/** What Gnat z CS is with no skin on: the T-side starting pistol. */
export const DEFAULT_GUN = 'glock';

/** The full fire profile of a CS weapon key (class plus per-gun tweaks). */
export function gunProfile(weapon: string): GunProfile {
  const w = CS_WEAPONS[weapon] ?? CS_WEAPONS[DEFAULT_GUN];
  return { ...GUN_CLASSES[w.class], ...w.tweak };
}

/** Knife model recipe: blade outline as [x, y] points along +y (metres; +x is the edge), handle and extras. */
export interface KnifeShape {
  blade: [number, number][];
  handle: number;
  guard: boolean;
  /** Karambit and Skeleton: a finger ring at the pommel. */
  ring?: boolean;
  /** Butterfly knife: split handle. */
  split?: boolean;
  /** Shadow Daggers: T-handle across the palm, a short blade out of the fist. */
  push?: boolean;
  /** Inspect move in the hub: spin about the handle, flip end over end, or twirl about the blade. */
  inspect: 'spin' | 'flip' | 'twirl';
}

type Outline = [number, number][];

/**
 * Serrations along the spine: the outline runs hilt → edge → tip → back down the spine, so the teeth go in
 * descending y between `top` and `bottom`, alternating with the spine line at x = `spine`.
 */
function saw(spine: number, top: number, bottom: number, teeth: number, depth = 0.004): Outline {
  const out: Outline = [];
  for (let k = 0; k <= teeth * 2; k++) out.push([spine - (k % 2 ? depth : 0), top - ((top - bottom) * k) / (teeth * 2)]);
  return out;
}

export const KNIVES: Record<string, KnifeShape> = {
  bayonet: { blade: [[-0.013, 0], [0.013, 0], [0.014, 0.13], [0.004, 0.18], [-0.013, 0.15]], handle: 0.12, guard: true, inspect: 'twirl' },
  knife_m9_bayonet: { blade: [[-0.016, 0], [0.016, 0], [0.018, 0.12], [0.006, 0.185], [-0.012, 0.16], ...saw(-0.016, 0.13, 0.03, 8)], handle: 0.12, guard: true, inspect: 'twirl' },
  knife_flip: { blade: [[-0.014, 0], [0.014, 0], [0.016, 0.06], [0.008, 0.105], [-0.014, 0.08]], handle: 0.1, guard: false, inspect: 'flip' },
  knife_gut: { blade: [[-0.016, 0], [0.016, 0], [0.018, 0.06], [0.004, 0.072], [0.012, 0.1], [-0.006, 0.098], [-0.016, 0.07]], handle: 0.1, guard: false, inspect: 'flip' },
  knife_karambit: { blade: [[-0.012, 0], [0.012, 0], [0.03, 0.04], [0.055, 0.07], [0.075, 0.085], [0.05, 0.088], [0.022, 0.065], [0.0, 0.03]], handle: 0.09, guard: false, ring: true, inspect: 'spin' },
  knife_tactical: { blade: [[-0.018, 0], [0.018, 0], [0.02, 0.1], [0.01, 0.145], [-0.004, 0.15], ...saw(-0.018, 0.11, 0.025, 6)], handle: 0.11, guard: true, inspect: 'twirl' },
  knife_butterfly: { blade: [[-0.011, 0], [0.011, 0], [0.012, 0.08], [0.0, 0.105], [-0.011, 0.085]], handle: 0.12, guard: false, split: true, inspect: 'spin' },
  knife_falchion: { blade: [[-0.014, 0], [0.014, 0], [0.022, 0.06], [0.026, 0.1], [0.014, 0.135], [-0.004, 0.12], [-0.014, 0.08]], handle: 0.11, guard: false, inspect: 'twirl' },
  knife_push: { blade: [[-0.022, 0], [0.022, 0], [0.003, 0.075], [-0.003, 0.075]], handle: 0.05, guard: false, push: true, inspect: 'flip' },
  knife_survival_bowie: { blade: [[-0.02, 0], [0.02, 0], [0.025, 0.11], [0.014, 0.16], [-0.002, 0.172], [-0.01, 0.15], [-0.02, 0.12]], handle: 0.12, guard: true, inspect: 'twirl' },
  knife_gypsy_jackknife: { blade: [[-0.01, 0], [0.01, 0], [0.016, 0.07], [0.012, 0.11], [0.0, 0.135], [-0.008, 0.1]], handle: 0.12, guard: false, inspect: 'flip' },
  knife_stiletto: { blade: [[-0.008, 0], [0.008, 0], [0.007, 0.11], [0.0, 0.15], [-0.007, 0.11]], handle: 0.12, guard: false, inspect: 'flip' },
  knife_widowmaker: { blade: [[-0.012, 0], [0.012, 0], [0.035, 0.05], [0.065, 0.09], [0.09, 0.105], [0.062, 0.108], [0.03, 0.08], [0.0, 0.035]], handle: 0.1, guard: false, inspect: 'spin' },
  knife_ursus: { blade: [[-0.015, 0], [0.015, 0], [0.016, 0.095], [0.006, 0.12], [-0.015, 0.11]], handle: 0.11, guard: false, inspect: 'flip' },
  knife_outdoor: { blade: [[-0.017, 0], [0.01, 0], [0.012, 0.012], [0.02, 0.02], [0.021, 0.09], [0.008, 0.125], [-0.017, 0.1]], handle: 0.11, guard: false, inspect: 'twirl' },
  knife_cord: { blade: [[-0.014, 0], [0.014, 0], [0.015, 0.085], [0.0, 0.12], [-0.014, 0.1]], handle: 0.11, guard: false, inspect: 'twirl' },
  knife_skeleton: { blade: [[-0.013, 0], [0.013, 0], [0.014, 0.08], [0.004, 0.11], [-0.013, 0.09]], handle: 0.1, guard: false, ring: true, inspect: 'spin' },
  knife_canis: { blade: [[-0.015, 0], [0.015, 0], [0.016, 0.09], [0.0, 0.125], [-0.015, 0.095], ...saw(-0.015, 0.085, 0.02, 5)], handle: 0.11, guard: false, inspect: 'twirl' },
  knife_css: { blade: [[-0.015, 0], [0.015, 0], [0.016, 0.11], [0.0, 0.15], [-0.012, 0.12]], handle: 0.11, guard: true, inspect: 'twirl' },
  knife_kukri: { blade: [[-0.012, 0], [0.012, 0], [0.03, 0.06], [0.045, 0.12], [0.04, 0.16], [0.02, 0.17], [0.01, 0.14], [-0.004, 0.08]], handle: 0.12, guard: false, inspect: 'twirl' },
};

/** Glove recipes: which parts get the skin's colours. */
export interface GloveShape {
  /** Bare fingertips (hand wraps, fingerless sport gloves). */
  fingerless: boolean;
  cuff: number;
  /** Knuckle studs or plates. */
  knuckles: boolean;
}

export const GLOVES: Record<string, GloveShape> = {
  leather_handwraps: { fingerless: true, cuff: 0.05, knuckles: false },
  sporty_gloves: { fingerless: false, cuff: 0.035, knuckles: false },
  slick_gloves: { fingerless: false, cuff: 0.03, knuckles: false },
  motorcycle_gloves: { fingerless: false, cuff: 0.045, knuckles: true },
  specialist_gloves: { fingerless: false, cuff: 0.06, knuckles: false },
  studded_bloodhound_gloves: { fingerless: false, cuff: 0.04, knuckles: true },
  studded_hydra_gloves: { fingerless: false, cuff: 0.04, knuckles: true },
  studded_brokenfang_gloves: { fingerless: false, cuff: 0.04, knuckles: true },
};

export const isKnife = (weapon: string): boolean => weapon in KNIVES;
export const isGloves = (weapon: string): boolean => weapon in GLOVES;
