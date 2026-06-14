"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { bus } from "@/game/state/events";
import { EventName } from "@/game/state/EventNames";
import { safeJSONStorage } from "./safeStorage";

export type QualityTier = "low" | "medium" | "high" | "ultra" | "auto";
export type RuleMode = "color" | "classic";

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muteAll: boolean;
}
export interface GraphicsSettings {
  tier: QualityTier;
  bgDim: number; // 0..1 extra dim
  bloom: boolean;
  screenShake: boolean;
  reduceMotion: boolean;
  colorblindGlyphs: boolean;
}
export type ControlScheme = "buttons" | "gestures";

export interface GameplaySettings {
  ruleMode: RuleMode;
  ghostPiece: boolean;
  showNextCount: 1 | 2 | 3;
  holdEnabled: boolean;
  das: number; // ms
  arr: number; // ms
  controlScheme: ControlScheme;
  haptics: boolean;
}

export interface Settings {
  audio: AudioSettings;
  graphics: GraphicsSettings;
  gameplay: GameplaySettings;
}

interface SettingsStore extends Settings {
  setAudio: (p: Partial<AudioSettings>) => void;
  setGraphics: (p: Partial<GraphicsSettings>) => void;
  setGameplay: (p: Partial<GameplaySettings>) => void;
  /** Push the full settings snapshot onto the event bus (game applies live). */
  broadcast: () => void;
}

const DEFAULTS: Settings = {
  audio: { master: 80, music: 80, sfx: 80, muteAll: false },
  graphics: {
    tier: "auto",
    bgDim: 0,
    bloom: true,
    screenShake: true,
    reduceMotion: false,
    colorblindGlyphs: false,
  },
  gameplay: {
    ruleMode: "color",
    ghostPiece: true,
    showNextCount: 3,
    holdEnabled: true,
    das: 130,
    arr: 30,
    controlScheme: "buttons",
    haptics: true,
  },
};

/** Translate UI settings into the bus payload the game/audio consume. */
function toBusPayload(s: Settings) {
  return {
    audio: {
      master: s.audio.master,
      music: s.audio.music,
      sfx: s.audio.sfx,
      ambience: s.audio.music,
      muteMaster: s.audio.muteAll,
      muteMusic: false,
      muteSfx: false,
      muteAmbience: false,
    },
    graphics: s.graphics,
    gameplay: s.gameplay,
  };
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      setAudio: (p) => {
        set((s) => ({ audio: { ...s.audio, ...p } }));
        get().broadcast();
      },
      setGraphics: (p) => {
        set((s) => ({ graphics: { ...s.graphics, ...p } }));
        get().broadcast();
      },
      setGameplay: (p) => {
        set((s) => ({ gameplay: { ...s.gameplay, ...p } }));
        get().broadcast();
      },
      broadcast: () => {
        const { audio, graphics, gameplay } = get();
        bus.emit(EventName.SettingsChange, toBusPayload({ audio, graphics, gameplay }));
      },
    }),
    { name: "chromasand-settings", version: 1, storage: safeJSONStorage },
  ),
);
