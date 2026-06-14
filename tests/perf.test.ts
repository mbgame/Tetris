import { describe, it, expect } from "vitest";
import { pickTier } from "@/game/perf/benchmark";
import { TIERS, knobs } from "@/game/perf/tiers";

describe("pickTier", () => {
  it("maps frame time to tier", () => {
    expect(pickTier(8)).toBe("ultra");
    expect(pickTier(14)).toBe("high");
    expect(pickTier(20)).toBe("medium");
    expect(pickTier(40)).toBe("low");
  });
  it("boundaries", () => {
    expect(pickTier(11)).toBe("ultra");
    expect(pickTier(16.7)).toBe("high");
    expect(pickTier(24)).toBe("medium");
    expect(pickTier(24.1)).toBe("low");
  });
});

describe("tier knobs", () => {
  it("fidelity rises with tier", () => {
    const order = ["low", "medium", "high", "ultra"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(TIERS[order[i]].grainsPerCell).toBeGreaterThan(TIERS[order[i - 1]].grainsPerCell);
      expect(TIERS[order[i]].bgScale).toBeGreaterThanOrEqual(TIERS[order[i - 1]].bgScale);
    }
  });
  it("low disables the dissolve shader (scale-out)", () => {
    expect(knobs("low").dissolveSubdiv).toBe(0);
    expect(knobs("ultra").dissolveSubdiv).toBeGreaterThan(0);
  });
  it("low disables shake + bloom", () => {
    expect(knobs("low").shake).toBe(false);
    expect(knobs("low").bloom).toBe(0);
  });
});
