import Phaser from "phaser";

/**
 * Procedurally-generated block "material" textures for Block Drop — one set,
 * cycled per level so each world looks/feels different. Generated in code
 * (grayscale so runtime tint still colors them) rather than fetched from the
 * network, keeping the PWA fully offline-capable and avoiding CORS/load races.
 *
 * Two base shapes are used: a rounded body (glossy/glass) and a square tile
 * (the patterned materials — stripes / grid / circuit / weave / gem), so worlds
 * differ in silhouette as well as surface.
 */
const SIZE = 64;
const PAD = 2;
const RAD = Math.floor(SIZE * 0.18);
const INNER = SIZE - 2 * PAD;

type Draw = (g: Phaser.GameObjects.Graphics) => void;

const rounded = (g: Phaser.GameObjects.Graphics, alpha = 1) => {
  g.fillStyle(0xffffff, alpha);
  g.fillRoundedRect(PAD, PAD, INNER, INNER, RAD);
};
const square = (g: Phaser.GameObjects.Graphics, alpha = 1) => {
  g.fillStyle(0xffffff, alpha);
  g.fillRoundedRect(PAD, PAD, INNER, INNER, 5);
};
const border = (g: Phaser.GameObjects.Graphics, alpha = 0.28) => {
  g.lineStyle(2.5, 0x000000, alpha);
  g.strokeRoundedRect(PAD + 1, PAD + 1, INNER - 2, INNER - 2, 5);
  g.fillStyle(0xffffff, 0.25);
  g.fillRoundedRect(PAD + 3, PAD + 3, INNER - 6, SIZE * 0.16, 4);
};

