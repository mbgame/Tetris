import type { GamePhase } from "../state/EventNames";

/**
 * Finite state machine for the game flow (docs/01 §5) — pure logic, NO Phaser
 * imports. GameScene/SceneFlow drives it and mirrors changes onto the event bus.
 *
 *   BOOT → MENU → LEVEL_SELECT → COUNTDOWN → PLAYING
 *   PLAYING ↔ PAUSED
 *   PLAYING → LINE_CLEAR → PLAYING
 *   PLAYING → LEVEL_COMPLETE → (COUNTDOWN next | VICTORY)
 *   PLAYING → GAME_OVER → (MENU | COUNTDOWN retry)
 */
const TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  BOOT: ["MENU"],
  MENU: ["LEVEL_SELECT", "COUNTDOWN"],
  LEVEL_SELECT: ["COUNTDOWN", "MENU"],
  COUNTDOWN: ["PLAYING"],
  PLAYING: ["PAUSED", "LINE_CLEAR", "LEVEL_COMPLETE", "GAME_OVER", "MENU"],
  PAUSED: ["PLAYING", "MENU", "COUNTDOWN"],
  LINE_CLEAR: ["PLAYING", "LEVEL_COMPLETE", "GAME_OVER"],
  LEVEL_COMPLETE: ["COUNTDOWN", "VICTORY", "MENU"],
  GAME_OVER: ["COUNTDOWN", "MENU"],
  VICTORY: ["MENU"],
};

export class GameState {
  private _state: GamePhase;

  constructor(
    initial: GamePhase = "BOOT",
    private onChange?: (next: GamePhase, prev: GamePhase) => void,
  ) {
    this._state = initial;
  }

  get state(): GamePhase {
    return this._state;
  }

  canTransition(to: GamePhase): boolean {
    return TRANSITIONS[this._state].includes(to);
  }

  /** Transition if allowed; returns true on success. Throws on illegal moves. */
  transition(to: GamePhase): boolean {
    if (!this.canTransition(to)) {
      throw new Error(`Illegal transition: ${this._state} → ${to}`);
    }
    const prev = this._state;
    this._state = to;
    this.onChange?.(to, prev);
    return true;
  }

  is(state: GamePhase): boolean {
    return this._state === state;
  }
}
