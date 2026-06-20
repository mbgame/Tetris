/**
 * Pure board model for the "Block Drop" mode — NO Phaser imports (unit-testable).
 *
 * A square grid (default 8×8). Pieces are dropped in whole (no gravity); full
 * rows AND full columns clear simultaneously. A cell holds a colorId:
 * 0 = empty, >0 = filled with that color.
 */
export const BLAST_SIZE = 8;
export const EMPTY = 0;

export interface BlastCell {
  x: number;
  y: number;
  colorId: number;
}

/** A piece footprint: cell offsets normalized so min x/y are 0, plus a color. */
export interface PlacedShape {
  cells: { x: number; y: number }[];
  colorId: number;
}

export class BlastBoard {
  readonly size: number;
  /** row-major: grid[y][x] */
  readonly grid: number[][];

  constructor(size: number = BLAST_SIZE) {
    this.size = size;
    this.grid = Array.from({ length: size }, () => new Array<number>(size).fill(EMPTY));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  get(x: number, y: number): number {
    return this.inBounds(x, y) ? this.grid[y][x] : EMPTY;
  }

  set(x: number, y: number, colorId: number): void {
    if (this.inBounds(x, y)) this.grid[y][x] = colorId;
  }

  /** Can the shape's cells be placed with its origin at (ox, oy)? */
  canPlace(cells: { x: number; y: number }[], ox: number, oy: number): boolean {
    return cells.every((c) => {
      const x = ox + c.x;
      const y = oy + c.y;
      return this.inBounds(x, y) && this.grid[y][x] === EMPTY;
    });
  }

  /** Write a shape into the grid at origin (ox, oy). Caller must canPlace first. */
  place(cells: { x: number; y: number }[], ox: number, oy: number, colorId: number): void {
    for (const c of cells) this.set(ox + c.x, oy + c.y, colorId);
  }

  /** True if the shape fits anywhere on the board (drives game-over detection). */
  fitsAnywhere(cells: { x: number; y: number }[]): boolean {
    for (let oy = 0; oy < this.size; oy++) {
      for (let ox = 0; ox < this.size; ox++) {
        if (this.canPlace(cells, ox, oy)) return true;
      }
    }
    return false;
  }

  /** Indices of every fully-filled row and column. */
  getFullLines(): { rows: number[]; cols: number[] } {
    const rows: number[] = [];
    const cols: number[] = [];
    for (let y = 0; y < this.size; y++) {
      if (this.grid[y].every((c) => c !== EMPTY)) rows.push(y);
    }
    for (let x = 0; x < this.size; x++) {
      let full = true;
      for (let y = 0; y < this.size; y++) {
        if (this.grid[y][x] === EMPTY) {
          full = false;
          break;
        }
      }
      if (full) cols.push(x);
    }
    return { rows, cols };
  }

  /**
   * Empty the given rows + columns (block-blast: no collapse, holes stay).
   * Returns the cleared cells (position + color) so VFX can animate them. A cell
   * at a row∩column intersection is reported once.
   */
  clearLines(rows: number[], cols: number[]): BlastCell[] {
    const rowSet = new Set(rows);
    const colSet = new Set(cols);
    const cleared: BlastCell[] = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!rowSet.has(y) && !colSet.has(x)) continue;
        const colorId = this.grid[y][x];
        if (colorId !== EMPTY) cleared.push({ x, y, colorId });
        this.grid[y][x] = EMPTY;
      }
    }
    return cleared;
  }

  /** True if a cleared line was all one color (scoring bonus). */
  lineIsMono(cells: BlastCell[]): boolean {
    if (cells.length === 0) return false;
    const c = cells[0].colorId;
    return cells.every((cell) => cell.colorId === c);
  }

  forEachCell(cb: (x: number, y: number, colorId: number) => void): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const c = this.grid[y][x];
        if (c !== EMPTY) cb(x, y, c);
      }
    }
  }

  countFilled(): number {
    let n = 0;
    this.forEachCell(() => n++);
    return n;
  }
}
