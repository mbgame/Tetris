import mitt, { type Emitter } from "mitt";
import type { GameEvents } from "./EventNames";

/**
 * Single app-wide event bus connecting Phaser game code and React UI.
 *
 * Import the same `bus` from either side; payloads are type-checked against
 * `GameEvents`. Phaser is NOT imported here so React/server bundles stay light.
 */
export const bus: Emitter<GameEvents> = mitt<GameEvents>();

export type { GameEvents };
