# 03 — Visual Effects & Shaders

> Goal: spectacle that scales. The sand dissolve must look great on `ultra` and degrade cleanly to a cheap particle burst on `low`. All effects respect the active **quality tier** ([`06`](06-SETTINGS-AND-PERFORMANCE.md)).

---

## 1. The signature effect — block → sand dissolve

When a mono-color row clears, its blocks must **crumble into falling sand** rather than blink out. Two cooperating techniques:

### 1a. Dissolve shader (the "crumble")
A fragment shader animates each clearing block from solid → grainy → gone using a **noise threshold**:

```glsl
// dissolve.frag (sketch — adapt to Phaser 4 filter pipeline)
precision mediump float;
varying vec2 outTexCoord;
uniform sampler2D uMainSampler;   // the block texture
uniform float uProgress;          // 0 = solid, 1 = fully dissolved
uniform float uEdgeWidth;         // glow band width, e.g. 0.08
uniform vec3  uEdgeColor;         // hot sand edge color (per palette)

// cheap hash noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

void main(){
  vec4 tex = texture2D(uMainSampler, outTexCoord);
  float n  = noise(outTexCoord * 18.0);          // grain frequency
  float edge = uProgress;
  if (n < edge) { discard; }                      // already turned to sand
  // hot edge band glows like burning paper / hot sand
  float band = smoothstep(edge, edge + uEdgeWidth, n);
  vec3 col = mix(uEdgeColor, tex.rgb, band);
  gl_FragColor = vec4(col, tex.a);
}
```

`uProgress` is tweened 0→1 over ~280 ms per clearing block (slight per-block stagger left→right for a "sweep" feel).

### 1b. Sand particles (the "fall")
As each block dissolves, spawn sand grains **at the noise-revealed pixels' region** and let them fall:

- Use Phaser 4 **`SpriteGPULayer`** for the grains — one draw call for thousands of particles, critical for mobile.
- Per cleared cell, emit `grainsPerCell` grains (tier-dependent: low=6, medium=14, high=28, ultra=48).
- Grain behavior: initial small upward/outward velocity, **gravity** pulls down, slight horizontal drift (per-grain noise), fade alpha + shrink over `lifespan` (~600–900 ms), tinted to the block's color with brightness jitter so it reads as granular sand, not flat dots.
- Grains collide with nothing (purely visual) to stay cheap; they just pour and fade.

**Tier fallback (`low`):** skip the dissolve shader; do a single quick scale-down + a small CPU particle burst (≤6 grains/cell). Still feels sandy, costs little.

### 1c. Settle animation (gravity collapse)
After grains spawn, blocks above the cleared row **fall** to fill the gap with a short eased tween (~120 ms) + a tiny squash-on-land. This sells weight and is separate from the sand (don't dissolve the survivors).

---

## 2. Lock / move / rotate feedback

- **Soft lock flash:** brief additive flash on the locked piece (1 frame bright, fades 100 ms).
- **Hard drop:** motion-streak (vertical smear sprite) + small dust puff at landing row + screen shake (tier-gated, off on `low`, subtle on others; respect "reduce motion").
- **Rotate:** small angular overshoot tween (e.g. rotate to +6° then settle) for snappiness.
- **Color match telegraph:** when a row is one block away from being a mono-color full row, gently pulse that row's glow so the player sees the opportunity.

---

## 3. Per-level background scenes (10 shaders/themes)

Each level's `BackgroundScene` runs a full-screen themed fragment shader (animated by `uTime`) plus optional sprite accents. Keep these **cheap**: they fill the screen every frame. Use the quality tier to lower internal resolution of the background buffer (render background at 0.5×–0.75× then upscale on `low/medium`).

Theme list (palettes detailed in [`05-LEVELS.md`](05-LEVELS.md)):

| Lvl | Scene | Background shader idea | Accent particles |
|---|---|---|---|
| 1 | Dawn Meadow | soft vertical gradient + drifting bokeh | floating pollen |
| 2 | Neon City | scrolling grid horizon + glow lines | rising sparks |
| 3 | Crystal Caverns | refractive facets, slow parallax | falling glints |
| 4 | Desert Dunes | layered dune silhouettes + heat shimmer | blowing sand (ties to core effect) |
| 5 | Ocean Deep | caustics + god-rays, gentle blue | rising bubbles |
| 6 | Volcanic Forge | ember gradient + lava cracks | floating embers |
| 7 | Aurora Tundra | animated aurora bands (curl noise) | snow drift |
| 8 | Sky Citadel | parallax clouds + sun shafts | wind streaks |
| 9 | Void Nebula | starfield + nebula fbm | warping stars |
| 10 | Prism Sanctum | rotating prism light + rainbow caustics | light motes |

Backgrounds must never out-contrast the board — keep them lower-contrast/darker so blocks pop. Provide a "background dim" setting.

---

## 4. Post-processing (per-camera, tier-gated)

Apply to the `GameScene` camera as post-FX (Phaser 4 FX/filter pipeline):

| Effect | low | medium | high | ultra |
|---|---|---|---|---|
| Bloom (on bright blocks/glow) | off | subtle | medium | strong |
| Vignette | off | on | on | on |
| Chromatic aberration | off | off | subtle on clear | subtle always |
| Color grade (per-level LUT/tint) | tint only | tint | LUT | LUT + grain |

Bloom should key off an emissive mask (block glow, sand edge, accents) — not blow out the whole screen.

---

## 5. Block visuals

- One base rounded-square texture, **runtime tinted** to the palette color.
- Add a subtle inner bevel/gradient in the texture so tinted blocks look dimensional, not flat.
- Optional thin emissive rim that brightens when the block is part of a near-complete mono row (the telegraph in §2).
- Ghost piece: same shape, ~25% alpha, no glow.

---

## 6. "Reduce motion" & accessibility

- A settings toggle disables screen shake, heavy aberration, and reduces particle counts to the `low` profile regardless of tier.
- Color is load-bearing in this game → ship a **colorblind aid**: each palette color also carries a distinct **glyph/pattern** overlay option (small icon per color) so rows can be matched by symbol, not just hue. Document patterns in palette config.

---

## 7. Implementation order (matches TASKS Phase 5)

1. Block renderer with tinting (no FX).
2. Sand particles via `SpriteGPULayer` (the fall) — get this feeling good first.
3. Dissolve shader (the crumble) layered on top.
4. Settle/collapse tween.
5. Lock/drop/rotate feedback.
6. One background shader end-to-end (Level 1), then template the rest.
7. Post-FX pipeline + tier gating.

Build the sand at `medium` tier first, then add `ultra` flourishes and `low` fallbacks last.
