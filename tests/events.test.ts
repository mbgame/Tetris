import { describe, it, expect, vi } from "vitest";
import { bus } from "@/game/state/events";
import { EventName, InputAction } from "@/game/state/EventNames";
import type { ScoreUpdatePayload } from "@/game/state/EventNames";

describe("event bus", () => {
  it("delivers typed payloads to listeners", () => {
    const handler = vi.fn();
    bus.on(EventName.ScoreUpdate, handler);

    const payload: ScoreUpdatePayload = {
      score: 1200,
      level: 1,
      lines: 3,
      linesToTarget: 7,
      combo: 2,
      b2b: 0,
    };
    bus.emit(EventName.ScoreUpdate, payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
    bus.off(EventName.ScoreUpdate, handler);
  });

  it("relays input action intents (React → game)", () => {
    const handler = vi.fn();
    bus.on(EventName.InputAction, handler);
    bus.emit(EventName.InputAction, { action: InputAction.HardDrop, pressed: true });
    expect(handler).toHaveBeenCalledWith({ action: "HARD_DROP", pressed: true });
    bus.off(EventName.InputAction, handler);
  });
});
