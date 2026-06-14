import { describe, it, expect } from "vitest";
import { Board, WIDTH, HEIGHT, EMPTY } from "@/game/core/Board";
import { spawnPiece, pieceCells } from "@/game/core/Piece";

describe("Board", () => {
  it("starts empty", () => {
    const b = new Board();
    let filled = 0;
    b.forEachCell(() => filled++);
    expect(filled).toBe(0);
    expect(b.get(0, 0)).toBe(EMPTY);
  });

  it("treats walls and floor as occupied, space above as free", () => {
    const b = new Board();
    expect(b.isOccupied(-1, 5)).toBe(true); // left wall
    expect(b.isOccupied(WIDTH, 5)).toBe(true); // right wall
    expect(b.isOccupied(3, HEIGHT)).toBe(true); // floor
    expect(b.isOccupied(3, -1)).toBe(false); // above board
    expect(b.isOccupied(3, 5)).toBe(false); // empty cell
  });

  it("lock writes the piece cells with its colorId", () => {
    const b = new Board();
    const p = spawnPiece("T", 4);
    b.lock(p);
    for (const cell of pieceCells(p)) {
      expect(b.get(cell.x, cell.y)).toBe(4);
    }
    let filled = 0;
    b.forEachCell(() => filled++);
    expect(filled).toBe(4);
  });

  it("collides against the floor and filled cells", () => {
    const b = new Board();
    // piece sitting at the very bottom, pushed one past floor → collide
    const below = { type: "O" as const, colorId: 1, rot: 0 as const, x: 4, y: HEIGHT - 1 };
    expect(b.collides(below)).toBe(true);

    const resting = { type: "O" as const, colorId: 1, rot: 0 as const, x: 4, y: HEIGHT - 2 };
    expect(b.collides(resting)).toBe(false);
    b.lock(resting);
    // same spot now occupied
    expect(b.collides(resting)).toBe(true);
  });

  it("raiseGarbage pushes the stack up and adds a floor row", () => {
    const b = new Board();
    b.set(0, HEIGHT - 1, 5); // a block on the floor
    const junk = new Array(WIDTH).fill(2);
    junk[3] = 0; // gap
    const overflow = b.raiseGarbage(junk);
    expect(overflow).toBe(false);
    expect(b.get(0, HEIGHT - 2)).toBe(5); // old floor block moved up one
    expect(b.get(3, HEIGHT - 1)).toBe(0); // gap at bottom
    expect(b.get(0, HEIGHT - 1)).toBe(2); // junk filled
  });

  it("raiseGarbage reports overflow when the top row had blocks", () => {
    const b = new Board();
    b.set(0, 0, 7); // block in the very top row
    expect(b.raiseGarbage(new Array(WIDTH).fill(1))).toBe(true);
  });

  it("detects a full row", () => {
    const b = new Board();
    const y = HEIGHT - 1;
    for (let x = 0; x < WIDTH; x++) b.set(x, y, 2);
    expect(b.isRowFull(y)).toBe(true);
    b.set(3, y, EMPTY);
    expect(b.isRowFull(y)).toBe(false);
  });
});