const MATERIALS: Draw[] = [
  // 0 — glossy (vertical gradient + bevels)
  (g) => {
    rounded(g);
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(PAD, SIZE * 0.5, INNER, SIZE * 0.5 - PAD, RAD);
    g.fillStyle(0xffffff, 0.5);
    g.fillRoundedRect(PAD + 2, PAD + 2, INNER - 4, SIZE * 0.16, RAD * 0.6);
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(PAD + 2, SIZE - PAD - SIZE * 0.12, INNER - 4, SIZE * 0.1, RAD * 0.5);
  },
  // 1 — glass (translucent, bright rim, diagonal sheen)
  (g) => {
    rounded(g, 0.55);
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeRoundedRect(PAD + 1, PAD + 1, INNER - 2, INNER - 2, RAD);
    g.fillStyle(0xffffff, 0.5);
    g.beginPath();
    g.moveTo(PAD + 6, PAD + 4);
    g.lineTo(PAD + 22, PAD + 4);
    g.lineTo(PAD + 8, SIZE - PAD - 4);
    g.lineTo(PAD + 2, SIZE - PAD - 14);
    g.closePath();
    g.fillPath();
  },
  // 2 — brushed metal (vertical streaks + top sheen)
  (g) => {
    square(g, 0.92);
    for (let x = PAD + 3; x < SIZE - PAD - 2; x += 4) {
      g.fillStyle(0x000000, 0.06);
      g.fillRect(x, PAD + 3, 1.5, INNER - 6);
      g.fillStyle(0xffffff, 0.12);
      g.fillRect(x + 2, PAD + 3, 1, INNER - 6);
    }
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(PAD + 3, PAD + 3, INNER - 6, SIZE * 0.16);
    border(g, 0.3);
  },
  // 3 — stone (speckled noise + uneven shading)
  (g) => {
    square(g, 0.94);
    let seed = 1337;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 70; i++) {
      const x = PAD + 3 + rnd() * (INNER - 6);
      const y = PAD + 3 + rnd() * (INNER - 6);
      g.fillStyle(rnd() > 0.5 ? 0x000000 : 0xffffff, 0.12 + rnd() * 0.14);
      g.fillCircle(x, y, 1 + rnd() * 1.8);
    }
    border(g, 0.25);
  },
  // 4 — diagonal stripes (hazard-tape look)
  (g) => {
    square(g);
    for (let d = -SIZE; d < SIZE * 2; d += 14) {
      g.fillStyle(0x000000, 0.16);
      g.beginPath();
      g.moveTo(d, PAD);
      g.lineTo(d + 7, PAD);
      g.lineTo(d + 7 - INNER, SIZE - PAD);
      g.lineTo(d - INNER, SIZE - PAD);
      g.closePath();
      g.fillPath();
    }
    border(g, 0.3);
  },
  // 5 — studded grid (raised dots)
  (g) => {
    square(g, 0.96);
    for (let y = PAD + 8; y < SIZE - PAD - 4; y += 12) {
      for (let x = PAD + 8; x < SIZE - PAD - 4; x += 12) {
        g.fillStyle(0x000000, 0.18);
        g.fillCircle(x + 1, y + 1, 3.4);
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(x, y, 3);
      }
    }
    border(g, 0.28);
  },
  // 6 — circuit board (traces + nodes)
  (g) => {
    square(g, 0.9);
    g.lineStyle(2, 0xffffff, 0.3);
    g.lineBetween(PAD + 6, SIZE * 0.32, SIZE - PAD - 6, SIZE * 0.32);
    g.lineBetween(SIZE * 0.4, SIZE * 0.32, SIZE * 0.4, SIZE - PAD - 8);
    g.lineBetween(PAD + 6, SIZE * 0.7, SIZE * 0.68, SIZE * 0.7);
    g.lineBetween(SIZE * 0.68, SIZE * 0.2, SIZE * 0.68, SIZE * 0.7);
    g.fillStyle(0xffffff, 0.55);
    for (const [nx, ny] of [
      [SIZE * 0.4, SIZE * 0.32],
      [SIZE * 0.68, SIZE * 0.7],
      [PAD + 8, SIZE * 0.32],
      [SIZE * 0.4, SIZE - PAD - 8],
    ] as const) {
      g.fillStyle(0x000000, 0.2);
      g.fillRect(nx - 2.5, ny - 2.5, 5, 5);
      g.fillStyle(0xffffff, 0.55);
      g.fillRect(nx - 2, ny - 2, 4, 4);
    }
    border(g, 0.3);
  },
  // 7 — carbon-fibre weave
  (g) => {
    square(g, 0.92);
    const s = 8;
    for (let y = PAD + 2; y < SIZE - PAD - 2; y += s) {
      for (let x = PAD + 2; x < SIZE - PAD - 2; x += s) {
        const up = ((x + y) / s) % 2 < 1;
        g.fillStyle(0xffffff, up ? 0.16 : 0.04);
        g.fillRoundedRect(x, y, s - 1, (s - 1) / 2, 1);
        g.fillStyle(0x000000, up ? 0.04 : 0.16);
        g.fillRoundedRect(x, y + (s - 1) / 2, s - 1, (s - 1) / 2, 1);
      }
    }
    border(g, 0.32);
  },
  // 8 — faceted gem (triangular facets)
  (g) => {
    square(g);
    const c = SIZE / 2;
    const lo = PAD + 3;
    const hi = SIZE - PAD - 3;
    const tri = (ax: number, ay: number, bx: number, by: number, alpha: number, col = 0x000000) => {
      g.fillStyle(col, alpha);
      g.fillTriangle(c, c, ax, ay, bx, by);
    };
    tri(lo, lo, hi, lo, 0.04, 0xffffff); // top — lightest
    tri(hi, lo, hi, hi, 0.1); // right
    tri(hi, hi, lo, hi, 0.2); // bottom — darkest
    tri(lo, hi, lo, lo, 0.1); // left
    g.lineStyle(1, 0xffffff, 0.3);
    g.strokeTriangle(c, c, lo, lo, hi, lo);
    g.strokeTriangle(c, c, hi, hi, lo, hi);
    border(g, 0.34);
  },
];

export const MATERIAL_COUNT = MATERIALS.length;

/** Generate (once) all material textures; returns their texture keys in order. */
export function ensureMaterials(scene: Phaser.Scene): string[] {
  const keys: string[] = [];
  for (let i = 0; i < MATERIALS.length; i++) {
    const key = `blast-mat-${i}`;
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      MATERIALS[i](g);
      g.generateTexture(key, SIZE, SIZE);
      g.destroy();
    }
    keys.push(key);
  }
  return keys;
}

/** Texture key for a given 1-based level (cycles through the material set). */
export function materialForLevel(keys: string[], levelId: number): string {
  return keys[(levelId - 1) % keys.length];
}
