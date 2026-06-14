# 02 — Architecture

## 1. Engine decision: Phaser 4 (not Three.js)

| Factor | Phaser 4 | Three.js |
|---|---|---|
| Native 2D grid rendering | ✅ first-class | ❌ build 2D-on-3D plumbing |
| Particle system for sand | ✅ mature `ParticleEmitter` + new `SpriteGPULayer` (one draw call, ~1M sprites) | ❌ roll your own |
| Custom shaders / post-FX | ✅ filter & FX pipeline, `#pragma` GLSL, per-camera post-FX | ✅ powerful but more wiring |
| Mobile 2D performance | ✅ batched WebGL, designed for it | ⚠️ heavier baseline |
| Dev velocity for this genre | ✅ scenes, tweens, input, audio built in | ❌ assemble from parts |

**Decision: Phaser 4.1.x.** The sand effect specifically benefits from `SpriteGPULayer`. Keep Three.js only as a "what-if we go 3D in v2" note.

> Phaser needs `window`/`document`, so it **must run client-side only**. Next.js SSR must never import Phaser on the server.

---

## 2. Repository structure

```
chromasand/
├─ app/                          # Next.js App Router
│  ├─ layout.tsx
│  ├─ page.tsx                   # landing / play button
│  ├─ play/page.tsx              # mounts the game (client-only)
│  └─ globals.css                # Tailwind v4
├─ components/
│  ├─ GameCanvas.tsx             # dynamic(()=>..., {ssr:false}) wrapper that boots Phaser
│  ├─ HUD/                       # React HUD overlay (score, queue, hold, combo)
│  ├─ menus/                     # MainMenu, LevelSelect, Settings, Pause, GameOver
│  └─ ui/                        # shared primitives (Slider, Toggle, Button)
├─ game/                         # ALL Phaser/game code (framework-agnostic where possible)
│  ├─ main.ts                    # createGame(config) → Phaser.Game
│  ├─ config.ts                  # Phaser.Types.Core.GameConfig builder (per quality tier)
│  ├─ scenes/
│  │  ├─ BootScene.ts            # load minimal, set up scale/quality
│  │  ├─ PreloadScene.ts         # load level assets (atlas, audio, shaders)
│  │  ├─ GameScene.ts            # the board + pieces + clear logic orchestrator
│  │  ├─ BackgroundScene.ts      # per-level themed background (runs behind GameScene)
│  │  └─ UIScene.ts              # in-canvas overlays if any (mostly DOM HUD instead)
│  ├─ core/                      # PURE LOGIC, no Phaser imports → unit testable
│  │  ├─ Board.ts                # grid model, lock, clear-check, collapse
│  │  ├─ Piece.ts                # tetromino defs, color, rotation (SRS)
│  │  ├─ srs.ts                  # rotation states + wall-kick tables
│  │  ├─ rng.ts                  # seeded RNG + color bag balancer
│  │  ├─ scoring.ts              # scoring formulas
│  │  └─ rules.ts                # clear-rule strategy (Color vs Classic mode)
│  ├─ render/
│  │  ├─ BlockRenderer.ts        # draws grid cells (sprites/quads)
│  │  ├─ SandSystem.ts           # the dissolve VFX (SpriteGPULayer + shader)
│  │  └─ GhostPiece.ts
│  ├─ fx/
│  │  ├─ shaders/                # .glsl / .ts shader sources
│  │  ├─ DissolvePipeline.ts     # block→sand dissolve shader
│  │  ├─ BackgroundShaders.ts    # 10 themed background fragment shaders
│  │  └─ PostFX.ts               # bloom/vignette/chromatic per quality tier
│  ├─ audio/AudioManager.ts      # bus mixing, ducking (see 04-AUDIO.md)
│  ├─ levels/                    # level configs (see 05-LEVELS.md)
│  │  └─ levels.ts               # LevelConfig[] (10 entries)
│  └─ state/
│     ├─ events.ts               # mitt event bus (game → React and back)
│     └─ EventNames.ts           # typed event constants
├─ store/                        # Zustand stores for React UI
│  ├─ useSettings.ts
│  ├─ useProgress.ts             # unlocked levels, high scores
│  └─ useHud.ts                  # live score/level/combo mirror
├─ public/assets/                # textures, audio, fonts (see asset pipeline)
├─ tests/                        # Vitest (core/) + Playwright (smoke)
└─ docs/ , TASKS.md , README.md
```

