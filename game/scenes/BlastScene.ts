import Phaser from "phaser";
import { BlastBoard, type BlastCell } from "../blast/BlastBoard";
import { randomPiece, rotateShape, type PieceShape } from "../blast/pieces";
import { BLAST_LEVEL_COUNT, getBlastLevel, type BlastLevelConfig } from "../blast/levels";
import { placementScore, clearScore } from "../blast/scoring";
import { BlastFx } from "../blast/BlastFx";
import { ensureMaterials, materialForLevel, fxForLevel, type ClearStyle } from "../blast/materials";
import { POWERUP_COST, MULT_DURATION, MULT_MAX, type PowerupKind } from "../blast/powerups";
import { paletteFromColors, tintFor } from "../render/palette";
import { ensureBlockTexture } from "../render/BlockRenderer";
import { GameState } from "../core/GameState";
import { createRng } from "../core/rng";
import { bus } from "../state/events";
import { EventName } from "../state/EventNames";

const TRAY_SLOTS = 3;
const TRAY_SCALE_MAX = 0.7; // cap on parked piece size (small pieces don't blow up)
const RIGHT_RESERVE = 0.14; // fraction of width kept clear for the DOM power-up rail
const IDLE_HINT_MS = 5000; // idle time before a best-move hint appears

interface TrayPiece {
  container: Phaser.GameObjects.Container;
  shape: PieceShape;
  colorId: number;
  slot: number;
  homeX: number;
  homeY: number;
  /** parked display scale (per-piece so big/small pieces fill the slot evenly) */
  trayScale: number;
  /** world-space grab rectangle (the whole slot box) for manual hit-testing */
  grabRect: Phaser.Geom.Rectangle;
}

/**
 * "Block Drop" mode — a drag-and-drop block-blast puzzle. The player drags one
 * of three tray pieces onto an 8×8 board; full rows AND columns clear (colors
 * only affect score). Levels are cleared by reaching a point target. Clears earn
 * coins, spent on power-ups (refresh / hammer / recolor / clear-row / multiplier).
 *
 * Mirrors GameScene's event-bus contract so the React HUD + menu cards work.
 * Dormant unless started with mode === "blast"; ignores intents otherwise.
 */
export class BlastScene extends Phaser.Scene {
  private board!: BlastBoard;
  private fsm!: GameState;
  private level!: BlastLevelConfig;
  private palette!: number[];
  private rng: () => number = Math.random;
  private fx!: BlastFx;
  private matKeys: string[] = [];
  private blockTex = "blast-mat-0"; // per-level block material texture
  private clearStyle: ClearStyle = "pop"; // per-level clear animation
  private clearSfx = "chime"; // per-level clear sound variant

  private cell = 48;
  private originX = 0;
  private originY = 0;

  private boardLayer!: Phaser.GameObjects.Group;
  private gridGfx?: Phaser.GameObjects.Graphics;
  private ghostGfx?: Phaser.GameObjects.Graphics;
  private overlay?: Phaser.GameObjects.Text;

  private tray: (TrayPiece | null)[] = [];
  private dragging?: TrayPiece;
  private dragPointer?: Phaser.Input.Pointer; // the specific pointer holding the drag
  private dragTarget?: { col: number; row: number; valid: boolean };

  private score = 0;
  private coins = 0;
  private scoreMult = 1;
  private multMoves = 0;
  private hammerArmed = false;
  private rotateArmed = false;

  // idle-hint state
  private lastActivity = 0;
  private hintActive = false;
  private hintGfx?: Phaser.GameObjects.Graphics;
  private hintTween?: Phaser.Tweens.Tween;
  private hintPiece?: TrayPiece;
  private stuckText?: Phaser.GameObjects.Text; // "no moves — use a power-up" nudge

  private active = false; // owns the session (drives bus emissions)
  private running = false; // drag input enabled
  private clearing = false;
  private reduceMotion = false;

  constructor() {
    super("BlastScene");
  }

  create() {
    ensureBlockTexture(this); // shared rounded-block texture (used by FX shards fallback)
    this.matKeys = ensureMaterials(this); // per-level block materials
    this.input.addPointer(2); // ensure touch pointers exist alongside the mouse pointer
    this.fsm = new GameState("BOOT");
    this.bindIntents();
    this.bindDrag();
  }

