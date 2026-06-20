import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { BackgroundScene } from "./scenes/BackgroundScene";
import { GameScene } from "./scenes/GameScene";
import { BlastScene } from "./scenes/BlastScene";

/** Quality tier — full knob set lands in Phase 9; only DPR/antialias used here. */
export type QualityTier = "low" | "medium" | "high" | "ultra";

/** Canonical play field: 9:16 portrait. Desktop centers this, bg fills margins. */
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

// Tier knobs (incl. DPR cap) live in game/perf/tiers.ts.

export function buildConfig(
  parent: HTMLElement,
  tier: QualityTier = "high",
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#0a0a0a",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
    },
    render: {
      antialias: tier !== "low",
      powerPreference: "high-performance",
      roundPixels: true,
    },
    fps: { target: 60, forceSetTimeOut: false },
    input: { gamepad: true },
    scene: [BootScene, PreloadScene, BackgroundScene, GameScene, BlastScene],
  };
}
