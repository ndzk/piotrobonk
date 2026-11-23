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
    /** The start of a slide passes through bodies (not through attacks): a wall of enemies can be slid through. */
    slideGrace: 0.3,
    slideJumpBoost: 1.08,
    fastFallSpeed: 22,
    stepHeight: 0.42,
    /** Short: a crowd that catches Piotrek hits again soon. */
    invulnerability: 0.45,
    /** Seconds after a hit before regeneration starts again. */
    regenPause: 3,
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
    /** A heavy blow (40+ damage, or 30 % of what it hit): AWP, Deagle, a maxed briefcase. */
    hitstopHeavy: 0.035,
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
    // A tense opening (BALANCE.md): standing still is punished from the first minute; moving is not.
    rate: [
      [0, 0.35],
      [60, 0.45],
      [120, 0.6],
      [240, 0.85],
      [300, 1.05],
      [420, 1.5],
      [600, 2.2],
    ] as const,
    /**
     * Never an empty plaza: below this many enemies alive (base + per minute, up to max) a group comes at once,
     * whatever the director says. The director only shapes the waves on top of it.
     */
    floor: { base: 6, perMinute: 6, max: 50, every: 0.35 },
    /** Enemy health multiplier grows linearly by this much per minute. */
    hpPerMinute: 0.22,
    maxEnemies: 480,
    spawnRadius: [20, 30] as const,
    /** Despawn and respawn closer when an enemy is this far behind. */
    leashRadius: 48,
  },

  xp: {
    /** XP needed for level n -> n+1: base + linear * (n-1) + curve * (n-1)^power. */
    base: 4,
    linear: 2.5,
    curve: 0.58,
    power: 1.65,
    magnetSpeed: 16,
    maxCoins: 900,
  },

  /**
   * Diminishing returns (BALANCE.md, "Siła gracza"): stacking one stat stops being the whole build. Armour blocks
   * cap × a / (a + half); attacks never come faster than `minCooldown` of their base time; luck and pickup reach
   * bend towards a ceiling as soft caps (x / (1 + x × soft)).
   */
  limits: {
    armorCap: 0.6,
    armorHalf: 0.45,
    /** All attack speed together (weapon levels, passives, the gun): never under this share of the base time. */
    minCooldown: 0.6,
    /** Crit chance never goes past this, however much luck. */
    critCap: 0.25,
    /** Every weapon's hard limits, unless it has its own (WeaponDef.limits). */
    weapon: { count: 8, reach: 6, area: 4, seconds: 0.15 },
    luckSoft: 0.7,
    magnetSoft: 0.6,
    /** Kebab XXL: health per kill, and no more than this per second however big the crowd. */
    lifestealPerSecond: 2,
  },

  /** Camping: staying within `radius` metres for `after` seconds brings a flock and a ring every `every` s. */
  camping: { radius: 5, after: 10, every: 4 },
  /** Kiting: running at `speed` of a full run for `after` s (from second `from`) sends `count` fast ones every `every` s. */
  kiting: { speed: 0.8, after: 20, every: 12, count: 2, from: 150 },

  /** Evolutions wait for this many seconds of the run, per kurs: a chest before then gives upgrades. */
  evolveFrom: { spokojny: 210, normalnie: 270, opoznienie: 300 },

  cards: {
    /** Base rarity weights; luck moves weight from common to the rarer tiers. */
    weights: { common: 64, rare: 24, epic: 9, legendary: 3 },
    luckShift: 0.6,
    /** What a card's rarity does to its level's increments (additive within the weapon's budget, BALANCE.md). */
    multiplier: { common: 1, rare: 1.15, epic: 1.3, legendary: 1.5 },
    rerolls: 1,
    skips: 3,
    banishes: 2,
    weaponSlots: 4,
    passiveSlots: 4,
  },

  /**
   * The three kursy. Multipliers are the last layer (BALANCE.md): what separates them first is mechanics,
   * how many affixes an elite has, how long a boss warns (`telegraph`), whether it has its extra phase, how soon
   * the last train leaves (`lastTrain`, a share of the boss's own deadline in TUNING.boss.fight: when the Nocne
   * Kanary come).
   */
  difficulty: {
    spokojny: { hp: 0.75, damage: 0.45, bossAt: 300, waves: 0.85, bossHp: 0.6, bossPace: 1.4, telegraph: 1.25, affixes: 1, extraPhase: false, lastTrain: 1.5, lead: 0 },
    normalnie: { hp: 1, damage: 1.5, bossAt: 360, waves: 1, bossHp: 3, bossPace: 1, telegraph: 1, affixes: 1, extraPhase: false, lastTrain: 1, lead: 1 },
    /** More damage and faster attacks, not more boss health: a sponge is not harder, only longer. */
    opoznienie: { hp: 1.15, damage: 1.9, bossAt: 420, waves: 1.1, bossHp: 3.3, bossPace: 0.8, telegraph: 0.85, affixes: 2, extraPhase: true, lastTrain: 0.85, lead: 1 },
  },

  /**
   * The wave director (src/game/director.ts): phase lengths in seconds and spawn multipliers. Spokojny reads
   * the player (adaptive); the others run on the seed and the clock only.
   */
  director: {
    spokojny: { build: [22, 30] as const, peak: [12, 16] as const, fade: [6, 8] as const, relax: [10, 14] as const, buildMul: [0.8, 1.1] as const, peakMul: 1.35, fadeMul: [1.05, 0.75] as const, relaxMul: 0.55, start: 35, adaptive: true, intensityPeak: 0.9 },
    normalnie: { build: [20, 26] as const, peak: [14, 18] as const, fade: [5, 7] as const, relax: [10, 13] as const, buildMul: [0.85, 1.15] as const, peakMul: 1.6, fadeMul: [1.1, 0.8] as const, relaxMul: 0.6, start: 30, adaptive: false, intensityPeak: 1 },
    opoznienie: { build: [18, 24] as const, peak: [16, 20] as const, fade: [5, 6] as const, relax: [6, 8] as const, buildMul: [0.9, 1.2] as const, peakMul: 1.6, fadeMul: [1.15, 0.85] as const, relaxMul: 0.65, start: 25, adaptive: false, intensityPeak: 1 },
  },

  /** Spawn shapes (BALANCE.md): some groups appear ahead of where Piotrek run; peaks open with a pattern. */
  patterns: {
    /** Share of steady groups placed ahead of Piotrek's run (when moving), and how far ahead. */
    aheadShare: 0.3,
    ahead: [22, 28] as const,
    /** A ring closing in: radius, enemies (grows by `ringPerMinute`). */
    ring: 13,
    ringCount: 14,
    ringPerMinute: 3,
    /** A wall across the way: distance ahead, length, enemies per metre. */
    wall: 12,
    wallLength: 16,
    wallStep: 1.1,
    flock: 9,
  },

  /** The ladder modifiers' numbers (src/content/difficulty.ts says what each one is). */
  ladder: {
    /** Pociąg skrócony: the arena's radius. */
    shortTrain: 0.75,
    /** Ostatni pociąg wcześniej: the boss fight's clock before the Nocne Kanary. */
    lastTrainEarly: 0.67,
    /** Twarde siedzenia / Ostry hamulec: enemy health / damage. */
    hardSeats: 1.25,
    hardBrake: 1.25,
    /** Bez ulgi: every heal. */
    noDiscount: 0.75,
    /** Przepełniony skład: spawn rate. Zepsuty rozkład: spawn rate, and peaks this much longer (breathers shorter). */
    crowded: 1.15,
    brokenTimetable: 1.12,
    brokenPeaks: 1.3,
    /** Bartek pije podwójne espresso: every boss's pauses and warnings. */
    espressoPace: 0.85,
    espressoTelegraph: 0.85,
    /** Tłok na peronie: enemies in a ring, and its radius (tighter). */
    platformCrowd: 1.3,
    platformRing: 0.8,
    /** Godzina szczytu: weight of the late passengers among the spawns. */
    rushHour: 2,
  },

  /** Events at fixed minutes (before the boss): announced a few seconds ahead. */
  events: [
    { at: 135, kind: 'golebie' },
    { at: 215, kind: 'kontrola' },
    { at: 290, kind: 'zlomiarze' },
  ] as const,
  eventWarn: 3,
  /**
   * The events' sizes. Kontrola's four zones sit `controlDistance` from Piotrek with `controlRadius`: that leaves
   * a 2,7 m gap between neighbours and a 4 m clear spot in the middle (BALANCE.md: no trap without a way out).
   */
  eventsTuning: { raid: 18, raidSpeed: 1.2, controlDistance: 9, controlRadius: 5, controlDamage: 8, controlTime: 10 },

  boss: {
    /**
     * Every ground attack aimed at Piotrek must be escapable on foot: its warning is at least as long as running
     * out of it takes at this share of the running speed (a slide gets out with time to spare).
     */
    escapeSpeed: 0.85,
    /** After this many seconds a boss is enraged: shorter pauses, faster on its feet (and it says so). */
    enrageAt: 120,
    enragePace: 0.7,
    enrageSpeed: 1.25,
    /** Feet this far above the ground let a boss's shockwave pass under them (a jump clears it). */
    waveClear: 0.45,
    /** Every so often the boss calls in a handful of minions (a warning ring first). */
    minionsEvery: 16,
    minions: 4,
    /** The extra phase on Opóźnienie 120 min and up: from this share of health, faster and with everything. */
    extraAt: 0.15,
    /**
     * Phase gates: a hit never takes a boss past the next phase's threshold (the rest is lost), and the change of
     * phase is this many seconds in which it cannot be hurt (and starts no attack).
     */
    transition: 2.5,
    /**
     * Each boss fight's kill times on Normalnie (BALANCE.md, "Bossowie"): the fastest the oracle with the best
     * build may ever manage, and the upper end of where its fights should land. The last train leaves at twice
     * the upper end (times the kurs's `lastTrain`), and the Nocne Kanary end any fight that runs on past it.
     */
    fight: {
      fabryczna: [120, 150],
      niciarniana: [120, 150],
      widzew: [120, 150],
      andrzejow: [135, 180],
      bedon: [135, 180],
      justynow: [135, 180],
      galkowek: [150, 210],
      zakowice: [150, 210],
      koluszki: [210, 300],
    } as Record<string, readonly [number, number]>,
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
    /**
     * Harder kursy (Opóźnienie and the ladder's espresso): more and faster lemurs, a sip that heals more, coffee
     * spilt over the car park in the third phase, a narrower slap window.
     */
    harder: { lemurs: 1.5, lemurSpeed: 1.3, sipHeal: 2, spillEvery: 6, spill: 3.2, spillDamage: 7, qteWindow: 0.1 },
    easier: { lemurs: 0.75, lemurSpeed: 0.9, sipHeal: 0.7, qteWindow: 0.18 },
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
    critMultiplier: 1.75,
    /**
     * A touch's damage before the kurs and the minute: `flat` + `per` × the enemy's own damage. Four or five
     * touches finish Piotrek at the start of Normalnie (BALANCE.md, "Dźwignie").
     */
    touch: { flat: 10, per: 1.2 },
    /** The bus at full speed on Normalnie: this share of Piotrek's health, whatever the armour (all of it on Opóźnienie). */
    runOver: 0.6,
    minDamage: 1,
    /** Enemy contact damage grows by this fraction per minute of the run. */
    enemyDamagePerMinute: 0.075,
    /** Seconds between two ticks of the same puddle on one enemy (scaled by attack speed). */
    puddleTick: 0.3,
    /** Extra damage an enemy marked by Kontrola Biletów takes. */
    vulnerable: 1.5,
    /** HP restored per kill by Kebab's lifesteal (capped per second in `limits`). */
    lifesteal: 1,
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
