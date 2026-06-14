import { PIECE_TYPES, type PieceType } from "./Piece";

/**
 * Seeded RNG + randomizers — pure logic, NO Phaser imports. Deterministic given
 * a seed so games and tests are reproducible.
 */

/** mulberry32: fast, seedable, good enough for gameplay randomness. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher–Yates using the provided rng. */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Standard 7-bag piece randomizer: every 7 draws yields each tetromino once. */
export class SevenBag {
  private bag: PieceType[] = [];
  constructor(private rng: () => number) {}

  private refill(): void {
    this.bag = shuffle([...PIECE_TYPES], this.rng);
  }

  next(): PieceType {
    if (this.bag.length === 0) this.refill();
    return this.bag.shift()!;
  }

  /** Peek the next `n` types without consuming (for the queue HUD). */
  peek(n: number): PieceType[] {
    while (this.bag.length < n) this.bag.push(...shuffle([...PIECE_TYPES], this.rng));
    return this.bag.slice(0, n);
  }
}

// ── Color selection ─────────────────────────────────────────────────────────
export type ColorBagMode = "weighted" | "bag" | "shuffleEveryN";

export interface ColorBagRule {
  mode: ColorBagMode;
  /** relative weights per palette color (weighted mode); defaults to uniform */
  weights?: number[];
  /** reshuffle period for shuffleEveryN */
  n?: number;
}

/** Max times the same color may appear consecutively (color-drought balancer). */
const MAX_RUN = 3;

/**
 * Picks a colorId from the active palette (colorIds 1..palette.length) honoring
 * the level's colorBagRule, with a balancer that never returns the same color
 * more than MAX_RUN times in a row.
 */
export class ColorSelector {
  private bag: number[] = [];
  private lastColor = -1;
  private runLength = 0;
  private drawCount = 0;
  /** colorIds 1..N */
  private readonly colors: number[];

  constructor(
    private paletteSize: number,
    private rule: ColorBagRule,
    private rng: () => number,
  ) {
    this.colors = Array.from({ length: paletteSize }, (_, i) => i + 1);
  }

  private weightedPick(exclude: number): number {
    const weights = this.rule.weights ?? this.colors.map(() => 1);
    let total = 0;
    for (let i = 0; i < this.colors.length; i++) {
      if (this.colors[i] === exclude) continue;
      total += weights[i] ?? 1;
    }
    let r = this.rng() * total;
    for (let i = 0; i < this.colors.length; i++) {
      if (this.colors[i] === exclude) continue;
      r -= weights[i] ?? 1;
      if (r <= 0) return this.colors[i];
    }
    return this.colors.find((cid) => cid !== exclude) ?? this.colors[0];
  }

  private bagPick(exclude: number): number {
    if (this.bag.length === 0) this.bag = shuffle([...this.colors], this.rng);
    // avoid starting a fresh bag with the excluded color when possible
    let idx = 0;
    if (this.bag[0] === exclude && this.bag.length > 1) idx = 1;
    return this.bag.splice(idx, 1)[0];
  }

  private rawPick(exclude: number): number {
    switch (this.rule.mode) {
      case "bag":
        return this.bagPick(exclude);
      case "shuffleEveryN": {
        const period = this.rule.n ?? this.paletteSize;
        if (this.drawCount % period === 0) this.bag = shuffle([...this.colors], this.rng);
        if (this.bag.length === 0) this.bag = shuffle([...this.colors], this.rng);
        let idx = 0;
        if (this.bag[0] === exclude && this.bag.length > 1) idx = 1;
        return this.bag.splice(idx, 1)[0];
      }
      case "weighted":
      default:
        return this.weightedPick(exclude);
    }
  }

  next(): number {
    // Exclude the running color once it has hit MAX_RUN to prevent droughts.
    const exclude = this.runLength >= MAX_RUN ? this.lastColor : -1;
    const picked = this.paletteSize === 1 ? this.colors[0] : this.rawPick(exclude);

    if (picked === this.lastColor) {
      this.runLength++;
    } else {
      this.lastColor = picked;
      this.runLength = 1;
    }
    this.drawCount++;
    return picked;
  }
}
