import { Board } from "./Board";
import { type ActivePiece, type Rotation } from "./Piece";

/**
 * Super Rotation System wall kicks — pure logic, NO Phaser imports.
 *
 * Standard SRS kick tables are published with y pointing UP. Our board has y
 * pointing DOWN, so each candidate's dy is negated at apply time (see tryRotate).
 */

export type RotateDir = 1 | -1; // CW | CCW

type Offset = [number, number]; // [dx, dy] in y-UP convention

/** key = `${from}>${to}` */
type KickTable = Record<string, Offset[]>;

// JLSTZ wall kicks (T, S, Z, J, L).
const JLSTZ_KICKS: KickTable = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

// I-piece wall kicks.
const I_KICKS: KickTable = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

function nextRot(rot: Rotation, dir: RotateDir): Rotation {
  return (((rot + dir) % 4) + 4) % 4 as Rotation;
}

function kicksFor(piece: ActivePiece, from: Rotation, to: Rotation): Offset[] {
  if (piece.type === "O") return [[0, 0]]; // O never needs to kick
  const table = piece.type === "I" ? I_KICKS : JLSTZ_KICKS;
  return table[`${from}>${to}`] ?? [[0, 0]];
}

/**
 * Try to rotate `piece` by `dir`. Tests each SRS kick offset against the board;
 * returns a new kicked ActivePiece on the first non-colliding candidate, else null.
 */
export function tryRotate(board: Board, piece: ActivePiece, dir: RotateDir): ActivePiece | null {
  const to = nextRot(piece.rot, dir);
  for (const [dx, dy] of kicksFor(piece, piece.rot, to)) {
    const candidate: ActivePiece = {
      ...piece,
      rot: to,
      x: piece.x + dx,
      y: piece.y - dy, // negate: table is y-up, board is y-down
    };
    if (!board.collides(candidate)) return candidate;
  }
  return null;
}
