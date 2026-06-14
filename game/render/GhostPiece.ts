import Phaser from "phaser";
import { Board } from "../core/Board";
import { pieceCells, type ActivePiece } from "../core/Piece";
import { BLOCK_TEX } from "./BlockRenderer";
import { tintFor } from "./palette";

/**
 * Renders the landing-spot ghost: the active piece hard-dropped straight down to
 * where it would rest, drawn faint. Pure drop math lives in `dropPosition`.
 */
export class GhostPiece {
  private layer: Phaser.GameObjects.Group;

  constructor(
    private scene: Phaser.Scene,
    private cell: number,
    private gridToPixel: (col: number, row: number) => { x: number; y: number },
    private palette?: number[],
  ) {
    this.layer = scene.add.group();
  }

  clear(): void {
    this.layer.clear(true, true);
  }

  render(board: Board, piece: ActivePiece): void {
    this.layer.clear(true, true);
    const ghost = dropPosition(board, piece);
    for (const c of pieceCells(ghost)) {
      if (c.y < 2) continue; // skip hidden buffer
      const { x, y } = this.gridToPixel(c.x, c.y);
      const img = this.layer.create(x, y, BLOCK_TEX) as Phaser.GameObjects.Image;
      img.setDisplaySize(this.cell, this.cell);
      img.setTint(tintFor(piece.colorId, this.palette));
      img.setAlpha(0.22);
    }
  }
}

/** Lowest non-colliding position of `piece` (pure — testable without Phaser). */
export function dropPosition(board: Board, piece: ActivePiece): ActivePiece {
  let p = piece;
  while (!board.collides({ ...p, y: p.y + 1 })) {
    p = { ...p, y: p.y + 1 };
  }
  return p;
}
