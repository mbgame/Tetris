# 05 — Levels

> 10 levels, 10 scenes. Difficulty rises mainly by **adding colors** (mono-color rows get harder), then by speed and hazards. Tune `targetLines`/`gravityMs` during playtesting (Phase 4/11).

---

## 1. LevelConfig schema (`game/levels/levels.ts`)

```ts
export interface LevelConfig {
  id: number;                 // 1..10
  name: string;               // "Dawn Meadow"
  scene: SceneTheme;          // background shader + music key
  colors: ColorDef[];         // active palette (id, hex, glyph for colorblind aid)
  colorBagRule: 'weighted' | 'bag' | 'shuffleEveryN';
  shuffleEveryN?: number;     // for periodic palette shuffles (late levels)
  gravityMs: number;          // ms per gravity step
  softDropMs: number;         // step interval while soft-dropping
  lockDelayMs: number;        // default 500
  targetLines: number;        // mono-color lines to clear to finish
  garbage?: {                 // optional hazards
    prefillRows?: number;     // start with N junk rows
    risePeriodMs?: number;    // rising garbage cadence (undefined = none)
  };
  bgDim: number;              // 0..1 background dim so blocks pop
  bgmKey: string;             // audio key
}

export interface ColorDef { id: number; hex: string; glyph: string; }
export type SceneTheme =
  | 'dawn' | 'neon' | 'crystal' | 'dunes' | 'ocean'
  | 'forge' | 'aurora' | 'sky' | 'void' | 'prism';
```

---

## 2. The 10 levels (starting values — tune later)

| Lvl | Name | Scene | Colors | gravityMs | targetLines | Hazard | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Dawn Meadow | `dawn` | 2 | 900 | 8 | none | Tutorial pacing; introduce move/rotate/drop. |
| 2 | Neon City | `neon` | 3 | 800 | 10 | none | Introduce **Hold**. |
| 3 | Crystal Caverns | `crystal` | 3 | 700 | 12 | none | Faster; color planning bites. |
| 4 | Desert Dunes | `dunes` | 4 | 620 | 12 | none | Sand theme front-and-center. |
| 5 | Ocean Deep | `ocean` | 4 | 560 | 14 | prefillRows: 2 | First junk rows. |
| 6 | Volcanic Forge | `forge` | 5 | 500 | 14 | prefillRows: 3 | Heat + speed. |
| 7 | Aurora Tundra | `aurora` | 5 | 440 | 16 | risePeriodMs: 18000 | First rising garbage. |
| 8 | Sky Citadel | `sky` | 6 | 380 | 16 | risePeriodMs: 14000 | |
| 9 | Void Nebula | `void` | 6 | 320 | 18 | risePeriodMs: 11000, shuffleEveryN: 12 | Palette shuffles mid-level. |
| 10 | Prism Sanctum | `prism` | 7 | 260 | 20 | risePeriodMs: 9000 | Finale; all colors, fastest, climactic VFX/BGM. |

> Palette guidance: pick **high-contrast, distinguishable** hues; the first colors added (levels 1–2) should be maximally different (e.g. warm vs cool). Each `ColorDef` carries a `glyph` for the colorblind aid (e.g. ▲ ● ◆ ■ ★ ✦ ✚). Keep glyphs subtle/optional.

### Example palette seeds (refine for harmony per scene)
- L1 `dawn`: `#FF6B6B` (▲), `#4ECDC4` (●)
- L2 `neon`: + `#FFE66D` (◆)
- L4 `dunes`: warm set `#E8B25F`, `#D9644A`, `#7FB069`, `#5BC0EB`
- L10 `prism`: 7-color rainbow set, fully saturated, evenly spaced in hue.

---

## 3. Level lifecycle

On entering a level:
1. `PreloadScene` loads that level's atlas (if not cached), bgm, and registers its background shader.
2. `BackgroundScene` reconfigures to the level's `scene` theme + `bgDim`.
3. Apply `garbage.prefillRows` if any.
4. `COUNTDOWN` (3-2-1) then `PLAYING`.
5. Track mono-color lines cleared; at `targetLines` → `LEVEL_COMPLETE`, crossfade BGM, unlock next.

Persist per-level: best score, best time, stars (optional: stars by score thresholds).

---

## 4. Hazards

- **prefillRows:** seed N bottom rows with mixed-color junk (with one-cell gaps so it's solvable). These can only be removed by making mono rows around/over them → teaches the core tension.
- **Rising garbage:** every `risePeriodMs`, push the stack up one junk row from the bottom. Game over if it reaches the top. Clears push back progress, creating urgency.
- **Palette shuffle (`shuffleEveryN`):** after every N locks, remap which colors the bag draws (existing board colors unchanged) — forces re-planning. Use only on levels 9–10.

---

## 5. Authoring checklist per level (use in TASKS Phase 10)

For each level 1→10:
- [ ] Palette chosen, contrast-checked, glyphs assigned.
- [ ] Background shader implemented + dimmed correctly.
- [ ] BGM track wired + loops cleanly.
- [ ] Difficulty params set; playtested to ~2–4 min completion.
- [ ] Accent particles present and cheap.
- [ ] Level-complete + transition to next verified.
