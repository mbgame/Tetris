import { describe, it, expect } from "vitest";
import { BlastBoard, BLAST_SIZE, EMPTY } from "@/game/blast/BlastBoard";

const square2 = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

describe("BlastBoard", () => {
  it("starts empty at the default size", () => {
    const b = new BlastBoard();
    expect(b.size).toBe(BLAST_SIZE);
    expect(b.countFilled()).toBe(0);
    expect(b.get(0, 0)).toBe(EMPTY);
  });

  it("canPlace respects bounds and occupancy", () => {
    const b = new BlastBoard();
    expect(b.canPlace(square2, 0, 0)).toBe(true);
    expect(b.canPlace(square2, b.size - 1, 0)).toBe(false); // runs off the right edge
    b.place(square2, 0, 0, 1);
    expect(b.canPlace(square2, 0, 0)).toBe(false); // now occupied
  });

  it("place writes the shape with the given color", () => {
    const b = new BlastBoard();
    b.place(square2, 2, 3, 4);
    expect(b.get(2, 3)).toBe(4);
    expect(b.get(3, 4)).toBe(4);
    expect(b.countFilled()).toBe(4);
  });

  it("detects full rows and columns", () => {
    const b = new BlastBoard();
    for (let x = 0; x < b.size; x++) b.set(x, 0, 1); // fill row 0
    for (let y = 0; y < b.size; y++) b.set(0, y, 2); // fill column 0
    const { rows, cols } = b.getFullLines();
    expect(rows).toEqual([0]);
    expect(cols).toEqual([0]);
  });

  it("clearLines empties rows+cols and reports cleared cells once", () => {
    const b = new BlastBoard();
    for (let x = 0; x < b.size; x++) b.set(x, 0, 1);
    for (let y = 0; y < b.size; y++) b.set(0, y, 1);
    const { rows, cols } = b.getFullLines();
    const cleared = b.clearLines(rows, cols);
    // row (size) + column (size) − 1 shared intersection cell
    expect(cleared.length).toBe(b.size * 2 - 1);
    expect(b.countFilled()).toBe(0);
  });

  it("fitsAnywhere is false on a full board", () => {
    const b = new BlastBoard();
    for (let y = 0; y < b.size; y++) for (let x = 0; x < b.size; x++) b.set(x, y, 1);
    expect(b.fitsAnywhere([{ x: 0, y: 0 }])).toBe(false);
  });

  it("lineIsMono only when all colors match", () => {
    const b = new BlastBoard();
    expect(b.lineIsMono([{ x: 0, y: 0, colorId: 1 }, { x: 1, y: 0, colorId: 1 }])).toBe(true);
    expect(b.lineIsMono([{ x: 0, y: 0, colorId: 1 }, { x: 1, y: 0, colorId: 2 }])).toBe(false);
  });
});
