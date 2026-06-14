"use client";

import { create } from "zustand";
import type { GamePhase, PieceType } from "@/game/state/EventNames";

/** Live mirror of in-game state for the React HUD. Not persisted. */
interface HudStore {
  phase: GamePhase;
  score: number;
  level: number;
  levelName: string;
  lines: number;
  linesToTarget: number;
  combo: number;
  b2b: number;
  next: PieceType[];
  hold: PieceType | null;
  canHold: boolean;
  set: (p: Partial<HudStore>) => void;
}

export const useHud = create<HudStore>((set) => ({
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
  set: (p) => set(p),
}));
