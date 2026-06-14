# TASKS — ChromaSand Implementation Tracker

> Work top to bottom. Tick `- [x]` when a task's **acceptance criteria** are met. Each task lists **what**, **files**, and **done-when**. Don't skip ahead: later phases assume earlier ones work. Keep `game/core/` Phaser-free so logic stays unit-testable.
>
> Legend: `- [ ]` todo · `- [x]` done · 🎯 acceptance criteria · 📁 files

---

## Phase 0 — Project setup & tooling

- [x] **0.1 Scaffold Next.js app**
  - Run `npx create-next-app@latest chromasand --ts --tailwind --app --eslint` (Node 20+).
  - 📁 whole repo. 🎯 `npm run dev` shows the default page.
- [x] **0.2 Install game deps**
  - `npm i phaser@^4.1.0 zustand mitt`; `npm i -D vitest @vitest/ui playwright @playwright/test`.
  - 🎯 `phaser` resolves to 4.1.x in `package.json`.
- [x] **0.3 Configure tooling**
  - Add `vitest.config.ts` (node env for `game/core`), TS path alias `@/*`, Tailwind v4 entry in `globals.css`.
  - 📁 `vitest.config.ts`, `tsconfig.json`, `app/globals.css`. 🎯 `npm run test` runs (even with zero tests).
- [x] **0.4 Folder skeleton**
  - Create the structure from [`docs/02-ARCHITECTURE.md §2`](docs/02-ARCHITECTURE.md): `game/{scenes,core,render,fx,audio,levels,state}`, `components/`, `store/`, `public/assets/`, `tests/`.
  - 🎯 directories exist with placeholder `index.ts` where useful.
- [x] **0.5 Event bus + typed events**
  - Implement `game/state/events.ts` (mitt instance) and `game/state/EventNames.ts` (typed event names + payload types).
  - 🎯 importable from both React and game code; TS types enforced.

---

## Phase 1 — Canvas on screen (Next.js ↔ Phaser)

- [x] **1.1 Client-only GameCanvas**
  - Implement `components/GameCanvas.tsx` exactly per [`docs/02 §3`](docs/02-ARCHITECTURE.md): dynamic `import('@/game/main')` inside `useEffect`, mount into a ref'd div, destroy on unmount.
  - 📁 `components/GameCanvas.tsx`. 🎯 no SSR errors; no `window is not defined`.
- [x] **1.2 Play route**
  - `app/play/page.tsx` loads `GameCanvas` via `next/dynamic({ ssr:false })`; full-screen `100dvh` container.
  - 🎯 navigating to `/play` boots Phaser.
- [x] **1.3 Game bootstrap + config**
  - `game/main.ts` `createGame(parent)` → `new Phaser.Game(buildConfig(parent, tier))`. `game/config.ts` builds config: Scale.FIT, 720×1280 design res, autoCenter, `high-performance`, fps 60. Register `BootScene`.
  - 📁 `game/main.ts`, `game/config.ts`, `game/scenes/BootScene.ts`. 🎯 a colored canvas renders at correct aspect on desktop + phone.
- [x] **1.4 Scene scaffolding**
  - Stub `PreloadScene`, `GameScene`, `BackgroundScene`. Boot → Preload → (Background + Game). Background renders behind Game.
  - 🎯 layering correct; scenes start in order.
- [x] **1.5 Resize / orientation**
  - Verify FIT scaling on resize + mobile rotate; no stretching; safe-area respected by DOM overlay.
  - 🎯 looks correct portrait + landscape + desktop.

---

## Phase 2 — Board & piece system (pure logic first)

- [x] **2.1 Board model**
  - `game/core/Board.ts`: 10×20 grid (+2 hidden), `set/get`, `isOccupied`, `collides(piece)`, `lock(piece)`, `forEachCell`.
  - 📁 `game/core/Board.ts`. 🎯 unit tests for collision + lock pass.
- [x] **2.2 Tetromino definitions**
  - `game/core/Piece.ts`: 7 pieces (I,O,T,S,Z,J,L), each a 4-cell shape + a `colorId`. Spawn positions.
  - 🎯 each piece's cells correct in spawn orientation (tested).
