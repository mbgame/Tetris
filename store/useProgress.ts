"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "./safeStorage";

export interface LevelRecord {
  bestScore: number;
  bestTimeMs?: number;
}

interface ProgressStore {
  /** highest unlocked level id (1..10) */
  unlocked: number;
  records: Record<number, LevelRecord>;
  totalBest: number;
  unlock: (level: number) => void;
  recordScore: (level: number, score: number, timeMs?: number) => void;
  reset: () => void;
}

export const useProgress = create<ProgressStore>()(
  persist(
    (set) => ({
      unlocked: 1,
      records: {},
      totalBest: 0,
      unlock: (level) => set((s) => ({ unlocked: Math.max(s.unlocked, Math.min(10, level)) })),
      recordScore: (level, score, timeMs) =>
        set((s) => {
          const prev = s.records[level] ?? { bestScore: 0 };
          const bestScore = Math.max(prev.bestScore, score);
          const bestTimeMs =
            timeMs == null ? prev.bestTimeMs : Math.min(prev.bestTimeMs ?? Infinity, timeMs);
          return {
            records: { ...s.records, [level]: { bestScore, bestTimeMs } },
            totalBest: Math.max(s.totalBest, score),
          };
        }),
      reset: () => set({ unlocked: 1, records: {}, totalBest: 0 }),
    }),
    { name: "chromasand-progress", version: 1, storage: safeJSONStorage },
  ),
);
