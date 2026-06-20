/**
 * Block Drop power-ups — pure data shared by the scene (logic) and the React
 * HUD (buttons). Coins are earned from line clears and spent here.
 */
export type PowerupKind = "refresh" | "bomb" | "hammer" | "mult" | "rotate";

export interface PowerupDef {
  kind: PowerupKind;
  icon: string;
  label: string;
  desc: string;
  cost: number;
}

export const POWERUPS: PowerupDef[] = [
  { kind: "refresh", icon: "🔄", label: "Refresh", desc: "Swap the 3 tray pieces for new ones", cost: 6 },
  { kind: "hammer", icon: "🔨", label: "Hammer", desc: "Tap a block to smash it", cost: 8 },
  { kind: "rotate", icon: "🔃", label: "Rotate", desc: "Tap a tray piece to spin it 90°", cost: 10 },
  { kind: "bomb", icon: "💣", label: "Clear Row", desc: "Delete the bottom filled row", cost: 14 },
  { kind: "mult", icon: "✨", label: "Multiplier", desc: "Boost points (2×→3×→4×) for a few moves", cost: 16 },
];

export const POWERUP_COST: Record<PowerupKind, number> = POWERUPS.reduce(
  (acc, p) => ((acc[p.kind] = p.cost), acc),
  {} as Record<PowerupKind, number>,
);

/** Scoring multiplier lasts this many scoring events after purchase. */
export const MULT_DURATION = 6;
export const MULT_MAX = 4;
