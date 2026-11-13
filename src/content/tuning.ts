// Game-feel tuning in one place: movement, camera, juice, waves, levelling. Units: metres, seconds.
export const TUNING = {
  simHz: 60,

  player: {
    maxHp: 100,
    radius: 0.38,
    height: 1.75,
    /** Ground movement (Quake-style acceleration toward the wished speed). */
    runSpeed: 7.2,
    groundAccel: 11,
    friction: 9,
    stopSpeed: 2.5,
    /** Air movement: small acceleration, but strafing can still add speed up to airMaxSpeed. */
    airAccel: 2.4,
    airWishSpeed: 1.6,
    airMaxSpeed: 15,
    gravity: 26,
    fallGravityMul: 1.45,
    jumpVelocity: 8.4,
    /** Releasing jump early cuts the rise (variable jump height). */
    jumpCut: 0.5,
    coyoteTime: 0.12,
    jumpBuffer: 0.14,
    /** Jumping within this time after landing skips ground friction: bunny hops keep their speed. */
    bhopWindow: 0.1,
    bhopBoost: 0.4,
    slideBoost: 4.2,
    slideMaxSpeed: 14,
    slideFriction: 1.6,
    slideDuration: 0.85,
    slideCooldown: 0.35,
    slideJumpBoost: 1.08,
    fastFallSpeed: 22,
    stepHeight: 0.42,
    invulnerability: 0.45,
    pickupRadius: 2.4,
    regenDelay: 0,
  },

  camera: {
    distance: 5.4,
    minDistance: 1.4,
    height: 1.55,
    shoulder: 0.45,
    fov: 70,
    fovSpeedBoost: 10,
    mouseSensitivity: 0.0023,
    stickSensitivity: 3.2,
    pitchMin: -1.15,
    pitchMax: 0.55,
    follow: 18,
    collisionPadding: 0.3,
  },

  feel: {
    hitstopCrit: 0.05,
    hitstopHurt: 0.07,
    shakeHit: 0.08,
    shakeCrit: 0.18,
    shakeHurt: 0.5,
    shakeLand: 0.12,
    shakeDecay: 2.4,
    shakeMaxOffset: 0.35,
    shakeMaxAngle: 0.04,
    flashTime: 0.09,
    damageNumberLife: 0.75,
    deathSlowMo: 0.25,
    deathSlowMoTime: 1.4,
  },

  waves: {
    /** Spawn groups per second over time (seconds, rate); linear between keys. A group is 1–5 enemies. */
    rate: [
      [0, 0.4],
      [45, 0.75],
      [120, 1.4],
      [240, 2.4],
      [420, 4],
      [600, 6],
    ] as const,
    /** Enemy health multiplier grows linearly by this much per minute. */
    hpPerMinute: 0.22,
    maxEnemies: 480,
    spawnRadius: [20, 30] as const,
    /** Despawn and respawn closer when an enemy is this far behind. */
    leashRadius: 48,
  },

  xp: {
    /** XP needed for level n -> n+1: base + linear * (n-1) + curve * (n-1)^power. */
    base: 6,
    linear: 4,
    curve: 0.75,
    power: 1.65,
    magnetSpeed: 16,
    maxCoins: 900,
  },

  cards: {
    /** Base rarity weights; luck moves weight from common to the rarer tiers. */
    weights: { common: 64, rare: 24, epic: 9, legendary: 3 },
    luckShift: 0.6,
    multiplier: { common: 1, rare: 1.35, epic: 1.75, legendary: 2.4 },
    rerolls: 2,
    skips: 3,
    banishes: 2,
    weaponSlots: 4,
    passiveSlots: 4,
  },

  combat: {
    baseCrit: 0.06,
    critMultiplier: 2,
    armorReduction: 1,
    minDamage: 1,
  },
};
