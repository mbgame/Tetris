import { describe, it, expect } from "vitest";
import { Scorer } from "@/game/core/scoring";

describe("Scorer", () => {
  it("single mono clear at level 1 = floor(100*1.5) = 150", () => {
    const s = new Scorer();
    const r = s.clear(1, 1);
    expect(r.gained).toBe(150);
    expect(r.combo).toBe(0);
    expect(r.b2b).toBe(false);
    expect(s.score).toBe(150);
  });

  it("double clear at level 2 = floor(300*2*1.5) = 900", () => {
    const s = new Scorer();
    expect(s.clear(2, 2).gained).toBe(900);
  });

  it("back-to-back doubles apply the 1.5× b2b multiplier", () => {
    const s = new Scorer();
    const first = s.clear(2, 1); // 300*1.5 = 450, combo 0
    expect(first.gained).toBe(450);
    expect(first.b2b).toBe(false);

    const second = s.clear(2, 1); // floor(300*1.5*1.5)=675 + combo(50*1*1)=50 = 725
    expect(second.b2b).toBe(true);
    expect(second.gained).toBe(725);
  });

  it("combo grows across consecutive clears and resets on a dry lock", () => {
    const s = new Scorer();
    s.clear(1, 1); // combo 0
    const c2 = s.clear(1, 1); // combo 1 → bonus 50
    expect(c2.combo).toBe(1);
    expect(c2.gained).toBe(150 + 50);
    s.lockWithoutClear();
    const c3 = s.clear(1, 1); // combo back to 0
    expect(c3.combo).toBe(0);
    expect(c3.gained).toBe(150);
  });

  it("3×3 square clear scores and advances combo", () => {
    const s = new Scorer();
    const r = s.square(1, 1); // floor(250*1*1.5)=375, combo 0
    expect(r.gained).toBe(375);
    expect(r.combo).toBe(0);
    const r2 = s.square(2, 1); // floor(250*2*1.5)=750 + combo(50*1)=50 = 800
    expect(r2.gained).toBe(800);
  });

  it("soft/hard drop points accumulate", () => {
    const s = new Scorer();
    s.softDrop(5); // +5
    s.hardDrop(10); // +20
    expect(s.score).toBe(25);
  });

  it("a single clear after a multi does not get b2b", () => {
    const s = new Scorer();
    s.clear(2, 1); // multi
    const r = s.clear(1, 1); // single → no b2b
    expect(r.b2b).toBe(false);
  });
});
