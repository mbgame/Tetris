import Phaser from "phaser";
import { BlastBoard, type BlastCell } from "../blast/BlastBoard";
import { randomPiece, type PieceShape } from "../blast/pieces";
import { BLAST_LEVEL_COUNT, getBlastLevel, type BlastLevelConfig } from "../blast/levels";
import { placementScore, clearScore } from "../blast/scoring";
import { paletteFromColors, tintFor } from "../render/palette";
import { ensureBlockTexture, BLOCK_TEX } from "../render/BlockRenderer";
import { GameState } from "../core/GameState";
import { createRng } from "../core/rng";
import { bus } from "../state/events";
import { EventName } from "../state/EventNames";

const TRAY_SLOTS = 3;
const TRAY_SCALE_MAX = 0.7; // cap on parked piece size (small pieces don't blow up)

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
 * only affect score). Each level is cleared by reaching a point target; harder
 * levels start with more pre-placed noise and bias toward bigger pieces.
 *
 * Mirrors GameScene's event-bus contract (StateChange / ScoreUpdate / …) so the
 * existing React HUD + menu cards work unchanged. Dormant unless started with
 * mode === "blast"; ignores intents otherwise.
 */
export class BlastScene extends Phaser.Scene {
  private board!: BlastBoard;
  private fsm!: GameState;
  private level!: BlastLevelConfig;
  private palette!: number[];
  private rng: () => number = Math.random;

  private cell = 48;
  private originX = 0;
  private originY = 0;

  private boardLayer!: Phaser.GameObjects.Group;
  private gridGfx?: Phaser.GameObjects.Graphics;
  private ghostGfx?: Phaser.GameObjects.Graphics;
  private overlay?: Phaser.GameObjects.Text;

  private tray: (TrayPiece | null)[] = [];
  private dragging?: TrayPiece;
  private dragTarget?: { col: number; row: number; valid: boolean };

  private score = 0;
  private active = false; // owns the session (drives bus emissions)
  private running = false; // drag input enabled
  private clearing = false;
  private reduceMotion = false;

  constructor() {
    super("BlastScene");
  }

