import Phaser from "phaser";
import { Board, WIDTH, HEIGHT, type ClearedCell } from "../core/Board";
import { pieceCells, type ActivePiece } from "../core/Piece";
import { PieceQueue } from "../core/PieceQueue";
import { tryRotate, type RotateDir } from "../core/srs";
import { getClearableRows, getTelegraphRows, type ClearMode } from "../core/rules";
import { Scorer } from "../core/scoring";
import { GameState } from "../core/GameState";
import { LEVEL_COUNT, getLevel, type LevelConfig } from "../levels/levels";
import { BlockRenderer } from "../render/BlockRenderer";
import { GhostPiece, dropPosition } from "../render/GhostPiece";
import { SandSystem } from "../render/SandSystem";
import { paletteFromColors } from "../render/palette";
import { DissolvePipeline } from "../fx/DissolvePipeline";
import { applyPostFX } from "../fx/PostFX";
import { InputController } from "../input/InputController";
import { resolveTier } from "../perf/benchmark";
import type { QualityTier } from "../config";
import { bus } from "../state/events";
import { EventName, InputAction } from "../state/EventNames";

const SETTLE_MS = 120;
const LOCK_RESET_CAP = 15; // max move-resets before a lock is forced

/** Board + pieces + full game loop: FSM, gravity, lock delay, clears, scoring, progression. */
export class GameScene extends Phaser.Scene {
  private board!: Board;
  private queue!: PieceQueue;
  private blocks!: BlockRenderer;
  private ghost!: GhostPiece;
  private sand!: SandSystem;
  private dissolve!: DissolvePipeline;
  private scorer!: Scorer;
  private fsm!: GameState;

  private level!: LevelConfig;
  private palette!: number[];
  private active!: ActivePiece;

  private gravityTimer?: Phaser.Time.TimerEvent;
  private lockTimer?: Phaser.Time.TimerEvent;
  private garbageTimer?: Phaser.Time.TimerEvent;
  private lockResets = 0;

  private running = false; // gameplay input + gravity active (false during countdown/clear/over)
  private clearing = false;
  private monoLines = 0; // mono-color lines cleared this level
  private levelStartMs = 0;
  private overlay?: Phaser.GameObjects.Text;
  // settings-driven (updated live via SettingsChange)
  private reduceMotion = false;
  private tier: QualityTier = "high";
  private clearMode: ClearMode = "color";
  private ghostOn = true;
  private glyphsOn = false;
  private das = 130;
  private arr = 30;
  private inputCtl?: InputController;

  constructor() {
    super("GameScene");
  }

