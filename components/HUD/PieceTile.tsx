"use client";

import { ROTATIONS, type PieceType } from "@/game/core/Piece";

/** Classic per-type colors so queued shapes are recognizable in the HUD. */
const TYPE_COLOR: Record<PieceType, string> = {
  I: "#4ECDC4",
  O: "#FFE66D",
  T: "#A685E2",
  S: "#6BCB77",
  Z: "#FF6B6B",
  J: "#4D96FF",
  L: "#FF9F45",
};

export default function PieceTile({ type, size = 56 }: { type: PieceType | null; size?: number }) {
  const cells = type ? ROTATIONS[type][0] : [];
  const dim = 4;
  const c = size / dim;
  const color = type ? TYPE_COLOR[type] : "transparent";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={cell.x * c + 1}
          y={cell.y * c + 1}
          width={c - 2}
          height={c - 2}
          rx={c * 0.18}
          fill={color}
        />
      ))}
    </svg>
  );
}
