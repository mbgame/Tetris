import { Board, WIDTH, HEIGHT, EMPTY } from "./Board";

/**
 * Clear-rule strategy — pure logic, NO Phaser imports. This encodes THE core
 * rule (docs/01 §4):
 *   - 'color'   → a row clears iff it is full AND all cells share one color.
 *   - 'classic' → any full row clears (accessibility mode).
 */
export type ClearMode = "color" | "classic";

/** True if the row is full and every cell is the same color. */
export function isRowMono(board: Board, y: number): boolean {
  if (!board.isRowFull(y)) return false;
  const first = board.get(0, y);
  if (first === EMPTY) return false;
  for (let x = 1; x < WIDTH; x++) {
    if (board.get(x, y) !== first) return false;
  }
  return true;
}

/** Row indices that should clear under the given mode (top→bottom order). */
export function getClearableRows(board: Board, mode: ClearMode): number[] {
  const rows: number[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    if (!board.isRowFull(y)) continue;
    if (mode === "classic" || isRowMono(board, y)) rows.push(y);
  }
  return rows;
}

/**
 * Rows one block away from a mono-color clear: exactly one empty cell and every
 * filled cell shares a color. Drives the telegraph glow (docs/03 §2).
 */
export function getTelegraphRows(board: Board): number[] {
  const rows: number[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    let empties = 0;
    let color = 0;
    let mono = true;
    for (let x = 0; x < WIDTH; x++) {
      const c = board.get(x, y);
      if (c === EMPTY) {
        empties++;
      } else if (color === 0) {
        color = c;
      } else if (c !== color) {
        mono = false;
        break;
      }
    }
    if (mono && empties === 1 && color !== 0) rows.push(y);
  }
  return rows;
}
