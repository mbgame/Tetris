"use client";

import { LEVELS } from "@/game/levels/levels";
import { BLAST_LEVELS } from "@/game/blast/levels";
import { useProgress } from "@/store/useProgress";
import { useHud } from "@/store/useHud";
import { Button, Panel } from "@/components/ui";

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function MainMenu({
  onPlay,
  onSettings,
  title = "ChromaSand",
  subtitle = "Clear rows of one color. Watch them pour into sand.",
}: {
  onPlay: () => void;
  onSettings: () => void;
  title?: string;
  subtitle?: string;
}) {
  const swatches = ["#4fd1c5", "#f6ad55", "#fc8181", "#68d391", "#b794f4", "#f6e05e"];
  return (
    <Overlay>
      <div className="pointer-events-auto flex w-[min(92vw,460px)] flex-col items-center rounded-3xl bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 px-8 py-10 text-center text-white shadow-2xl ring-1 ring-white/10">
        {/* floating block accents */}
        <div className="mb-6 flex gap-2">
          {swatches.map((c, i) => (
            <span
              key={c}
              className="h-5 w-5 animate-pulse rounded-md shadow-[0_0_12px] [animation-duration:2s]"
              style={{ background: c, color: c, animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>

        <h1 className="bg-gradient-to-r from-teal-300 via-fuchsia-400 to-amber-300 bg-clip-text font-mono text-5xl font-extrabold tracking-tight text-transparent drop-shadow-[0_0_25px_rgba(94,234,212,0.35)]">
          {title}
        </h1>
        <p className="mb-8 mt-3 max-w-xs font-mono text-sm text-zinc-400">{subtitle}</p>

        <button
          onClick={onPlay}
          className="pointer-events-auto group w-full rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-400 px-8 py-4 font-mono text-xl font-bold text-black shadow-[0_0_30px_rgba(45,212,191,0.5)] transition hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(45,212,191,0.7)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
        >
          <span className="inline-block transition group-hover:translate-x-0.5">▶ PLAY</span>
        </button>

        <button
          onClick={onSettings}
          className="pointer-events-auto mt-3 w-full rounded-2xl bg-white/10 px-8 py-3 font-mono text-base font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20 active:scale-95"
        >
          ⚙ Settings
        </button>
      </div>
    </Overlay>
  );
}

export function LevelSelect({ onStart, onBack }: { onStart: (id: number) => void; onBack: () => void }) {
  const unlocked = useProgress((s) => s.unlocked);
  const records = useProgress((s) => s.records);
  return (
    <Overlay>
      <Panel title="Select Level">
        <div className="grid grid-cols-2 gap-2">
          {LEVELS.map((l) => {
            const locked = l.id > unlocked;
            const best = records[l.id]?.bestScore ?? 0;
            return (
              <button
                key={l.id}
                disabled={locked}
                onClick={() => onStart(l.id)}
                className={`rounded-lg p-3 text-left font-mono text-sm transition ${
                  locked ? "cursor-not-allowed bg-white/5 opacity-40" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                <div className="font-bold">
                  {locked ? "🔒 " : ""}
                  {l.id}. {l.name}
                </div>
                <div className="text-xs opacity-60">{l.colors.length} colors{best ? ` · best ${best.toLocaleString()}` : ""}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onBack}>Back</Button>
        </div>
      </Panel>
    </Overlay>
  );
}

export function BlastLevelSelect({
  onStart,
  onBack,
}: {
  onStart: (id: number) => void;
  onBack: () => void;
}) {
  const blastUnlocked = useProgress((s) => s.blastUnlocked);
  return (
    <Overlay>
      <Panel title="Block Drop — Select Level">
        <div className="grid grid-cols-2 gap-2">
          {BLAST_LEVELS.map((l) => {
            const locked = l.id > blastUnlocked;
            return (
              <button
                key={l.id}
                disabled={locked}
                onClick={() => onStart(l.id)}
                className={`rounded-lg p-3 text-left font-mono text-sm transition ${
                  locked ? "cursor-not-allowed bg-white/5 opacity-40" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                <div className="font-bold">
                  {locked ? "🔒 " : ""}
                  {l.id}. {l.name}
                </div>
                <div className="text-xs opacity-60">
                  target {l.targetPoints.toLocaleString()} · {l.colors.length} colors
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onBack}>Back</Button>
        </div>
      </Panel>
    </Overlay>
  );
}

export function PauseCard({
  onResume,
  onRestart,
  onSettings,
  onQuit,
}: {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onQuit: () => void;
}) {
  return (
    <Overlay>
      <Panel title="Paused">
        <div className="flex flex-col gap-3">
          <Button onClick={onResume}>Resume</Button>
          <Button variant="ghost" onClick={onRestart}>Restart level</Button>
          <Button variant="ghost" onClick={onSettings}>Settings</Button>
          <Button variant="ghost" onClick={onQuit}>Quit to menu</Button>
        </div>
      </Panel>
    </Overlay>
  );
}

export function GameOverCard({ onRetry, onQuit }: { onRetry: () => void; onQuit: () => void }) {
  const { score, level } = useHud();
  return (
    <Overlay>
      <Panel title="Game Over">
        <p className="mb-4 font-mono text-sm">Level {level} · Score {score.toLocaleString()}</p>
        <div className="flex flex-col gap-3">
          <Button onClick={onRetry}>Retry</Button>
          <Button variant="ghost" onClick={onQuit}>Quit to menu</Button>
        </div>
      </Panel>
    </Overlay>
  );
}

export function LevelCompleteCard() {
  const { level, score } = useHud();
  return (
    <Overlay>
      <Panel title={`Level ${level} Complete!`}>
        <p className="font-mono text-sm">Score {score.toLocaleString()} · loading next…</p>
      </Panel>
    </Overlay>
  );
}

export function VictoryCard({ onQuit }: { onQuit: () => void }) {
  const { score } = useHud();
  return (
    <Overlay>
      <Panel title="Victory! 🎉">
        <p className="mb-4 font-mono text-sm">All 10 worlds cleared. Final score {score.toLocaleString()}.</p>
        <Button onClick={onQuit}>Back to menu</Button>
      </Panel>
    </Overlay>
  );
}
