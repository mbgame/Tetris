import Phaser from "phaser";
import { Board, HIDDEN, WIDTH, VISIBLE } from "../core/Board";
import { pieceCells, type ActivePiece } from "../core/Piece";
import { tintFor } from "./palette";

const BLOCK_TEX = "block";

/**
 * Draws board cells and the active piece using ONE rounded-square texture,
 * tinted per colorId (so a single texture serves all colors). Maps grid coords
 * → pixels. Hidden buffer rows (above the visible field) are clipped off-screen.
 */
export class BlockRenderer {
  readonly cell: number;
  readonly originX: number;
  readonly originY: number;

  private boardLayer: Phaser.GameObjects.Group;
  private pieceLayer: Phaser.GameObjects.Group;
  private telegraph?: Phaser.GameObjects.Graphics;
  private telegraphTween?: Phaser.Tweens.Tween;
  private glyphsOn = false;
  private glyphMap: string[] = []; // indexed by colorId

  constructor(
    private scene: Phaser.Scene,
    private palette?: number[],
  ) {
    ensureBlockTexture(scene);

    // Fit the 10×20 field centered in the design resolution.
    const { width, height } = scene.scale.gameSize;
    this.cell = Math.floor(Math.min((width * 0.84) / WIDTH, (height * 0.84) / VISIBLE));
    this.originX = Math.floor((width - this.cell * WIDTH) / 2);
    this.originY = Math.floor((height - this.cell * VISIBLE) / 2);

    this.boardLayer = scene.add.group();
    this.pieceLayer = scene.add.group();

    this.buildWell();
  }

  /**
   * Draw the play-field "well": a recessed panel plus solid textured walls on the
   * left, right and floor so the player can see the boundary they can't move past.
   */
  private buildWell(): void {
    const cell = this.cell;
    const fieldW = cell * WIDTH;
    const fieldH = cell * VISIBLE;
    const x = this.originX;
    const y = this.originY;
    const wall = Math.max(8, Math.floor(cell * 0.45));

    const g = this.scene.add.graphics().setDepth(-5);

    // recessed play area so the field reads as distinct from the background
    g.fillStyle(0x000000, 0.4);
    g.fillRect(x, y, fieldW, fieldH);

    // helper: one textured wall bar (bevel + brick notches)
    const drawWall = (wx: number, wy: number, ww: number, wh: number, vertical: boolean) => {
      g.fillStyle(0x2b303b, 1);
      g.fillRect(wx, wy, ww, wh);
      // top/left highlight, bottom/right shadow
      g.fillStyle(0xffffff, 0.12);
      g.fillRect(wx, wy, vertical ? ww : ww, vertical ? 3 : 3);
      g.fillStyle(0x000000, 0.35);
      g.fillRect(wx, wy + wh - 3, ww, 3);
      // notches every cell so it reads as stacked blocks / brick
      g.fillStyle(0x000000, 0.25);
      if (vertical) {
        for (let i = 1; i * cell < wh; i++) g.fillRect(wx, wy + i * cell - 1, ww, 2);
      } else {
        for (let i = 1; i * cell < ww; i++) g.fillRect(wx + i * cell - 1, wy, 2, wh);
      }
    };

    drawWall(x - wall, y, wall, fieldH + wall, true); // left wall
    drawWall(x + fieldW, y, wall, fieldH + wall, true); // right wall
    drawWall(x - wall, y + fieldH, fieldW + wall * 2, wall, false); // floor

    // thin inner edge highlight around the opening
    g.lineStyle(2, 0x4fd1c5, 0.35);
    g.strokeRect(x, y, fieldW, fieldH);
  }

  gridToPixel(col: number, row: number): { x: number; y: number } {
    return {
      x: this.originX + col * this.cell + this.cell / 2,
      y: this.originY + (row - HIDDEN) * this.cell + this.cell / 2,
    };
  }

  private placeInto(group: Phaser.GameObjects.Group, col: number, row: number, colorId: number, alpha = 1) {
    if (row < HIDDEN) return; // clip hidden buffer
    const { x, y } = this.gridToPixel(col, row);
    const img = group.create(x, y, BLOCK_TEX) as Phaser.GameObjects.Image;
    img.setDisplaySize(this.cell, this.cell);
    img.setTint(tintFor(colorId, this.palette));
    img.setAlpha(alpha);
    const glyph = this.glyphsOn ? this.glyphMap[colorId] : undefined;
    if (glyph) {
      const txt = this.scene.add
        .text(x, y, glyph, { fontFamily: "monospace", fontSize: `${Math.floor(this.cell * 0.45)}px`, color: "#000000" })
        .setOrigin(0.5)
        .setAlpha(0.55 * alpha);
      group.add(txt);
    }
  }

