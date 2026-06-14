/**
 * Level configs (docs/05) — pure data, NO Phaser imports. Difficulty rises
 * mainly by adding colors, then speed, then hazards. Palettes here are distinct
 * high-contrast placeholders; Phase 10 refines them per theme.
 */
export type SceneTheme =
  | "dawn"
  | "neon"
  | "crystal"
  | "dunes"
  | "ocean"
  | "forge"
  | "aurora"
  | "sky"
  | "void"
  | "prism";

export type ColorBagRule = "weighted" | "bag" | "shuffleEveryN";

export interface ColorDef {
  id: number;
  hex: string;
  glyph: string;
}

export interface LevelConfig {
  id: number;
  name: string;
  scene: SceneTheme;
  colors: ColorDef[];
  colorBagRule: ColorBagRule;
  shuffleEveryN?: number;
  gravityMs: number;
  softDropMs: number;
  lockDelayMs: number;
  targetLines: number;
  garbage?: {
    prefillRows?: number;
    risePeriodMs?: number;
  };
  bgDim: number;
  bgmKey: string;
}

// Colorblind glyphs assigned by palette index (docs/05 §2).
const GLYPHS = ["▲", "●", "◆", "■", "★", "✦", "✚"];

/** Build a themed palette: high-contrast hues, id = index+1, glyph per index. */
const palette = (hexes: string[]): ColorDef[] =>
  hexes.map((hex, i) => ({ id: i + 1, hex, glyph: GLYPHS[i] }));

const SOFT_DROP_MS = 40;
const LOCK_DELAY_MS = 500;

export const LEVELS: LevelConfig[] = [
  {
    id: 1, name: "Dawn Meadow", scene: "dawn", colors: palette(["#FF6B6B", "#4ECDC4"]),
    colorBagRule: "weighted", gravityMs: 900, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 8, bgDim: 0.25, bgmKey: "bgm-dawn",
  },
  {
    id: 2, name: "Neon City", scene: "neon", colors: palette(["#FF2E97", "#00F0FF", "#FFE93D"]),
    colorBagRule: "weighted", gravityMs: 800, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 10, bgDim: 0.3, bgmKey: "bgm-neon",
  },
  {
    id: 3, name: "Crystal Caverns", scene: "crystal", colors: palette(["#7DE2FC", "#B07CFF", "#FF8FB1"]),
    colorBagRule: "weighted", gravityMs: 700, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 12, bgDim: 0.3, bgmKey: "bgm-crystal",
  },
  {
    id: 4, name: "Desert Dunes", scene: "dunes", colors: palette(["#E8B25F", "#D9644A", "#7FB069", "#5BC0EB"]),
    colorBagRule: "weighted", gravityMs: 620, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 12, bgDim: 0.3, bgmKey: "bgm-dunes",
  },
  {
    id: 5, name: "Ocean Deep", scene: "ocean", colors: palette(["#48CAE4", "#0096C7", "#90BE6D", "#F9C74F"]),
    colorBagRule: "weighted", gravityMs: 560, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 14, garbage: { prefillRows: 2 },
    bgDim: 0.35, bgmKey: "bgm-ocean",
  },
  {
    id: 6, name: "Volcanic Forge", scene: "forge", colors: palette(["#FF5400", "#FFB703", "#E63946", "#8338EC", "#06D6A0"]),
    colorBagRule: "weighted", gravityMs: 500, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 14, garbage: { prefillRows: 3 },
    bgDim: 0.35, bgmKey: "bgm-forge",
  },
  {
    id: 7, name: "Aurora Tundra", scene: "aurora", colors: palette(["#00F5D4", "#9B5DE5", "#F15BB5", "#FEE440", "#00BBF9"]),
    colorBagRule: "weighted", gravityMs: 440, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 16, garbage: { risePeriodMs: 18000 },
    bgDim: 0.35, bgmKey: "bgm-aurora",
  },
  {
    id: 8, name: "Sky Citadel", scene: "sky", colors: palette(["#FF6B6B", "#FFD166", "#06D6A0", "#118AB2", "#A685E2", "#F78C6B"]),
    colorBagRule: "weighted", gravityMs: 380, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 16, garbage: { risePeriodMs: 14000 },
    bgDim: 0.4, bgmKey: "bgm-sky",
  },
  {
    id: 9, name: "Void Nebula", scene: "void", colors: palette(["#B5179E", "#7209B7", "#4361EE", "#4CC9F0", "#F72585", "#80FFDB"]),
    colorBagRule: "shuffleEveryN", shuffleEveryN: 12, gravityMs: 320,
    softDropMs: SOFT_DROP_MS, lockDelayMs: LOCK_DELAY_MS, targetLines: 18,
    garbage: { risePeriodMs: 11000 }, bgDim: 0.4, bgmKey: "bgm-void",
  },
  {
    id: 10, name: "Prism Sanctum", scene: "prism", colors: palette(["#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93", "#FF924C", "#36C9C6"]),
    colorBagRule: "weighted", gravityMs: 260, softDropMs: SOFT_DROP_MS,
    lockDelayMs: LOCK_DELAY_MS, targetLines: 20, garbage: { risePeriodMs: 9000 },
    bgDim: 0.4, bgmKey: "bgm-prism",
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): LevelConfig {
  const lvl = LEVELS.find((l) => l.id === id);
  if (!lvl) throw new Error(`No level with id ${id}`);
  return lvl;
}
