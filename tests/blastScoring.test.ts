import { describe, it, expect } from "vitest";
import { placementScore, clearScore } from "@/game/blast/scoring";

describe("blast scoring", () => {
  it("placement scores one point per cell", () => {
    expect(placementScore(1)).toBe(1);
    expect(placementScore(5)).toBe(5);
  });

  it("no clear scores nothing", () => {
    expect(clearScore(0, 0)).toBe(0);
  });

  it("single line: base only", () => {
    expect(clearScore(1, 0)).toBe(80);
  });

  it("simultaneous lines multiply by line count", () => {
    // 2 lines: 80 * 2 * 2 = 320
    expect(clearScore(2, 0)).toBe(320);
  });

  it("mono lines add a per-line bonus", () => {
    expect(clearScore(1, 1)).toBe(80 + 50);
    expect(clearScore(2, 2)).toBe(320 + 100);
  });
});
