"use client";

import { useEffect } from "react";
import { bus } from "@/game/state/events";
import { EventName } from "@/game/state/EventNames";
import { useHud } from "@/store/useHud";
import { useProgress } from "@/store/useProgress";
import { useSettings } from "@/store/useSettings";

/**
 * Wires the game event bus into the React stores. Renders nothing. Mounted once
 * inside the play layer. Also broadcasts persisted settings on mount so audio /
 * game pick up the user's saved values before the first sound/frame.
 */
export default function HudBridge() {
  useEffect(() => {
    const hud = useHud.getState().set;

    const onScore = (p: { score: number; level: number; lines: number; linesToTarget: number }) =>
      hud({ score: p.score, level: p.level, lines: p.lines, linesToTarget: p.linesToTarget });
    const onLevel = (p: { level: number; name: string }) =>
      hud({ level: p.level, levelName: p.name });
    const onCombo = (p: { combo: number; b2b: number }) => hud({ combo: p.combo, b2b: p.b2b });
    const onQueue = (p: { next: HudNext }) => hud({ next: p.next });
    const onHold = (p: { piece: HudPiece; canHold: boolean }) =>
      hud({ hold: p.piece, canHold: p.canHold });
    const onState = (p: { state: HudPhase }) => hud({ phase: p.state });
    const onCoins = (p: { coins: number }) => hud({ coins: p.coins });
    const onPowerup = (p: {
      multiplier: number;
      multMoves: number;
      hammerArmed: boolean;
      rotateArmed: boolean;
    }) =>
      hud({
        multiplier: p.multiplier,
        multMoves: p.multMoves,
        hammerArmed: p.hammerArmed,
        rotateArmed: p.rotateArmed,
      });

    const onComplete = (p: { level: number; score: number; timeMs?: number }) => {
      useProgress.getState().unlock(p.level + 1);
      useProgress.getState().recordScore(p.level, p.score, p.timeMs);
    };
    const onOver = (p: { level: number; score: number }) =>
      useProgress.getState().recordScore(p.level, p.score);

    // haptics (8.4) — vibrate on clear / game over when enabled + supported
    const vibe = (pattern: number | number[]) => {
      if (useSettings.getState().gameplay.haptics && typeof navigator !== "undefined" && navigator.vibrate)
        navigator.vibrate(pattern);
    };
    const onClearHaptic = () => vibe(18);
    const onOverHaptic = () => vibe([40, 50, 40]);

    bus.on(EventName.ScoreUpdate, onScore);
    bus.on(EventName.LevelChange, onLevel);
    bus.on(EventName.ComboUpdate, onCombo);
    bus.on(EventName.QueueUpdate, onQueue);
    bus.on(EventName.HoldUpdate, onHold);
    bus.on(EventName.StateChange, onState);
    bus.on(EventName.CoinUpdate, onCoins);
    bus.on(EventName.PowerupUpdate, onPowerup);
    bus.on(EventName.LevelComplete, onComplete);
    bus.on(EventName.GameOver, onOver);
    bus.on(EventName.Victory, onOver);
    bus.on(EventName.LinesCleared, onClearHaptic);
    bus.on(EventName.GameOver, onOverHaptic);

    // settings hydrated from localStorage by persist → push to game/audio now.
    useSettings.getState().broadcast();

    return () => {
      bus.off(EventName.ScoreUpdate, onScore);
      bus.off(EventName.LevelChange, onLevel);
      bus.off(EventName.ComboUpdate, onCombo);
      bus.off(EventName.QueueUpdate, onQueue);
      bus.off(EventName.HoldUpdate, onHold);
      bus.off(EventName.StateChange, onState);
      bus.off(EventName.CoinUpdate, onCoins);
      bus.off(EventName.PowerupUpdate, onPowerup);
      bus.off(EventName.LevelComplete, onComplete);
      bus.off(EventName.GameOver, onOver);
      bus.off(EventName.Victory, onOver);
      bus.off(EventName.LinesCleared, onClearHaptic);
      bus.off(EventName.GameOver, onOverHaptic);
    };
  }, []);

  return null;
}

// local aliases to avoid importing payload types verbatim
type HudNext = ReturnType<typeof useHud.getState>["next"];
type HudPiece = ReturnType<typeof useHud.getState>["hold"];
type HudPhase = ReturnType<typeof useHud.getState>["phase"];
