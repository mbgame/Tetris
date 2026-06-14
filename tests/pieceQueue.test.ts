import { describe, it, expect } from "vitest";
import { PieceQueue } from "@/game/core/PieceQueue";

describe("PieceQueue", () => {
  it("previews the next pieces (type + colour) matching the spawn order", () => {
    const q = new PieceQueue(4, { mode: "weighted" }, 1);
    const preview = q.preview(3);
    const first = q.spawnNext();
    expect(first.type).toBe(preview[0].type);
    expect(first.colorId).toBe(preview[0].colorId); // colour matches preview exactly
  });

  it("first hold stores current type and returns a new piece", () => {
    const q = new PieceQueue(4, { mode: "weighted" }, 2);
    const cur = q.spawnNext();
    expect(q.hold).toBeNull();
    const next = q.swapHold(cur);
    expect(next).not.toBeNull();
    expect(q.hold).toBe(cur.type);
    expect(next!.type).not.toBe(undefined);
  });

  it("second hold swaps the held type back in", () => {
    const q = new PieceQueue(4, { mode: "weighted" }, 3);
    const a = q.spawnNext();
    q.swapHold(a); // hold = a.type
    const b = q.spawnNext(); // fresh drop re-enables hold
    const back = q.swapHold(b);
    expect(back!.type).toBe(a.type); // got the held piece back
    expect(q.hold).toBe(b.type);
  });

  it("cannot hold twice before a lock", () => {
    const q = new PieceQueue(4, { mode: "weighted" }, 4);
    const cur = q.spawnNext();
    expect(q.canHold).toBe(true);
    const swapped = q.swapHold(cur)!;
    expect(q.canHold).toBe(false);
    expect(q.swapHold(swapped)).toBeNull(); // locked out
  });

  it("re-enables hold on the next spawn", () => {
    const q = new PieceQueue(4, { mode: "weighted" }, 5);
    const cur = q.spawnNext();
    q.swapHold(cur);
    expect(q.canHold).toBe(false);
    q.spawnNext();
    expect(q.canHold).toBe(true);
  });
});