  create() {
    this.registry.set("tier", this.tier);
    this.scorer = new Scorer();
    this.fsm = new GameState("BOOT", (next) => bus.emit(EventName.StateChange, { state: next }));
    this.fsm.transition("MENU");
    this.bindInput();
    this.bindIntents();
    applyPostFX(this, { bloom: true, tier: this.tier, reduceMotion: this.reduceMotion });
    // Wait in MENU; React main-menu drives RequestStartLevel.
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

  private onStartLevel = (p: { level: number }) => {
    this.scorer.reset();
    this.loadLevel(p.level);
  };

  private pauseGame = () => {
    if (!this.fsm.is("PLAYING")) return;
    this.running = false;
    if (this.gravityTimer) this.gravityTimer.paused = true;
    if (this.garbageTimer) this.garbageTimer.paused = true;
    this.cancelLock();
    this.fsm.transition("PAUSED");
  };

  private resumeGame = () => {
    if (!this.fsm.is("PAUSED")) return;
    this.fsm.transition("PLAYING");
    this.running = true;
    if (this.gravityTimer) this.gravityTimer.paused = false;
    if (this.garbageTimer) this.garbageTimer.paused = false;
  };

  private onRestart = () => {
    const id = this.level?.id ?? 1;
    this.scorer.reset();
    this.loadLevel(id);
  };

  private toMenu = () => {
    this.running = false;
    this.clearing = false;
    this.gravityTimer?.remove();
    this.garbageTimer?.remove();
    this.cancelLock();
    this.children.removeAll(true);
    if (!this.fsm.is("MENU")) this.fsm.transition("MENU");
  };

  private applySettings = (s: Record<string, unknown>) => {
    const g = s.graphics as
      | { tier?: QualityTier | "auto"; reduceMotion?: boolean; colorblindGlyphs?: boolean }
      | undefined;
    const gp = s.gameplay as
      | { ruleMode?: ClearMode; ghostPiece?: boolean; das?: number; arr?: number }
      | undefined;
    if (g) {
      if (g.reduceMotion != null) this.reduceMotion = g.reduceMotion;
      if (g.colorblindGlyphs != null) {
        this.glyphsOn = g.colorblindGlyphs;
        if (this.blocks && this.level) {
          const map: string[] = [];
          for (const c of this.level.colors) map[c.id] = c.glyph;
          this.blocks.setGlyphs(this.glyphsOn, map);
          if (this.running) this.redraw();
        }
      }
      if (g.tier) this.resolveAndApplyTier(g.tier);
    }
    if (gp) {
      if (gp.ruleMode) this.clearMode = gp.ruleMode;
      if (gp.ghostPiece != null) this.ghostOn = gp.ghostPiece;
      if (gp.das != null) this.das = gp.das;
      if (gp.arr != null) this.arr = gp.arr;
    }
  };

  private benched = false;

  /** Resolve the tier setting (running an auto-benchmark once) and apply it live. */
  private resolveAndApplyTier(setting: QualityTier | "auto") {
    if (setting === "auto") {
      if (this.benched) return;
      this.benched = true;
      void resolveTier("auto").then((t) => {
        this.tier = t;
        this.registry.set("tier", t);
        this.applyTierLive();
      });
    } else {
      this.tier = setting;
      this.registry.set("tier", setting);
      this.applyTierLive();
    }
  }

  /** Rebuild tier-dependent render systems in place (no board reset). */
  private applyTierLive() {
    if (!this.board || !this.blocks) return;
    this.sand = new SandSystem(this, this.blocks.cell, (c, r) => this.blocks.gridToPixel(c, r), this.tier, this.palette);
    this.dissolve = new DissolvePipeline(
      this,
      this.blocks.cell,
      (c, r) => this.blocks.gridToPixel(c, r),
      this.tier,
      this.reduceMotion,
      this.palette,
      { obtainBlock: () => this.blocks.obtainBlock(), releaseBlock: (i) => this.blocks.releaseBlock(i) },
    );
    applyPostFX(this, { bloom: true, tier: this.tier, reduceMotion: this.reduceMotion });
    // background reads tier on (re)build → re-emit its current level theme
    if (this.level) {
      bus.emit(EventName.LevelChange, {
        level: this.level.id,
        name: this.level.name,
        theme: this.level.scene,
        bgDim: this.level.bgDim,
      });
    }
  }

  // ── gamepad (optional, 8.5) ──────────────────────────────────────────────
  private prevPad = new Set<number>();
  private pollGamepad() {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const now = new Set<number>();
    const edge = (i: number, action: InputAction) => {
      if (pad.buttons[i]?.pressed) {
        now.add(i);
        if (!this.prevPad.has(i)) this.handleAction(action);
      }
    };
    edge(14, InputAction.MoveLeft);
    edge(15, InputAction.MoveRight);
    edge(13, InputAction.SoftDrop);
    edge(0, InputAction.RotateCW);
    edge(1, InputAction.RotateCCW);
    edge(2, InputAction.Hold);
    edge(5, InputAction.HardDrop);
    edge(4, InputAction.HardDrop);
    edge(9, InputAction.Pause);
    this.prevPad = now;
  }

  // ── level lifecycle ──────────────────────────────────────────────────────
  private loadLevel(id: number) {
    this.level = getLevel(id);
    this.palette = paletteFromColors(this.level.colors);
    bus.emit(EventName.LevelChange, {
      level: this.level.id,
      name: this.level.name,
      theme: this.level.scene,
      bgDim: this.level.bgDim,
    });
    this.monoLines = 0;
    this.running = false;
    this.clearing = false;

    this.board = new Board();
    this.queue = new PieceQueue(
      this.level.colors.length,
      { mode: this.level.colorBagRule, n: this.level.shuffleEveryN },
      (Date.now() ^ (id * 2654435761)) >>> 0,
    );

    // (Re)build render systems bound to this palette.
    this.children.removeAll(true);
    this.blocks = new BlockRenderer(this, this.palette);
    this.ghost = new GhostPiece(this, this.blocks.cell, (c, r) => this.blocks.gridToPixel(c, r), this.palette);
    const toPixel = (c: number, r: number) => this.blocks.gridToPixel(c, r);
    this.sand = new SandSystem(this, this.blocks.cell, toPixel, this.tier, this.palette);
    this.dissolve = new DissolvePipeline(this, this.blocks.cell, toPixel, this.tier, this.reduceMotion, this.palette, {
      obtainBlock: () => this.blocks.obtainBlock(),
      releaseBlock: (i) => this.blocks.releaseBlock(i),
    });

    const glyphMap: string[] = [];
    for (const c of this.level.colors) glyphMap[c.id] = c.glyph;
    this.blocks.setGlyphs(this.glyphsOn, glyphMap);

    this.applyPrefill();
    this.blocks.renderBoard(this.board);

    if (!this.fsm.is("COUNTDOWN")) {
      if (!this.fsm.canTransition("COUNTDOWN")) this.fsm.transition("MENU");
      this.fsm.transition("COUNTDOWN");
    }
    this.countdown();
  }

  /** Seed mixed-color junk rows with gaps (solvable) for prefill hazards. */
  private applyPrefill() {
    const rows = this.level.garbage?.prefillRows ?? 0;
    const n = this.level.colors.length;
    for (let i = 0; i < rows; i++) {
      const y = HEIGHT - 1 - i;
      const gap = Math.floor(Math.random() * WIDTH);
      for (let x = 0; x < WIDTH; x++) {
        if (x === gap) continue;
        this.board.set(x, y, 1 + Math.floor(Math.random() * n));
      }
    }
  }

  // ── countdown (4.7) ────────────────────────────────────────────────────────
  private countdown() {
    let n = 3;
    const show = (t: string) => {
      this.overlay?.destroy();
      this.overlay = this.add
        .text(this.scale.width / 2, this.scale.height / 2, t, {
          fontFamily: "monospace",
          fontSize: "120px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setDepth(100);
    };
    show(String(n));
    const tick = this.time.addEvent({
      delay: 700,
      repeat: 3,
      callback: () => {
        n -= 1;
        if (n > 0) show(String(n));
        else if (n === 0) show("GO");
        else {
          tick.remove();
          this.overlay?.destroy();
          this.overlay = undefined;
          this.beginPlay();
        }
      },
    });
  }

  private beginPlay() {
    this.fsm.transition("PLAYING");
    this.running = true;
    this.levelStartMs = performance.now();
    this.spawn();
    this.gravityTimer?.remove();
    this.gravityTimer = this.time.addEvent({
      delay: this.level.gravityMs,
      loop: true,
      callback: () => this.step(),
    });

    // rising garbage hazard (docs/05 §4)
    this.garbageTimer?.remove();
    this.garbageTimer = undefined;
    const rise = this.level.garbage?.risePeriodMs;
    if (rise) {
      this.garbageTimer = this.time.addEvent({ delay: rise, loop: true, callback: () => this.riseGarbage() });
    }
    this.emitScore();
  }

  private makeJunkRow(): number[] {
    const n = this.level.colors.length;
    const gap = Math.floor(Math.random() * WIDTH);
    const row: number[] = [];
    for (let x = 0; x < WIDTH; x++) row.push(x === gap ? 0 : 1 + Math.floor(Math.random() * n));
    return row;
  }

  /** Push one junk row up from the floor; game over if it overflows the top. */
  private riseGarbage() {
    if (!this.running || this.clearing) return;
    const overflow = this.board.raiseGarbage(this.makeJunkRow());
    if (overflow) {
      this.gameOver();
      return;
    }
    // the rising stack may now intersect the active piece — nudge it up, else lose
    if (this.board.collides(this.active)) {
      const up = { ...this.active, y: this.active.y - 1 };
      if (!this.board.collides(up)) this.active = up;
      else {
        this.gameOver();
        return;
      }
    }
    this.redraw();
  }

  // ── piece lifecycle ─────────────────────────────────────────────────────
  private spawn(fromHold?: ActivePiece) {
    this.active = fromHold ?? this.queue.spawnNext();
    this.lockResets = 0;
    this.cancelLock();
    if (this.board.collides(this.active)) {
      this.gameOver();
      return;
    }
    this.emitQueueHold();
    this.redraw();
    if (this.isResting()) this.scheduleLock();
  }

  private isResting(): boolean {
    return this.board.collides({ ...this.active, y: this.active.y + 1 });
  }

  private step() {
    if (!this.running || this.clearing) return;
    if (this.isResting()) {
      this.scheduleLock();
      return;
    }
    this.active = { ...this.active, y: this.active.y + 1 };
    this.redraw();
    if (this.isResting()) this.scheduleLock();
  }

  // ── lock delay (4.2) ──────────────────────────────────────────────────────
  private scheduleLock() {
    if (this.lockTimer) {
      if (this.lockResets < LOCK_RESET_CAP) {
        this.lockTimer.remove();
        this.lockTimer = this.armLockTimer();
        this.lockResets += 1;
      }
      // else: cap reached → let the running timer expire
    } else {
      this.lockTimer = this.armLockTimer();
    }
  }

  private armLockTimer(): Phaser.Time.TimerEvent {
    return this.time.delayedCall(this.level.lockDelayMs, () => this.commitLock());
  }

  private cancelLock() {
    this.lockTimer?.remove();
    this.lockTimer = undefined;
  }

  private commitLock() {
    if (!this.running || this.clearing) return;
    this.cancelLock();
    this.lock();
  }

  private lock() {
    this.lockFlash(this.active);
    bus.emit(EventName.Sfx, { name: "lock" });
    this.board.lock(this.active);
    const rows = getClearableRows(this.board, this.clearMode);
    if (rows.length === 0) {
      this.scorer.lockWithoutClear();
      this.redraw();
      this.spawn();
    } else {
      this.startLineClear(rows);
    }
  }

  // ── line clear + sand (Phase 3) ───────────────────────────────────────────
  private startLineClear(rows: number[]) {
    this.clearing = true;
    this.cancelLock();
    this.fsm.transition("LINE_CLEAR");

    const cleared: ClearedCell[] = [];
    for (const y of rows) {
      for (let x = 0; x < WIDTH; x++) {
        const colorId = this.board.get(x, y);
        if (colorId !== 0) cleared.push({ x, y, colorId });
      }
    }
    const rowSet = new Set(rows);
    const survivors: { x: number; y: number; colorId: number; drop: number }[] = [];
    this.board.forEachCell((x, y, colorId) => {
      if (rowSet.has(y)) return;
      survivors.push({ x, y, colorId, drop: rows.filter((r) => r > y).length });
    });

    // scoring + progression
    const res = this.scorer.clear(rows.length, this.level.id);
    this.monoLines += rows.length;
    bus.emit(EventName.LinesCleared, { rows, colors: cleared.map((c) => c.colorId), count: rows.length });
    bus.emit(EventName.ComboUpdate, { combo: res.combo, b2b: res.b2b ? 1 : 0 });
    this.emitScore();

    this.board.clearRows(rows);

    this.blocks.clearBoard();
    this.blocks.clearPiece();
    this.ghost.clear();
    const survivorImgs = survivors.map((s) => ({ img: this.blocks.makeBlock(s.x, s.y, s.colorId), s }));

    this.sand.emit(cleared);
    this.dissolve.run(cleared, () => {
      this.settle(survivorImgs, () => {
        this.blocks.renderBoard(this.board);
        this.clearing = false;
        if (this.monoLines >= this.level.targetLines) {
          this.levelComplete();
        } else {
          this.fsm.transition("PLAYING");
          this.spawn();
        }
      });
    });
  }

  private settle(
    survivorImgs: { img: Phaser.GameObjects.Image; s: { x: number; y: number; drop: number } }[],
    onDone: () => void,
  ) {
    let remaining = survivorImgs.length;
    if (remaining === 0) return onDone();
    const finish = () => { if (--remaining === 0) onDone(); };
    for (const { img, s } of survivorImgs) {
      if (s.drop === 0) { this.blocks.releaseBlock(img); finish(); continue; }
      const target = this.blocks.gridToPixel(s.x, s.y + s.drop);
      this.tweens.add({ targets: img, y: target.y, duration: SETTLE_MS, ease: "Quad.easeIn",
        onComplete: () => { this.blocks.releaseBlock(img); finish(); } });
    }
  }

  // ── progression (4.5) / game over (4.6) ────────────────────────────────────
  private levelComplete() {
    this.running = false;
    this.gravityTimer?.remove();
    this.garbageTimer?.remove();
    this.fsm.transition("LEVEL_COMPLETE");
    const timeMs = this.levelStartMs ? Math.round(performance.now() - this.levelStartMs) : undefined;
    bus.emit(EventName.LevelComplete, { level: this.level.id, score: this.scorer.score, timeMs });

    if (this.level.id >= LEVEL_COUNT) {
      this.fsm.transition("VICTORY");
      bus.emit(EventName.Victory, { score: this.scorer.score, level: this.level.id, lines: this.monoLines });
    } else {
      this.loadLevel(this.level.id + 1);
    }
  }

  private gameOver() {
    this.running = false;
    this.clearing = false;
    this.gravityTimer?.remove();
    this.garbageTimer?.remove();
    this.cancelLock();
    this.fsm.transition("GAME_OVER");
    bus.emit(EventName.GameOver, { score: this.scorer.score, level: this.level.id, lines: this.monoLines });
  }

  /** Restart the current level (retry). */
  retry() {
    if (!this.fsm.is("GAME_OVER")) return;
    this.scorer.reset();
    this.loadLevel(this.level.id);
  }

  // ── input: device-agnostic actions (Phase 8) ────────────────────────────
  private bindInput() {
    // Keyboard → actions with DAS/ARR, polled in update().
    this.inputCtl = new InputController(
      this,
      () => ({ das: this.das, arr: this.arr, softDropMs: this.level?.softDropMs ?? 40 }),
      (a) => this.handleAction(a),
    );
    // Touch / gamepad emit the same actions over the bus.
    bus.on(EventName.InputAction, this.onBusAction);
    this.input.keyboard?.addKey("R").on("down", () => this.retry());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      bus.off(EventName.InputAction, this.onBusAction),
    );
  }

  private onBusAction = (p: { action: InputAction }) => this.handleAction(p.action);

  /** Single entry point: every device routes here. */
  private handleAction(action: InputAction) {
    switch (action) {
      case InputAction.MoveLeft: this.move(-1); break;
      case InputAction.MoveRight: this.move(1); break;
      case InputAction.SoftDrop: this.softDrop(); break;
      case InputAction.HardDrop: this.hardDrop(); break;
      case InputAction.RotateCW: this.rotate(1); break;
      case InputAction.RotateCCW: this.rotate(-1); break;
      case InputAction.Hold: this.hold(); break;
      case InputAction.Pause: this.togglePause(); break;
    }
  }

  update(time: number, delta: number) {
    this.inputCtl?.update(time, delta);
    this.pollGamepad();
  }

  private togglePause() {
    if (this.fsm.is("PLAYING")) this.pauseGame();
    else if (this.fsm.is("PAUSED")) this.resumeGame();
  }

  private canAct(): boolean {
    return this.running && !this.clearing;
  }

  private move(dx: number) {
    if (!this.canAct()) return;
    const moved = { ...this.active, x: this.active.x + dx };
    if (!this.board.collides(moved)) {
      this.active = moved;
      bus.emit(EventName.Sfx, { name: "move" });
      this.redraw();
      this.isResting() ? this.scheduleLock() : this.cancelLock();
    }
  }

  private rotate(dir: RotateDir) {
    if (!this.canAct()) return;
    const rotated = tryRotate(this.board, this.active, dir);
    if (rotated) {
      this.active = rotated;
      bus.emit(EventName.Sfx, { name: "rotate" });
      this.redraw();
      this.isResting() ? this.scheduleLock() : this.cancelLock();
    }
  }

  private softDrop() {
    if (!this.canAct()) return;
    if (!this.isResting()) {
      this.active = { ...this.active, y: this.active.y + 1 };
      this.scorer.softDrop(1);
      bus.emit(EventName.Sfx, { name: "softdrop" });
      this.redraw();
      if (this.isResting()) this.scheduleLock();
    }
  }

  private hardDrop() {
    if (!this.canAct()) return;
    const landed = dropPosition(this.board, this.active);
    this.scorer.hardDrop(landed.y - this.active.y);
    this.active = landed;
    const landRow = Math.max(...pieceCells(landed).map((c) => c.y));
    bus.emit(EventName.Sfx, { name: "harddrop" });
    this.dropFeedback(landRow);
    this.commitLock();
  }

  private hold() {
    if (!this.canAct()) return;
    const swapped = this.queue.swapHold(this.active);
    if (swapped && !this.board.collides(swapped)) {
      this.active = swapped;
      this.lockResets = 0;
      this.cancelLock();
      bus.emit(EventName.Sfx, { name: "hold" });
      this.emitQueueHold();
      this.redraw();
      if (this.isResting()) this.scheduleLock();
    }
  }

  // ── rendering + HUD events ──────────────────────────────────────────────
  private redraw() {
    this.blocks.renderBoard(this.board);
    if (this.ghostOn) this.ghost.render(this.board, this.active);
    else this.ghost.clear();
    this.blocks.renderPiece(this.active);
    this.blocks.renderTelegraph(getTelegraphRows(this.board));
  }

  // ── input / drop feedback (5.2) ─────────────────────────────────────────
  private get shakeAllowed(): boolean {
    return this.tier !== "low" && !this.reduceMotion;
  }

  /** Hard-drop punch: small screen shake + dust puff at the landing row. */
  private dropFeedback(landRow: number) {
    if (this.shakeAllowed) this.cameras.main.shake(70, 0.004);
    const { y } = this.blocks.gridToPixel(0, landRow);
    const dust = this.add
      .rectangle(this.scale.width / 2, y, this.blocks.cell * 10, this.blocks.cell * 0.6, 0xffffff, 0.35)
      .setDepth(30);
    this.tweens.add({ targets: dust, alpha: 0, scaleY: 2, duration: 220, ease: "Quad.easeOut",
      onComplete: () => dust.destroy() });
  }

  /** Soft-lock flash: brief additive flash on the just-locked cells. */
  private lockFlash(piece: ActivePiece) {
    if (this.reduceMotion) return;
    const flashes = pieceCells(piece)
      .filter((c) => c.y >= 2)
      .map((c) => this.blocks.makeBlock(c.x, c.y, piece.colorId, 0.95).setTint(0xffffff).setDepth(25));
    if (flashes.length === 0) return;
    this.tweens.add({ targets: flashes, alpha: 0, duration: 120,
      onComplete: () => flashes.forEach((f) => this.blocks.releaseBlock(f)) });
  }

  private emitScore() {
    bus.emit(EventName.ScoreUpdate, {
      score: this.scorer.score,
      level: this.level.id,
      lines: this.monoLines,
      linesToTarget: Math.max(0, this.level.targetLines - this.monoLines),
      combo: 0,
      b2b: 0,
    });
  }

  private emitQueueHold() {
    bus.emit(EventName.QueueUpdate, { next: this.queue.preview(3) });
    bus.emit(EventName.HoldUpdate, { piece: this.queue.hold, canHold: this.queue.canHold });
  }
}
