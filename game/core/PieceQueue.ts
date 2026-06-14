import { spawnPiece, type ActivePiece, type PieceType } from "./Piece";
import { SevenBag, ColorSelector, createRng, type ColorBagRule } from "./rng";

/** A queued piece with its colour decided up front so the HUD preview matches spawn. */
export interface QueuedPiece {
  type: PieceType;
  colorId: number;
}

/**
 * Owns piece generation, the next-N preview, and the hold slot — pure logic,
 * NO Phaser imports. Colours are assigned when a piece enters the buffer (not at
 * spawn), so `preview()` returns exactly the type+colour that will spawn.
 */
export class PieceQueue {
  private bag: SevenBag;
  private colors: ColorSelector;
  private buffer: QueuedPiece[] = [];
  private holdType: PieceType | null = null;
  private holdUsed = false;

  constructor(paletteSize: number, rule: ColorBagRule, seed: number) {
    const rng = createRng(seed);
    this.bag = new SevenBag(rng);
    this.colors = new ColorSelector(paletteSize, rule, rng);
  }

  /** Keep at least `min` pieces (type+colour pre-decided) in the buffer. */
  private fill(min: number): void {
    while (this.buffer.length < min) {
      this.buffer.push({ type: this.bag.next(), colorId: this.colors.next() });
    }
  }

  private take(): QueuedPiece {
    this.fill(1);
    return this.buffer.shift()!;
  }

  /** Spawn the next piece for a fresh drop; re-enables hold. */
  spawnNext(): ActivePiece {
    this.holdUsed = false;
    const it = this.take();
    return spawnPiece(it.type, it.colorId);
  }

  /** The exact upcoming pieces (type + colour) for the HUD next queue. */
  preview(n: number): QueuedPiece[] {
    this.fill(n);
    return this.buffer.slice(0, n);
  }

  get hold(): PieceType | null {
    return this.holdType;
  }

  get canHold(): boolean {
    return !this.holdUsed;
  }

  /**
   * Swap the current piece into the hold slot (once per drop).
   * Returns the new active piece, or null if hold is locked out this drop.
   */
  swapHold(current: ActivePiece): ActivePiece | null {
    if (this.holdUsed) return null;
    this.holdUsed = true;

    if (this.holdType === null) {
      this.holdType = current.type;
      const it = this.take();
      return spawnPiece(it.type, it.colorId);
    }
    const swap = this.holdType;
    this.holdType = current.type;
    return spawnPiece(swap, this.colors.next());
  }
}