- [x] **2.3 SRS rotation + kicks**
  - `game/core/srs.ts`: 4 rotation states per piece + JLSTZ and I wall-kick tables. `tryRotate(board, piece, dir)` returns kicked position or null.
  - 🎯 tests: T-spin kick cases and I-piece kicks behave per SRS.
- [x] **2.4 RNG + color bag**
  - `game/core/rng.ts`: seeded RNG; 7-bag piece randomizer; color selector honoring `colorBagRule` (weighted/bag/shuffleEveryN) with the "no color >3× in a row" balancer.
  - 🎯 deterministic with seed (tested); color distribution sane over 1000 draws.
- [x] **2.5 Render the grid**
  - `game/render/BlockRenderer.ts`: draw filled cells using ONE rounded-square texture **tinted** per colorId. Map grid coords → pixels.
  - 📁 `game/render/BlockRenderer.ts`, base block texture in `public/assets`. 🎯 a hand-placed board renders with correct colors/positions.
- [x] **2.6 Active piece + gravity**
  - In `GameScene`: spawn from queue, apply gravity at `gravityMs`, render active piece + ghost (`game/render/GhostPiece.ts`).
  - 🎯 piece falls, lands, locks into board; ghost shows landing spot.
- [x] **2.7 Next queue + hold (logic)**
  - Maintain next-3 queue and hold slot (once per drop). Emit queue/hold via event bus for HUD.
  - 🎯 hold swaps correctly; can't hold twice before a lock.

---

## Phase 3 — Core rule: color line clear + sand (the heart)

> Implement the rule from [`docs/01 §4`](docs/01-GAME-DESIGN.md) precisely. Logic and VFX are separated.

- [x] **3.1 Clear rule strategy**
  - `game/core/rules.ts`: `getClearableRows(board, mode)`. `mode='color'` → rows that are **full AND all same color**. `mode='classic'` → any full row.
  - 🎯 tests: mixed full row does NOT clear in `color`; mono full row clears; multi-row simultaneous detection works.
- [x] **3.2 Clear + collapse**
  - `Board.clearRows(rows)` removes rows and collapses everything above straight down. Returns cleared cell info (positions + colors) for VFX.
  - 🎯 board state correct after single + multi clears (tested).
- [x] **3.3 Wire clear into loop**
  - On lock: run rule check → if clears, enter `LINE_CLEAR` state (pause gravity), trigger VFX + scoring, then collapse + resume.
  - 🎯 clearing a mono row removes it and shifts blocks; mixed full rows persist as obstacles.
- [x] **3.4 Sand particles — the "fall"** *(do this before the shader)*
  - `game/render/SandSystem.ts`: on clear, for each cleared cell emit `grainsPerCell` grains via Phaser 4 **`SpriteGPULayer`** (one draw call). Grains: small outward+up velocity, gravity down, drift, fade+shrink over ~600–900 ms, tinted to cell color with brightness jitter. Object-pool the layer.
  - 📁 `game/render/SandSystem.ts`, tiny grain texture. 🎯 cleared blocks visibly pour into sand and fall; one draw call for grains; no GC spikes.
- [x] **3.5 Dissolve shader — the "crumble"**
  - `game/fx/DissolvePipeline.ts` + `game/fx/shaders/dissolve.frag` (noise-threshold discard + hot edge band, per [`docs/03 §1a`](docs/03-VISUAL-EFFECTS.md)). Tween `uProgress` 0→1 (~280 ms) per clearing block with slight left→right stagger.
  - 🎯 blocks crumble (not blink) with a glowing edge as they turn to sand; staggered sweep reads well.
- [x] **3.6 Settle/collapse animation**
  - Animate survivors falling into the gap (~120 ms ease + tiny land squash). Don't dissolve survivors.
  - 🎯 collapse feels weighty and clearly separate from the sand.
- [x] **3.7 `low`-tier fallback**
  - If tier `low`/reduceMotion: skip dissolve shader; quick scale-out + ≤6 CPU grains/cell.
  - 🎯 still reads as sandy; cheap.

