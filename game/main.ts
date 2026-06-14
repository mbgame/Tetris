import Phaser from "phaser";
import { buildConfig, type QualityTier } from "./config";
import { AudioManager } from "./audio/AudioManager";

// Phaser 4.1.0's SpriteGPULayer constructor references the global `Phaser`
// (e.g. `new Phaser.Structs.Map()`), which doesn't exist under ESM bundling.
// Expose it so the GPU sand layer can be created.
(globalThis as unknown as { Phaser?: typeof Phaser }).Phaser ??= Phaser;

/**
 * Entry point booted only on the client (dynamic import from GameCanvas).
 * Never import this from server-bundled code — it pulls in Phaser (needs window).
 */
export function createGame(parent: HTMLElement, tier: QualityTier = "high"): Phaser.Game {
  const game = new Phaser.Game(buildConfig(parent, tier));

  // Audio: created up front, unlocked on first user gesture (autoplay gate).
  const audio = new AudioManager();
  audio.attachUnlock();
  game.events.once(Phaser.Core.Events.DESTROY, () => audio.dispose());

  // Dev handle for debugging / e2e probes.
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __PHASER_GAME__?: Phaser.Game; __AUDIO__?: AudioManager }).__PHASER_GAME__ = game;
    (window as unknown as { __AUDIO__?: AudioManager }).__AUDIO__ = audio;
  }
  return game;
}
