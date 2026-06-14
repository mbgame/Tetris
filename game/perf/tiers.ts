import type { QualityTier } from "../config";

/** Concrete quality tiers (resolved from the 'auto' setting via benchmark). */
export type ResolvedTier = Exclude<QualityTier, "auto">;

/**
 * Central quality-tier knob table (docs/06 B2). Every render system reads its
 * fidelity from here so switching tiers changes the whole pipeline consistently.
 */
export interface TierKnobs {
  dprCap: number; // device-pixel-ratio clamp
  grainsPerCell: number; // sand grains emitted per cleared cell
  dissolveSubdiv: number; // sub-tiles per axis (0 = cheap scale-out)
  bgScale: number; // background internal render scale
  bloom: number; // bloom strength (0 = off)
  chromatic: "off" | "on-clear" | "always";
  shake: boolean; // screen shake allowed
  accent: "minimal" | "some" | "full";
}

export const TIERS: Record<ResolvedTier, TierKnobs> = {
  low: { dprCap: 1, grainsPerCell: 6, dissolveSubdiv: 0, bgScale: 0.5, bloom: 0, chromatic: "off", shake: false, accent: "minimal" },
  medium: { dprCap: 1.5, grainsPerCell: 14, dissolveSubdiv: 3, bgScale: 0.6, bloom: 2, chromatic: "off", shake: true, accent: "some" },
  high: { dprCap: 2, grainsPerCell: 28, dissolveSubdiv: 4, bgScale: 0.75, bloom: 4, chromatic: "on-clear", shake: true, accent: "full" },
  ultra: { dprCap: 3, grainsPerCell: 48, dissolveSubdiv: 5, bgScale: 1, bloom: 7, chromatic: "always", shake: true, accent: "full" },
};

export function knobs(tier: ResolvedTier): TierKnobs {
  return TIERS[tier];
}
