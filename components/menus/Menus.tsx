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
  return (
    <Overlay>
      <Panel>
        <h1 className="mb-1 font-mono text-4xl font-bold tracking-tight text-teal-300">{title}</h1>
        <p className="mb-6 font-mono text-sm opacity-70">{subtitle}</p>
        <div className="flex flex-col gap-3">
          <Button onClick={onPlay}>Play</Button>
          <Button variant="ghost" onClick={onSettings}>Settings</Button>
        </div>
      </Panel>
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
  return (
    <Overlay>
      <Panel title="Block Drop — Select Level">
        <div className="grid grid-cols-2 gap-2">
          {BLAST_LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => onStart(l.id)}
              className="rounded-lg bg-white/10 p-3 text-left font-mono text-sm transition hover:bg-white/20"
            >
              <div className="font-bold">
                {l.id}. {l.name}
              </div>
              <div className="text-xs opacity-60">
                target {l.targetPoints.toLocaleString()} · {l.colors.length} colors
              </div>
            </button>
          ))}
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
