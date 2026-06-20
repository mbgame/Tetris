import Phaser from "phaser";

/**
 * Procedurally-generated block "material" textures for Block Drop — one set,
 * cycled per level so each world looks/feels different. Generated in code
 * (grayscale so runtime tint still colors them) rather than fetched from the
 * network, keeping the PWA fully offline-capable and avoiding CORS/load races.
 */
const SIZE = 64;
const PAD = 2;
const RAD = Math.floor(SIZE * 0.18);

type Draw = (g: Phaser.GameObjects.Graphics) => void;

const base = (g: Phaser.GameObjects.Graphics, alpha = 1) => {
  g.fillStyle(0xffffff, alpha);
  g.fillRoundedRect(PAD, PAD, SIZE - 2 * PAD, SIZE - 2 * PAD, RAD);
};

const MATERIALS: Draw[] = [
  // 0 — glossy (vertical gradient + bevels)
  (g) => {
    base(g);
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(PAD, SIZE * 0.5, SIZE - 2 * PAD, SIZE * 0.5 - PAD, RAD);
    g.fillStyle(0xffffff, 0.5);
    g.fillRoundedRect(PAD + 2, PAD + 2, SIZE - 2 * PAD - 4, SIZE * 0.16, RAD * 0.6);
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(PAD + 2, SIZE - PAD - SIZE * 0.12, SIZE - 2 * PAD - 4, SIZE * 0.1, RAD * 0.5);
  },
  // 1 — matte (flat with a thin inset border + soft top light)
  (g) => {
    base(g, 0.96);
    g.lineStyle(3, 0x000000, 0.22);
    g.strokeRoundedRect(PAD + 1.5, PAD + 1.5, SIZE - 2 * PAD - 3, SIZE - 2 * PAD - 3, RAD * 0.8);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(PAD + 4, PAD + 4, SIZE - 2 * PAD - 8, SIZE * 0.22, RAD * 0.5);
  },
  // 2 — glass (translucent body, bright rim, diagonal sheen streak)
  (g) => {
    base(g, 0.55);
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeRoundedRect(PAD + 1, PAD + 1, SIZE - 2 * PAD - 2, SIZE - 2 * PAD - 2, RAD);
    g.fillStyle(0xffffff, 0.5);
    g.beginPath();
    g.moveTo(PAD + 6, PAD + 4);
    g.lineTo(PAD + 22, PAD + 4);
    g.lineTo(PAD + 8, SIZE - PAD - 4);
    g.lineTo(PAD + 2, SIZE - PAD - 14);
    g.closePath();
    g.fillPath();
  },
  // 3 — brushed metal (vertical streaks + strong top sheen)
  (g) => {
    base(g, 0.92);
    for (let x = PAD + 3; x < SIZE - PAD - 2; x += 4) {
      g.fillStyle(0x000000, 0.06);
      g.fillRect(x, PAD + 3, 1.5, SIZE - 2 * PAD - 6);
      g.fillStyle(0xffffff, 0.12);
      g.fillRect(x + 2, PAD + 3, 1, SIZE - 2 * PAD - 6);
    }
    g.fillStyle(0xffffff, 0.45);
    g.fillRoundedRect(PAD + 2, PAD + 2, SIZE - 2 * PAD - 4, SIZE * 0.18, RAD * 0.5);
    g.fillStyle(0x000000, 0.22);
    g.fillRect(PAD + 2, SIZE - PAD - 5, SIZE - 2 * PAD - 4, 3);
  },
  // 4 — plastic (big soft highlight blob, rounded)
  (g) => {
    base(g);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(SIZE * 0.35, SIZE * 0.34, SIZE * 0.2);
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(SIZE * 0.5, SIZE * 0.45, SIZE * 0.32);
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(PAD + 3, SIZE * 0.62, SIZE - 2 * PAD - 6, SIZE * 0.3, RAD * 0.6);
  },
  // 5 — stone (speckled noise + uneven shading)
  (g) => {
    base(g, 0.94);
    // deterministic speckles (fixed pattern so the texture is stable)
    let seed = 1337;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 60; i++) {
      const x = PAD + 3 + rnd() * (SIZE - 2 * PAD - 6);
      const y = PAD + 3 + rnd() * (SIZE - 2 * PAD - 6);
      g.fillStyle(rnd() > 0.5 ? 0x000000 : 0xffffff, 0.12 + rnd() * 0.12);
      g.fillCircle(x, y, 1 + rnd() * 1.8);
    }
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(PAD + 3, PAD + 3, SIZE - 2 * PAD - 6, SIZE * 0.16, RAD * 0.5);
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
