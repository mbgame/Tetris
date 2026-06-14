/**
 * Default colorId → tint map. Per-level palettes (Phase 4) override this; kept
 * here so the renderer has sane colors before levels exist. colorId 0 = empty.
 */
export const DEFAULT_PALETTE: number[] = [
  0x000000, // 0 unused (empty)
  0x4fd1c5, // 1 teal
  0xf6ad55, // 2 orange
  0xfc8181, // 3 red
  0x68d391, // 4 green
  0x63b3ed, // 5 blue
  0xb794f4, // 6 purple
  0xf6e05e, // 7 yellow
];

export function tintFor(colorId: number, palette: number[] = DEFAULT_PALETTE): number {
  return palette[colorId] ?? 0xffffff;
}

/** Build a colorId→int tint array (index 0 = empty) from a level's ColorDefs. */
export function paletteFromColors(colors: { id: number; hex: string }[]): number[] {
  const out: number[] = [0x000000];
  for (const c of colors) out[c.id] = parseInt(c.hex.replace("#", ""), 16);
  return out;
}