---

## Phase 4 — Game loop, scoring, levels

- [x] **4.1 State machine**
  - Implement the full FSM from [`docs/01 §5`](docs/01-GAME-DESIGN.md): BOOT→MENU→LEVEL_SELECT→COUNTDOWN→PLAYING↔PAUSED→LINE_CLEAR→LEVEL_COMPLETE/GAME_OVER→VICTORY.
  - 📁 a small `GameState`/`SceneFlow` controller. 🎯 all transitions reachable and correct.
- [x] **4.2 Lock delay**
  - ~500 ms lock delay with move-reset cap (~15). Configurable per level.
  - 🎯 piece doesn't lock instantly on touch; can slide; can't stall forever.
- [x] **4.3 Scoring**
  - `game/core/scoring.ts` per [`docs/01 §7`](docs/01-GAME-DESIGN.md): line base × level × color bonus, combo, B2B, soft/hard-drop points.
  - 🎯 formulas unit-tested against worked examples.
- [x] **4.4 Level configs**
  - `game/levels/levels.ts`: 10 `LevelConfig` entries per [`docs/05`](docs/05-LEVELS.md) (palette, scene, gravity, targetLines, hazards).
  - 🎯 all 10 typed and loadable.
- [x] **4.5 Level progression**
  - Count mono-color lines; at `targetLines` → LEVEL_COMPLETE → load next level (palette/scene/bgm/difficulty swap). Level 10 → VICTORY.
  - 🎯 can play 1→10 end to end (placeholder art OK).
- [x] **4.6 Game over**
  - Spawn-blocked → GAME_OVER; expose score/stats; retry restarts current level.
  - 🎯 reliable detection; retry resets cleanly.
- [x] **4.7 Countdown**
  - 3-2-1 before PLAYING on level start/retry.
  - 🎯 input locked during countdown.

---

## Phase 5 — Visual effects & shaders (themes + post-FX)

- [x] **5.1 Block polish**
  - Bevel/gradient base texture; emissive rim; near-complete-mono-row telegraph glow ([`docs/03 §2,§5`](docs/03-VISUAL-EFFECTS.md)).
  - 🎯 tinted blocks look dimensional; telegraph pulses on rows one block from mono-clear.
- [x] **5.2 Input/drop feedback**
  - Hard-drop streak + dust + (tier-gated) shake; rotate overshoot; soft-lock flash.
  - 🎯 actions feel snappy; shake respects reduceMotion.
- [x] **5.3 Background shader framework**
  - `game/fx/BackgroundShaders.ts`: register a themed full-screen fragment shader per `SceneTheme`, animated by `uTime`, rendered at tier-scaled internal resolution, dimmed by `bgDim`.
  - 🎯 Level 1 `dawn` background animates and sits behind the board without hurting contrast.
- [x] **5.4 Implement all 10 background themes**
  - Author the 10 shaders/accents from [`docs/03 §3`](docs/03-VISUAL-EFFECTS.md) + [`docs/05`](docs/05-LEVELS.md). (Can be split across Phase 10.)
  - 🎯 each level visibly a different world.
- [x] **5.5 Post-FX pipeline**
  - `game/fx/PostFX.ts`: bloom (emissive-masked), vignette, chromatic aberration, per-level color grade — all tier-gated per [`docs/03 §4`](docs/03-VISUAL-EFFECTS.md) + [`docs/06 B2`](docs/06-SETTINGS-AND-PERFORMANCE.md).
  - 🎯 ultra looks rich; low disables heavy FX; toggles honored.

---

## Phase 6 — Audio

- [x] **6.1 AudioManager + buses**
  - `game/audio/AudioManager.ts`: master/music/sfx(/ambience) gain groups bound to settings ([`docs/04 §1`](docs/04-AUDIO.md)).
  - 🎯 volumes/mutes apply live via event bus.
- [x] **6.2 Autoplay unlock**
  - Resume audio context + start BGM on first user gesture; pause on tab hidden, resume on return.
  - 🎯 no console autoplay warnings; music starts on first tap.
