import Phaser from "phaser";

/**
 * Loads level assets (atlas, audio, shaders) — stubbed for now.
 * On complete: start Background (behind) then launch Game (on top).
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    // Asset loading lands in later phases.
  }

  create() {
    // Order matters: BackgroundScene added first → renders behind play scenes.
    // Both gameplay scenes run concurrently but stay dormant until their start
    // intent (mode "classic" → GameScene, "blast" → BlastScene).
    this.scene.start("BackgroundScene");
    this.scene.launch("GameScene");
    this.scene.launch("BlastScene");
  }
}
