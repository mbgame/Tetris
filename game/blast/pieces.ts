/**
 * Draggable piece shapes for "Block Drop" mode — pure data + generator, NO
 * Phaser imports (unit-testable). Each shape is a normalized list of cell
 * offsets (min x = min y = 0). Difficulty biases the generator toward bigger,
 * more awkward footprints; it can also synthesize randomized blobs.
 */

export interface PieceShape {
  /** normalized cell offsets */
  cells: { x: number; y: number }[];
  /** bounding-box dimensions in cells */
  w: number;
  h: number;
  /** rough difficulty tier 0..2 (small → large/awkward) */
  tier: number;
}

const shape = (cells: [number, number][], tier: number): PieceShape => {
  const pts = cells.map(([x, y]) => ({ x, y }));
  const w = Math.max(...pts.map((p) => p.x)) + 1;
  const h = Math.max(...pts.map((p) => p.y)) + 1;
  return { cells: pts, w, h, tier };
};

/** Curated base library spanning 1–5 cells. Rotations are baked in as variants. */
export const BLAST_SHAPES: PieceShape[] = [
  // tier 0 — tiny, almost always placeable
  shape([[0, 0]], 0), // single
  shape([[0, 0], [1, 0]], 0), // domino h
  shape([[0, 0], [0, 1]], 0), // domino v
  shape([[0, 0], [1, 0], [2, 0]], 0), // tri line h
  shape([[0, 0], [0, 1], [0, 2]], 0), // tri line v
  shape([[0, 0], [1, 0], [0, 1]], 0), // small corner
  // tier 1 — tetromino-ish + 2×2
  shape([[0, 0], [1, 0], [0, 1], [1, 1]], 1), // square 2×2
  shape([[0, 0], [1, 0], [2, 0], [3, 0]], 1), // line 4 h
  shape([[0, 0], [0, 1], [0, 2], [0, 3]], 1), // line 4 v
  shape([[0, 0], [0, 1], [0, 2], [1, 2]], 1), // L
  shape([[1, 0], [1, 1], [1, 2], [0, 2]], 1), // J
  shape([[0, 0], [1, 0], [2, 0], [1, 1]], 1), // T
  shape([[1, 0], [2, 0], [0, 1], [1, 1]], 1), // S
  shape([[0, 0], [1, 0], [1, 1], [2, 1]], 1), // Z
  // tier 2 — big / awkward
  shape([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], 2), // line 5 h
  shape([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], 2), // line 5 v
  shape([[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], 2), // big corner ⌐
  shape([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], 2), // big corner ¬
  shape([[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]], 2), // U
  shape([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], 2), // plus +
  shape([[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]], 2), // P
  shape([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], 2), // rect 3×2
];

/** Rotate a shape 90° clockwise, re-normalized to origin 0,0. */
export function rotateShape(s: PieceShape): PieceShape {
  const pts = s.cells.map((c) => ({ x: -c.y, y: c.x }));
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const cells = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  return { cells, w, h, tier: s.tier };
}

/**
 * Synthesize a randomized connected blob of `n` cells via a random walk —
 * occasional organic shapes so the set never feels fully fixed.
 */
export function randomBlob(n: number, rng: () => number): PieceShape {
  const taken = new Set<string>(["0,0"]);
  const cells: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let guard = 0;
  while (cells.length < n && guard++ < 200) {
    const base = cells[Math.floor(rng() * cells.length)];
    const [dx, dy] = dirs[Math.floor(rng() * dirs.length)];
    const nx = base.x + dx;
    const ny = base.y + dy;
    const key = `${nx},${ny}`;
    if (taken.has(key)) continue;
    taken.add(key);
    cells.push({ x: nx, y: ny });
  }
  // normalize to min 0,0
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const norm = cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
  const w = Math.max(...norm.map((c) => c.x)) + 1;
  const h = Math.max(...norm.map((c) => c.y)) + 1;
  return { cells: norm, w, h, tier: n >= 5 ? 2 : 1 };
}

/**
 * Pick a piece shape biased by difficulty (0 easy → 1 hard). Higher difficulty
 * weights larger tiers and occasionally emits a randomized blob.
 */
export function randomPiece(rng: () => number, difficulty: number): PieceShape {
  const d = Math.max(0, Math.min(1, difficulty));

  // ~12% chance of a randomized blob on harder levels
  if (rng() < 0.12 * d) {
    return randomBlob(3 + Math.floor(rng() * (2 + Math.round(d * 2))), rng);
  }

  // tier weights shift toward bigger shapes as difficulty rises
  const w0 = 1 - d * 0.7; // tier 0
  const w1 = 0.5 + d * 0.3; // tier 1
  const w2 = d * 0.9; // tier 2
  const weights = [w0, w1, w2];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  let tier = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      tier = i;
      break;
    }
  }
  const pool = BLAST_SHAPES.filter((s) => s.tier === tier);
  return pool[Math.floor(rng() * pool.length)];
}
