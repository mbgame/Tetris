"use client";

import { useRef } from "react";
import { bus } from "@/game/state/events";
import { EventName, InputAction } from "@/game/state/EventNames";

/**
 * Touch Scheme B — bottom-anchored DOM control pad. Large (≥44px), thumb-
 * reachable, semi-transparent. Emits device-agnostic InputActions on the bus.
 * Soft-drop auto-repeats while held via pointer down/up.
 */
function emit(action: InputAction) {
  bus.emit(EventName.InputAction, { action });
}

function PadButton({
  label,
  action,
  hold,
  className = "",
}: {
  label: string;
  action: InputAction;
  hold?: boolean;
  className?: string;
}) {
  const repeat = useRef(0);
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    emit(action);
    if (hold) repeat.current = window.setInterval(() => emit(action), 50);
  };
  const stop = () => {
    if (repeat.current) window.clearInterval(repeat.current);
    repeat.current = 0;
  };
  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={`pointer-events-auto flex h-16 min-w-16 select-none items-center justify-center rounded-2xl bg-white/15 text-2xl text-white backdrop-blur active:bg-white/30 ${className}`}
      aria-label={action}
    >
      {label}
    </button>
  );
}

export default function TouchControls() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      {/* left cluster: movement */}
      <div className="flex gap-2">
        <PadButton label="◀" action={InputAction.MoveLeft} />
        <PadButton label="▶" action={InputAction.MoveRight} />
        <PadButton label="▼" action={InputAction.SoftDrop} hold />
      </div>
      {/* right cluster: rotate / drop / hold */}
      <div className="flex gap-2">
        <PadButton label="⟲" action={InputAction.RotateCCW} />
        <PadButton label="⟳" action={InputAction.RotateCW} />
        <PadButton label="⤓" action={InputAction.HardDrop} />
        <PadButton label="⇪" action={InputAction.Hold} />
      </div>
    </div>
  );
}
