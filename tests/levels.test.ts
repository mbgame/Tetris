import { describe, it, expect } from "vitest";
import { LEVELS, LEVEL_COUNT, getLevel } from "@/game/levels/levels";

describe("LEVELS", () => {
  it("defines 10 levels with sequential ids 1..10", () => {
    expect(LEVEL_COUNT).toBe(10);
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("color count rises 2→7 across levels", () => {
    expect(LEVELS.map((l) => l.colors.length)).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 7]);
  });

  it("gravity gets faster every level", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].gravityMs).toBeLessThan(LEVELS[i - 1].gravityMs);
    }
  });

  it("each palette has unique color ids 1..N and a glyph", () => {
    for (const lvl of LEVELS) {
      const ids = lvl.colors.map((c) => c.id);
      expect(ids).toEqual(lvl.colors.map((_, i) => i + 1));
      expect(lvl.colors.every((c) => c.glyph.length > 0 && c.hex.startsWith("#"))).toBe(true);
    }
  });

  it("hazards match the design table", () => {
    expect(getLevel(5).garbage?.prefillRows).toBe(2);
    expect(getLevel(6).garbage?.prefillRows).toBe(3);
    expect(getLevel(7).garbage?.risePeriodMs).toBe(18000);
    expect(getLevel(9).colorBagRule).toBe("shuffleEveryN");
    expect(getLevel(9).shuffleEveryN).toBe(12);
  });

  it("getLevel throws for unknown id", () => {
    expect(() => getLevel(99)).toThrow();
  });
});