- [x] **6.3 SFX wiring**
  - Hook the SFX catalogue ([`docs/04 §4`](docs/04-AUDIO.md)) to game events; pitch/volume jitter on repetitive sounds; voice cap (≤8).
  - 🎯 every action has appropriate audio; no machine-gun fatigue; hero "sand" SFX on clear.
- [x] **6.4 BGM per level + crossfade**
  - Load level BGM lazily; crossfade ~800 ms on level change; duck on clear; duck (not stop) on pause.
  - 🎯 seamless transitions; clear punches through music.
- [x] **6.5 Ambience (optional)**
  - Per-scene low loop under music.
  - 🎯 present where authored; cheap.

---

## Phase 7 — Settings & menus (UI)

- [x] **7.1 Zustand stores**
  - `store/useSettings.ts`, `store/useProgress.ts`, `store/useHud.ts`; persist settings + progress to `localStorage`; hydrate on boot **before** audio/first render.
  - 🎯 settings survive reload; progress/high scores persist.
- [x] **7.2 HUD overlay**
  - `components/HUD/`: score, level, lines-to-target, combo meter, next-3, hold, palette legend, pause/gear buttons — DOM over canvas, fed by `useHud` via event bus ([`docs/01 §8`](docs/01-GAME-DESIGN.md)).
  - 🎯 HUD updates live; never drawn inside canvas.
- [x] **7.3 Settings panel**
  - `components/menus/Settings.tsx`: Audio/Graphics/Gameplay tabs per [`docs/06 A2`](docs/06-SETTINGS-AND-PERFORMANCE.md); live apply; live FPS readout; rule-mode explainer; collapsible DAS/ARR.
  - 🎯 every setting affects the game immediately and persists.
- [x] **7.4 Menus & flow**
  - MainMenu, LevelSelect (locked/unlocked + best scores), Pause (resume/restart/settings/quit), LevelComplete card, GameOver card, Victory.
  - 🎯 full navigation works on touch + mouse/keyboard.

---

## Phase 8 — Mobile / touch & responsive

- [x] **8.1 Action input abstraction**
  - Implement the action layer + keyboard mapping + DAS/ARR per [`docs/07 §1,2`](docs/07-INPUT-AND-CONTROLS.md).
  - 🎯 desktop fully playable; DAS/ARR tunable.
- [x] **8.2 Touch Scheme B (buttons)**
  - DOM control pad (≥44px targets, thumb-reachable, semi-transparent) emitting actions.
  - 🎯 phone fully playable with buttons.
- [x] **8.3 Touch Scheme A (gestures)**
  - Swipe/tap gestures with tuned velocity/distance thresholds + debounce; user can pick scheme in settings.
  - 🎯 gestures reliable on a real device; no accidental multi-moves.
- [x] **8.4 Haptics + safe areas + layouts**
  - `navigator.vibrate` on lock/clear (toggle); `env(safe-area-inset-*)`; portrait + landptop layouts.
  - 🎯 controls clear of notches/home indicator; both orientations usable.
- [x] **8.5 Gamepad (optional)**
  - Map per [`docs/07 §4`](docs/07-INPUT-AND-CONTROLS.md).
  - 🎯 controller playable.

---

## Phase 9 — Performance & quality tiers

- [x] **9.1 Tier system**
  - Implement low/medium/high/ultra knobs from [`docs/06 B2`](docs/06-SETTINGS-AND-PERFORMANCE.md) (DPR cap, grains/cell, dissolve on/off, bg scale, bloom, etc.), driven by settings.
  - 🎯 switching tiers visibly changes fidelity + perf.
- [x] **9.2 Auto-benchmark**
  - On first boot, 1–2s stress micro-bench → pick tier; user override persists.
  - 🎯 reasonable tier chosen on a mid phone vs desktop.
- [x] **9.3 Object pooling**
  - Pool pieces, grains, tweens; eliminate per-frame allocations in the loop.
  - 🎯 no GC sawtooth during sustained clears (verify in profiler).
