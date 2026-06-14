# 06 — Settings & Performance

## Part A — Settings

### A1. Settings schema (`store/useSettings.ts`, persisted to localStorage)

```ts
interface Settings {
  audio: {
    master: number;   // 0..100
    music: number;    // 0..100
    sfx: number;      // 0..100
    muteAll: boolean;
  };
  graphics: {
    tier: 'low' | 'medium' | 'high' | 'ultra' | 'auto'; // 'auto' = benchmark on boot
    bgDim: number;        // 0..1, extra background dimming
    bloom: boolean;
    screenShake: boolean;
    reduceMotion: boolean;     // disables shake + heavy FX, lowers particles
    colorblindGlyphs: boolean; // show per-color glyphs
  };
  gameplay: {
    ruleMode: 'color' | 'classic'; // 'classic' = any full row clears (assist)
    ghostPiece: boolean;
    showNextCount: 1 | 2 | 3;
    holdEnabled: boolean;          // forced on from level 2 regardless
    das: number;  // delayed auto shift (ms) — see input doc
    arr: number;  // auto repeat rate (ms)
  };
}
```

### A2. Settings UI (React, `components/menus/Settings.tsx`)

- Three tabs: **Audio**, **Graphics**, **Gameplay**.
- Audio: three sliders + mute-all toggle; changes apply live (no apply button).
- Graphics: tier dropdown (with `auto`), bloom toggle, screen-shake toggle, reduce-motion, colorblind glyphs, background dim slider. Show a tiny live FPS readout so users see the effect of tier changes.
- Gameplay: rule mode (with a clear explanation of Color vs Classic/assist), ghost piece, next-count, DAS/ARR sliders (advanced, collapsible).
- Accessible from main menu **and** the pause screen.
- All changes → Zustand → `localStorage` → event bus → game applies immediately.

### A3. Defaults

`tier: 'auto'`, all audio 80, `ruleMode: 'color'`, ghost on, next 3, glyphs off, shake on, reduceMotion off.

---

## Part B — Performance

### B1. Targets

| Platform | Target | Floor |
|---|---|---|
| Mid-tier phone (2021+) | 60 fps at `low`/`medium` | never below 45 |
| Desktop | 60 fps at `high`/`ultra` | 60 |
| Input latency | < 1 frame perceived | hard-drop must feel instant |

### B2. Quality tiers — what each changes

| Knob | low | medium | high | ultra |
|---|---|---|---|---|
| Device pixel ratio cap | 1.0 | 1.5 | 2.0 | full |
| Sand grains / cell | 6 | 14 | 28 | 48 |
| Dissolve shader | off (scale-out) | on | on | on + edge glow |
| Background render scale | 0.5× | 0.6× | 0.75× | 1× |
| Bloom | off | subtle | medium | strong |
| Chromatic aberration | off | off | on-clear | always |
| Accent particles | minimal | some | full | full + extras |
| Screen shake | off | subtle | subtle | subtle |

`auto` runs a 1–2s micro-benchmark on first boot (measure avg frame time rendering a stress burst) and picks a tier; user can override.

### B3. Budget per frame (16.6 ms)

- Game logic (move/gravity/clear check): pure, sub-millisecond.
- Keep **draw calls low**: tint one block texture (no per-color textures); batch via atlas; sand via **`SpriteGPULayer`** (one draw call for all grains).
- Background shader runs at reduced internal resolution on low/medium (B2).
- Avoid per-frame allocations in the game loop (object-pool pieces, grains, tweens). GC spikes = jank.

### B4. Mobile-specific

- Use `100dvh` and lock to portrait (or design portrait-first; allow landscape with repositioned HUD).
- Clamp DPR (B2) — full retina DPR (3×) on phones murders fill-rate; 1.5× looks fine for this art style.
- Cap pixel-heavy post-FX on `low`.
- Pause rendering when tab/app is hidden (`visibilitychange`) to save battery.
- Test on a real mid phone early and often; the simulator lies about perf.

### B5. Memory & loading

- Lazy-load per-level assets; dispose previous level's unique textures/audio when advancing (keep shared atlas).
- Single WebGL context — ensure the game is destroyed on route unmount (no leaked contexts on navigation/fast-refresh).
- Keep total initial JS for `/play` reasonable; Phaser (~1MB) loads only there via dynamic import.

### B6. Profiling checklist (Phase 9)

- [ ] Chrome perf trace: no long tasks > 16 ms during steady play.
- [ ] No GC sawtooth during sustained clears (verify pooling).
- [ ] Draw-call count stable during a 4-line mono clear with full sand.
- [ ] 60 fps held on target phone at chosen tier; 45 fps floor never breached.
- [ ] Background-tab pause verified; battery drain sane.