  // ── React → game intents ─────────────────────────────────────────────────
  private bindIntents() {
    bus.on(EventName.RequestStartLevel, this.onStartLevel);
    bus.on(EventName.RequestPause, this.pauseGame);
    bus.on(EventName.RequestResume, this.resumeGame);
    bus.on(EventName.RequestRestart, this.onRestart);
    bus.on(EventName.RequestQuit, this.toMenu);
    bus.on(EventName.RequestPowerup, this.onPowerup);
    bus.on(EventName.SettingsChange, this.applySettings);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EventName.RequestStartLevel, this.onStartLevel);
      bus.off(EventName.RequestPause, this.pauseGame);
      bus.off(EventName.RequestResume, this.resumeGame);
      bus.off(EventName.RequestRestart, this.onRestart);
      bus.off(EventName.RequestQuit, this.toMenu);
      bus.off(EventName.RequestPowerup, this.onPowerup);
      bus.off(EventName.SettingsChange, this.applySettings);
    });
  }

  private onStartLevel = (p: { level: number; mode?: string }) => {
    if (p.mode !== "blast") return; // classic handled by GameScene
    this.active = true;
    this.score = 0;
    this.coins = 0; // fresh wallet for a new game
    this.loadLevel(p.level);
  };

  private onRestart = () => {
    if (!this.active) return;
    this.score = 0;
    this.coins = 0;
    this.loadLevel(this.level.id);
  };

  private toMenu = () => {
    if (!this.active) return;
    this.active = false;
    this.running = false;
    this.clearing = false;
    this.children.removeAll(true);
    this.tray = [];
    if (!this.fsm.is("MENU")) this.fsm.transition("MENU");
  };

  private pauseGame = () => {
    if (!this.active || !this.fsm.is("PLAYING")) return;
    this.running = false;
    this.fsm.transition("PAUSED");
    bus.emit(EventName.StateChange, { state: "PAUSED" });
  };

  private resumeGame = () => {
    if (!this.active || !this.fsm.is("PAUSED")) return;
    this.fsm.transition("PLAYING");
    this.running = true;
    bus.emit(EventName.StateChange, { state: "PLAYING" });
  };

  private applySettings = (s: Record<string, unknown>) => {
    const g = s.graphics as { reduceMotion?: boolean } | undefined;
    if (g?.reduceMotion != null) {
      this.reduceMotion = g.reduceMotion;
      this.fx?.setReduceMotion(g.reduceMotion);
    }
  };

  // ── level lifecycle ──────────────────────────────────────────────────────
  private loadLevel(id: number) {
    this.level = getBlastLevel(id);
    this.palette = paletteFromColors(this.level.colors);
    this.rng = createRng((Date.now() ^ (id * 2654435761)) >>> 0);
    this.running = false;
    this.clearing = false;
    this.scoreMult = 1;
    this.multMoves = 0;
    this.hammerArmed = false;
    this.rotateArmed = false;
    this.blockTex = materialForLevel(this.matKeys, id);
    const mfx = fxForLevel(id);
    this.clearStyle = mfx.style;
    this.clearSfx = mfx.sfx;

    bus.emit(EventName.LevelChange, {
      level: this.level.id,
      name: this.level.name,
      theme: this.level.scene,
      bgDim: this.level.bgDim,
    });

    this.board = new BlastBoard();
    this.children.removeAll(true);
    this.tray = [];
    this.dragging = undefined;
    this.dragPointer = undefined;
    this.dragTarget = undefined;
    this.gridGfx = undefined;
    this.ghostGfx = undefined;
    this.hintGfx = undefined;
    this.hintTween = undefined;
    this.hintPiece = undefined;
    this.hintActive = false;
    this.stuckText = undefined;
    this.fx = new BlastFx(this, this.palette, this.reduceMotion, this.blockTex);

    this.fsm = new GameState("MENU");
    this.fsm.transition("COUNTDOWN");
    bus.emit(EventName.StateChange, { state: "COUNTDOWN" });

    this.computeLayout();
    this.boardLayer = this.add.group();
    this.drawGrid();
    this.applyNoise();
    this.renderBoard();
    this.refillTray();

    this.emitScore();
    this.emitCoins();
    this.emitPowerup();
    this.startBanner();
  }

  /**
   * Fit the square board in the upper-left area; tray below it. The right strip
   * (RIGHT_RESERVE of width) is left clear for the DOM power-up rail.
   */
  private computeLayout() {
    const { width, height } = this.scale.gameSize;
    const size = this.board.size;
    const topPad = height * 0.1; // HUD top bar
    const trayBand = height * 0.16; // draggable tray pieces
    const availH = height - topPad - trayBand;
    const playW = width * (1 - RIGHT_RESERVE);
    const maxW = playW * 0.99;
    this.cell = Math.floor(Math.min(maxW / size, availH / size));
    const boardPx = this.cell * size;
    this.originX = Math.floor((playW - boardPx) / 2);
    this.originY = Math.floor(topPad + (availH - boardPx) / 2);
  }

  private drawGrid() {
    const size = this.board.size;
    const boardPx = this.cell * size;
    const g = this.add.graphics().setDepth(-2);
    // soft outer glow so the board reads as lit, not a dark hole
    g.fillStyle(0xffffff, 0.06);
    g.fillRoundedRect(this.originX - 16, this.originY - 16, boardPx + 32, boardPx + 32, 18);
    // frosted light panel (was a dark recess) — keeps blocks readable while bright
    g.fillStyle(0xffffff, 0.1);
    g.fillRoundedRect(this.originX - 6, this.originY - 6, boardPx + 12, boardPx + 12, 12);
    g.fillStyle(0x1a2433, 0.32);
    g.fillRoundedRect(this.originX, this.originY, boardPx, boardPx, 8);
    // cell grid
    g.lineStyle(1, 0xffffff, 0.1);
    for (let i = 0; i <= size; i++) {
      const p = i * this.cell;
      g.lineBetween(this.originX, this.originY + p, this.originX + boardPx, this.originY + p);
      g.lineBetween(this.originX + p, this.originY, this.originX + p, this.originY + boardPx);
    }
    g.lineStyle(2, 0x7fe9df, 0.5);
    g.strokeRoundedRect(this.originX, this.originY, boardPx, boardPx, 8);
    this.gridGfx = g;
  }

  /** Scatter random pre-placed noise cells (more on harder levels). */
  private applyNoise() {
    const size = this.board.size;
    const n = this.level.colors.length;
    let placed = 0;
    let guard = 0;
    while (placed < this.level.noiseCells && guard++ < 500) {
      const x = Math.floor(this.rng() * size);
      const y = Math.floor(this.rng() * size);
      if (this.board.get(x, y) !== 0) continue;
      this.board.set(x, y, 1 + Math.floor(this.rng() * n));
      placed++;
    }
    // never start with an already-complete line
    const { rows, cols } = this.board.getFullLines();
    if (rows.length || cols.length) this.board.clearLines(rows, cols);
  }

  // ── board rendering ──────────────────────────────────────────────────────
  private cellCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.originX + col * this.cell + this.cell / 2,
      y: this.originY + row * this.cell + this.cell / 2,
    };
  }

  private renderBoard() {
    this.boardLayer.clear(true, true);
    this.board.forEachCell((x, y, colorId) => {
      const { x: px, y: py } = this.cellCenter(x, y);
      const img = this.boardLayer.create(px, py, this.blockTex) as Phaser.GameObjects.Image;
      img.setDisplaySize(this.cell, this.cell);
      img.setTint(tintFor(colorId, this.palette));
    });
  }

  // ── tray + pieces ────────────────────────────────────────────────────────
  private refillTray() {
    for (let i = 0; i < TRAY_SLOTS; i++) this.tray[i] = this.makeTrayPiece(i);
    this.running = this.fsm.is("PLAYING");
    this.checkGameOver();
  }

  /** Discard whatever is in the tray and deal a fresh set (refresh power-up). */
  private discardTray() {
    for (const t of this.tray) t?.container.destroy();
    this.tray = [];
  }

  private makeTrayPiece(slot: number, override?: { shape: PieceShape; colorId: number }): TrayPiece {
    const shape = override?.shape ?? randomPiece(this.rng, this.level.difficulty);
    const colorId = override?.colorId ?? 1 + Math.floor(this.rng() * this.level.colors.length);
    const { width, height } = this.scale.gameSize;
    const cell = this.cell;
    // tray spans the same left play area as the board (right strip is the rail)
    const playW = width * (1 - RIGHT_RESERVE);
    const slotW = playW / TRAY_SLOTS;
    const slotCx = slotW * (slot + 0.5);

    const trayTop = this.originY + cell * this.board.size;
    const trayH = height - trayTop - height * 0.03;
    const slotCy = trayTop + trayH / 2;
    const slotBoxW = slotW * 0.82;
    const slotBoxH = trayH * 0.6;

    const container = this.add.container(0, 0).setDepth(40);
    for (const c of shape.cells) {
      const img = this.add.image(c.x * cell, c.y * cell, this.blockTex);
      img.setDisplaySize(cell, cell);
      img.setTint(tintFor(colorId, this.palette));
      container.add(img);
    }

    // per-piece parked scale: shrink big pieces to fit, but never blow tiny ones up
    const pieceW = shape.w * cell;
    const pieceH = shape.h * cell;
    const trayScale = Math.min(slotBoxW / pieceW, slotBoxH / pieceH, TRAY_SCALE_MAX);

    // Grab zone = the whole slot box (world space). We hit-test this manually on
    // pointerdown (see bindDrag) instead of relying on Phaser's draggable, whose
    // hover state only updates on pointer MOVE — that caused "press does nothing
    // until you jiggle the mouse".
    const grabRect = new Phaser.Geom.Rectangle(
      slotCx - slotBoxW / 2,
      slotCy - slotBoxH / 2,
      slotBoxW,
      slotBoxH,
    );

    const piece: TrayPiece = { container, shape, colorId, slot, homeX: 0, homeY: 0, trayScale, grabRect };
    this.parkPiece(piece, slotCx, slotCy);
    return piece;
  }

  /** Center a parked piece's bbox at (cx, cy) using its tray scale; remember home. */
  private parkPiece(piece: TrayPiece, cx: number, cy: number) {
    const bboxCx = ((piece.shape.w - 1) / 2) * this.cell;
    const bboxCy = ((piece.shape.h - 1) / 2) * this.cell;
    piece.homeX = cx - bboxCx * piece.trayScale;
    piece.homeY = cy - bboxCy * piece.trayScale;
    piece.container.setScale(piece.trayScale);
    piece.container.setPosition(piece.homeX, piece.homeY);
  }

  private bindDrag() {
    // Manual drag: hit-test slot rects on pointerdown so a grab registers on the
    // very first press, with no pointer-move priming required.
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.running || this.clearing) return;
      this.markActivity();
      if (this.hammerArmed) {
        this.useHammer(pointer);
        return;
      }
      if (this.rotateArmed) {
        this.useRotate(pointer);
        return;
      }
      if (this.dragging) return;
      const piece = this.tray.find(
        (t): t is TrayPiece => t !== null && Phaser.Geom.Rectangle.Contains(t.grabRect, pointer.x, pointer.y),
      );
      if (!piece) return;
      this.dragging = piece;
      this.dragPointer = pointer; // bind this exact pointer (touch id) to the drag
      piece.container.setScale(1).setDepth(60);
      this.moveDragged(pointer);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.markActivity(); // any movement counts as activity (dismisses idle hint)
      if (this.dragging && pointer.id === this.dragPointer?.id) this.moveDragged(pointer);
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.markActivity();
      if (this.dragging && pointer.id === this.dragPointer?.id) this.dropDragged();
    });
  }

  /** Position the dragged piece above the pointer + refresh the ghost preview. */
  private moveDragged(pointer: Phaser.Input.Pointer) {
    const piece = this.dragging;
    if (!piece) return;
    const halfW = ((piece.shape.w - 1) * this.cell) / 2;
    piece.container.x = pointer.x - halfW;
    piece.container.y = pointer.y - this.cell * 1.4;
    this.updateGhost(piece);
  }

  /** Resolve the in-progress drag: place if valid, else snap back to the tray. */
  private dropDragged() {
    const piece = this.dragging;
    if (!piece) return;
    this.dragging = undefined;
    this.dragPointer = undefined;
    this.ghostGfx?.clear();
    const t = this.dragTarget;
    this.dragTarget = undefined;
    if (t && t.valid) this.commitPlacement(piece, t.col, t.row);
    else this.snapBack(piece);
  }

  /** Safety net for off-canvas release + idle-hint trigger. */
  update() {
    // Drop if the specific pointer holding the drag was released (e.g. off-canvas).
    // Must check that pointer — on touch, input.activePointer may be the idle mouse
    // pointer (isDown=false), which previously dropped grabs instantly.
    if (this.dragging && this.dragPointer && !this.dragPointer.isDown) this.dropDragged();

    // idle hint: after 5s of no activity while it's the player's turn, suggest a move
    if (
      this.running &&
      !this.clearing &&
      !this.dragging &&
      !this.hintActive &&
      this.fsm.is("PLAYING") &&
      this.time.now - this.lastActivity > IDLE_HINT_MS
    ) {
      this.showHint();
    }
  }

  /** Reset the idle timer + dismiss any visible hint (the player is acting). */
  private markActivity() {
    this.lastActivity = this.time.now;
    if (this.hintActive) this.clearHint();
  }

  private targetOrigin(piece: TrayPiece): { col: number; row: number } {
    return {
      col: Math.round((piece.container.x - this.originX - this.cell / 2) / this.cell),
      row: Math.round((piece.container.y - this.originY - this.cell / 2) / this.cell),
    };
  }

  /** Pixel → board cell (or null if outside the board). */
  private pixelToCell(px: number, py: number): { col: number; row: number } | null {
    const col = Math.floor((px - this.originX) / this.cell);
    const row = Math.floor((py - this.originY) / this.cell);
    if (col < 0 || col >= this.board.size || row < 0 || row >= this.board.size) return null;
    return { col, row };
  }

  private updateGhost(piece: TrayPiece) {
    if (!this.ghostGfx) this.ghostGfx = this.add.graphics().setDepth(30);
    const g = this.ghostGfx;
    g.clear();
    const { col, row } = this.targetOrigin(piece);
    const valid = this.board.canPlace(piece.shape.cells, col, row);
    this.dragTarget = { col, row, valid };
    const color = valid ? 0x4ade80 : 0xf87171;
    g.fillStyle(color, 0.45);
    g.lineStyle(2, color, 0.9);
    for (const c of piece.shape.cells) {
      const x = col + c.x;
      const y = row + c.y;
      if (x < 0 || x >= this.board.size || y < 0 || y >= this.board.size) continue;
      const px = this.originX + x * this.cell;
      const py = this.originY + y * this.cell;
      g.fillRoundedRect(px + 2, py + 2, this.cell - 4, this.cell - 4, 6);
      g.strokeRoundedRect(px + 2, py + 2, this.cell - 4, this.cell - 4, 6);
    }
  }

  private snapBack(piece: TrayPiece) {
    piece.container.setDepth(40);
    this.tweens.add({
      targets: piece.container,
      x: piece.homeX,
      y: piece.homeY,
      scale: piece.trayScale,
      duration: 160,
      ease: "Back.easeOut",
    });
  }

  // ── placement → clears → scoring ─────────────────────────────────────────
  private commitPlacement(piece: TrayPiece, col: number, row: number) {
    this.markActivity();
    this.board.place(piece.shape.cells, col, row, piece.colorId);
    this.tray[piece.slot] = null;
    piece.container.destroy();
    bus.emit(EventName.Sfx, { name: "lock" });

    // placement points (×multiplier), popped at the piece's centroid
    const gained = placementScore(piece.shape.cells.length) * this.scoreMult;
    this.score += gained;
    const cx = this.originX + (col + (piece.shape.w - 1) / 2) * this.cell + this.cell / 2;
    const cy = this.originY + (row + (piece.shape.h - 1) / 2) * this.cell + this.cell / 2;
    this.fx.floatText(cx, cy, `+${gained}`, { color: "#ffffff" });
    this.fx.placementPop(cx, cy, this.cell, piece.colorId);
    this.consumeMult();

    this.renderBoard();

    const { rows, cols } = this.board.getFullLines();
    if (rows.length || cols.length) {
      this.resolveClears(rows, cols);
    } else {
      this.afterPlacement();
    }
  }

  private resolveClears(rows: number[], cols: number[]) {
    this.clearing = true;
    this.running = false;
    this.fsm.transition("LINE_CLEAR");
    bus.emit(EventName.StateChange, { state: "LINE_CLEAR" });

    // count mono lines before wiping the cells
    let mono = 0;
    for (const y of rows) {
      const cells: BlastCell[] = [];
      for (let x = 0; x < this.board.size; x++) cells.push({ x, y, colorId: this.board.get(x, y) });
      if (this.board.lineIsMono(cells)) mono++;
    }
    for (const x of cols) {
      const cells: BlastCell[] = [];
      for (let y = 0; y < this.board.size; y++) cells.push({ x, y, colorId: this.board.get(x, y) });
      if (this.board.lineIsMono(cells)) mono++;
    }
    const lineCount = rows.length + cols.length;
    const cleared = this.board.clearLines(rows, cols);

    const gained = clearScore(lineCount, mono) * this.scoreMult;
    this.score += gained;
    this.consumeMult();

    // coins: 1 per line + 1 per mono line
    const earned = lineCount + mono;
    this.coins += earned;
    this.emitCoins();

    bus.emit(EventName.ComboUpdate, { combo: lineCount - 1, b2b: 0 });
    // single clear sound (AudioManager.onClear plays it) with the material variant
    bus.emit(EventName.LinesCleared, {
      rows,
      colors: cleared.map((c) => c.colorId),
      count: lineCount,
      variant: this.clearSfx,
    });

    // centroid for the popups
    let px = 0;
    let py = 0;
    for (const c of cleared) {
      const p = this.cellCenter(c.x, c.y);
      px += p.x;
      py += p.y;
    }
    px /= cleared.length || 1;
    py /= cleared.length || 1;
    this.fx.floatText(px, py - 30, `+${gained}`, { color: "#fde047", big: true });
    this.fx.floatText(px, py + 24, `+${earned} 🪙`, { color: "#fbbf24" });
    this.fx.comboBanner(this.scale.width / 2, this.scale.height * 0.32, lineCount);

    if (!this.reduceMotion) {
      if (lineCount >= 2) this.cameras.main.flash(120, 255, 255, 255, false);
      this.cameras.main.shake(60 + lineCount * 18, 0.004 * lineCount);
    }

    this.fx.clearBurst(cleared, this.cell, (x, y) => this.cellCenter(x, y), () => {
      this.renderBoard();
      this.clearing = false;
      this.afterPlacement();
    }, this.clearStyle);
  }

  private afterPlacement() {
    this.emitScore();

    if (this.score >= this.level.targetPoints) {
      this.levelComplete();
      return;
    }

    if (this.fsm.is("LINE_CLEAR")) {
      this.fsm.transition("PLAYING");
      bus.emit(EventName.StateChange, { state: "PLAYING" });
    }
    this.running = true;

    if (this.tray.every((t) => t === null)) this.refillTray();
    else this.checkGameOver();
  }

  private checkGameOver() {
    if (!this.fsm.is("PLAYING")) return; // only meaningful once play has begun
    const remaining = this.tray.filter((t): t is TrayPiece => t !== null);
    if (remaining.length === 0) return;
    const anyFits = remaining.some((p) => this.board.fitsAnywhere(p.shape.cells));
    if (anyFits) {
      this.clearStuck();
      return;
    }
    // Nothing fits — only a loss if no affordable power-up can rescue the board.
    if (this.canRescue()) {
      this.promptStuck();
      return;
    }
    this.clearStuck();
    this.gameOver();
  }

  /** Could an affordable power-up plausibly open up a move? */
  private canRescue(): boolean {
    const hasEmpty = this.board.countFilled() < this.board.size * this.board.size;
    // hammer / clear-row free board space (work even on a full board); refresh /
    // rotate only help when there's somewhere for a new/rotated piece to land.
    if (this.coins >= POWERUP_COST.hammer) return true;
    if (this.coins >= POWERUP_COST.bomb) return true;
    if (hasEmpty && this.coins >= POWERUP_COST.refresh) return true;
    if (hasEmpty && this.coins >= POWERUP_COST.rotate) return true;
    return false;
  }

  /** Persistent nudge while stuck-but-rescuable: spend a power-up to continue. */
  private promptStuck() {
    if (this.stuckText) return;
    bus.emit(EventName.Sfx, { name: "telegraph" });
    const cx = this.originX + (this.board.size * this.cell) / 2;
    const cy = this.originY + (this.board.size * this.cell) / 2;
    this.stuckText = this.add
      .text(cx, cy, "No moves left!\nUse a power-up 👉", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#fca5a5",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 5,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(110);
    this.tweens.add({ targets: this.stuckText, alpha: { from: 0.55, to: 1 }, duration: 500, yoyo: true, repeat: -1 });
  }

  private clearStuck() {
    if (this.stuckText) {
      this.tweens.killTweensOf(this.stuckText);
      this.stuckText.destroy();
      this.stuckText = undefined;
    }
  }

  // ── power-ups ─────────────────────────────────────────────────────────────
  private onPowerup = (p: { kind: PowerupKind }) => {
    if (!this.active || !this.running || this.clearing) return;
    const cost = POWERUP_COST[p.kind];
    if (this.coins < cost) return;
    this.markActivity();

    // hammer + rotate just arm; everything else acts immediately
    if (p.kind === "hammer") {
      this.coins -= cost;
      this.hammerArmed = true;
      this.rotateArmed = false;
      this.emitCoins();
      this.emitPowerup();
      this.fx.floatText(this.scale.width / 2, this.scale.height * 0.33, "🔨 Tap a block", { color: "#fca5a5" });
      bus.emit(EventName.Sfx, { name: "ui" });
      return;
    }
    if (p.kind === "rotate") {
      this.coins -= cost;
      this.rotateArmed = true;
      this.hammerArmed = false;
      this.emitCoins();
      this.emitPowerup();
      this.fx.floatText(this.scale.width / 2, this.scale.height * 0.33, "🔃 Tap a tray piece", { color: "#7dd3fc" });
      bus.emit(EventName.Sfx, { name: "ui" });
      return;
    }

    this.coins -= cost;
    this.emitCoins();
    bus.emit(EventName.Sfx, { name: "ui" });

    const trayY = this.originY + this.board.size * this.cell + (this.scale.height - (this.originY + this.board.size * this.cell)) * 0.4;
    switch (p.kind) {
      case "refresh":
        this.discardTray();
        this.refillTray();
        this.fx.sparkleRing(this.scale.width * (1 - 0.2) * 0.5, trayY, 0x7dd3fc, this.cell * 1.6);
        break;
      case "bomb":
        this.clearBottomRow();
        break;
      case "mult":
        this.scoreMult = this.scoreMult < 2 ? 2 : Math.min(MULT_MAX, this.scoreMult + 1);
        this.multMoves = MULT_DURATION;
        this.emitPowerup();
        this.fx.rays(this.scale.width / 2, this.scale.height * 0.4, 0xa78bfa);
        this.fx.floatText(this.scale.width / 2, this.scale.height * 0.33, `${this.scoreMult}× POINTS!`, {
          color: "#a78bfa",
          big: true,
        });
        break;
    }
  };

  /** Smash a single board block at the pointer (hammer). Empty tap cancels arm. */
  private useHammer(pointer: Phaser.Input.Pointer) {
    const cell = this.pixelToCell(pointer.x, pointer.y);
    this.hammerArmed = false;
    this.emitPowerup();
    if (!cell) return;
    const colorId = this.board.get(cell.col, cell.row);
    if (colorId === 0) return; // tapped empty → just cancel
    this.board.removeCells([{ x: cell.col, y: cell.row }]);
    const { x, y } = this.cellCenter(cell.col, cell.row);
    this.fx.clearBurst([{ x: cell.col, y: cell.row, colorId }], this.cell, (cx, cy) => this.cellCenter(cx, cy), () => {}, this.clearStyle);
    this.fx.placementPop(x, y, this.cell, colorId);
    bus.emit(EventName.Sfx, { name: "clear", intensity: 1, variant: this.clearSfx });
    this.renderBoard();
    this.checkGameOver();
  }

  /** Rotate the tapped tray piece 90° (rotate power-up). Empty tap cancels arm. */
  private useRotate(pointer: Phaser.Input.Pointer) {
    const piece = this.tray.find(
      (t): t is TrayPiece => t !== null && Phaser.Geom.Rectangle.Contains(t.grabRect, pointer.x, pointer.y),
    );
    this.rotateArmed = false;
    this.emitPowerup();
    if (!piece) return; // tapped outside a tray slot → just cancel
    const rotated = rotateShape(piece.shape);
    const slot = piece.slot;
    piece.container.destroy();
    this.tray[slot] = this.makeTrayPiece(slot, { shape: rotated, colorId: piece.colorId });
    const fresh = this.tray[slot]!;
    this.tweens.add({ targets: fresh.container, angle: { from: -90, to: 0 }, duration: 200, ease: "Back.easeOut" });
    bus.emit(EventName.Sfx, { name: "rotate" });
    this.checkGameOver();
  }

  /** Delete the bottom-most filled row (clear-row power-up). */
  private clearBottomRow() {
    let target = -1;
    for (let y = this.board.size - 1; y >= 0; y--) {
      let any = false;
      for (let x = 0; x < this.board.size; x++) if (this.board.get(x, y) !== 0) { any = true; break; }
      if (any) { target = y; break; }
    }
    if (target < 0) return;
    const cells: BlastCell[] = [];
    for (let x = 0; x < this.board.size; x++) {
      const colorId = this.board.get(x, target);
      if (colorId !== 0) cells.push({ x, y: target, colorId });
    }
    this.board.removeCells(cells.map((c) => ({ x: c.x, y: c.y })));
    if (!this.reduceMotion) this.cameras.main.shake(120, 0.005);
    this.fx.clearBurst(cells, this.cell, (cx, cy) => this.cellCenter(cx, cy), () => {}, this.clearStyle);
    const bx = this.originX + (this.board.size * this.cell) / 2;
    this.fx.shockwave(bx, this.cellCenter(0, target).y, 0xffffff);
    bus.emit(EventName.Sfx, { name: "clear", intensity: 2, variant: this.clearSfx });
    this.renderBoard();
    this.checkGameOver();
  }

  // ── idle hint ─────────────────────────────────────────────────────────────
  /** Best (piece, col, row): maximize lines cleared, tie-break toward the edges. */
  private bestMove(): { piece: TrayPiece; col: number; row: number } | null {
    let best: { piece: TrayPiece; col: number; row: number } | null = null;
    let bestScore = -1;
    for (const piece of this.tray) {
      if (!piece) continue;
      for (let row = 0; row < this.board.size; row++) {
        for (let col = 0; col < this.board.size; col++) {
          if (!this.board.canPlace(piece.shape.cells, col, row)) continue;
          const lines = this.board.linesIfPlaced(piece.shape.cells, col, row);
          // weight clears heavily; otherwise prefer bottom-right to keep the top open
          const s = lines * 1000 + (col + row);
          if (s > bestScore) {
            bestScore = s;
            best = { piece, col, row };
          }
        }
      }
    }
    return best;
  }

  /** Pulse the recommended tray piece + outline its best landing cells. */
  private showHint() {
    const move = this.bestMove();
    if (!move) return;
    this.hintActive = true;
    this.hintPiece = move.piece;

    // pulse the tray piece
    this.hintTween = this.tweens.add({
      targets: move.piece.container,
      scale: move.piece.trayScale * 1.18,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // pulsing outline on the board target
    if (!this.hintGfx) this.hintGfx = this.add.graphics().setDepth(28);
    const g = this.hintGfx;
    g.clear();
    g.lineStyle(3, 0xfde047, 0.95);
    g.fillStyle(0xfde047, 0.18);
    for (const c of move.piece.shape.cells) {
      const px = this.originX + (move.col + c.x) * this.cell;
      const py = this.originY + (move.row + c.y) * this.cell;
      g.fillRoundedRect(px + 2, py + 2, this.cell - 4, this.cell - 4, 6);
      g.strokeRoundedRect(px + 2, py + 2, this.cell - 4, this.cell - 4, 6);
    }
    this.tweens.add({ targets: g, alpha: { from: 0.35, to: 1 }, duration: 480, yoyo: true, repeat: -1 });
    bus.emit(EventName.Sfx, { name: "ui" });
  }

  private clearHint() {
    this.hintActive = false;
    this.hintTween?.stop();
    this.hintTween = undefined;
    if (this.hintPiece) {
      this.hintPiece.container.setScale(this.hintPiece.trayScale);
      this.hintPiece = undefined;
    }
    if (this.hintGfx) {
      this.tweens.killTweensOf(this.hintGfx);
      this.hintGfx.destroy();
      this.hintGfx = undefined;
    }
  }

  /** Spend one multiplier "move"; reset to ×1 when exhausted. */
  private consumeMult() {
    if (this.multMoves <= 0) return;
    this.multMoves--;
    if (this.multMoves === 0) this.scoreMult = 1;
    this.emitPowerup();
  }

  // ── progression / end states ─────────────────────────────────────────────
  private levelComplete() {
    this.running = false;
    this.clearing = false;
    this.coins += 5; // completion bonus
    this.emitCoins();
    this.fsm.transition("LEVEL_COMPLETE");
    bus.emit(EventName.StateChange, { state: "LEVEL_COMPLETE" });
    bus.emit(EventName.LevelComplete, { level: this.level.id, score: this.score });
    bus.emit(EventName.Sfx, { name: "levelup" });

    const advance = () => {
      if (this.level.id >= BLAST_LEVEL_COUNT) {
        this.fsm.transition("VICTORY");
        bus.emit(EventName.StateChange, { state: "VICTORY" });
        bus.emit(EventName.Victory, { score: this.score, level: this.level.id, lines: 0 });
      } else {
        this.loadLevel(this.level.id + 1);
      }
    };

    // play the celebration, then advance (VICTORY card shows for the final level)
    this.fx.levelUp(advance);
  }

  private gameOver() {
    this.running = false;
    this.clearing = false;
    this.fsm.transition("GAME_OVER");
    bus.emit(EventName.StateChange, { state: "GAME_OVER" });
    bus.emit(EventName.GameOver, { score: this.score, level: this.level.id, lines: 0 });
    bus.emit(EventName.Sfx, { name: "gameover" });
  }

  // ── countdown banner ─────────────────────────────────────────────────────
  private startBanner() {
    this.overlay?.destroy();
    this.overlay = this.add
      .text(this.scale.width / 2, this.scale.height / 2, this.level.name, {
        fontFamily: "monospace",
        fontSize: "56px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100);
    this.time.delayedCall(800, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.beginPlay();
    });
  }

  private beginPlay() {
    if (!this.fsm.is("COUNTDOWN")) return;
    this.fsm.transition("PLAYING");
    bus.emit(EventName.StateChange, { state: "PLAYING" });
    this.running = true;
    this.lastActivity = this.time.now;
    this.checkGameOver();
  }

  // ── HUD events ───────────────────────────────────────────────────────────
  private emitScore() {
    bus.emit(EventName.ScoreUpdate, {
      score: this.score,
      level: this.level.id,
      lines: 0,
      linesToTarget: Math.max(0, this.level.targetPoints - this.score),
      combo: 0,
      b2b: 0,
    });
  }

  private emitCoins() {
    bus.emit(EventName.CoinUpdate, { coins: this.coins });
  }

  private emitPowerup() {
    bus.emit(EventName.PowerupUpdate, {
      multiplier: this.scoreMult,
      multMoves: this.multMoves,
      hammerArmed: this.hammerArmed,
      rotateArmed: this.rotateArmed,
    });
  }
}
