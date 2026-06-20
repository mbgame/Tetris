import { describe, it, expect } from "vitest";
import { createRng } from "@/game/core/rng";
import { BLAST_SHAPES, randomPiece, randomBlob } from "@/game/blast/pieces";

describe("blast pieces", () => {
  it("all curated shapes are normalized to origin 0,0", () => {
    for (const s of BLAST_SHAPES) {
      const minX = Math.min(...s.cells.map((c) => c.x));
      const minY = Math.min(...s.cells.map((c) => c.y));
      expect(minX).toBe(0);
      expect(minY).toBe(0);
      expect(s.w).toBe(Math.max(...s.cells.map((c) => c.x)) + 1);
      expect(s.h).toBe(Math.max(...s.cells.map((c) => c.y)) + 1);
    }
  });

  it("randomBlob is connected, sized, and normalized", () => {
    const rng = createRng(123);
    const blob = randomBlob(5, rng);
    expect(blob.cells.length).toBe(5);
    expect(Math.min(...blob.cells.map((c) => c.x))).toBe(0);
    expect(Math.min(...blob.cells.map((c) => c.y))).toBe(0);
    // no duplicate cells
    const keys = new Set(blob.cells.map((c) => `${c.x},${c.y}`));
    expect(keys.size).toBe(5);
  });

  it("randomPiece is deterministic for a fixed seed", () => {
    const a = randomPiece(createRng(42), 0.5);
    const b = randomPiece(createRng(42), 0.5);
    expect(a.cells).toEqual(b.cells);
  });

  it("easy difficulty favors small shapes", () => {
    const rng = createRng(7);
    let smallCount = 0;
    for (let i = 0; i < 200; i++) {
      if (randomPiece(rng, 0).cells.length <= 3) smallCount++;
    }
    expect(smallCount).toBeGreaterThan(120); // majority small at difficulty 0
  });
});
