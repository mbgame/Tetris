import { pieceCells, type ActivePiece } from "./Piece";

/**
 * Pure board model — NO Phaser imports (unit-testable in Node).
 *
 * Grid: 10 columns × 22 rows. Rows 0–1 are the hidden spawn buffer; visible
 * play field is rows 2–21. Origin top-left (col 0, row 0), y increases downward.
 * A cell holds a colorId: 0 = empty, >0 = filled with that color.
 */
export const WIDTH = 10;
export const HIDDEN = 2;
export const VISIBLE = 20;
export const HEIGHT = HIDDEN + VISIBLE; // 22

export const EMPTY = 0;

export class Board {
  /** row-major: grid[y][x] */
  readonly grid: number[][];

  constructor() {
    this.grid = Array.from({ length: HEIGHT }, () => new Array<number>(WIDTH).fill(EMPTY));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
  }

  get(x: number, y: number): number {
    return this.inBounds(x, y) ? this.grid[y][x] : EMPTY;
  }

  set(x: number, y: number, colorId: number): void {
    if (this.inBounds(x, y)) this.grid[y][x] = colorId;
  }

  /**
   * Is the cell blocked? Walls (x out of range) and the floor (y >= HEIGHT)
   * count as occupied; space above the board (y < 0) is free so pieces can
   * spawn/rotate in the buffer.
   */
  isOccupied(x: number, y: number): boolean {
    if (x < 0 || x >= WIDTH || y >= HEIGHT) return true;
    if (y < 0) return false;
    return this.grid[y][x] !== EMPTY;
  }

  /** True if any of the piece's cells overlaps a wall, floor, or filled cell. */
  collides(piece: ActivePiece): boolean {
    return pieceCells(piece).some((c) => this.isOccupied(c.x, c.y));
  }

  /** Write the piece's cells into the grid using its colorId. */
  lock(piece: ActivePiece): void {
    for (const c of pieceCells(piece)) this.set(c.x, c.y, piece.colorId);
  }

  /** Visit every filled cell (visible + hidden). */
  forEachCell(cb: (x: number, y: number, colorId: number) => void): void {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const c = this.grid[y][x];
        if (c !== EMPTY) cb(x, y, c);
      }
    }
  }

  /** Is a whole row filled (any colors)? */
  isRowFull(y: number): boolean {
    if (y < 0 || y >= HEIGHT) return false;
    return this.grid[y].every((c) => c !== EMPTY);
  }

  /**
   * Remove the given rows and collapse everything above straight down (classic
   * column collapse, not per-cell gravity). Returns the cleared cells (position
   * + color) so VFX can pour them into sand.
   */
  clearRows(rows: number[]): ClearedCell[] {
    if (rows.length === 0) return [];
    const remove = new Set(rows);

    const cleared: ClearedCell[] = [];
    for (const y of rows) {
      for (let x = 0; x < WIDTH; x++) {
        const colorId = this.grid[y][x];
        if (colorId !== EMPTY) cleared.push({ x, y, colorId });
      }
    }

    // Keep surviving rows in order, then pad the same number of empty rows on top.
    const kept = this.grid.filter((_, y) => !remove.has(y));
    const pad = rows.length;
    for (let y = 0; y < HEIGHT; y++) {
      this.grid[y] =
        y < pad ? new Array<number>(WIDTH).fill(EMPTY) : kept[y - pad];
    }
    return cleared;
  }

  /**
   * Push the stack up by one row and insert `newBottom` at the floor (rising
   * garbage hazard). Returns true if the top row overflowed (had blocks shoved
   * off the board) → caller should trigger game over.
   */
  raiseGarbage(newBottom: number[]): boolean {
    const overflow = this.grid[0].some((c) => c !== EMPTY);
    for (let y = 0; y < HEIGHT - 1; y++) this.grid[y] = this.grid[y + 1];
    this.grid[HEIGHT - 1] = newBottom.slice(0, WIDTH);
    return overflow;
  }
}

export interface ClearedCell {
  x: number;
  y: number;
  colorId: number;
}
