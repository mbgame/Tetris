import Phaser from "phaser";
import type { ClearedCell } from "../core/Board";
import type { QualityTier } from "../config";
import { knobs } from "../perf/tiers";
import { tintFor } from "./palette";

const GRAIN_TEX = "grain";

/**
 * Pours cleared blocks into falling sand using a single Phaser 4 `SpriteGPULayer`
 * (one draw call for thousands of grains). The layer is object-pooled: a fixed
 * GPU buffer is reused via a ring index, so emitting grains causes no GC churn.
 *
 * Grain motion is driven entirely by the layer's built-in member animations
 * (Gravity ease for y, linear drift for x, shrink for scale) — no per-frame JS.
 */
export class SandSystem {
  private layer: Phaser.GameObjects.SpriteGPULayer;
  private head = 0;
  private readonly size: number;
  private readonly perCell: number;

  constructor(
    private scene: Phaser.Scene,
    private cell: number,
    private gridToPixel: (col: number, row: number) => { x: number; y: number },
    tier: QualityTier = "high",
    private palette?: number[],
  ) {
    ensureGrainTexture(scene);
    this.perCell = knobs(tier).grainsPerCell;
    this.size = Math.max(1024, this.perCell * 40 * 2); // ~2 full multi-clears in flight
    this.layer = scene.add.spriteGPULayer(GRAIN_TEX, this.size);
    this.layer.gravity = 1600; // px/s² pulling grains down
    this.layer.setDepth(50);
  }

  /** Emit a sand burst for every cleared cell, tinted to that cell's color. */
  emit(cells: ClearedCell[]): void {
    for (const cell of cells) {
      const { x, y } = this.gridToPixel(cell.x, cell.y);
      const color = tintFor(cell.colorId, this.palette);
      for (let i = 0; i < this.perCell; i++) this.spawnGrain(x, y, color);
    }
  }

  private spawnGrain(px: number, py: number, color: number): void {
    const rng = Math.random;
    const life = 600 + rng() * 300; // 600–900 ms
    const spread = this.cell * 0.4;
    const ox = px + (rng() - 0.5) * this.cell * 0.8;
    const oy = py + (rng() - 0.5) * this.cell * 0.8;
    const up = Math.round(80 + rng() * 160); // initial upward velocity (int)
    const drift = (rng() - 0.5) * spread * 2;
    const s = (0.35 + rng() * 0.45) * (this.cell / 64); // grain size rel. to block
    const tint = jitterBrightness(color, rng);

    const member: Partial<Phaser.Types.GameObjects.SpriteGPULayer.Member> = {
      x: { base: ox, amplitude: drift, ease: "Quad.easeOut", duration: life, loop: false },
      y: { base: oy, ease: "Gravity", velocity: -up, gravityFactor: 1, duration: life, loop: false },
      scaleX: { base: s, amplitude: -s, ease: "Quad.easeIn", duration: life, loop: false },
      scaleY: { base: s, amplitude: -s, ease: "Quad.easeIn", duration: life, loop: false },
      tintBlend: 1,
      tintTopLeft: tint,
      tintTopRight: tint,
      tintBottomLeft: tint,
      tintBottomRight: tint,
      creationTime: this.layer.timeElapsed,
    };

    if (this.layer.memberCount < this.size) {
      this.layer.addMember(member);
    } else {
      this.layer.editMember(this.head % this.size, member); // recycle oldest
    }
    this.head++;
  }
}

/** ±18% brightness variation so the burst reads as granular sand, not flat dots. */
function jitterBrightness(color: number, rng: () => number): number {
  const f = 0.82 + rng() * 0.36;
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

/** Tiny soft dot used for every grain (tinted per member). */
export function ensureGrainTexture(scene: Phaser.Scene, size = 16): void {
  if (scene.textures.exists(GRAIN_TEX)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = size / 2;
  // soft radial-ish dot via stacked translucent circles
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(0xffffff, i === 1 ? 1 : 0.18);
    g.fillCircle(c, c, (c * i) / 4);
  }
  g.generateTexture(GRAIN_TEX, size, size);
  g.destroy();
}

export { GRAIN_TEX };
