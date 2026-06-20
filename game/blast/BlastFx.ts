import Phaser from "phaser";
import { BLOCK_TEX } from "../render/BlockRenderer";
import { tintFor } from "../render/palette";
import type { BlastCell } from "./BlastBoard";

/**
 * Visual-effects helper for Block Drop — all the "juice": floating score/coin
 * popups, placement pops, line-clear shard bursts + shockwave rings, combo
 * banners and the level-up celebration. Pure presentation; no game state.
 *
 * Honors `reduceMotion` by degrading to minimal/instant effects.
 */
export class BlastFx {
  constructor(
    private scene: Phaser.Scene,
    private palette: number[],
    private reduceMotion: boolean,
  ) {}

  setReduceMotion(v: boolean) {
    this.reduceMotion = v;
  }

  /** Floating text that drifts up, scales in, then fades. */
  floatText(x: number, y: number, text: string, opts: { color?: string; size?: number; big?: boolean } = {}) {
    const size = opts.size ?? (opts.big ? 52 : 30);
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: "monospace",
        fontSize: `${size}px`,
        color: opts.color ?? "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(120);

    if (this.reduceMotion) {
      this.scene.tweens.add({ targets: t, alpha: 0, duration: 500, delay: 200, onComplete: () => t.destroy() });
      return;
    }
    t.setScale(0.3);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: t,
      y: y - (opts.big ? 90 : 60),
      alpha: 0,
      duration: 900,
      delay: 260,
      ease: "Quad.easeIn",
      onComplete: () => t.destroy(),
    });
  }

  /** Quick pop + ring when a piece is placed. */
  placementPop(cx: number, cy: number, cell: number, colorId: number) {
    if (this.reduceMotion) return;
    const ring = this.scene.add.graphics().setDepth(45);
    ring.lineStyle(4, tintFor(colorId, this.palette), 0.8);
    ring.strokeCircle(cx, cy, cell * 0.4);
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.8,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /**
   * Line-clear burst: each cell pops + throws a couple of shards outward, plus a
   * shockwave ring centered on the cleared region. Calls back when the longest
   * tween completes.
   */
  clearBurst(
    cells: BlastCell[],
    cell: number,
    toPixel: (x: number, y: number) => { x: number; y: number },
    onDone: () => void,
  ) {
    if (cells.length === 0) return onDone();
    if (this.reduceMotion) {
      return this.scene.time.delayedCall(60, onDone);
    }

    // shockwave ring at the centroid
    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      const p = toPixel(c.x, c.y);
      sx += p.x;
      sy += p.y;
    }
    sx /= cells.length;
    sy /= cells.length;
    const ring = this.scene.add.graphics().setDepth(48);
    ring.lineStyle(6, 0xffffff, 0.9);
    ring.strokeCircle(sx, sy, cell * 0.5);
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 3.2,
      duration: 420,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });

    let remaining = cells.length;
    const finish = () => {
      if (--remaining <= 0) onDone();
    };

    for (const c of cells) {
      const { x, y } = toPixel(c.x, c.y);
      const tint = tintFor(c.colorId, this.palette);

      // main block pops bright then shrinks away
      const main = this.scene.add.image(x, y, BLOCK_TEX).setDisplaySize(cell, cell).setDepth(50).setTint(0xffffff);
      this.scene.tweens.add({
        targets: main,
        scale: main.scale * 1.5,
        alpha: 0,
        angle: Phaser.Math.Between(-40, 40),
        duration: 280,
        ease: "Quad.easeOut",
        onComplete: () => {
          main.destroy();
          finish();
        },
      });

      // 2 shards fly outward
      for (let i = 0; i < 2; i++) {
        const shard = this.scene.add.image(x, y, BLOCK_TEX).setDisplaySize(cell * 0.4, cell * 0.4).setDepth(49).setTint(tint);
        const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist = cell * Phaser.Math.FloatBetween(0.8, 1.8);
        this.scene.tweens.add({
          targets: shard,
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist + cell * 0.6, // slight gravity
          alpha: 0,
          scale: 0,
          angle: Phaser.Math.Between(-180, 180),
          duration: 460,
          ease: "Quad.easeOut",
          onComplete: () => shard.destroy(),
        });
      }
    }
  }

  /** Big combo banner for 2+ simultaneous lines. */
  comboBanner(cx: number, cy: number, lineCount: number) {
    if (lineCount < 2) return;
    this.floatText(cx, cy, `${lineCount}× COMBO!`, { color: "#fde047", big: true });
  }

  /**
   * Level-up celebration: white flash, expanding rings, a shower of colored
   * shards from the top, and a zooming "LEVEL UP!" banner. Fires onDone roughly
   * when the banner settles.
   */
  levelUp(onDone: () => void) {
    const { width, height } = this.scene.scale.gameSize;
    const cx = width / 2;
    const cy = height / 2;

    if (this.reduceMotion) {
      const t = this.scene.add
        .text(cx, cy, "LEVEL UP!", { fontFamily: "monospace", fontSize: "60px", color: "#fde047", fontStyle: "bold" })
        .setOrigin(0.5)
        .setDepth(130);
      this.scene.time.delayedCall(900, () => {
        t.destroy();
        onDone();
      });
      return;
    }

    this.scene.cameras.main.flash(260, 255, 255, 255, false);

    // expanding rings
    for (let r = 0; r < 3; r++) {
      const ring = this.scene.add.graphics().setDepth(125);
      ring.lineStyle(8, 0xfde047, 0.9);
      ring.strokeCircle(cx, cy, 40);
      this.scene.tweens.add({
        targets: ring,
        scale: 8,
        alpha: 0,
        duration: 900,
        delay: r * 130,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy(),
      });
    }

    // shard shower from the top
    const colors = this.palette.slice(1);
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, width);
      const tint = colors[Phaser.Math.Between(0, colors.length - 1)] ?? 0xffffff;
      const shard = this.scene.add.image(x, -20, BLOCK_TEX).setDisplaySize(18, 18).setDepth(124).setTint(tint);
      this.scene.tweens.add({
        targets: shard,
        y: height + 40,
        x: x + Phaser.Math.Between(-80, 80),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(900, 1600),
        delay: Phaser.Math.Between(0, 400),
        ease: "Quad.easeIn",
        onComplete: () => shard.destroy(),
      });
    }

    // zooming banner
    const banner = this.scene.add
      .text(cx, cy, "LEVEL UP!", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#fde047",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(130)
      .setScale(0.2)
      .setAlpha(0);
    this.scene.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 320, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: banner,
      alpha: 0,
      scale: 1.4,
      duration: 400,
      delay: 760,
      ease: "Quad.easeIn",
      onComplete: () => banner.destroy(),
    });

    this.scene.time.delayedCall(900, onDone);
  }
}
