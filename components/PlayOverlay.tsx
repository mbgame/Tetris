"use client";

import { useEffect, useState } from "react";
import { bus } from "@/game/state/events";
import { EventName, type GameMode } from "@/game/state/EventNames";
import { useHud } from "@/store/useHud";
import { useSettings } from "@/store/useSettings";
import HUD from "@/components/HUD/HUD";
import BlastHud from "@/components/HUD/BlastHud";
import TouchControls from "@/components/TouchControls";
import GestureLayer from "@/components/GestureLayer";
import Settings from "@/components/menus/Settings";
import {
  MainMenu,
  LevelSelect,
  BlastLevelSelect,
  PauseCard,
  GameOverCard,
  LevelCompleteCard,
  VictoryCard,
} from "@/components/menus/Menus";

type View = "main" | "select" | "playing";

/**
 * Orchestrates the whole DOM overlay for the chosen game `mode`: main menu /
 * level select before play, and HUD + pause/gameover/complete/victory cards
 * during play. Drives the game via bus intents; reads live phase from `useHud`.
 */
export default function PlayOverlay({ mode }: { mode: GameMode }) {
  const [view, setView] = useState<View>("main");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const phase = useHud((s) => s.phase);
  const scheme = useSettings((s) => s.gameplay.controlScheme);
  const setHud = useHud((s) => s.set);
  const showControls = phase === "PLAYING" || phase === "COUNTDOWN" || phase === "LINE_CLEAR";
  const isBlast = mode === "blast";

  // record the active mode so HUD components can branch.
  useEffect(() => {
    setHud({ mode });
  }, [mode, setHud]);

  const start = (id: number) => {
    bus.emit(EventName.RequestStartLevel, { level: id, mode });
    setView("playing");
  };
  const pause = () => bus.emit(EventName.RequestPause, undefined);
  const resume = () => bus.emit(EventName.RequestResume, undefined);
  const restart = () => bus.emit(EventName.RequestRestart, undefined);
  const quit = () => {
    bus.emit(EventName.RequestQuit, undefined);
    setView("main");
  };

  return (
    // pointer-events-none so canvas drag (Block Drop) isn't swallowed; interactive
    // children (HUD buttons, menus, gesture/touch layers) opt back in themselves.
    <div className="pointer-events-none absolute inset-0">
      {view === "playing" && (
        <>
          {/* gesture/touch controls only apply to classic falling-piece mode */}
          {!isBlast && showControls && scheme === "gestures" && <GestureLayer />}
          {isBlast ? (
            <BlastHud onPause={pause} onSettings={() => setSettingsOpen(true)} />
          ) : (
            <HUD onPause={pause} onSettings={() => setSettingsOpen(true)} />
          )}
          {!isBlast && showControls && scheme === "buttons" && <TouchControls />}
          {phase === "PAUSED" && (
            <PauseCard
              onResume={resume}
              onRestart={restart}
              onSettings={() => setSettingsOpen(true)}
              onQuit={quit}
            />
          )}
          {phase === "GAME_OVER" && <GameOverCard onRetry={restart} onQuit={quit} />}
          {/* Block Drop plays an in-canvas level-up celebration + auto-advances,
              so skip the dimming card that would hide it. */}
          {!isBlast && phase === "LEVEL_COMPLETE" && <LevelCompleteCard />}
          {phase === "VICTORY" && <VictoryCard onQuit={quit} />}
        </>
      )}

      {view === "main" &&
        (isBlast ? (
          <MainMenu
            onPlay={() => setView("select")}
            onSettings={() => setSettingsOpen(true)}
            title="Block Drop"
            subtitle="Drag blocks onto the grid. Fill rows or columns to clear."
          />
        ) : (
          <MainMenu onPlay={() => setView("select")} onSettings={() => setSettingsOpen(true)} />
        ))}
      {view === "select" &&
        (isBlast ? (
          <BlastLevelSelect onStart={start} onBack={() => setView("main")} />
        ) : (
          <LevelSelect onStart={start} onBack={() => setView("main")} />
        ))}

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
