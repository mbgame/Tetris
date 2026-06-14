import { describe, it, expect } from "vitest";
import { Board } from "@/game/core/Board";
import { tryRotate } from "@/game/core/srs";
import { pieceCells, type ActivePiece } from "@/game/core/Piece";

const sortCells = (p: ActivePiece) =>
  pieceCells(p)
    .map((c) => [c.x, c.y])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);

describe("SRS rotation + kicks", () => {
  it("rotates T CW in open space (no kick)", () => {
    const b = new Board();
    const t: ActivePiece = { type: "T", colorId: 1, rot: 0, x: 4, y: 10 };
    const r = tryRotate(b, t, 1);
    expect(r).not.toBeNull();
    expect(r!.rot).toBe(1);
    expect(r!.x).toBe(4);
    expect(r!.y).toBe(10);
    // state 1 local: (1,0)(1,1)(2,1)(1,2)
    expect(sortCells(r!)).toEqual([[5, 10], [5, 11], [6, 11], [5, 12]].sort((a, b) => a[1] - b[1] || a[0] - b[0]));
  });

  it("T wall-kicks up off the floor (offset [-1,+1])", () => {
    const b = new Board();
    // box at (4,20): naive CW rotation pushes a cell to y=22 (below floor) → must kick
    const t: ActivePiece = { type: "T", colorId: 1, rot: 0, x: 4, y: 20 };
    const r = tryRotate(b, t, 1);
    expect(r).not.toBeNull();
    expect(r!.rot).toBe(1);
    expect(r!.x).toBe(3); // dx -1
    expect(r!.y).toBe(19); // dy +1 (y-up) → board y - 1
  });

  it("I-piece kicks off the floor per SRS (0→1 offset [1,+2])", () => {
    const b = new Board();
    const i: ActivePiece = { type: "I", colorId: 1, rot: 0, x: 3, y: 19 };
    const r = tryRotate(b, i, 1);
    expect(r).not.toBeNull();
    expect(r!.rot).toBe(1);
    expect(r!.x).toBe(4); // dx +1
    expect(r!.y).toBe(17); // dy +2 (y-up) → board y - 2
  });

  it("returns null when no kick resolves the collision", () => {
    const b = new Board();
    // fill a column band so a rotating I has nowhere to go
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < 10; x++) {
        if (x !== 4) b.set(x, y, 9);
      }
    }
    // vertical I sitting in the single open column; rotating to horizontal collides everywhere
    const i: ActivePiece = { type: "I", colorId: 1, rot: 1, x: 2, y: 8 };
    expect(tryRotate(b, i, 1)).toBeNull();
  });
});
