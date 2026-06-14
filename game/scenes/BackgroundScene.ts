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
export class BackgroundScene extends Phaser.Scene {
  private shader?: Phaser.GameObjects.Shader;
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
  }

  update(time: number) {
    this.shader?.setUniform("uTime", time / 1000);
  }
}
