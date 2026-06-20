"use client";

import { create } from "zustand";
import type { GameMode, GamePhase, PieceType, QueuePreviewItem } from "@/game/state/EventNames";

/** Live mirror of in-game state for the React HUD. Not persisted. */
interface HudStore {
  mode: GameMode;
  phase: GamePhase;
  score: number;
  level: number;
  levelName: string;
  lines: number;
  linesToTarget: number;
  combo: number;
  b2b: number;
  next: QueuePreviewItem[];
  hold: PieceType | null;
  canHold: boolean;
  // Block Drop economy
  coins: number;
  multiplier: number;
  multMoves: number;
  hammerArmed: boolean;
  rotateArmed: boolean;
  set: (p: Partial<HudStore>) => void;
}

export const useHud = create<HudStore>((set) => ({
  mode: "classic",
  phase: "BOOT",
  score: 0,
  level: 1,
  levelName: "",
  lines: 0,
  linesToTarget: 0,
  combo: 0,
  b2b: 0,
  next: [],
  hold: null,
  canHold: true,
  coins: 0,
  multiplier: 1,
  multMoves: 0,
  hammerArmed: false,
  rotateArmed: false,
  set: (p) => set(p),
}));
