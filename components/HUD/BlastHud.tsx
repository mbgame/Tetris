"use client";

import { bus } from "@/game/state/events";
import { EventName } from "@/game/state/EventNames";
import { useHud } from "@/store/useHud";
import { POWERUPS, type PowerupKind } from "@/game/blast/powerups";

/**
 * DOM HUD for Block Drop: score + points-to-target up top, a prominent coin
 * wallet and multiplier badge, and a big vertical power-up rail down the right
 * edge (the Phaser board reserves that strip). Buttons dispatch RequestPowerup
 * intents. Board + tray live inside the Phaser canvas.
 */
export default function BlastHud({
  onPause,
  onSettings,
}: {
  onPause: () => void;
  onSettings: () => void;
}) {
  const { score, level, levelName, linesToTarget, coins, multiplier, multMoves, hammerArmed, rotateArmed } =
    useHud();

  const buy = (kind: PowerupKind) => bus.emit(EventName.RequestPowerup, { kind });

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      {/* top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between p-3 font-mono">
        <div className="flex flex-col gap-1.5">
          <div>
            <div className="text-xs opacity-70">SCORE</div>
            <div className="text-2xl font-bold tabular-nums text-fuchsia-300">
              {score.toLocaleString()}
            </div>
          </div>
          {/* coin wallet — big, glowing */}
          <div className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-lg font-bold text-amber-300 ring-1 ring-amber-300/40 shadow-[0_0_16px_rgba(251,191,36,0.35)]">
            <span className="text-xl">🪙</span>
            <span className="tabular-nums">{coins}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <div className="text-xs opacity-70">LEVEL {level}</div>
          <div className="text-sm">{levelName}</div>
          <div className="text-xs opacity-70">{linesToTarget.toLocaleString()} pts to go</div>
          {multiplier > 1 && (
            <div className="mt-1 animate-pulse rounded-full bg-violet-500/30 px-3 py-1 text-base font-bold text-violet-200 ring-2 ring-violet-300/60 shadow-[0_0_18px_rgba(167,139,250,0.5)]">
              {multiplier}× POINTS · {multMoves}
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

      {/* power-up rail — right edge, big gamey buttons */}
      <div className="absolute bottom-0 right-0 top-0 flex w-[14%] min-w-[60px] flex-col items-stretch justify-center gap-2 p-1.5 font-mono">
        <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-white/50">
          Power-ups
        </div>
        {POWERUPS.map((p) => {
          const affordable = coins >= p.cost;
          const armed = (p.kind === "hammer" && hammerArmed) || (p.kind === "rotate" && rotateArmed);
          return (
            <button
              key={p.kind}
              onClick={() => buy(p.kind)}
              disabled={!affordable}
              title={`${p.label} — ${p.desc} (${p.cost} coins)`}
              className={`pointer-events-auto flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 backdrop-blur transition ${
                armed
                  ? "scale-105 bg-rose-500/40 ring-2 ring-rose-300 shadow-[0_0_18px_rgba(251,113,133,0.6)]"
                  : affordable
                    ? "bg-white/15 ring-1 ring-white/20 hover:scale-105 hover:bg-white/25 active:scale-95"
                    : "cursor-not-allowed bg-white/5 opacity-40"
              }`}
            >
              <span className="text-3xl leading-none">{p.icon}</span>
              <span className="text-[10px] font-semibold leading-tight opacity-90">{p.label}</span>
              <span
                className={`flex items-center gap-0.5 rounded-full px-1.5 text-[11px] font-bold ${
                  affordable ? "bg-amber-400/20 text-amber-300" : "text-white/50"
                }`}
              >
                {p.cost} 🪙
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
