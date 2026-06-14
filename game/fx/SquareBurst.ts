import Phaser from "phaser";
import type { ClearedCell } from "../core/Board";
import { BLOCK_TEX } from "../render/BlockRenderer";
import { tintFor } from "../render/palette";

export interface BlockPool {
  obtainBlock: () => Phaser.GameObjects.Image;
  releaseBlock: (img: Phaser.GameObjects.Image) => void;
}

const DURATION = 460;

/**
 * 3×3 square clear effect — deliberately different from the line-clear sand pour.
 * The cells flash white, then burst outward as spinning shards while an expanding
 * colored shockwave ring + bright core flash radiate from the square's center.
 */
export class SquareBurst {
  constructor(
    private scene: Phaser.Scene,
    private cell: number,
    private gridToPixel: (col: number, row: number) => { x: number; y: number },
    private palette?: number[],
    private pool?: BlockPool,
  ) {}

  run(cells: ClearedCell[], onDone: () => void): void {
    if (cells.length === 0) {
      onDone();
      return;
    }
    // center of mass + dominant color
    let cx = 0;
    let cy = 0;
    for (const c of cells) {
      const p = this.gridToPixel(c.x, c.y);
      cx += p.x;
      cy += p.y;
    }
    cx /= cells.length;
    cy /= cells.length;
    const color = tintFor(cells[0].colorId, this.palette);

    this.shockwave(cx, cy, color);
    this.coreFlash(cx, cy);
    this.scene.cameras.main.flash(120, ...rgb(color), false);

    let remaining = cells.length;
    const free = (img: Phaser.GameObjects.Image) =>
      this.pool ? this.pool.releaseBlock(img) : img.destroy();

    for (const c of cells) {
      const { x, y } = this.gridToPixel(c.x, c.y);
      const img = this.pool ? this.pool.obtainBlock() : this.scene.add.image(0, 0, BLOCK_TEX);
      img.setPosition(x, y).setDisplaySize(this.cell, this.cell).setTint(0xffffff).setDepth(45);

      const ang = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.6;
      const dist = this.cell * (1.6 + Math.random());
      this.scene.tweens.add({
        targets: img,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        angle: (Math.random() - 0.5) * 540,
        scale: 0,
        alpha: 0,
        duration: DURATION,
        ease: "Cubic.easeOut",
        onComplete: () => {
          free(img);
          if (--remaining === 0) onDone();
        },
      });
      // quick white→color flash on each shard
      this.scene.tweens.add({ targets: img, duration: 90, onUpdate: () => img.setTint(0xffffff) });
      this.scene.time.delayedCall(90, () => img.setTint(color));
    }
  }

  private shockwave(cx: number, cy: number, color: number): void {
    const ring = this.scene.add.graphics().setDepth(44);
    const state = { r: this.cell * 0.6, a: 0.9, w: 8 };
    this.scene.tweens.add({
      targets: state,
      r: this.cell * 4.5,
      a: 0,
      w: 1,
      duration: DURATION,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(state.w, color, state.a);
        ring.strokeCircle(cx, cy, state.r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  private coreFlash(cx: number, cy: number): void {
    const core = this.scene.add.circle(cx, cy, this.cell * 1.2, 0xffffff, 0.9).setDepth(46);
    this.scene.tweens.add({
      targets: core,
      scale: 2.4,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => core.destroy(),
    });
  }
}

/** 0xRRGGBB → [r,g,b]. */
function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}