  create() {
    ensureBlockTexture(this); // shared rounded-block texture (also used by classic)
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
    bus.on(EventName.SettingsChange, this.applySettings);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EventName.RequestStartLevel, this.onStartLevel);
      bus.off(EventName.RequestPause, this.pauseGame);
      bus.off(EventName.RequestResume, this.resumeGame);
      bus.off(EventName.RequestRestart, this.onRestart);
      bus.off(EventName.RequestQuit, this.toMenu);
      bus.off(EventName.SettingsChange, this.applySettings);
    });
  }

  private onStartLevel = (p: { level: number; mode?: string }) => {
    if (p.mode !== "blast") return; // classic handled by GameScene
    this.active = true;
    this.score = 0;
    this.loadLevel(p.level);
  };

  private onRestart = () => {
    if (!this.active) return;
    this.score = 0;
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
    if (g?.reduceMotion != null) this.reduceMotion = g.reduceMotion;
  };

  // ── level lifecycle ──────────────────────────────────────────────────────
  private loadLevel(id: number) {
    this.level = getBlastLevel(id);
    this.palette = paletteFromColors(this.level.colors);
    this.rng = createRng((Date.now() ^ (id * 2654435761)) >>> 0);
    this.running = false;
    this.clearing = false;

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
    this.dragTarget = undefined;
    this.gridGfx = undefined;
    this.ghostGfx = undefined;

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
    this.startBanner();
  }

  /** Fit the square board in the upper area; tray sits below it. */
  private computeLayout() {
    const { width, height } = this.scale.gameSize;
    const size = this.board.size;
    const topPad = height * 0.13; // leave room for HUD top bar
    const trayH = height * 0.2;
    const availH = height - topPad - trayH;
    const maxW = width * 0.92;
    this.cell = Math.floor(Math.min(maxW / size, availH / size));
    const boardPx = this.cell * size;
    this.originX = Math.floor((width - boardPx) / 2);
    this.originY = Math.floor(topPad + (availH - boardPx) / 2);
  }

  private drawGrid() {
    const size = this.board.size;
    const boardPx = this.cell * size;
    const g = this.add.graphics().setDepth(-2);
    // recessed panel
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(this.originX - 6, this.originY - 6, boardPx + 12, boardPx + 12, 10);
    // cell grid
    g.lineStyle(1, 0xffffff, 0.08);
    for (let i = 0; i <= size; i++) {
      const p = i * this.cell;
      g.lineBetween(this.originX, this.originY + p, this.originX + boardPx, this.originY + p);
      g.lineBetween(this.originX + p, this.originY, this.originX + p, this.originY + boardPx);
    }
    g.lineStyle(2, 0x4fd1c5, 0.35);
    g.strokeRoundedRect(this.originX, this.originY, boardPx, boardPx, 6);
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
      const img = this.boardLayer.create(px, py, BLOCK_TEX) as Phaser.GameObjects.Image;
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

  private makeTrayPiece(slot: number): TrayPiece {
    const shape = randomPiece(this.rng, this.level.difficulty);
    const colorId = 1 + Math.floor(this.rng() * this.level.colors.length);
    const { width, height } = this.scale.gameSize;
    const cell = this.cell;
    const slotW = width / TRAY_SLOTS;
    const slotCx = slotW * (slot + 0.5);

    // tray band sits below the board; slot box is the comfortable area we fit into
    const trayTop = this.originY + cell * this.board.size;
    const trayH = height - trayTop;
    const slotCy = trayTop + trayH / 2;
    const slotBoxW = slotW * 0.82;
    const slotBoxH = trayH * 0.6;

    const container = this.add.container(0, 0).setDepth(40);
    for (const c of shape.cells) {
      const img = this.add.image(c.x * cell, c.y * cell, BLOCK_TEX);
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
      if (this.dragging || !this.running || this.clearing) return;
      const piece = this.tray.find(
        (t): t is TrayPiece => t !== null && Phaser.Geom.Rectangle.Contains(t.grabRect, pointer.x, pointer.y),
      );
      if (!piece) return;
      this.dragging = piece;
      piece.container.setScale(1).setDepth(60);
      this.moveDragged(pointer);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.dragging) this.moveDragged(pointer);
    });

    this.input.on("pointerup", () => this.dropDragged());
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
    this.ghostGfx?.clear();
    const t = this.dragTarget;
    this.dragTarget = undefined;
    if (t && t.valid) this.commitPlacement(piece, t.col, t.row);
    else this.snapBack(piece);
  }

  /** Safety net: if the pointer was released off-canvas (no pointerup), drop. */
  update() {
    if (this.dragging && !this.input.activePointer.isDown) this.dropDragged();
  }

  private targetOrigin(piece: TrayPiece): { col: number; row: number } {
    return {
      col: Math.round((piece.container.x - this.originX - this.cell / 2) / this.cell),
      row: Math.round((piece.container.y - this.originY - this.cell / 2) / this.cell),
    };
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
    this.board.place(piece.shape.cells, col, row, piece.colorId);
    this.tray[piece.slot] = null;
    piece.container.destroy();
    bus.emit(EventName.Sfx, { name: "lock" });

    this.score += placementScore(piece.shape.cells.length);
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

    this.score += clearScore(lineCount, mono);
    bus.emit(EventName.ComboUpdate, { combo: lineCount - 1, b2b: 0 });
    bus.emit(EventName.Sfx, { name: "clear", intensity: lineCount });
    bus.emit(EventName.LinesCleared, { rows, colors: cleared.map((c) => c.colorId), count: lineCount });

    if (!this.reduceMotion) {
      if (lineCount >= 2) this.cameras.main.flash(120, 255, 255, 255, false);
      this.cameras.main.shake(60 + lineCount * 15, 0.003 * lineCount);
    }

    this.burstClear(cleared, () => {
      this.renderBoard();
      this.clearing = false;
      this.afterPlacement();
    });
  }

  /** Pop cleared cells with a quick scale-up + fade. */
  private burstClear(cells: BlastCell[], onDone: () => void) {
    if (cells.length === 0 || this.reduceMotion) {
      if (cells.length) this.renderBoard();
      return onDone();
    }
    let remaining = cells.length;
    const finish = () => {
      if (--remaining <= 0) onDone();
    };
    for (const c of cells) {
      const { x, y } = this.cellCenter(c.x, c.y);
      const img = this.add.image(x, y, BLOCK_TEX).setDisplaySize(this.cell, this.cell).setDepth(50);
      img.setTint(tintFor(c.colorId, this.palette));
      this.tweens.add({
        targets: img,
        scale: img.scale * 1.4,
        alpha: 0,
        duration: 240,
        ease: "Quad.easeOut",
        onComplete: () => {
          img.destroy();
          finish();
        },
      });
    }
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
    if (!anyFits) this.gameOver();
  }

  // ── progression / end states ─────────────────────────────────────────────
  private levelComplete() {
    this.running = false;
    this.clearing = false;
    this.fsm.transition("LEVEL_COMPLETE");
    bus.emit(EventName.StateChange, { state: "LEVEL_COMPLETE" });
    bus.emit(EventName.LevelComplete, { level: this.level.id, score: this.score });
    bus.emit(EventName.Sfx, { name: "levelup" });

    if (this.level.id >= BLAST_LEVEL_COUNT) {
      this.fsm.transition("VICTORY");
      bus.emit(EventName.StateChange, { state: "VICTORY" });
      bus.emit(EventName.Victory, { score: this.score, level: this.level.id, lines: 0 });
    } else {
      this.time.delayedCall(1100, () => this.loadLevel(this.level.id + 1));
    }
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
}
