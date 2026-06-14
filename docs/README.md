# ChromaSand

> Working title. A colorful, modern, mobile + desktop Tetris variant where **same‑colored full rows dissolve into sand**. Built with **Phaser 4** inside **Next.js 16**, with shader-driven visual effects, layered audio, an in-game settings panel, and **10 themed levels**.

---

## What makes it different

This is not classic Tetris. The core twist:

- Every falling tetromino is a **single solid color**.
- A horizontal line clears **only when every cell in that line is the same color**.
- When it clears, the blocks **crumble into falling sand grains** (GPU particles + a dissolve shader) rather than just blinking out.
- Each level introduces **more colors**, making mono-color rows progressively harder to assemble — that *is* the difficulty curve.
- 10 levels = 10 distinct **scenes** (palette, background shader, music, particle accents), ending in a final "Prism Sanctum."

There is an **Easy/Assist** rule variant (any full row clears) documented for accessibility; the color rule is the default.

> The exact clear rule is a deliberate design decision and is fully specified in [`docs/01-GAME-DESIGN.md`](docs/01-GAME-DESIGN.md). Read that first.

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Rendering | **Phaser 4.1.x** (WebGL) | Purpose-built 2D, mature particle system, new filter/FX + custom shader pipeline, `SpriteGPULayer` (massive sprite counts in one draw call) — ideal for the sand effect and mobile performance. |
| App shell | **Next.js 16.2.x** (App Router) + **React 19** | Routing, settings UI, asset hosting, static export / Vercel deploy. Phaser runs client-only via a dynamically imported canvas component. |
| Language | **TypeScript** | Type-safe game state, piece definitions, level configs. |
| Styling (UI chrome) | **Tailwind CSS v4** | Menus, settings, HUD overlays that live in the DOM above the canvas. |
| Audio | **Phaser Sound (Web Audio)** | Bus-based mixing for BGM / SFX with independent volume + mute. |
| State (UI ↔ game) | Lightweight **event bus** (`mitt`) + Zustand for React UI state | Decouples Phaser from React; no prop drilling. |
| Persistence | `localStorage` (settings, high scores, progress) | No backend required. |
| Testing | **Vitest** (logic) + **Playwright** (smoke/e2e) | Pure game logic is unit-tested headless; canvas boot is smoke-tested. |

> Three.js was considered and rejected: a 2D grid puzzle would require building 2D plumbing and a particle system on top of a 3D engine, hurting mobile performance and dev speed. Rationale in [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md).

---

## Documentation map

Read in this order:

1. [`docs/01-GAME-DESIGN.md`](docs/01-GAME-DESIGN.md) — Game Design Document: core loop, the color/sand clear rule, scoring, progression.
2. [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) — Engine choice, folder structure, Next.js↔Phaser integration, scene graph, state.
3. [`docs/03-VISUAL-EFFECTS.md`](docs/03-VISUAL-EFFECTS.md) — Shaders, the sand dissolve, post-processing, per-level themes.
4. [`docs/04-AUDIO.md`](docs/04-AUDIO.md) — Audio bus design, BGM/SFX, ducking, settings hooks.
5. [`docs/05-LEVELS.md`](docs/05-LEVELS.md) — All 10 level definitions (palette, scene, difficulty params).
6. [`docs/06-SETTINGS-AND-PERFORMANCE.md`](docs/06-SETTINGS-AND-PERFORMANCE.md) — Settings schema, graphics quality tiers, perf budget.
7. [`docs/07-INPUT-AND-CONTROLS.md`](docs/07-INPUT-AND-CONTROLS.md) — Keyboard + touch + gamepad mapping, DAS/ARR, gestures.

Then work through **[`TASKS.md`](TASKS.md)** top to bottom, ticking each `- [ ]` as you finish.

---

## Quickstart

> Requires **Node.js 20+**.

```bash
# 1. Scaffold (App Router, TS, Tailwind)
npx create-next-app@latest chromasand --ts --tailwind --app --eslint
cd chromasand

# 2. Game + tooling deps
npm install phaser@^4.1.0 zustand mitt
npm install -D vitest @vitest/ui playwright @playwright/test

# 3. Run
npm run dev
```

Then follow **Phase 0** and **Phase 1** in [`TASKS.md`](TASKS.md) to wire Phaser into a client-only React component and get a canvas on screen.

---

## Target platforms

- **Mobile web** (iOS Safari, Android Chrome) — touch controls, portrait-first, 60 fps on mid-tier hardware via the `low` quality tier.
- **Desktop web** — keyboard + mouse, up to `ultra` quality with full post-processing.
- Optional later: wrap in Capacitor for app stores (out of scope for v1).

---

## Status

Pre-implementation. This repository currently contains **specification + task tracking only**. See `TASKS.md` for the build plan.
