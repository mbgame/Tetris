/**
 * Block Drop level configs — pure data, NO Phaser imports. Difficulty rises by:
 * higher point targets, more pre-placed "noise" cells, more colors, and a
 * difficulty bias that pushes the piece generator toward bigger/awkward shapes.
 */
import type { SceneTheme, ColorDef } from "../levels/levels";

const GLYPHS = ["▲", "●", "◆", "■", "★", "✦", "✚"];
const palette = (hexes: string[]): ColorDef[] =>
  hexes.map((hex, i) => ({ id: i + 1, hex, glyph: GLYPHS[i] }));

export interface BlastLevelConfig {
  id: number;
  name: string;
  scene: SceneTheme;
  colors: ColorDef[];
  /** points needed to clear the level */
  targetPoints: number;
  /** random pre-placed cells scattered on the board at start (noise) */
  noiseCells: number;
  /** 0..1 generator bias toward larger/awkward pieces */
  difficulty: number;
  bgDim: number;
  bgmKey: string;
}

export const BLAST_LEVELS: BlastLevelConfig[] = [
  {
    id: 1, name: "Calm Start", scene: "dawn", colors: palette(["#FF6B6B", "#4ECDC4"]),
    targetPoints: 600, noiseCells: 3, difficulty: 0.0, bgDim: 0.25, bgmKey: "bgm-dawn",
  },
  {
    id: 2, name: "Warming Up", scene: "neon", colors: palette(["#FF2E97", "#00F0FF", "#FFE93D"]),
    targetPoints: 1000, noiseCells: 6, difficulty: 0.15, bgDim: 0.3, bgmKey: "bgm-neon",
  },
  {
    id: 3, name: "Crowded", scene: "crystal", colors: palette(["#7DE2FC", "#B07CFF", "#FF8FB1"]),
    targetPoints: 1500, noiseCells: 10, difficulty: 0.3, bgDim: 0.3, bgmKey: "bgm-crystal",
  },
  {
    id: 4, name: "Tight Fit", scene: "dunes", colors: palette(["#E8B25F", "#D9644A", "#7FB069", "#5BC0EB"]),
    targetPoints: 2200, noiseCells: 14, difficulty: 0.45, bgDim: 0.3, bgmKey: "bgm-dunes",
  },
  {
    id: 5, name: "Deep Water", scene: "ocean", colors: palette(["#48CAE4", "#0096C7", "#90BE6D", "#F9C74F"]),
    targetPoints: 3000, noiseCells: 18, difficulty: 0.6, bgDim: 0.35, bgmKey: "bgm-ocean",
  },
  {
    id: 6, name: "Forge Pressure", scene: "forge", colors: palette(["#FF5400", "#FFB703", "#E63946", "#8338EC", "#06D6A0"]),
    targetPoints: 4000, noiseCells: 22, difficulty: 0.75, bgDim: 0.35, bgmKey: "bgm-forge",
  },
  {
    id: 7, name: "Aurora Maze", scene: "aurora", colors: palette(["#00F5D4", "#9B5DE5", "#F15BB5", "#FEE440", "#00BBF9"]),
    targetPoints: 5200, noiseCells: 26, difficulty: 0.9, bgDim: 0.35, bgmKey: "bgm-aurora",
  },
  {
    id: 8, name: "Prism Gauntlet", scene: "prism", colors: palette(["#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93", "#FF924C"]),
    targetPoints: 6500, noiseCells: 30, difficulty: 1.0, bgDim: 0.4, bgmKey: "bgm-prism",
  },
];

export const BLAST_LEVEL_COUNT = BLAST_LEVELS.length;

export function getBlastLevel(id: number): BlastLevelConfig {
  const lvl = BLAST_LEVELS.find((l) => l.id === id);
  if (!lvl) throw new Error(`No blast level with id ${id}`);
  return lvl;
}
