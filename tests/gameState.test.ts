import { describe, it, expect, vi } from "vitest";
import { GameState } from "@/game/core/GameState";

describe("GameState FSM", () => {
  it("walks the full happy path BOOT→…→VICTORY", () => {
    const g = new GameState("BOOT");
    const path = [
      "MENU", "LEVEL_SELECT", "COUNTDOWN", "PLAYING",
      "LINE_CLEAR", "PLAYING", "LEVEL_COMPLETE", "VICTORY",
    ] as const;
    for (const s of path) expect(g.transition(s)).toBe(true);
    expect(g.is("VICTORY")).toBe(true);
  });

  it("supports pause/resume", () => {
    const g = new GameState("PLAYING");
    g.transition("PAUSED");
    expect(g.is("PAUSED")).toBe(true);
    g.transition("PLAYING");
    expect(g.is("PLAYING")).toBe(true);
  });

  it("LEVEL_COMPLETE can advance to COUNTDOWN (next level) or VICTORY", () => {
    const a = new GameState("LEVEL_COMPLETE");
    expect(a.canTransition("COUNTDOWN")).toBe(true);
    expect(a.canTransition("VICTORY")).toBe(true);
  });

  it("GAME_OVER retries via COUNTDOWN", () => {
    const g = new GameState("GAME_OVER");
    expect(g.canTransition("COUNTDOWN")).toBe(true);
    g.transition("COUNTDOWN");
    expect(g.is("COUNTDOWN")).toBe(true);
  });

  it("throws on illegal transitions", () => {
    const g = new GameState("BOOT");
    expect(() => g.transition("PLAYING")).toThrow(/Illegal transition/);
  });

  it("fires onChange with next + prev", () => {
    const cb = vi.fn();
    const g = new GameState("BOOT", cb);
    g.transition("MENU");
    expect(cb).toHaveBeenCalledWith("MENU", "BOOT");
  });
});