  /** Toggle the colorblind glyph overlay + supply the colorId→glyph map. */
  setGlyphs(on: boolean, map: string[]): void {
    this.glyphsOn = on;
    this.glyphMap = map;
  }

  /** Redraw all locked cells. */
  renderBoard(board: Board): void {
    this.boardLayer.clear(true, true);
    board.forEachCell((x, y, colorId) => this.placeInto(this.boardLayer, x, y, colorId));
  }

  /** Redraw the active falling piece. */
  renderPiece(piece: ActivePiece): void {
    this.pieceLayer.clear(true, true);
    for (const c of pieceCells(piece)) {
      this.placeInto(this.pieceLayer, c.x, c.y, piece.colorId);
    }
  }

  /** Clear the static board layer (used while a clear animation owns the visuals). */
  clearBoard(): void {
    this.boardLayer.clear(true, true);
  }

  /** Clear the active-piece layer. */
  clearPiece(): void {
    this.pieceLayer.clear(true, true);
  }

  /** Pulse a glow on rows one block from a mono clear (telegraph). */
  renderTelegraph(rows: number[]): void {
    if (!this.telegraph) {
      this.telegraph = this.scene.add.graphics().setDepth(20);
    }
    const g = this.telegraph;
    g.clear();
    if (rows.length === 0) {
      this.telegraphTween?.stop();
      this.telegraphTween = undefined;
      g.setAlpha(1);
      return;
    }
    g.lineStyle(3, 0xffffff, 0.9);
    for (const y of rows) {
      if (y < HIDDEN) continue;
      const { x: px, y: py } = this.gridToPixel(0, y);
      g.strokeRoundedRect(px - this.cell / 2 + 1, py - this.cell / 2 + 1, this.cell * WIDTH - 2, this.cell - 2, 6);
    }
    if (!this.telegraphTween) {
      this.telegraphTween = this.scene.tweens.add({
        targets: g,
        alpha: { from: 0.25, to: 0.85 },
        duration: 450,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /** Create/recycle a tinted block image at a grid cell (release it when done). */
  makeBlock(col: number, row: number, colorId: number, alpha = 1): Phaser.GameObjects.Image {
    const { x, y } = this.gridToPixel(col, row);
    const img = this.obtainBlock();
    img.setPosition(x, y);
    img.setDisplaySize(this.cell, this.cell);
    img.setTint(tintFor(colorId, this.palette));
    img.setAlpha(alpha);
    return img;
  }

  // ── transient block pool (Phase 9.3) — avoids per-clear GC churn ──────────
  private pool: Phaser.GameObjects.Image[] = [];

  /** Get a reusable block image (already visible/active, scale & alpha reset). */
  obtainBlock(): Phaser.GameObjects.Image {
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, BLOCK_TEX);
    img.setActive(true).setVisible(true).setAlpha(1).setScale(1).setAngle(0).clearTint();
    return img;
  }

  /** Return a block image to the pool instead of destroying it. */
  releaseBlock(img: Phaser.GameObjects.Image): void {
    img.setVisible(false).setActive(false);
    this.pool.push(img);
  }
}

/**
 * Generate the shared rounded-square block texture (grayscale so runtime tint
 * preserves hue). A vertical gradient + bevel highlight/shadow make tinted
 * blocks read as dimensional rather than flat (docs/03 §5).
 */
export function ensureBlockTexture(scene: Phaser.Scene, size = 64): void {
  if (scene.textures.exists(BLOCK_TEX)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = Math.floor(size * 0.18);
  const p = 2;
  // solid body (gradient fills are unreliable on Phaser Graphics rounded rects)
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(p, p, size - 2 * p, size - 2 * p, r);
  // fake top→bottom shading: translucent dark band over the lower half
  g.fillStyle(0x000000, 0.18);
  g.fillRoundedRect(p, size * 0.5, size - 2 * p, size * 0.5 - p, r);
  // top highlight bevel
  g.fillStyle(0xffffff, 0.5);
  g.fillRoundedRect(p + 2, p + 2, size - 2 * p - 4, size * 0.16, r * 0.6);
  // bottom-right shadow bevel
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(p + 2, size - p - size * 0.12, size - 2 * p - 4, size * 0.1, r * 0.5);
  g.generateTexture(BLOCK_TEX, size, size);
  g.destroy();
}

export { BLOCK_TEX };