**Golden rule:** everything in `game/core/` has **zero Phaser imports** so it can be unit-tested in Node. Phaser is only the renderer/input/audio layer driven by that logic.

---

## 3. Next.js ↔ Phaser integration pattern

`components/GameCanvas.tsx` (client component):

```tsx
'use client';
import { useEffect, useRef } from 'react';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    let destroyed = false;
    (async () => {
      const { createGame } = await import('@/game/main'); // dynamic → no SSR
      if (destroyed || !containerRef.current) return;
      gameRef.current = createGame(containerRef.current);
    })();
    return () => {
      destroyed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} id="game-root" className="w-full h-full" />;
}
```

`app/play/page.tsx` loads it with SSR disabled:

```tsx
import dynamic from 'next/dynamic';
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), { ssr: false });
export default function PlayPage() {
  return <main className="relative w-screen h-[100dvh] overflow-hidden">
    <GameCanvas />
    {/* HUD + menu overlays are absolutely-positioned DOM on top */}
  </main>;
}
```

Key rules:
- **Never** `import 'phaser'` at module top level in a file that the server bundles. Only inside dynamically-imported client modules.
- Use `100dvh` (dynamic viewport) so mobile browser chrome doesn't clip the canvas.
- Destroy the game on unmount to avoid duplicate WebGL contexts on route changes / fast refresh.

---

## 4. Phaser scale config (responsive, mobile + desktop)

In `game/config.ts`:

```ts
scale: {
  mode: Phaser.Scale.FIT,           // letterbox-fit, preserves aspect
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: 720,                       // design resolution (portrait-friendly)
  height: 1280,
},
render: {
  antialias: tier !== 'low',
  powerPreference: 'high-performance',
  roundPixels: true,
},
fps: { target: 60, forceSetTimeOut: false },
```

Choose design resolution **720×1280** (9:16 portrait) as the canonical play field; desktop gets the same field centered with themed background filling the margins. Resolution multiplier (DPR clamp) is set per quality tier (see perf doc).

---

## 5. State flow (game ↔ React)

```
              mitt event bus
GameScene  ───────────────────▶  Zustand (useHud)  ───▶  React HUD
 (emits: SCORE, LEVEL, COMBO, GAME_OVER, LEVEL_COMPLETE)

React menus ──(settings changed)──▶ bus ──▶ AudioManager / quality tier / rule mode
```

- Game logic is the source of truth for gameplay; it **emits** snapshots, never reads React.
- React owns menu/settings UI; settings changes are **pushed** into the game via events.
- `EventNames.ts` defines a typed enum so both sides agree on event names/payloads.

This decoupling means the game can run with the HUD entirely removed (e.g. in tests).

---

## 6. Scene layering

`BackgroundScene` (themed shader, behind) → `GameScene` (board, pieces, sand) → DOM HUD (React, on top). `BackgroundScene` is swapped/reconfigured per level so each level is a different "world" without reloading the whole game.

---

## 7. Asset pipeline

- Textures packed into a **single atlas per theme group** to minimize draw calls/texture binds.
- Block sprites are simple rounded-square base textures **tinted** at runtime to the piece color (so one texture serves all colors). Sand grains are a tiny 4–8px soft dot, also tinted.
- Audio as `.webm`/`.ogg` + `.mp3` fallback (see audio doc).
- Shaders authored as `.glsl` strings/`.ts` and registered as Phaser filters/pipelines in `PreloadScene`.
- Lazy-load per-level assets in `PreloadScene` keyed by level to keep initial bundle small.

---

## 8. Build & deploy

- `next build` → static-friendly; deploy to Vercel or `next export`-style static host (the game is client-only so SSG works).
- Ensure Node 20+. Keep Next.js patched (active security releases on the 16.x line).
- Phaser is large (~1MB+); it loads only on `/play` via dynamic import, keeping the landing page light.
