import Phaser from "phaser";

/** First scene. Minimal setup, then hand off to Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    // Visible confirmation a colored canvas renders at correct aspect (task 1.3).
    this.cameras.main.setBackgroundColor("#101820");
    this.scene.start("PreloadScene");
  }
}
