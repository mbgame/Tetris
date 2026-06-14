import Phaser from "phaser";
import { InputAction } from "../state/EventNames";

export interface InputTiming {
  das: number; // delayed auto shift (ms)
  arr: number; // auto repeat rate (ms)
  softDropMs: number; // soft-drop step interval
}

type Emit = (action: InputAction) => void;

const KEYS: Record<string, string[]> = {
  left: ["LEFT", "A"],
  right: ["RIGHT", "D"],
  soft: ["DOWN", "S"],
  hard: ["SPACE", "W"],
  rotcw: ["UP", "X", "K"],
  rotccw: ["Z", "J"],
  hold: ["C", "SHIFT"],
  pause: ["ESC", "P"],
};

/**
 * Keyboard → action translation with DAS/ARR auto-shift. Polled from the scene's
 * update loop. Movement repeats are handled here; one-shot actions (rotate, hard
 * drop, hold, pause) fire on the key-down edge. Devices other than the keyboard
 * (touch, gamepad) emit the same InputActions via the event bus.
 */
export class InputController {
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private lastDir: -1 | 0 | 1 = 0;
  private charge = 0;
  private repeating = false;
  private softCharge = 0;

  constructor(
    private scene: Phaser.Scene,
    private getTiming: () => InputTiming,
    private emit: Emit,
  ) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    for (const [action, names] of Object.entries(KEYS)) {
      this.keys[action] = names.map((n) => kb.addKey(n));
    }
  }

  private isDown(action: string): boolean {
    return (this.keys[action] ?? []).some((k) => k.isDown);
  }
  private justDown(action: string): boolean {
    return (this.keys[action] ?? []).some((k) => Phaser.Input.Keyboard.JustDown(k));
  }

  update(_time: number, delta: number): void {
    const { das, arr, softDropMs } = this.getTiming();
    this.handleDirection(das, arr, delta);

    if (this.isDown("soft")) {
      this.softCharge += delta;
      if (this.softCharge >= softDropMs) {
        this.emit(InputAction.SoftDrop);
        this.softCharge = 0;
      }
    } else {
      this.softCharge = 0;
    }

    if (this.justDown("rotcw")) this.emit(InputAction.RotateCW);
    if (this.justDown("rotccw")) this.emit(InputAction.RotateCCW);
    if (this.justDown("hard")) this.emit(InputAction.HardDrop);
    if (this.justDown("hold")) this.emit(InputAction.Hold);
    if (this.justDown("pause")) this.emit(InputAction.Pause);
  }

  private handleDirection(das: number, arr: number, delta: number): void {
    const L = this.isDown("left");
    const R = this.isDown("right");
    const dir: -1 | 0 | 1 = L && !R ? -1 : R && !L ? 1 : 0;

    if (dir === 0) {
      this.lastDir = 0;
      this.charge = 0;
      this.repeating = false;
      return;
    }
    if (dir !== this.lastDir) {
      // fresh press → immediate move, then wait DAS before repeating
      this.emit(dir < 0 ? InputAction.MoveLeft : InputAction.MoveRight);
      this.lastDir = dir;
      this.charge = 0;
      this.repeating = false;
      return;
    }
    this.charge += delta;
    if (!this.repeating) {
      if (this.charge >= das) {
        this.emit(dir < 0 ? InputAction.MoveLeft : InputAction.MoveRight);
        this.repeating = true;
        this.charge = 0;
      }
    } else if (this.charge >= arr) {
      this.emit(dir < 0 ? InputAction.MoveLeft : InputAction.MoveRight);
      this.charge = 0;
    }
  }
}
