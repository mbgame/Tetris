/**
 * Block Drop scoring — pure logic, NO Phaser imports.
 *
 * Points come from two sources:
 *   • placing a piece: +1 per cell (rewards progress even without a clear)
 *   • clearing lines: a per-line base, multiplied by how many lines went at once
 *     (simultaneous combo), plus a bonus per mono-color line.
 *
 * Colors never gate a clear — they only add the mono bonus.
 */
const LINE_BASE = 80; // points for a single cleared line
const MONO_BONUS = 50; // extra for a line that was all one color

export function placementScore(cellCount: number): number {
  return cellCount;
}

/**
 * @param lineCount     total rows + columns cleared this placement
 * @param monoLineCount how many of those lines were a single color
 */
export function clearScore(lineCount: number, monoLineCount: number): number {
  if (lineCount <= 0) return 0;
  const combo = lineCount; // 1 line ×1, 2 lines ×2, …
  return LINE_BASE * lineCount * combo + MONO_BONUS * monoLineCount;
}
