"use client";

import { bus } from "@/game/state/events";
import { EventName } from "@/game/state/EventNames";
import { useHud } from "@/store/useHud";
import { POWERUPS, type PowerupKind } from "@/game/blast/powerups";

/**
 * DOM HUD for Block Drop mode: score, level, points-to-target, coin wallet,
 * active multiplier badge, and the power-up bar. Fed by `useHud` (mirrors the
 * game event bus); buttons dispatch `RequestPowerup` intents. The board + tray
 * are drawn inside the Phaser canvas, not here.
 */
export default function BlastHud({
  onPause,
  onSettings,
}: {
  onPause: () => void;
  onSettings: () => void;
}) {
  const { score, level, levelName, linesToTarget, coins, multiplier, multMoves, hammerArmed } = useHud();

  const buy = (kind: PowerupKind) => bus.emit(EventName.RequestPowerup, { kind });

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      {/* top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between p-3 font-mono">
        <div>
          <div className="text-xs opacity-70">SCORE</div>
          <div className="text-2xl font-bold tabular-nums text-fuchsia-300">
            {score.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm font-bold text-amber-300">
            🪙 <span className="tabular-nums">{coins}</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs opacity-70">LEVEL {level}</div>
          <div className="text-sm">{levelName}</div>
          <div className="text-xs opacity-70">{linesToTarget.toLocaleString()} pts to go</div>
          {multiplier > 1 && (
            <div className="mt-1 inline-block animate-pulse rounded bg-violet-500/30 px-2 py-0.5 text-sm font-bold text-violet-200 ring-1 ring-violet-300/50">
              {multiplier}× · {multMoves} left
            </div>
          )}
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

      {/* power-up bar (bottom) */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2 font-mono">
        {POWERUPS.map((p) => {
          const affordable = coins >= p.cost;
          const armed = p.kind === "hammer" && hammerArmed;
          return (
            <button
              key={p.kind}
              onClick={() => buy(p.kind)}
              disabled={!affordable}
              title={`${p.label} — ${p.desc} (${p.cost}🪙)`}
              className={`pointer-events-auto flex w-14 flex-col items-center rounded-lg px-1 py-1.5 text-center backdrop-blur transition ${
                armed
                  ? "bg-rose-500/40 ring-2 ring-rose-300"
                  : affordable
                    ? "bg-white/15 hover:bg-white/25"
                    : "cursor-not-allowed bg-white/5 opacity-40"
              }`}
            >
              <span className="text-xl leading-none">{p.icon}</span>
              <span className="mt-0.5 text-[9px] leading-tight opacity-80">{p.label}</span>
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
                {p.cost}🪙
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
