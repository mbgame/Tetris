/**
 * Tetromino definitions — pure data, NO Phaser imports.
 *
 * Each piece has 4 rotation states (SRS). A state is 4 local cell coords inside
 * the piece's bounding box (x right, y down). Absolute board cells = local + the
 * piece's (x,y) top-left box position.
 *
 * Color is per-instance (chosen from the level palette at spawn), not per type.
 */
export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export const PIECE_TYPES: readonly PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** rotation index: 0 = spawn, 1 = CW, 2 = 180, 3 = CCW */
export type Rotation = 0 | 1 | 2 | 3;

export interface Cell {
  x: number;
  y: number;
}

export interface ActivePiece {
  type: PieceType;
  colorId: number;
  rot: Rotation;
  /** top-left of the piece's bounding box, in board coords */
  x: number;
  y: number;
}

const c = (x: number, y: number): Cell => ({ x, y });

/** 4 rotation states per piece (standard SRS bounding boxes). */
export const ROTATIONS: Record<PieceType, Cell[][]> = {
  I: [
    [c(0, 1), c(1, 1), c(2, 1), c(3, 1)],
    [c(2, 0), c(2, 1), c(2, 2), c(2, 3)],
    [c(0, 2), c(1, 2), c(2, 2), c(3, 2)],
    [c(1, 0), c(1, 1), c(1, 2), c(1, 3)],
  ],
  O: [
    [c(1, 0), c(2, 0), c(1, 1), c(2, 1)],
    [c(1, 0), c(2, 0), c(1, 1), c(2, 1)],
    [c(1, 0), c(2, 0), c(1, 1), c(2, 1)],
    [c(1, 0), c(2, 0), c(1, 1), c(2, 1)],
  ],
  T: [
    [c(1, 0), c(0, 1), c(1, 1), c(2, 1)],
    [c(1, 0), c(1, 1), c(2, 1), c(1, 2)],
    [c(0, 1), c(1, 1), c(2, 1), c(1, 2)],
    [c(1, 0), c(0, 1), c(1, 1), c(1, 2)],
  ],
  S: [
    [c(1, 0), c(2, 0), c(0, 1), c(1, 1)],
    [c(1, 0), c(1, 1), c(2, 1), c(2, 2)],
    [c(1, 1), c(2, 1), c(0, 2), c(1, 2)],
    [c(0, 0), c(0, 1), c(1, 1), c(1, 2)],
  ],
  Z: [
    [c(0, 0), c(1, 0), c(1, 1), c(2, 1)],
    [c(2, 0), c(1, 1), c(2, 1), c(1, 2)],
    [c(0, 1), c(1, 1), c(1, 2), c(2, 2)],
    [c(1, 0), c(0, 1), c(1, 1), c(0, 2)],
  ],
  J: [
    [c(0, 0), c(0, 1), c(1, 1), c(2, 1)],
    [c(1, 0), c(2, 0), c(1, 1), c(1, 2)],
    [c(0, 1), c(1, 1), c(2, 1), c(2, 2)],
    [c(1, 0), c(1, 1), c(0, 2), c(1, 2)],
  ],
  L: [
    [c(2, 0), c(0, 1), c(1, 1), c(2, 1)],
    [c(1, 0), c(1, 1), c(1, 2), c(2, 2)],
    [c(0, 1), c(1, 1), c(2, 1), c(0, 2)],
    [c(0, 0), c(1, 0), c(1, 1), c(1, 2)],
  ],
};

/** Spawn box top-left so the piece appears centered in the hidden buffer (rows 0–1). */
export const SPAWN: Record<PieceType, Cell> = {
  I: c(3, 0),
  O: c(4, 0),
  T: c(3, 0),
  S: c(3, 0),
  Z: c(3, 0),
  J: c(3, 0),
  L: c(3, 0),
};

export function spawnPiece(type: PieceType, colorId: number): ActivePiece {
  const s = SPAWN[type];
  return { type, colorId, rot: 0, x: s.x, y: s.y };
}

/** Absolute board cells occupied by the piece in its current state. */
export function pieceCells(p: ActivePiece): Cell[] {
  return ROTATIONS[p.type][p.rot].map((cell) => ({ x: p.x + cell.x, y: p.y + cell.y }));
}
