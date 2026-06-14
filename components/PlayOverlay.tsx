"use client";

import { useState } from "react";
import { bus } from "@/game/state/events";
import { EventName } from "@/game/state/EventNames";
import { useHud } from "@/store/useHud";
import { useSettings } from "@/store/useSettings";
import HUD from "@/components/HUD/HUD";
import TouchControls from "@/components/TouchControls";
import GestureLayer from "@/components/GestureLayer";
import Settings from "@/components/menus/Settings";
import {
  MainMenu,
  LevelSelect,
  PauseCard,
  GameOverCard,
  LevelCompleteCard,
  VictoryCard,
} from "@/components/menus/Menus";

type View = "main" | "select" | "playing";

/**
 * Orchestrates the whole DOM overlay: main menu / level select before play, and
 * HUD + pause/gameover/complete/victory cards during play. Drives the game via
 * bus intents; reads live phase from `useHud`.
 */
export default function PlayOverlay() {
  const [view, setView] = useState<View>("main");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const phase = useHud((s) => s.phase);
  const scheme = useSettings((s) => s.gameplay.controlScheme);
  const showControls = phase === "PLAYING" || phase === "COUNTDOWN" || phase === "LINE_CLEAR";

  const start = (id: number) => {
    bus.emit(EventName.RequestStartLevel, { level: id });
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
    <div className="absolute inset-0">
      {view === "playing" && (
        <>
          {showControls && scheme === "gestures" && <GestureLayer />}
          <HUD onPause={pause} onSettings={() => setSettingsOpen(true)} />
          {showControls && scheme === "buttons" && <TouchControls />}
          {phase === "PAUSED" && (
            <PauseCard
              onResume={resume}
              onRestart={restart}
              onSettings={() => setSettingsOpen(true)}
              onQuit={quit}
            />
          )}
          {phase === "GAME_OVER" && <GameOverCard onRetry={restart} onQuit={quit} />}
          {phase === "LEVEL_COMPLETE" && <LevelCompleteCard />}
          {phase === "VICTORY" && <VictoryCard onQuit={quit} />}
        </>
      )}

      {view === "main" && (
        <MainMenu onPlay={() => setView("select")} onSettings={() => setSettingsOpen(true)} />
      )}
      {view === "select" && <LevelSelect onStart={start} onBack={() => setView("main")} />}

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
