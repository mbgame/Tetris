import { describe, it, expect } from "vitest";
import { Board, HEIGHT, WIDTH } from "@/game/core/Board";
import { spawnPiece } from "@/game/core/Piece";
import { dropPosition } from "@/game/render/GhostPiece";

describe("dropPosition", () => {
  it("drops a piece to the floor on an empty board", () => {
    const b = new Board();
    const p = spawnPiece("O", 1); // O box top-left at (4,0), cells in rows 0-1
    const landed = dropPosition(b, p);
    // O occupies box rows 0-1; bottom cell must rest on the last row
    expect(landed.y).toBe(HEIGHT - 2);
  });

  it("rests on top of existing blocks", () => {
    const b = new Board();
    for (let x = 0; x < WIDTH; x++) b.set(x, HEIGHT - 1, 3); // fill bottom row
    const p = spawnPiece("O", 1);
    const landed = dropPosition(b, p);
    expect(landed.y).toBe(HEIGHT - 3); // sits one row above the filled floor
  });

  it("does not move a piece already resting", () => {
    const b = new Board();
    const p = { ...spawnPiece("O", 1), y: HEIGHT - 2 };
    expect(dropPosition(b, p).y).toBe(HEIGHT - 2);
  });
});
