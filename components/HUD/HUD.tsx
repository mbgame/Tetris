"use client";

import { useHud } from "@/store/useHud";
import { useSettings } from "@/store/useSettings";
import { getLevel } from "@/game/levels/levels";
import PieceTile from "./PieceTile";

/**
 * DOM HUD overlay above the canvas (never drawn inside it). Fed entirely by
 * `useHud`, which mirrors the game event bus.
 */
export default function HUD({ onPause, onSettings }: { onPause: () => void; onSettings: () => void }) {
  const { score, level, levelName, linesToTarget, combo, b2b, next, hold, canHold } = useHud();
  const glyphs = useSettings((s) => s.graphics.colorblindGlyphs);
  const showNextCount = useSettings((s) => s.gameplay.showNextCount);

  let palette: { hex: string; glyph: string }[] = [];
  try {
    palette = getLevel(level).colors;
  } catch {
    /* level not loaded yet */
  }

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      {/* top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between p-3 font-mono">
        <div>
          <div className="text-xs opacity-70">SCORE</div>
          <div className="text-2xl font-bold tabular-nums">{score.toLocaleString()}</div>
        </div>
        <div className="text-center">
          <div className="text-xs opacity-70">LEVEL {level}</div>
          <div className="text-sm">{levelName}</div>
          <div className="text-xs opacity-70">{linesToTarget} to go</div>
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

      {/* combo */}
      {combo > 0 && (
        <div className="absolute left-1/2 top-20 -translate-x-1/2 font-mono text-lg font-bold text-yellow-300">
          {combo + 1}× COMBO{b2b > 0 ? " · B2B" : ""}
        </div>
      )}

      {/* hold (left) */}
      <div className="absolute left-3 top-1/3 font-mono">
        <div className="text-xs opacity-70">HOLD</div>
        <div className={`rounded bg-black/30 p-1 ${canHold ? "" : "opacity-40"}`}>
          <PieceTile type={hold} size={48} />
        </div>
      </div>

      {/* next (right) */}
      <div className="absolute right-3 top-1/4 font-mono">
        <div className="text-xs opacity-70">NEXT</div>
        <div className="flex flex-col gap-1">
          {next.slice(0, showNextCount).map((t, i) => (
            <div key={i} className="rounded bg-black/30 p-1">
              <PieceTile type={t} size={i === 0 ? 52 : 40} />
            </div>
          ))}
        </div>
      </div>

      {/* palette legend (bottom) */}
      {palette.length > 0 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-3 rounded bg-black/30 px-3 py-1 font-mono text-sm">
          {palette.map((c) => (
            <span key={c.hex} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: c.hex }} />
              {glyphs && <span>{c.glyph}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
