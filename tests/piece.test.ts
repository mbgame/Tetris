import { describe, it, expect } from "vitest";
import { spawnPiece, pieceCells, PIECE_TYPES, type PieceType } from "@/game/core/Piece";

/** Expected absolute cells in spawn orientation (state 0). */
const EXPECTED: Record<PieceType, [number, number][]> = {
  I: [[3, 1], [4, 1], [5, 1], [6, 1]],
  O: [[5, 0], [6, 0], [5, 1], [6, 1]],
  T: [[4, 0], [3, 1], [4, 1], [5, 1]],
  S: [[4, 0], [5, 0], [3, 1], [4, 1]],
  Z: [[3, 0], [4, 0], [4, 1], [5, 1]],
  J: [[3, 0], [3, 1], [4, 1], [5, 1]],
  L: [[5, 0], [3, 1], [4, 1], [5, 1]],
};

const sortCells = (cells: { x: number; y: number }[]) =>
  cells.map((c) => [c.x, c.y]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);

describe("Piece spawn orientation", () => {
  for (const type of PIECE_TYPES) {
    it(`${type} spawns with correct cells`, () => {
      const cells = sortCells(pieceCells(spawnPiece(type, 1)));
      const expected = [...EXPECTED[type]].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      expect(cells).toEqual(expected);
    });
  }

  it("every piece occupies exactly 4 cells", () => {
    for (const type of PIECE_TYPES) {
      expect(pieceCells(spawnPiece(type, 1))).toHaveLength(4);
    }
  });
});
