import Phaser from "phaser";
import { fragForTheme } from "../fx/BackgroundShaders";
import type { SceneTheme } from "../levels/levels";
import type { QualityTier } from "../config";
import { knobs } from "../perf/tiers";
import { bus } from "../state/events";
import { EventName, type LevelChangePayload } from "../state/EventNames";

/**
 * Per-level themed background. Runs a full-screen fragment shader animated by
 * uTime, rendered behind GameScene at a tier-scaled internal resolution and
 * upscaled, dimmed by the level's bgDim.
 */
/** Per-theme accent-particle tint (floating motes — pollen/embers/bubbles/stars). */
const ACCENT_COLOR: Record<SceneTheme, number> = {
  dawn: 0xfff1c1, neon: 0x00f0ff, crystal: 0xbfefff, dunes: 0xffe2a8, ocean: 0x9fe6ff,
  forge: 0xff8a3c, aurora: 0x9bffd6, sky: 0xffffff, void: 0xd6b8ff, prism: 0xffffff,
};

export class BackgroundScene extends Phaser.Scene {
  private shader?: Phaser.GameObjects.Shader;
  private accents: Phaser.GameObjects.Arc[] = [];
  private theme: SceneTheme = "dawn";
  private dim = 0.45;
  private tier: QualityTier = "high";

  constructor() {
    super("BackgroundScene");
  }

  create() {
    this.tier = (this.registry.get("tier") as QualityTier) ?? "high";
    this.build();
    bus.on(EventName.LevelChange, this.onLevelChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.off(EventName.LevelChange, this.onLevelChange));
  }

  private onLevelChange = (p: LevelChangePayload) => {
    this.theme = p.theme as SceneTheme;
    this.dim = p.bgDim;
    this.build();
  };

  private build() {
    this.tier = (this.registry.get("tier") as QualityTier) ?? this.tier;
    this.shader?.destroy();
    const { width, height } = this.scale.gameSize;
    const scale = knobs(this.tier).bgScale;
    const iw = Math.max(2, Math.floor(width * scale));
    const ih = Math.max(2, Math.floor(height * scale));

    this.shader = this.add
      .shader(
        {
          name: `bg-${this.theme}`,
          fragmentSource: fragForTheme(this.theme),
          initialUniforms: { uResolution: [iw, ih], uTime: 0, uDim: this.dim },
        },
        width / 2,
        height / 2,
        iw,
        ih,
      )
      .setDisplaySize(width, height)
      .setDepth(-100);

    this.addAccents(width, height);
  }

  /** Cheap floating accent motes that drift upward + twinkle, tinted per theme. */
  private addAccents(width: number, height: number) {
    this.accents.forEach((a) => a.destroy());
    this.accents = [];
    const count = this.tier === "low" ? 0 : this.tier === "medium" ? 16 : 28;
    const color = ACCENT_COLOR[this.theme] ?? 0xffffff;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = 1.5 + Math.random() * 2.5;
      const mote = this.add.circle(x, y, r, color, 0.5).setDepth(-90);
      this.accents.push(mote);
      const dur = 6000 + Math.random() * 8000;
      this.tweens.add({
        targets: mote,
        y: y - (60 + Math.random() * 120),
        x: x + (Math.random() - 0.5) * 60,
        duration: dur,
        repeat: -1,
        yoyo: true,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: mote,
        alpha: { from: 0.15, to: 0.7 },
        duration: 1200 + Math.random() * 2000,
        repeat: -1,
        yoyo: true,
      });
    }
  }

  update(time: number) {
    this.shader?.setUniform("uTime", time / 1000);
  }
}
