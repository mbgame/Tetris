"use client";

import { useHud } from "@/store/useHud";

/**
 * Minimal DOM HUD for Block Drop mode: score, level, points-to-target, and the
 * pause/settings buttons. Fed by `useHud` (mirrors the game event bus). The
 * board + draggable tray are drawn inside the Phaser canvas, not here.
 */
export default function BlastHud({
  onPause,
  onSettings,
}: {
  onPause: () => void;
  onSettings: () => void;
}) {
  const { score, level, levelName, linesToTarget } = useHud();

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between p-3 font-mono">
        <div>
          <div className="text-xs opacity-70">SCORE</div>
          <div className="text-2xl font-bold tabular-nums text-fuchsia-300">
            {score.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs opacity-70">LEVEL {level}</div>
          <div className="text-sm">{levelName}</div>
          <div className="text-xs opacity-70">{linesToTarget.toLocaleString()} pts to go</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSettings}
            className="pointer-events-auto rounded bg-white/10 px-3 py-1 text-sm backdrop-blur hover:bg-white/20"
            aria-label="Settings"
          >
            ⚙
          </button>
          <button
            onClick={onPause}
            className="pointer-events-auto rounded bg-white/10 px-3 py-1 text-sm backdrop-blur hover:bg-white/20"
            aria-label="Pause"
          >
            ⏸
          </button>
        </div>
      </div>
    </div>
  );
}
