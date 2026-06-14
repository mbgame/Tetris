# 04 — Audio

> Background music + SFX, both running continuously, with independent volume/mute controls in settings. Built on Phaser's Web Audio sound manager.

---

## 1. Audio buses

Model three logical buses, each with its own gain + mute, all under a master:

```
Master (volume, mute)
 ├─ Music  (volume, mute)      // looping per-level BGM, crossfaded on level change
 ├─ SFX    (volume, mute)      // moves, locks, clears, sand, UI
 └─ Ambience (volume, mute)    // optional per-scene loop (waves, wind, embers)
```

`AudioManager` (`game/audio/AudioManager.ts`) owns these. Web Audio doesn't give Phaser true bus nodes out of the box, so implement buses as **gain groups**: keep arrays of sounds per bus and apply `bus.volume = master * busVolume` whenever settings change. (Or wire a small custom GainNode graph if you want true buses — optional.)

Settings → audio mapping (from [`06`](06-SETTINGS-AND-PERFORMANCE.md)):
- `master` 0–100, `music` 0–100, `sfx` 0–100, plus per-bus mute toggles.
- Changes apply **immediately** via the event bus (no restart).

---

## 2. Music (BGM)

- One looping track per **scene/level** (10 tracks, or fewer reused across thematically similar levels for v1).
- **Crossfade** ~800 ms when advancing levels (fade old out, new in) so transitions feel seamless.
- Tracks should loop seamlessly (author with matched loop points; trim silence).
- Pause behavior: on `PAUSED`, duck music to ~30% (don't hard-stop) so resuming is smooth; full stop only on returning to menu.

## 3. Ambience (optional, per scene)

- Light scene loop (e.g. Ocean Deep = muffled waves, Volcanic Forge = low rumble) layered under music at low volume. Skippable for v1 if time-constrained.

---

## 4. SFX catalogue

Author short, punchy, non-fatiguing sounds (they repeat a lot):

| Event | Sound | Notes |
|---|---|---|
| Move L/R | soft tick | very quiet; pitch-vary ±5% to avoid machine-gun feel |
| Rotate | light click | |
| Soft drop step | subtle tick | quieter than move |
| Hard drop | thud + whoosh | |
| Lock | gentle clack | |
| **Line clear (sand)** | granular "pour"/shimmer | the hero SFX; layered: impact + falling-sand hiss + sparkle |
| Multi-line / combo | rising pitch stinger | pitch scales with combo count |
| Level up | short fanfare | |
| Game over | descending motif | |
| UI hover/select/back | tiny clicks | |
| Color-match telegraph | faint chime | when a mono row is one block away |

Pitch/volume randomization (±a few %) on repetitive SFX prevents listener fatigue.

---

## 5. Ducking & priority

- When the **clear/sand SFX** plays, briefly duck music ~15% for ~250 ms so the clear punches through.
- Cap simultaneous SFX voices (e.g. max 8) to avoid clipping during fast play; drop the oldest low-priority voice if exceeded.

---

## 6. Formats & loading

- Provide **`.webm`/`.ogg`** primary + **`.mp3`** fallback for Safari/iOS coverage; Phaser picks the supported one.
- Music: compressed, mono or light stereo, ~96–128 kbps is plenty for web.
- Preload SFX in `PreloadScene` (small). Stream/lazy-load per-level music when entering the level to keep initial load light.

---

## 7. The iOS / mobile autoplay gate

Browsers block audio until a user gesture. Handle this explicitly:
- Do **not** start music on boot. Start it on the first user interaction (tapping "Play"/level start).
- Phaser's sound manager exposes a locked state — resume the Web Audio context on first pointer/key input, then begin BGM.
- If the page is backgrounded (visibility hidden), pause audio; resume on return. Wire to `document.visibilitychange`.

---

## 8. Settings integration

- Settings panel sliders write to `useSettings` (Zustand) → persisted to `localStorage` → emitted on the bus → `AudioManager` applies gains live.
- On boot, load persisted settings **before** any audio plays so the user's chosen volumes are respected from the first sound.
- Provide a quick **mute-all** toggle (and respect it across sessions).

---

## 9. Implementation order (matches TASKS Phase 6)

1. `AudioManager` with master/music/sfx gain groups + settings binding.
2. Autoplay unlock on first gesture.
3. Wire SFX to existing game events (move/rotate/lock/clear).
4. Per-level BGM load + crossfade on level change.
5. Ducking on clear, voice cap.
6. Ambience layer (optional).
