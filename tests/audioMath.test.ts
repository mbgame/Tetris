import { describe, it, expect, vi } from "vitest";
import { gainFor, jitter, VoiceLimiter } from "@/game/audio/audioMath";

describe("gainFor", () => {
  it("maps 0..100 volume to 0..1 gain", () => {
    expect(gainFor(0, false)).toBe(0);
    expect(gainFor(50, false)).toBe(0.5);
    expect(gainFor(100, false)).toBe(1);
  });
  it("mute forces gain 0", () => {
    expect(gainFor(80, true)).toBe(0);
  });
  it("clamps out-of-range volume", () => {
    expect(gainFor(150, false)).toBe(1);
    expect(gainFor(-20, false)).toBe(0);
  });
});

describe("jitter", () => {
  it("stays within ±pct", () => {
    for (let i = 0; i < 100; i++) {
      const j = jitter(0.05);
      expect(j).toBeGreaterThanOrEqual(0.95);
      expect(j).toBeLessThanOrEqual(1.05);
    }
  });
  it("is deterministic with a fixed rng", () => {
    expect(jitter(0.1, () => 0.5)).toBe(1); // midpoint → no change
    expect(jitter(0.1, () => 1)).toBeCloseTo(1.1);
    expect(jitter(0.1, () => 0)).toBeCloseTo(0.9);
  });
});

describe("VoiceLimiter", () => {
  it("evicts the oldest voice past the cap", () => {
    const stop = vi.fn();
    const lim = new VoiceLimiter<string>(3, stop);
    lim.add("a"); lim.add("b"); lim.add("c");
    expect(lim.count).toBe(3);
    lim.add("d"); // evicts "a"
    expect(stop).toHaveBeenCalledWith("a");
    expect(lim.count).toBe(3);
  });

  it("release removes an ended voice without stopping it", () => {
    const stop = vi.fn();
    const lim = new VoiceLimiter<string>(8, stop);
    lim.add("x");
    lim.release("x");
    expect(lim.count).toBe(0);
    expect(stop).not.toHaveBeenCalled();
  });
});
