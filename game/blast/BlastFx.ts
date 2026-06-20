import Phaser from "phaser";
import { tintFor } from "../render/palette";
import type { BlastCell } from "./BlastBoard";
import type { ClearStyle } from "./materials";

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
    private tex: string,
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
   * Line-clear burst, dispatched by the level's material `style` so every world
   * destructs differently. `onDone` fires after the style's duration.
   */
  clearBurst(
    cells: BlastCell[],
    cell: number,
    toPixel: (x: number, y: number) => { x: number; y: number },
    onDone: () => void,
    style: ClearStyle = "pop",
  ) {
    if (cells.length === 0) return onDone();
    if (this.reduceMotion) return this.scene.time.delayedCall(60, onDone);

    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      const p = toPixel(c.x, c.y);
      sx += p.x;
      sy += p.y;
    }
    sx /= cells.length;
    sy /= cells.length;

    let dur = 320;
    switch (style) {
      case "shatter": dur = this.fxShatter(cells, cell, toPixel); break;
      case "spark": dur = this.fxSpark(cells, cell, toPixel, sx, sy); break;
      case "crumble": dur = this.fxCrumble(cells, cell, toPixel); break;
      case "zap": dur = this.fxZap(cells, cell, toPixel); break;
      case "shimmer": dur = this.fxShimmer(cells, cell, toPixel); break;
      default: dur = this.fxPop(cells, cell, toPixel, sx, sy); break;
    }
    this.scene.time.delayedCall(dur, onDone);
  }

  /** glossy/grid — bright pop + a couple of shards + a white shockwave ring. */
  private fxPop(cells: BlastCell[], cell: number, toPixel: (x: number, y: number) => { x: number; y: number }, sx: number, sy: number): number {
    this.ring(sx, sy, cell * 0.5, 0xffffff, 3.2, 420);
    for (const c of cells) {
      const { x, y } = toPixel(c.x, c.y);
      const tint = tintFor(c.colorId, this.palette);
      const main = this.scene.add.image(x, y, this.tex).setDisplaySize(cell, cell).setDepth(50).setTint(0xffffff);
      this.scene.tweens.add({ targets: main, scale: main.scale * 1.5, alpha: 0, angle: Phaser.Math.Between(-40, 40), duration: 280, ease: "Quad.easeOut", onComplete: () => main.destroy() });
      for (let i = 0; i < 2; i++) {
        const shard = this.scene.add.image(x, y, this.tex).setDisplaySize(cell * 0.4, cell * 0.4).setDepth(49).setTint(tint);
        const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist = cell * Phaser.Math.FloatBetween(0.8, 1.8);
        this.scene.tweens.add({ targets: shard, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist + cell * 0.6, alpha: 0, scale: 0, angle: Phaser.Math.Between(-180, 180), duration: 460, ease: "Quad.easeOut", onComplete: () => shard.destroy() });
      }
    }
    return 320;
  }

  /** glass — each cell explodes into many fast angular shards + sharp flash. */
  private fxShatter(cells: BlastCell[], cell: number, toPixel: (x: number, y: number) => { x: number; y: number }): number {
    for (const c of cells) {
      const { x, y } = toPixel(c.x, c.y);
      const tint = tintFor(c.colorId, this.palette);
      const flash = this.scene.add.rectangle(x, y, cell, cell, 0xffffff, 0.9).setDepth(51);
      this.scene.tweens.add({ targets: flash, alpha: 0, duration: 90, onComplete: () => flash.destroy() });
      for (let i = 0; i < 6; i++) {
        const sz = cell * Phaser.Math.FloatBetween(0.14, 0.3);
        const shard = this.scene.add.triangle(x, y, 0, 0, sz, 0, sz / 2, sz, tint, 0.95).setDepth(50);
        const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist = cell * Phaser.Math.FloatBetween(1.0, 2.4);
        this.scene.tweens.add({ targets: shard, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist + cell, alpha: 0, angle: Phaser.Math.Between(-360, 360), duration: 420, ease: "Quad.easeIn", onComplete: () => shard.destroy() });
      }
    }
    return 360;
  }

  /** metal — white flash + many thin bright sparks shooting out fast. */
  private fxSpark(cells: BlastCell[], cell: number, toPixel: (x: number, y: number) => { x: number; y: number }, sx: number, sy: number): number {
    this.ring(sx, sy, cell * 0.4, 0xfff3c4, 2.4, 300);
    for (const c of cells) {
      const { x, y } = toPixel(c.x, c.y);
      const flash = this.scene.add.image(x, y, this.tex).setDisplaySize(cell, cell).setDepth(50).setTint(0xffffff);
      this.scene.tweens.add({ targets: flash, alpha: 0, scale: flash.scale * 0.7, duration: 160, onComplete: () => flash.destroy() });
      for (let i = 0; i < 7; i++) {
        const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const len = cell * Phaser.Math.FloatBetween(0.4, 0.9);
        const spark = this.scene.add.rectangle(x, y, len, 2, 0xffe9a8, 1).setDepth(50).setOrigin(0, 0.5).setRotation(ang);
        const dist = cell * Phaser.Math.FloatBetween(1.2, 2.2);
        this.scene.tweens.add({ targets: spark, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, alpha: 0, scaleX: 0.2, duration: 300, ease: "Quad.easeOut", onComplete: () => spark.destroy() });
      }
    }
    return 320;
  }

  /** stone — blocks crumble into chunks that fall + a dust puff. */
  private fxCrumble(cells: BlastCell[], cell: number, toPixel: (x: number, y: number) => { x: number; y: number }): number {
    for (const c of cells) {
      const { x, y } = toPixel(c.x, c.y);
      const tint = tintFor(c.colorId, this.palette);
      const dust = this.scene.add.circle(x, y, cell * 0.3, 0xbbbbbb, 0.5).setDepth(49);
      this.scene.tweens.add({ targets: dust, scale: 2.2, alpha: 0, duration: 420, onComplete: () => dust.destroy() });
      for (let i = 0; i < 4; i++) {
        const sz = cell * Phaser.Math.FloatBetween(0.2, 0.36);
        const chunk = this.scene.add.rectangle(x + Phaser.Math.Between(-8, 8), y, sz, sz, tint, 1).setDepth(50);
        this.scene.tweens.add({ targets: chunk, y: y + cell * Phaser.Math.FloatBetween(1.5, 3), x: chunk.x + Phaser.Math.Between(-14, 14), angle: Phaser.Math.Between(-90, 90), alpha: 0, duration: 520, ease: "Quad.easeIn", onComplete: () => chunk.destroy() });
      }
    }
    return 480;
  }

  /** circuit — cyan flash + jagged lightning arcs across the cleared cells. */
  private fxZap(cells: BlastCell[], cell: number, toPixel: (x: number, y: number) => { x: number; y: number }): number {
    const pts = cells.map((c) => toPixel(c.x, c.y));
    for (const p of pts) {
      const flash = this.scene.add.rectangle(p.x, p.y, cell, cell, 0x9bf6ff, 0.85).setDepth(51);
      this.scene.tweens.add({ targets: flash, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
    }
    const g = this.scene.add.graphics().setDepth(52);
    g.lineStyle(2, 0xa5f3fc, 0.95);
    for (let i = 0; i < pts.length - 1; i++) this.bolt(g, pts[i], pts[i + 1], cell * 0.3);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, ease: "Quad.easeIn", onComplete: () => g.destroy() });
    return 260;
  }

  /** weave/gem — cells dissolve into rising, twinkling sparkles. */
  private fxShimmer(cells: BlastCell[], cell: number, toPixel: (x: number, y: number) => { x: number; y: number }): number {
    for (const c of cells) {
      const { x, y } = toPixel(c.x, c.y);
      const tint = tintFor(c.colorId, this.palette);
      const glow = this.scene.add.image(x, y, this.tex).setDisplaySize(cell, cell).setDepth(49).setTint(0xffffff);
      this.scene.tweens.add({ targets: glow, alpha: 0, scale: glow.scale * 1.2, duration: 240, onComplete: () => glow.destroy() });
      for (let i = 0; i < 5; i++) {
        const dot = this.scene.add.star(x + Phaser.Math.Between(-cell / 3, cell / 3), y + Phaser.Math.Between(-cell / 3, cell / 3), 4, 1.5, cell * 0.14, i % 2 ? 0xffffff : tint, 1).setDepth(50);
        this.scene.tweens.add({ targets: dot, y: dot.y - cell * Phaser.Math.FloatBetween(0.8, 1.8), alpha: 0, angle: 180, scale: { from: 1, to: 0.2 }, duration: 620, delay: i * 30, ease: "Sine.easeOut", onComplete: () => dot.destroy() });
      }
    }
    return 560;
  }

  // ── shared primitives ──────────────────────────────────────────────────────
  private ring(x: number, y: number, r: number, color: number, scale: number, dur: number) {
    const g = this.scene.add.graphics().setDepth(48);
    g.lineStyle(6, color, 0.9);
    g.strokeCircle(x, y, r);
    this.scene.tweens.add({ targets: g, alpha: 0, scale, duration: dur, ease: "Cubic.easeOut", onComplete: () => g.destroy() });
  }

  private bolt(g: Phaser.GameObjects.Graphics, a: { x: number; y: number }, b: { x: number; y: number }, jitter: number) {
    const segs = 5;
    g.beginPath();
    g.moveTo(a.x, a.y);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      g.lineTo(a.x + (b.x - a.x) * t + Phaser.Math.FloatBetween(-jitter, jitter), a.y + (b.y - a.y) * t + Phaser.Math.FloatBetween(-jitter, jitter));
    }
    g.lineTo(b.x, b.y);
    g.strokePath();
  }

  // ── power-up flourishes ────────────────────────────────────────────────────
  /** Rotating burst of light rays + bloom flash — multiplier / big rewards. */
  rays(cx: number, cy: number, color: number, count = 14) {
    if (this.reduceMotion) return;
    const g = this.scene.add.graphics().setDepth(118).setPosition(cx, cy);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const w = 0.12;
      g.fillStyle(color, 0.35);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a - w) * 400, Math.sin(a - w) * 400);
      g.lineTo(Math.cos(a + w) * 400, Math.sin(a + w) * 400);
      g.closePath();
      g.fillPath();
    }
    g.setScale(0.1).setAlpha(0.9);
    this.scene.tweens.add({ targets: g, scale: 1, angle: 40, alpha: 0, duration: 620, ease: "Cubic.easeOut", onComplete: () => g.destroy() });
    this.ring(cx, cy, 30, color, 6, 600);
  }

  /** Ring of sparks flying outward — refresh / tray actions. */
  sparkleRing(cx: number, cy: number, color: number, radius: number) {
    if (this.reduceMotion) return;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dot = this.scene.add.circle(cx, cy, 4, i % 2 ? 0xffffff : color, 1).setDepth(115);
      this.scene.tweens.add({ targets: dot, x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, alpha: 0, scale: 0.2, duration: 480, ease: "Quad.easeOut", onComplete: () => dot.destroy() });
    }
  }

  /** Big expanding shock ring — clear-row / impact power-ups. */
  shockwave(cx: number, cy: number, color = 0xffffff) {
    if (this.reduceMotion) return;
    this.ring(cx, cy, 40, color, 9, 520);
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
      const shard = this.scene.add.image(x, -20, this.tex).setDisplaySize(18, 18).setDepth(124).setTint(tint);
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
