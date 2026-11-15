# PIOTROBONK — working notes for Claude Code

Read this first on a fresh machine. Design decisions and the full per-stage changelog are in `DESIGN.md`;
this file is only what an agent needs to pick the work up.

## What this is

A 3D survivors-like (Megabonk × Vampire Survivors) in the browser, Polish throughout, built in stages to a
"polished Steam indie" bar. Story: someone stole the rails of line 17, so Piotrek walk home from Łódź
Fabryczna to Koluszki and beat a boss at every stop to rebuild the track.

- Repo: `ndzk/piotrobonk` (public). Live: <https://ndzk.github.io/piotrobonk/>
- Stack: Vite 8 (Rolldown) + TypeScript 6.0 strict + Three.js r187 (WebGL2), no backend, no external art.
  Everything procedural: geometry from primitives, canvas textures, WebAudio SFX and music.

## Hard rules

- **Piotrek use they/them.** In Polish that means plural verbs: "Piotrek idą", "Piotrek nie dojechali".
  Never a masculine singular about the player, anywhere. `tests/pronouns.test.ts` scans `src/content/`
  and the static HTML for this and will fail the build.
- **Real people.** Piotrek and Bartek D. are real and consented. Raw photos live in `ref/` (gitignored)
  and must never reach the repo or a build — only models and textures derived from them. The finale gag
  gives Bartek D. a literal stick ("kij"), not a phallic prop.
- **Zero placeholders.** No TODOs, no "temporary" art, no dead data. Zero console errors *and* warnings,
  zero TypeScript and ESLint errors, 60 FPS with 400+ enemies, no allocations in the game loop.
- Every player action gets visual *and* audio feedback; every screen animates in and out.
- Texts are Polish with correct grammar (decimal comma, plural forms via `src/core/text.ts`).
- Commits: English, short subject, no body, no trailers.

## Stage workflow (the user's process)

Each stage ends with: an independent reviewer subagent that did not write the code plays it (bot +
Playwright), looks at screenshots, reads the code and lists everything ugly, clunky, unbalanced or buggy
→ fix the **whole** list → green CI → deploy → verify the live Pages URL → commit → next stage.

