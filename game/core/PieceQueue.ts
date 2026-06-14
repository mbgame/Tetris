import { spawnPiece, type ActivePiece, type PieceType } from "./Piece";
import { SevenBag, ColorSelector, createRng, type ColorBagRule } from "./rng";

/**
 * Owns piece generation, the next-N preview, and the hold slot — pure logic,
 * NO Phaser imports. Color is assigned from the level palette at spawn time;
 * the preview only knows shapes (which is all the HUD shows).
 */
export class PieceQueue {
  private bag: SevenBag;
  private colors: ColorSelector;
  private holdType: PieceType | null = null;
  private holdUsed = false;

  constructor(paletteSize: number, rule: ColorBagRule, seed: number) {
    const rng = createRng(seed);
    this.bag = new SevenBag(rng);
    this.colors = new ColorSelector(paletteSize, rule, rng);
  }

  private pull(): ActivePiece {
    return spawnPiece(this.bag.next(), this.colors.next());
  }

  /** Spawn the next piece for a fresh drop; re-enables hold. */
  spawnNext(): ActivePiece {
    this.holdUsed = false;
    return this.pull();
  }

  /** Shapes of the upcoming pieces (for the HUD next queue). */
  preview(n: number): PieceType[] {
    return this.bag.peek(n);
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
      return this.pull();
    }
    const swap = this.holdType;
    this.holdType = current.type;
    return spawnPiece(swap, this.colors.next());
  }
}
