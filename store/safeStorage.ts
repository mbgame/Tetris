"use client";

import { createJSONStorage, type StateStorage } from "zustand/middleware";

/**
 * localStorage wrapper that never throws — handles private-mode/quota errors and
 * corrupt JSON gracefully so a bad/missing entry falls back to store defaults
 * instead of crashing the app (docs Phase 11.1).
 */
const safe: StateStorage = {
  getItem: (name) => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage?.setItem(name, value);
    } catch {
      /* quota / private mode — ignore */
    }
  },
  removeItem: (name) => {
    try {
      localStorage?.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const safeJSONStorage = createJSONStorage(() => safe);