Done so far: stage 0 (CI/CD, Pages, releases), stage 1 (characters, movement, arena, first weapon,
enemies, XP, cards), stage 2 (11 weapons + 10 evolutions, passives, chests, coffee machines, bins,
bottles, Złomiarz, bus), stage 3 (route map, 9 station arenas, 8 bosses with phases, progress saving,
track rebuild + train), stage 4 (hub with the recyklomat and an attract-mode demo on the station screen,
real CS2 cases from the ByMykel snapshot, roulette, trade-ups, buy-back, inventory with 3D inspect, gun skins
that change how Gnat z CS fires, ★ knives instead of the briefcase, ★ gloves, pattern wraps), stage 5
(finale with Bartek D. under Dino in Koluszki: coffee shield, lemur refills, knockout, the slap QTE, the cup
in slow motion, train, end card and credits; the in-engine intro; Bartek's video calls; the cup trophy),
stage 6 (PWA with update toast, icons and og:image, touch controls, key/pad rebinding, full settings from
the hub and the pause, quality presets with dynamic resolution and an FPS cap, save v4 with lifetime stats,
achievements, the journal with compendium and changelog, save export/import, the daily run with share
links), stage 7 (polish from a full playthrough: see POLISH.md). The full original brief is in `ref/BRIEF.md` (local only, like the photos).

## Where things live

| Path | What |
|---|---|
| `src/content/` | all data: weapons/passives (`items.ts`), enemies, bosses, stations (one file per stop), tuning, UI strings, SFX, music, characters, dialogs, the hub (`hub.ts`) |
| `src/content/skins/` | CS2 data: `snapshot.json` (generated), rarities/odds/prices (`index.ts`), CS weapon classes and model recipes (`catalog.ts`), palette fixes (`looks.ts`) |
| `src/hub/`, `src/render/` | hub scene; skin shader, CS models, thumbnails, the held kit |
| `src/game/` | simulation: `game.ts` (run flow, finale), `player.ts`, `enemies.ts`, `weapons.ts`, `boss.ts`, `hazards.ts`, `interactables.ts`, `world.ts`, `bot.ts`; `bartek.ts` (his rig), `coffee.ts` (cup + slap bar), `intro.ts` |
| `src/ui/` | DOM screens: HUD, level-up, chest, route map, boss UI, cleared, pause/summary; `story.ts` (dialogue box, video call, finale UI, credits); `settings.ts`, `journal.ts` (+ achievement toasts), `daily.ts` (result card), `touch.ts` |
| `src/core/` | save (v4) and settings, `daily.ts` (daily plan, score, share codes), `transfer.ts` (save as file / code), `platform.ts` (wake lock, rumble, fullscreen, share, files) |
| `src/render/quality.ts`, `readback.ts` | quality presets, resolution governor, FPS cap; GPU read-back without three.js's 4 ms flushing poll |
| `src/render/`, `src/characters/` | shared Three.js helpers, procedural people |
| `scripts/` | dev tools (see below) |
| `e2e/`, `tests/`, `src/**/*.test.ts` | Playwright and Vitest |

## Commands

```bash
npm ci && npm run dev                  # dev server
npm run typecheck && npm run lint && npm test && npm run build && npm run e2e
node scripts/bot-run.ts 120 out "&stacja=widzew"   # bot plays, screenshots + console report
node scripts/render-station.ts widzew out          # arena from four angles
node scripts/render-station.ts fabryczna out "&boss=kanar"   # a boss model in an arena
node scripts/boss-balance.ts normalnie             # every boss fight measured
node scripts/weapon-balance.ts 20 [--bron=kawa,gnat]  # each weapon alone, maxed: DPS and kills/min
node scripts/station-balance.ts [--kurs=normalnie] [--stacja=widzew]  # natural bot runs, clock x3
node scripts/render-characters.ts                  # character sheet (needs ref/, local only)
node scripts/fetch-skins.ts [--refresh-palettes]   # rebuild the CS2 skin snapshot (downloads ~40 MB)
node scripts/make-icons.ts                         # app icons and favicons into public/icons
node scripts/og-image.ts dist                      # link preview from the built title screen (CI does it)
```

URL params: `?debug=1` (F1 menu: immortality, +1000 bottles, spawn boss, next station), `?bot=1`,
`?seed=N`, `?stacja=<id>` (needs `debug` or `bot`). With either flag `window.__game` is the Game.

## Gotchas learned the hard way

- TypeScript is pinned to 6.0 (typescript-eslint needs < 6.1).
- Firefox e2e only works in CI headed under `xvfb-run` — headless Linux Firefox has no WebGL at all.
- Logic e2e tests skip on `test.info().project.name !== 'chromium'`; the `android` project is Chromium
  too, so skipping by `browserName` silently runs them on a phone viewport under software GL.
- Under SwiftShader the simulation runs slower than real time: give boss/flow tests generous budgets and
  drive them by game state, not wall clock.
- The enemy pool compacts on every death, so never hold a raw index across a step — the boss is keyed by
  `uid` for exactly this reason.
- `Material.dispose()` does not free its textures; arenas go through `src/render/dispose.ts`.
- Bot runs against the dev server, so a file save mid-run reloads the page and resets the run; measure
  against `npm run build` + `vite preview` instead. Same for a reviewer subagent: do not edit `src/` while
  it plays against the dev server.
- On the user's Windows PC: Node 24 works (engines say 26; `npm ci` only warns). Playwright's full Chromium
  fails to start there (side-by-side error), so run e2e locally with `PW_SHELL=1` (headless shell) and
  `CI=1` (headless has no GPU: same SwiftShader noise filter as CI). Bash heredocs mangle long edits there:
  write a script file and run it.
- The hub's attract demo is the same `Game` in `demo` mode (own bot-driven `Input`, muted `gameAudio`,
  throwaway save, renders into a texture). Anything new in `Game` that touches the save, audio, DOM or
  pointer lock must respect `this.demo`.
- Skins share one shader program (`customProgramCacheKey`), compiled in `Game.warmup` / `HubScene.warmup`
  for plain and instanced meshes; equipping must never call `renderer.compile`.
