/**
 * Typed event contract shared by game (Phaser) and React UI.
 *
 * Game logic is the source of truth: it EMITS snapshots (game → React) and
 * LISTENS for intents (React → game). Both sides import these names + payload
 * types so they can never disagree on the wire format.
 *
 * Keep this file Phaser-free and React-free — it is a pure contract.
 */

// ── Input actions (device-agnostic; see docs/07 §1) ────────────────────────
export const InputAction = {
  MoveLeft: "MOVE_LEFT",
  MoveRight: "MOVE_RIGHT",
  SoftDrop: "SOFT_DROP",
  HardDrop: "HARD_DROP",
  RotateCW: "ROTATE_CW",
  RotateCCW: "ROTATE_CCW",
  Hold: "HOLD",
  Pause: "PAUSE",
} as const;
export type InputAction = (typeof InputAction)[keyof typeof InputAction];

// ── Event names ─────────────────────────────────────────────────────────────
export const EventName = {
  // game → React (HUD / menus)
  ScoreUpdate: "score:update",
  LevelChange: "level:change",
  ComboUpdate: "combo:update",
  QueueUpdate: "queue:update",
  HoldUpdate: "hold:update",
  StateChange: "state:change",
  LinesCleared: "lines:cleared",
  GameOver: "game:over",
  LevelComplete: "level:complete",
  Victory: "victory",

  // React → game (intents)
  InputAction: "input:action",
  SettingsChange: "settings:change",
  RequestPause: "request:pause",
  RequestResume: "request:resume",
  RequestRestart: "request:restart",
  RequestStartLevel: "request:start-level",
  RequestQuit: "request:quit",

  // audio
  Sfx: "sfx",
} as const;
export type EventName = (typeof EventName)[keyof typeof EventName];

// ── Payload types ───────────────────────────────────────────────────────────
export interface ScoreUpdatePayload {
  score: number;
  level: number;
  /** mono-color lines cleared so far this level */
  lines: number;
  /** lines remaining to clear the current level target */
  linesToTarget: number;
  combo: number;
  b2b: number;
}

export interface LevelChangePayload {
  level: number;
  name: string;
  /** SceneTheme key for the background shader (see levels.ts). */
  theme: string;
  /** 0..1 background dim so blocks pop. */
  bgDim: number;
}

export interface ComboUpdatePayload {
  combo: number;
  b2b: number;
}

/** Next-N queue + hold slot, as tetromino type ids ("I","O","T",…). */
export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export interface QueueUpdatePayload {
  next: PieceType[];
}

export interface HoldUpdatePayload {
  piece: PieceType | null;
  /** false while a hold is locked out until the next lock */
  canHold: boolean;
}

export type GamePhase =
  | "BOOT"
  | "MENU"
  | "LEVEL_SELECT"
  | "COUNTDOWN"
  | "PLAYING"
  | "PAUSED"
  | "LINE_CLEAR"
  | "LEVEL_COMPLETE"
  | "GAME_OVER"
  | "VICTORY";

export interface StateChangePayload {
  state: GamePhase;
}

export interface LinesClearedPayload {
  rows: number[];
  /** colorId per cleared cell — drives sand tint */
  colors: number[];
  count: number;
}

export interface GameOverPayload {
  score: number;
  level: number;
  lines: number;
}

export interface LevelCompletePayload {
  level: number;
  score: number;
  timeMs?: number;
}

export interface SettingsChangePayload {
  // partial settings snapshot; concrete shape lands with store/useSettings (Phase 7)
  [key: string]: unknown;
}

export interface InputActionPayload {
  action: InputAction;
  /** true on key-down/press start; false on release (for held actions) */
  pressed?: boolean;
}

export type SfxName =
  | "move"
  | "rotate"
  | "softdrop"
  | "harddrop"
  | "lock"
  | "hold"
  | "clear"
  | "telegraph"
  | "levelup"
  | "gameover"
  | "ui";

export interface SfxPayload {
  name: SfxName;
  /** optional scalar (e.g. combo count) some sounds use to pitch up */
  intensity?: number;
}

// ── Event → payload map (consumed by mitt in events.ts) ─────────────────────
export type GameEvents = {
  [EventName.ScoreUpdate]: ScoreUpdatePayload;
  [EventName.LevelChange]: LevelChangePayload;
  [EventName.ComboUpdate]: ComboUpdatePayload;
  [EventName.QueueUpdate]: QueueUpdatePayload;
  [EventName.HoldUpdate]: HoldUpdatePayload;
  [EventName.StateChange]: StateChangePayload;
  [EventName.LinesCleared]: LinesClearedPayload;
  [EventName.GameOver]: GameOverPayload;
  [EventName.LevelComplete]: LevelCompletePayload;
  [EventName.Victory]: GameOverPayload;

  [EventName.InputAction]: InputActionPayload;
  [EventName.SettingsChange]: SettingsChangePayload;
  [EventName.RequestPause]: void;
  [EventName.RequestResume]: void;
  [EventName.RequestRestart]: void;
  [EventName.RequestStartLevel]: { level: number };
  [EventName.RequestQuit]: void;

  [EventName.Sfx]: SfxPayload;
};
