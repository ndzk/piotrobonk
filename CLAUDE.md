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
track rebuild + train). Next: stage 4 — bottles as a between-run currency, hub with the recyklomat,
CS2 skins from the ByMykel snapshot (palettes only, never Valve images), then stages 5–7 (finale with
Bartek D. under Dino in Koluszki, platform features, polish).

## Where things live

| Path | What |
|---|---|
| `src/content/` | all data: weapons/passives (`items.ts`), enemies, bosses, stations (one file per stop), tuning, UI strings, SFX, music, characters |
| `src/game/` | simulation: `game.ts` (run flow), `player.ts`, `enemies.ts`, `weapons.ts`, `boss.ts`, `hazards.ts`, `interactables.ts`, `world.ts`, `bot.ts` |
| `src/ui/` | DOM screens: HUD, level-up, chest, route map, boss UI, cleared, pause/summary |
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
node scripts/render-characters.ts                  # character sheet (needs ref/, local only)
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
  against `npm run build` + `vite preview` instead.

## CI / deploy

`.github/workflows/checks.yml` is the reusable gate (typecheck, lint, Vitest, build, size budget,
offline build, Playwright). `ci.yml` runs it on push, deploys to Pages on `main`, then re-runs the full
e2e against the live URL once it serves the new commit. `release.yml` publishes an offline zip on a `v*`
tag. Never push to Pages by hand.
