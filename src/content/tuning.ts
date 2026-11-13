// Game-feel tuning in one place: movement, camera, juice, waves, levelling. Units: metres, seconds.
export const TUNING = {
  simHz: 60,

  player: {
    maxHp: 120,
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
    /** A jump pressed shortly before landing (kept by the jump buffer) fires on touchdown within this window
     * and skips ground friction: bunny hops keep their speed. */
    bhopWindow: 0.12,
    bhopBoost: 0.4,
    /** Slide: burst on top of the current speed (smaller when slides are chained), never slower than running. */
    slideBoost: 4.2,
    slideMaxSpeed: 13,
    slideFriction: 1.6,
    slideDuration: 0.75,
    slideCooldown: 0.35,
    slideJumpBoost: 1.08,
    fastFallSpeed: 22,
    stepHeight: 0.42,
    invulnerability: 0.6,
    pickupRadius: 2.4,
  },

  camera: {
    distance: 5.4,
    minDistance: 0.25,
    /** Below this distance Piotrek is hidden so the camera never shows the inside of the model. */
    hideDistance: 0.9,
    height: 1.55,
    shoulder: 0.45,
    fov: 70,
    fovSpeedBoost: 10,
    mouseSensitivity: 0.0023,
    stickSensitivity: 3.2,
    pitchMin: -1.15,
    pitchMax: 0.55,
    /** How fast the camera target follows Piotrek vertically (step-ups, landings), 1/s. */
    follow: 12,
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
      [0, 0.35],
      [45, 0.65],
      [120, 1.2],
      [240, 2.6],
      [300, 3.8],
      [420, 5.6],
      [600, 8],
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
    base: 5,
    linear: 3.2,
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
    minDamage: 1,
    /** Enemy contact damage grows by this fraction per minute of the run. */
    enemyDamagePerMinute: 0.12,
  },
};
