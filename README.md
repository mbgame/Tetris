# ChromaSand

**Status: Released (v1.0.0)**

A fast, colorful tetromino puzzle. A row clears only when it's **completely full AND
all one color** — then it **pours away as sand**. Ten worlds, each a different scene,
escalating from 2 colors to 7.

Built with **Next.js 16** (App Router) + **Phaser 4** (client-only) + **Zustand** +
**Web Audio**. Game logic in `game/core/` is Phaser-free and unit-tested.

## Play

```bash
npm install
npm run dev       # http://localhost:3000  → click Play (loads /play)
```

Controls: **keyboard** (◀▶ move, ▼ soft drop, Space hard drop, ↑/X rotate CW, Z rotate
CCW, C hold, P/Esc pause), **touch** (on-screen buttons or gestures — pick in settings),
and **gamepad**.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest unit tests (logic) |
| `npm run e2e` | Playwright smoke + edge tests (auto-starts dev server) |
| `npm run lint` | ESLint |

## Architecture

- `game/core/` — pure logic (Board, Piece, SRS, RNG, rules, scoring, FSM, queue). No Phaser.
- `game/scenes|render|fx|audio|perf|input/` — Phaser rendering, sand/dissolve VFX, audio engine, tier system, input.
- `game/state/` — typed `mitt` event bus connecting game ↔ React.
- `components/`, `store/` — React HUD/menus and Zustand stores (settings/progress/HUD).

See `docs/` for the full design (game design, architecture, VFX, audio, levels, settings/perf, input).

## Performance

Quality tiers (low/medium/high/ultra, plus `auto` benchmark on first boot) scale grains,
the dissolve effect, background render resolution, and post-FX. Object-pooled grains +
blocks avoid GC churn. Tab-hidden pauses audio + the render loop.

## Deploy

Client-only game → static-friendly. Recommended: **Vercel** (Node 20+).

```bash
npm i -g vercel
vercel --prod
```

Or any static host: `npm run build` then `npm start` (Node 20+).
Phaser (~1MB) loads only on `/play` via dynamic import, so the landing page stays light.

Installable as a **PWA** (manifest + offline service worker); boots offline after first load.
