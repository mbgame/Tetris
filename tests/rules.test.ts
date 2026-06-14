import { describe, it, expect } from "vitest";
import { Board, WIDTH, HEIGHT, EMPTY } from "@/game/core/Board";
import { getClearableRows, isRowMono, getTelegraphRows } from "@/game/core/rules";

const fillRow = (b: Board, y: number, colors: number[]) => {
  for (let x = 0; x < WIDTH; x++) b.set(x, y, colors[x]);
};
const mono = (c: number) => new Array(WIDTH).fill(c);

describe("rules — getClearableRows", () => {
  it("color mode: a full mono row clears", () => {
    const b = new Board();
    fillRow(b, HEIGHT - 1, mono(3));
    expect(getClearableRows(b, "color")).toEqual([HEIGHT - 1]);
  });

  it("color mode: a full MIXED row does NOT clear", () => {
    const b = new Board();
    const mixed = mono(3);
    mixed[5] = 2; // one different color
    fillRow(b, HEIGHT - 1, mixed);
    expect(isRowMono(b, HEIGHT - 1)).toBe(false);
    expect(getClearableRows(b, "color")).toEqual([]);
  });

  it("classic mode: a full mixed row DOES clear", () => {
    const b = new Board();
    const mixed = mono(3);
    mixed[5] = 2;
    fillRow(b, HEIGHT - 1, mixed);
    expect(getClearableRows(b, "classic")).toEqual([HEIGHT - 1]);
  });

  it("color mode: detects multiple simultaneous mono rows", () => {
    const b = new Board();
    fillRow(b, HEIGHT - 1, mono(1));
    fillRow(b, HEIGHT - 2, mono(4));
    fillRow(b, HEIGHT - 3, mono(1));
    expect(getClearableRows(b, "color")).toEqual([HEIGHT - 3, HEIGHT - 2, HEIGHT - 1]);
  });

  it("a non-full row never clears", () => {
    const b = new Board();
    const partial = mono(3);
    partial[0] = EMPTY;
    fillRow(b, HEIGHT - 1, partial);
    expect(getClearableRows(b, "color")).toEqual([]);
    expect(getClearableRows(b, "classic")).toEqual([]);
  });
});

describe("rules — getTelegraphRows", () => {
  it("flags a row one block from a mono clear", () => {
    const b = new Board();
    const near = mono(3);
    near[4] = 0; // one gap, rest mono
    fillRow(b, HEIGHT - 1, near);
    expect(getTelegraphRows(b)).toEqual([HEIGHT - 1]);
  });

  it("does not flag a one-gap row of mixed colors", () => {
    const b = new Board();
    const near = mono(3);
    near[4] = 0;
    near[2] = 2; // mixed
    fillRow(b, HEIGHT - 1, near);
    expect(getTelegraphRows(b)).toEqual([]);
  });

  it("does not flag a full row or a two-gap row", () => {
    const b = new Board();
    fillRow(b, HEIGHT - 1, mono(3)); // full
    const twoGap = mono(3);
    twoGap[1] = 0; twoGap[5] = 0;
    fillRow(b, HEIGHT - 2, twoGap);
    expect(getTelegraphRows(b)).toEqual([]);
  });
});

describe("Board.clearRows — collapse", () => {
  it("removes a single row and drops blocks above", () => {
    const b = new Board();
    b.set(2, HEIGHT - 2, 7); // a floating block above the row to clear
    fillRow(b, HEIGHT - 1, mono(3));

    const cleared = b.clearRows([HEIGHT - 1]);
    expect(cleared).toHaveLength(WIDTH);
    expect(cleared.every((c) => c.colorId === 3)).toBe(true);

    // bottom row now holds the collapsed block; old row gone
    expect(b.get(2, HEIGHT - 1)).toBe(7);
    let filled = 0;
    b.forEachCell(() => filled++);
    expect(filled).toBe(1);
  });

  it("handles multiple non-contiguous clears", () => {
    const b = new Board();
    fillRow(b, HEIGHT - 1, mono(1)); // clear
    fillRow(b, HEIGHT - 2, [1, 2, 1, 1, 1, 1, 1, 1, 1, 1]); // survives (mixed/partial-ish, but full mixed)
    fillRow(b, HEIGHT - 3, mono(4)); // clear
    b.set(0, HEIGHT - 4, 5); // a block on top

    b.clearRows([HEIGHT - 1, HEIGHT - 3]);

    // survivors (the mixed row + top block) fall down by the cleared count below them
    // mixed row was at HEIGHT-2 with one clear below it → drops 1 → HEIGHT-1
    expect(b.get(1, HEIGHT - 1)).toBe(2);
    // top block had two clears below → drops 2 → HEIGHT-2
    expect(b.get(0, HEIGHT - 2)).toBe(5);
  });

  it("clearRows([]) is a no-op", () => {
    const b = new Board();
    fillRow(b, HEIGHT - 1, mono(3));
    expect(b.clearRows([])).toEqual([]);
    expect(b.isRowFull(HEIGHT - 1)).toBe(true);
  });
});
