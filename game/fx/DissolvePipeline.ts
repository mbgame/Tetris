import Phaser from "phaser";
import type { ClearedCell } from "../core/Board";
import type { QualityTier } from "../config";
import { knobs } from "../perf/tiers";
import { BLOCK_TEX } from "../render/BlockRenderer";
import { tintFor } from "../render/palette";

const DURATION = 280; // ms per block (docs/03 §1a)
const STAGGER = 22; // ms left→right sweep per column
const EDGE_WIDTH = 0.16; // hot-edge band width in progress space
const EDGE_COLOR = 0xffd9a0; // hot sand edge

const subdiv = (tier: QualityTier): number => knobs(tier).dissolveSubdiv;

interface SubTile {
  img: Phaser.GameObjects.Image;
  threshold: number;
  hidden: boolean;
}

/**
 * Drives the block→sand "crumble": each clearing block breaks into a grid of
 * sub-tiles that vanish in noise order over ~280 ms with a hot leading edge and
 * a left→right stagger — it crumbles rather than blinks. Equivalent to the
 * dissolve.frag GPU path but runs identically on every tier.
 *
 * `low` / reduceMotion fall back to a quick scale-out (task 3.7).
 */
export interface BlockPool {
  obtainBlock: () => Phaser.GameObjects.Image;
  releaseBlock: (img: Phaser.GameObjects.Image) => void;
}

export class DissolvePipeline {
  constructor(
    private scene: Phaser.Scene,
    private cell: number,
    private gridToPixel: (col: number, row: number) => { x: number; y: number },
    private tier: QualityTier = "high",
    private reduceMotion = false,
    private palette?: number[],
    private pool?: BlockPool,
  ) {}

  private take(x: number, y: number, w: number, tint: number): Phaser.GameObjects.Image {
    const img = this.pool ? this.pool.obtainBlock() : this.scene.add.image(0, 0, BLOCK_TEX);
    img.setPosition(x, y).setDisplaySize(w, w).setTint(tint).setDepth(40);
    return img;
  }
  private free(img: Phaser.GameObjects.Image): void {
    if (this.pool) this.pool.releaseBlock(img);
    else img.destroy();
  }

  run(cells: ClearedCell[], onDone: () => void): void {
    if (cells.length === 0) {
      onDone();
      return;
    }
    if (this.tier === "low" || this.reduceMotion || subdiv(this.tier) === 0) {
      this.scaleOut(cells, onDone);
    } else {
      this.crumble(cells, onDone);
    }
  }

  // ── full crumble ────────────────────────────────────────────────────────
  private crumble(cells: ClearedCell[], onDone: () => void): void {
    const n = subdiv(this.tier);
    const sub = this.cell / n;
    const minCol = Math.min(...cells.map((c) => c.x));
    let remaining = cells.length;

    for (const cell of cells) {
      const { x, y } = this.gridToPixel(cell.x, cell.y);
      const left = x - this.cell / 2;
      const top = y - this.cell / 2;
      const tint = tintFor(cell.colorId, this.palette);

      const tiles: SubTile[] = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const img = this.take(left + (c + 0.5) * sub, top + (r + 0.5) * sub, sub, tint);
          tiles.push({ img, threshold: Math.random(), hidden: false });
        }
      }

      const delay = (cell.x - minCol) * STAGGER;
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: DURATION,
        delay,
        onUpdate: (tw) => {
          const p = tw.getValue() ?? 0;
          for (const t of tiles) {
            if (t.hidden) continue;
            if (t.threshold < p) {
              t.img.setVisible(false);
              t.hidden = true;
            } else if (t.threshold < p + EDGE_WIDTH) {
              t.img.setTint(EDGE_COLOR); // hot leading edge
            }
          }
        },
        onComplete: () => {
          for (const t of tiles) this.free(t.img);
          if (--remaining === 0) onDone();
        },
      });
    }
  }

  // ── cheap fallback (low tier / reduce motion) ───────────────────────────
  private scaleOut(cells: ClearedCell[], onDone: () => void): void {
    let remaining = cells.length;
    for (const cell of cells) {
      const { x, y } = this.gridToPixel(cell.x, cell.y);
      const img = this.take(x, y, this.cell, tintFor(cell.colorId, this.palette));
      this.scene.tweens.add({
        targets: img,
        scale: 0,
        alpha: 0,
        duration: 180,
        ease: "Quad.easeIn",
        onComplete: () => {
          this.free(img);
          if (--remaining === 0) onDone();
        },
      });
    }
  }
}
