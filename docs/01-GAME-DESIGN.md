# 01 — Game Design Document

## 1. Vision

A fast, tactile, *colorful* puzzle game that reads instantly as "Tetris" but rewards **color planning** instead of pure row-filling. Lines you clear don't just vanish — they **pour away as sand**, giving every clear a satisfying, physical payoff. Ten levels each feel like a different world.

Pillars:
1. **Color is the puzzle.** You think in colors, not just shapes.
2. **Every clear is a moment.** The sand dissolve is the reward; it must look and sound great.
3. **Runs at 60 fps on a mid phone.** Spectacle scales down gracefully, never the responsiveness.

---

## 2. The board

- Grid: **10 columns × 20 rows** (classic). Top 2 rows are the hidden spawn buffer.
- A cell is either empty or filled with one of N **colors** (N depends on level — see §6).
- Coordinate origin: top-left `(col 0, row 0)`.

---

## 3. Pieces

- Standard **7 tetrominoes**: I, O, T, S, Z, J, L.
- **Each spawned piece is one solid color**, chosen from the level's active palette (see color-selection policy below).
- Rotation system: **SRS (Super Rotation System)** with standard wall kicks. Document the kick tables in code; reference SRS.
- A piece occupies 4 cells; all 4 share the piece's color.

### Color-selection policy (per spawn)
Default: **weighted random** from the active palette, with a "bag-ish" balancer that avoids drawing the same color more than 3 times in a row (prevents color droughts). Configurable per level via `colorBagRule`. See [`05-LEVELS.md`](05-LEVELS.md).

### Piece queue & hold
- **Next queue:** show next 3 pieces (color + shape).
- **Hold:** 1 slot, standard "hold once per drop" rule.

---

## 4. THE CORE RULE — color line clear (read carefully)

> This is the single most important spec in the project. Implement it exactly.

**Clear condition (default / "Color" mode):**
A row clears **if and only if**:
1. The row is **completely filled** (all 10 cells occupied), **AND**
2. **All 10 cells are the same color.**

A completely-filled row of *mixed* colors does **NOT** clear. It stays on the board as an obstacle until the player manages to make a row mono-color (which usually means clearing colored blocks around it / re-layering). This is the central tension.

**Why it's playable:** because each piece is mono-color and levels limit the palette (Level 1 = 2 colors), assembling a same-color row is achievable with planning. As levels add colors, mono rows get rarer → difficulty rises. Number of colors is the primary difficulty dial.

**Multiple simultaneous clears:** if a single piece lock completes several qualifying rows at once (even of different colors), all qualifying rows clear together and combo scoring applies (§7).

### Assist / "Classic" mode (accessibility option, off by default)
A toggle in settings changes the rule to: **any completely-filled row clears regardless of color.** Mono-color rows still award the color bonus. This makes the game approachable; it is surfaced as an accessibility setting, not the default. See [`06-SETTINGS-AND-PERFORMANCE.md`](06-SETTINGS-AND-PERFORMANCE.md).

### Gravity after clear
After cleared rows are removed, everything above falls straight down (classic column collapse, **not** per-cell/Puyo gravity) to keep mechanics predictable. The fall is animated (see VFX §"settle").

---

## 5. Game loop (state machine)

```
BOOT → MENU → LEVEL_SELECT → COUNTDOWN → PLAYING
PLAYING ↔ PAUSED
PLAYING → LINE_CLEAR (sand dissolve plays) → PLAYING
PLAYING → LEVEL_COMPLETE → (next level COUNTDOWN | VICTORY if level 10)
PLAYING → GAME_OVER → MENU / RETRY
```

Per-tick (PLAYING):
1. Apply input (move/rotate/soft-drop/hard-drop/hold).
2. Apply gravity at the level's drop interval.
3. On lock: write piece into grid, run **clear check**, if clears → enter `LINE_CLEAR` (pause gravity, play sand effect, collapse, score), else spawn next piece.
4. If a newly spawned piece overlaps existing blocks → `GAME_OVER`.

Lock delay: standard ~500 ms with move-reset cap (configurable).

---

## 6. Difficulty & progression

Each level defines (full table in [`05-LEVELS.md`](05-LEVELS.md)):

| Param | Meaning |
|---|---|
| `colorCount` | how many colors are active (2 → 7 across levels) |
| `palette` | the actual hex colors / theme |
| `gravityMs` | ms per gravity step (lower = faster) |
| `targetLines` | mono-color lines to clear to finish the level |
| `garbageRules` | optional pre-filled rows or rising garbage (later levels) |
| `colorBagRule` | spawn color balancing |
| `scene` | visual theme + BGM (see VFX & Audio docs) |

Progression: clear `targetLines` to advance. Levels 1–10 escalate `colorCount`, speed, and add hazards (garbage rows, periodic palette shuffles).

---

## 7. Scoring

Base score on a successful clear event:

```
lineScore   = baseLine[clearedRowCount] * level
baseLine    = { 1: 100, 2: 300, 3: 500, 4: 800 }   // rows cleared together
colorBonus  = 1.5x multiplier (always, since default rule requires mono-color)
comboBonus  = +50 * comboCount * level             // consecutive clears w/o a "dry" lock
b2bBonus    = +0.5x when consecutive clears are both multi-row (>=2)
softDrop    = +1 per cell dropped
hardDrop    = +2 per cell dropped
```

Final clear score = `floor(lineScore * colorBonus * b2bMultiplier) + comboBonus`.

Combo resets when a piece locks without clearing anything. Persist high score per level + total in `localStorage`.

---

## 8. HUD

DOM overlay (React) above the canvas, never inside it (keeps canvas pure for perf):
- Score, level, lines remaining (target), combo meter.
- Next-3 queue + Hold slot (rendered as small canvases or styled DOM tiles).
- Pause button (mobile), settings gear.
- Color legend for the current level's palette (helps planning).

---

## 9. Win / lose

- **Win level:** reach `targetLines`. Show level-complete card (stats + "Next"). Unlock next level.
- **Win game:** complete level 10 → Victory scene with aggregate stats.
- **Lose:** spawn blocked → Game Over card (score, "Retry", "Menu"). Retry restarts current level.

---

## 10. Open design decisions (resolve during Phase 4)

- [ ] Exact `targetLines` per level (tune for ~2–4 min/level).
- [ ] Whether later levels use **rising garbage** vs **pre-filled rows**.
- [ ] Whether Hold is unlocked from Level 1 or introduced at Level 2 as a tutorialized mechanic.
- [ ] Soft-drop scoring vs hard-drop balance.

These are tuning, not architecture — safe to defer until the loop is playable.
