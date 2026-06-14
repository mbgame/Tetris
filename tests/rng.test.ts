import { describe, it, expect } from "vitest";
import { createRng, SevenBag, ColorSelector } from "@/game/core/rng";
import { PIECE_TYPES } from "@/game/core/Piece";

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0,1)", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("SevenBag", () => {
  it("yields each tetromino exactly once per 7 draws", () => {
    const bag = new SevenBag(createRng(99));
    const draws = Array.from({ length: 7 }, () => bag.next());
    expect(new Set(draws).size).toBe(7);
    for (const t of PIECE_TYPES) expect(draws).toContain(t);
  });

  it("peek does not desync from next", () => {
    const bag = new SevenBag(createRng(42));
    const peeked = bag.peek(3);
    expect([bag.next(), bag.next(), bag.next()]).toEqual(peeked);
  });

  it("is deterministic for a seed", () => {
    const a = new SevenBag(createRng(5));
    const b = new SevenBag(createRng(5));
    const seqA = Array.from({ length: 21 }, () => a.next());
    const seqB = Array.from({ length: 21 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
});

describe("ColorSelector", () => {
  it("never returns the same color more than 3 times in a row", () => {
    const sel = new ColorSelector(4, { mode: "weighted" }, createRng(123));
    let run = 1;
    let prev = sel.next();
    for (let i = 0; i < 1000; i++) {
      const c = sel.next();
      run = c === prev ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(3);
      prev = c;
    }
  });

  it("uses the whole palette with sane distribution over 1000 draws", () => {
    const sel = new ColorSelector(4, { mode: "weighted" }, createRng(321));
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 1000; i++) counts[sel.next() - 1]++;
    for (const n of counts) expect(n).toBeGreaterThan(100); // none starved
  });

  it("bag mode is deterministic for a seed", () => {
    const a = new ColorSelector(5, { mode: "bag" }, createRng(8));
    const b = new ColorSelector(5, { mode: "bag" }, createRng(8));
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("single-color palette always returns color 1", () => {
    const sel = new ColorSelector(1, { mode: "weighted" }, createRng(1));
    for (let i = 0; i < 10; i++) expect(sel.next()).toBe(1);
  });
});
