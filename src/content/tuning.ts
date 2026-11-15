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
    // The first minutes used to be an empty plaza (a full health bar for four minutes): denser from the start.
    rate: [
      [0, 0.6],
      [45, 1.05],
      [120, 1.75],
      [240, 2.9],
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

  /** The three difficulties of a run ("Kurs"). */
  difficulty: {
    // The easy kurs must carry a player who never dodges on purpose (scripts/station-balance.ts, the bot).
    spokojny: { hp: 0.8, damage: 0.45, bossAt: 300, waves: 0.75, bossHp: 0.6, bossPace: 1.6 },
    normalnie: { hp: 1, damage: 1, bossAt: 360, waves: 1, bossHp: 1, bossPace: 1 },
    /** More damage and faster attacks, not more boss health: a sponge is not harder, only longer. */
    opoznienie: { hp: 1.35, damage: 1.3, bossAt: 420, waves: 1.25, bossHp: 1.05, bossPace: 0.75 },
  },

  boss: {
    /** Seconds the title card stays up before the fight starts. */
    intro: 2.8,
    /** Seconds of the track-rebuild animation after the boss goes down. */
    rebuild: 3.2,
    /** Seconds of the train rolling through afterwards. */
    train: 3.4,
    /** Waves keep coming during the fight, but thinner. */
    waveScale: 0.55,
  },

  /** The finale under Dino: Bartek's kopi luwak (0..1) is his shield, his healing and his rage. */
  finale: {
    /** Where he sits: in front of the shop windows (not the dark doorway), facing the car park. */
    seat: [23.5, 0.06, -20.4] as [number, number, number],
    /** He starts with a full cup: nearly untouchable until he has drunk some of it. */
    coffeeStart: 1,
    /** Seconds between sips in each phase (the third one he gulps). */
    sipEvery: [4, 4, 3.2],
    sip: 0.12,
    /** Fraction of his health one sip heals. */
    sipHeal: 0.01,
    /** Each lemur that reaches him tops the cup up by this much. */
    refill: 0.34,
    /** Share of damage he shrugs off at a full cup (it scales with the level). */
    shield: 0.8,
    /** A sip speeds up his attacks for this long, by this much (pace multiplier). */
    buffTime: 3,
    buffPace: 0.75,
    /** Lemurs run in from this far from him (metres), from the car park side away from Piotrek. */
    lemurRing: [15, 19] as [number, number],
    /** Lemur health against an ordinary enemy of the same minute: they take a deliberate effort to stop. */
    lemurHp: 2,
    /** A lemur hands over the refill from this close (metres). */
    lemurReach: 2.2,
    /** The slap: sweeps of the cursor per second, the target's share of the bar, how much it widens per miss. */
    qteSpeed: 0.85,
    qteWindow: 0.14,
    qteGrow: 0.05,
    qteMax: 0.42,
    /** Time runs at this speed while the cup flies. */
    slowMo: 0.25,
    /** The knockout: this many seconds of slow motion (at `koSpeed`) before the cut to the slap. */
    koTime: 1.3,
    koSpeed: 0.2,
  },

  combat: {
    baseCrit: 0.06,
    critMultiplier: 2,
    minDamage: 1,
    /** Enemy contact damage grows by this fraction per minute of the run. */
    enemyDamagePerMinute: 0.09,
    /** Seconds between two ticks of the same puddle on one enemy (scaled by attack speed). */
    puddleTick: 0.3,
    /** Extra damage an enemy marked by Kontrola Biletów takes. */
    vulnerable: 1.5,
    /** HP restored per kill by Kebab's lifesteal. */
    lifesteal: 2,
    /** Enemies cannot damage Piotrek while stunned. */
    stunnedHarmless: true,
    /** Boomerang return: homing acceleration and the speed it is capped at (m/s). */
    returnAccel: 30,
    returnMaxSpeed: 26,
    /** How far Sieć Trakcyjna's arcs reach beyond a strike. */
    arcRadius: 5,
    /** Length of the bus danger lane. */
    busWarnLength: 40,
  },
};
