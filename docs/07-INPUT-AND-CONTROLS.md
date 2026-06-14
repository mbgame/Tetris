# 07 — Input & Controls

> Must feel great on **both** a phone (touch) and a desktop (keyboard). Input is abstracted into game **actions** so every device maps to the same logic.

---

## 1. Action abstraction

Define actions, not keys, in `game/core` / input layer:

```
MOVE_LEFT, MOVE_RIGHT, SOFT_DROP (hold), HARD_DROP,
ROTATE_CW, ROTATE_CCW, HOLD, PAUSE
```

Each input device maps raw events → these actions → the game loop. Swapping/ remapping devices never touches game logic.

---

## 2. Keyboard (desktop default)

| Action | Keys |
|---|---|
| Move left/right | ◀ ▶ / A D |
| Soft drop (hold) | ▼ / S |
| Hard drop | Space / W / ▲ |
| Rotate CW | ↑(optional) / X / K |
| Rotate CCW | Z / J |
| Hold | C / Shift |
| Pause | Esc / P |

Allow rebinding later (store in settings); ship sensible defaults first.

### DAS / ARR (the feel of holding a direction)
- **DAS** (Delayed Auto Shift): delay before a held direction starts auto-repeating. Default ~150 ms.
- **ARR** (Auto Repeat Rate): interval between auto-shifts once DAS elapses. Default ~40 ms.
- Both exposed in advanced gameplay settings ([`06`](06-SETTINGS-AND-PERFORMANCE.md)) for skilled players.
- Soft-drop uses `softDropMs` from the level config.

---

## 3. Touch (mobile)

Two complementary schemes — support **both**, let the user pick (setting):

### Scheme A — Gestures (default, immersive)
- **Swipe left/right:** move one cell (swipe distance → repeat for fast moves, or tap-and-hold edge zones).
- **Tap:** rotate CW.
- **Two-finger tap / dedicated zone:** rotate CCW.
- **Swipe down (short):** soft drop; **swipe down (fast/long):** hard drop.
- **Swipe up:** hold.
- Use velocity + distance thresholds; debounce so a single flick isn't read as several moves. Tune thresholds on a real device.

### Scheme B — On-screen buttons (precision)
- Bottom-anchored control pad: ◀ ▶, rotate CW/CCW, soft-drop (hold), hard-drop, hold.
- Large hit targets (≥ 44px), thumb-reachable, semi-transparent so they don't hide the board.
- Buttons are DOM overlay (React) emitting actions via the event bus — keeps them crisp and easy to restyle.

Provide haptic feedback (`navigator.vibrate`) on lock/clear where supported (toggle in settings).

---

## 4. Gamepad (nice-to-have)

- D-pad → move; down → soft drop; A → rotate CW, B → rotate CCW; X → hold; shoulder → hard drop; Start → pause.
- Use the Gamepad API polled in the game loop. Low priority; wire after touch + keyboard solid.

---

## 5. Responsiveness rules

- Hard drop must register and resolve **within the same frame** as the input — never queue it behind gravity.
- Rotation with SRS wall kicks must try kick offsets in order and pick the first valid; if none valid, rotation fails silently (no state change).
- Lock delay resets on successful move/rotate up to a move-reset cap (e.g. 15 resets) to prevent infinite stalling.
- Debounce hard-drop so one press = one drop (no accidental double).

---

## 6. Layout adaptation

- **Portrait (phones):** board centered, HUD top, controls bottom (Scheme B) or full-screen gesture area (Scheme A).
- **Landscape / desktop:** board centered, next/hold/score in side panels, themed background fills the margins.
- HUD is DOM and uses safe-area insets (`env(safe-area-inset-*)`) so notches/home indicators don't overlap controls.

---

## 7. Implementation order (matches TASKS Phase 8)

1. Keyboard → actions → loop (desktop playable first).
2. DAS/ARR + soft/hard drop feel.
3. Touch Scheme B (buttons) — easiest to get reliable.
4. Touch Scheme A (gestures) + thresholds tuned on device.
5. Haptics + safe-area + landscape layout.
6. Gamepad (optional).
