/**
 * Scoring — pure logic, NO Phaser imports (docs/01 §7).
 *
 *   lineScore   = baseLine[rowCount] * level
 *   colorBonus  = 1.5×  (always, since the default rule requires mono-color)
 *   comboBonus  = +50 * comboCount * level   (consecutive clears)
 *   b2bBonus    = +0.5× when consecutive clears are both multi-row (>=2)
 *   softDrop    = +1 per cell, hardDrop = +2 per cell
 *
 *   clearScore  = floor(lineScore * colorBonus * b2bMultiplier) + comboBonus
 *
 * Combo resets when a piece locks without clearing.
 */
export const BASE_LINE: Record<number, number> = { 1: 100, 2: 300, 3: 500, 4: 800 };
export const COLOR_BONUS = 1.5;
export const SQUARE_BASE = 250; // per 3×3 mono square
const COMBO_UNIT = 50;
const B2B_MULTIPLIER = 1.5;

export interface ClearResult {
  gained: number;
  combo: number;
  b2b: boolean;
}

export class Scorer {
  private _score = 0;
  /** -1 = no active combo; becomes 0 on the first clear of a chain. */
  private combo = -1;
  private lastClearMulti = false;

  get score(): number {
    return this._score;
  }

  /** Apply a clear of `rowCount` rows at the given level. */
  clear(rowCount: number, level: number): ClearResult {
    const lineScore = (BASE_LINE[rowCount] ?? 0) * level;
    const isMulti = rowCount >= 2;
    const b2b = isMulti && this.lastClearMulti;
    const b2bMult = b2b ? B2B_MULTIPLIER : 1;

    this.combo += 1;
    const comboBonus = COMBO_UNIT * Math.max(0, this.combo) * level;
    const gained = Math.floor(lineScore * COLOR_BONUS * b2bMult) + comboBonus;

    this._score += gained;
    this.lastClearMulti = isMulti;
    return { gained, combo: this.combo, b2b };
  }

  /** Apply a 3×3 mono-square clear of `count` squares at the given level. */
  square(count: number, level: number): ClearResult {
    this.combo += 1;
    const comboBonus = COMBO_UNIT * Math.max(0, this.combo) * level;
    const gained = Math.floor(SQUARE_BASE * count * level * COLOR_BONUS) + comboBonus;
    this._score += gained;
    this.lastClearMulti = count >= 2;
    return { gained, combo: this.combo, b2b: false };
  }

  /** A lock that cleared nothing breaks the combo chain. */
  lockWithoutClear(): void {
    this.combo = -1;
    this.lastClearMulti = false;
  }

  softDrop(cells: number): void {
    this._score += cells;
  }

  hardDrop(cells: number): void {
    this._score += cells * 2;
  }

  reset(): void {
    this._score = 0;
    this.combo = -1;
    this.lastClearMulti = false;
  }
}