- The finale is its own little state machine in `game.ts` (`finaleStage`: knockout → qte → slap → after →
  ending, then `credits`). In the `finale` state the simulation step does not run: anything that must still
  move there (the player's slap pose, fx, particles, drops, shards, the cup, the train) is driven from
  `finaleFrame` with real or slowed time. The knockout cuts to Bartek's chair on purpose, so the slap and
  the cup's flight always play on the same clear tarmac; keep the strip east of the chair empty. The ending
  plays on the Koluszki platform west of the canopy (`endingSpot`). The finish is recorded at the slap
  (`settleFinale`), never later.
- `scripts/*.ts` that drive a browser take `PW_SHELL=1` on this PC too (headless shell).
- Never use `renderer.readRenderTargetPixelsAsync`: in headless Chromium in CI its 4 ms fence polling
  starved the frame loop. Use `readPixelsAsync` from `src/render/readback.ts`.
- The `minimatch ^11` override broke `glob` 11 inside workbox-build (it needs minimatch 10) and the PWA
  precached only icons everywhere; workbox-build now gets `glob` 14. The build log must say ~28 precache
  entries. The service worker is not registered with `?debug=1` or `?bot=1`.
- Every commit needs a Polish line (or `null` for tooling-only commits) in `src/content/changelog.ts`, keyed
  by its exact subject: `tests/changelog.test.ts` fails otherwise. Add it in the same commit.
- Text size zooms `#ui`; CSS divides viewport units by `var(--zoom, 1)`. New CSS inside `#ui` must do the
  same (`calc(100dvh / var(--zoom, 1))`), and JS that positions things in screen pixels inside `#ui` must
  divide by the zoom. The touch controls live outside `#ui` on purpose.
- Touch input never takes the pointer lock (Chromium reports fingers at (0, 0) under it). In `held` mode
  (cards, chest, call) the touch zones must not take new fingers, or nothing under them can be tapped.
- Boss attacks can carry an `effect` (stun, slow, invert, block) and projectiles a `look` (rail, spool); the
  game applies them in `hazardHit` and `step`. `magnet` and `roll` are attack kinds of their own.
- Station and boss music: `src/content/compose.ts` writes each loop's bass, lead and pad from its id; the
  music test fails if two stations or two bosses share a melody.
- Piotrek have an x-ray twin of every body mesh (yellow, drawn only where something occludes them, render
  order 5 between the world and the body at 10). New body meshes added later get none; that is on purpose.
- Every enemy (not only bosses) dithers out near the camera, range from its model's size, as a uniform.
- Nothing may compile a shader after start-up (an e2e test counts `linkProgram` calls through the hub, the
  Recyklomat, the inventory and a run). three.js deletes a program with the last material using it: shared
  programs (the skin, the CS model lens and studs) are held by never-disposed probes from `csProbes()` in each
  scene's warm-up. Warm-ups go through `precompile()` (parallel compile where the browser has it), and a
  scene drawn into a render target (the hub's demo screen, thumbnails, portraits) needs its own pass with
  that target set. Profile stutter with a CDP CPU profile and long-animation-frame entries on a GPU-backed
  headless Chromium (`--use-angle=d3d11 --enable-gpu`): SwiftShader hides and invents different costs.
- 2D canvases that are painted with many strokes or read back (`toDataURL`, `getImageData`) take
  `getContext('2d', { willReadFrequently: true })`: as GPU canvases, the faces and the first read-back cost
  over a second of start-up.
- Settings are applied in one place, `applySettings()` in `main.ts` (audio, game, input bindings, `zoom` of
  `#ui` for text size, colour-blind palette, quality, the title's control list). Achievements are checked
  about once a second there; their toasts wait while `toasts.allowed` is false (title, cards, cinematics).
- New screens that take input must be routed in `main.ts`'s frame loop (the title, hub and route branches
  check open overlays in order: daily card, journal, settings, then the rest).
- Bartek's dialogue lines, the intro and the calls are data in `src/content/dialogs.ts`; the pronoun test
  covers them too (Bartek talks to Piotrek in the plural).
- The save has a revision number; `saveSave` refuses to overwrite a newer one (another tab) and the game
  then asks for a reload. Route every save through `persist()` in `main.ts`.

## CI / deploy

`.github/workflows/checks.yml` is the reusable gate (typecheck, lint, Vitest, build, size budget,
offline build, Playwright). `ci.yml` runs it on push, deploys to Pages on `main`, then re-runs the full
e2e against the live URL once it serves the new commit. `release.yml` publishes an offline zip on a `v*`
tag. Never push to Pages by hand.