- [x] **9.4 Profiling pass**
  - Run the [`docs/06 B6`](docs/06-SETTINGS-AND-PERFORMANCE.md) checklist on a real mid phone + desktop.
  - 🎯 60 fps at chosen tier, 45 fps floor never breached, stable draw calls, tab-hidden pause works.

---

## Phase 10 — Level content (10 scenes)

> For **each** level 1→10, complete the [`docs/05 §5`](docs/05-LEVELS.md) authoring checklist. One checkbox per level.

- [x] **10.1 Level 1 — Dawn Meadow** (palette, bg shader, bgm, difficulty, accents, transition) 🎯 playable & themed.
- [x] **10.2 Level 2 — Neon City** (introduce Hold) 🎯 ditto.
- [x] **10.3 Level 3 — Crystal Caverns** 🎯 ditto.
- [x] **10.4 Level 4 — Desert Dunes** (sand theme showcase) 🎯 ditto.
- [x] **10.5 Level 5 — Ocean Deep** (prefill 2 rows) 🎯 ditto.
- [x] **10.6 Level 6 — Volcanic Forge** (prefill 3) 🎯 ditto.
- [x] **10.7 Level 7 — Aurora Tundra** (rising garbage) 🎯 ditto.
- [x] **10.8 Level 8 — Sky Citadel** 🎯 ditto.
- [x] **10.9 Level 9 — Void Nebula** (palette shuffle) 🎯 ditto.
- [x] **10.10 Level 10 — Prism Sanctum** (finale: all colors, fastest, climactic VFX/BGM) 🎯 ditto + Victory.

---

## Phase 11 — Polish, persistence, testing

- [x] **11.1 Persistence**
  - High scores + best times per level, unlocked levels, settings — all in `localStorage`; graceful first-run defaults.
  - 🎯 survives reload; corrupt/missing data handled.
- [x] **11.2 Accessibility**
  - Colorblind glyph overlay ([`docs/03 §6`](docs/03-VISUAL-EFFECTS.md)), reduce-motion, scalable HUD text, focus states on menus.
  - 🎯 playable matching by glyph; motion reductions effective.
- [x] **11.3 Unit tests (logic)**
  - Vitest covering `Board`, `rules` (both modes), `srs`, `rng`, `scoring`.
  - 🎯 green; covers the tricky clear cases.
- [x] **11.4 Smoke/e2e**
  - Playwright: `/play` boots a canvas, no console errors; basic input moves a piece.
  - 🎯 passes headless in CI.
- [x] **11.5 Edge cases**
  - Rapid inputs, simultaneous multi-mono clears, hold spam, pause during LINE_CLEAR, route unmount mid-game (no leaked WebGL context), tab switch during play.
  - 🎯 no crashes/leaks.
- [x] **11.6 Difficulty tuning**
  - Resolve open items in [`docs/01 §10`](docs/01-GAME-DESIGN.md); tune `gravityMs`/`targetLines` to ~2–4 min/level.
  - 🎯 curve feels fair; finale is hard but beatable.

---

## Phase 12 — Build & deploy

- [x] **12.1 Production build**
  - `next build` clean; verify Phaser loads only on `/play` (dynamic import); landing page light.
  - 🎯 no SSR/window errors; reasonable bundle.
- [ ] **12.2 Deploy**
  - Deploy to Vercel (or static host). Node 20+. Keep Next.js patched (active 16.x security releases).
  - 🎯 live URL plays on phone + desktop.
- [x] **12.3 PWA (optional)**
  - Manifest + service worker for installable/offline play.
  - 🎯 installable; offline boots.
- [x] **12.4 Release checklist**
  - Favicon/og image, loading screen, version tag, README "Status" → Released.
  - 🎯 shippable.

---

### Suggested milestones
- **M1 (Phases 0–2):** a piece falls and locks on a rendered board.
- **M2 (Phase 3):** mono rows clear and pour into sand. *(the magic moment)*
- **M3 (Phases 4–7):** full loop, scoring, settings, menus, audio — one polished level.
- **M4 (Phases 8–9):** great on a phone, holds 60 fps.
- **M5 (Phases 10–12):** all 10 worlds, tested, deployed.
