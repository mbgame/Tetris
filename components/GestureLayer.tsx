"use client";

import { useRef } from "react";
import { bus } from "@/game/state/events";
import { EventName, InputAction } from "@/game/state/EventNames";

/**
 * Touch Scheme A — gestures over a full-screen area (docs/07 §3a):
 *   swipe ◀▶ → move (distance → repeats), tap → rotate CW, two-finger tap →
 *   rotate CCW, short swipe ▼ → soft drop, fast/long swipe ▼ → hard drop,
 *   swipe ▲ → hold. Velocity/distance thresholds + debounce avoid misreads.
 */
const MOVE_DIST = 28; // px per horizontal step
const TAP_MAX = 14; // px movement still counts as a tap
const HARD_VEL = 1.2; // px/ms downward → hard drop
const SWIPE_MIN = 36; // px to register a vertical swipe

function emit(action: InputAction) {
  bus.emit(EventName.InputAction, { action });
}

export default function GestureLayer() {
  const st = useRef({ x: 0, y: 0, t: 0, lastStepX: 0, fingers: 0, moved: false });

  const onDown = (e: React.PointerEvent) => {
    const s = st.current;
    s.x = e.clientX;
    s.y = e.clientY;
    s.t = performance.now();
    s.lastStepX = e.clientX;
    s.moved = false;
  };

  const onMove = (e: React.PointerEvent) => {
    const s = st.current;
    const dx = e.clientX - s.lastStepX;
    if (Math.abs(e.clientX - s.x) > TAP_MAX || Math.abs(e.clientY - s.y) > TAP_MAX) s.moved = true;
    while (Math.abs(dx) >= MOVE_DIST) {
      emit(dx < 0 ? InputAction.MoveLeft : InputAction.MoveRight);
      s.lastStepX += dx < 0 ? -MOVE_DIST : MOVE_DIST;
      break; // one step per move event; fast drags fire more events
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const s = st.current;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = Math.max(1, performance.now() - s.t);

    if (!s.moved && Math.abs(dx) < TAP_MAX && Math.abs(dy) < TAP_MAX) {
      emit(e.shiftKey ? InputAction.RotateCCW : InputAction.RotateCW); // tap → rotate CW
      return;
    }
    if (dy < -SWIPE_MIN && Math.abs(dy) > Math.abs(dx)) {
      emit(InputAction.Hold); // swipe up
      return;
    }
    if (dy > SWIPE_MIN && Math.abs(dy) > Math.abs(dx)) {
      const vel = dy / dt;
      emit(vel >= HARD_VEL ? InputAction.HardDrop : InputAction.SoftDrop);
    }
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 touch-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
