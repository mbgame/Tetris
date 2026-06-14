import Phaser from "phaser";
import type { QualityTier } from "../config";
import { knobs } from "../perf/tiers";

/**
 * Per-camera post-processing (docs/03 §4, docs/06 B2), tier-gated:
 *   - Bloom  (approximated with Phaser 4's Glow filter, keyed off bright blocks)
 *   - Vignette
 *   - Color grade (ColorMatrix tint/contrast)
 * Chromatic aberration has no built-in Phaser 4 filter; left as a Phase-later
 * enhancement. All filter calls are guarded so FX never break gameplay.
 */
export interface PostFXOptions {
  bloom: boolean;
  tier: QualityTier;
  reduceMotion?: boolean;
}

export function applyPostFX(scene: Phaser.Scene, opts: PostFXOptions): void {
  const cam = scene.cameras.main;
  // Phaser 4 camera filter list (external = after camera transform).
  const list = (cam as unknown as { filters?: { external?: PhaserFilterList } }).filters?.external;
  if (!list) return;

  try {
    list.clear?.();

    // NOTE: A whole-camera Glow blooms everything uniformly and smears the
    // blocks — true bloom needs an emissive mask (bright blocks/sand/accents
    // only). Deferred until an emissive render pass exists; tier bloom strength
    // (knobs(opts.tier).bloom) is read for when that lands. Keep crisp blocks.
    void opts.bloom;
    void knobs(opts.tier).bloom;

    if (opts.tier !== "low") {
      // Gentle, wide vignette — frames the field without darkening the play area.
      const vig = list.addVignette?.() as { radius?: number; strength?: number } | undefined;
      if (vig) {
        vig.radius = 0.92; // darkening starts far out toward the corners
        vig.strength = 0.28; // light touch
      }
    }
    // No camera color-grade: leave block/background brightness untouched so the
    // scene stays bright (an over-eager grade crushed it to black before).
  } catch {
    // FX are non-essential; ignore any controller API mismatch.
  }
}

interface PhaserFilterList {
  clear?: () => void;
  addGlow?: (config?: object) => object;
  addVignette?: (config?: object) => object;
  addColorMatrix?: (config?: object) => object;
}
