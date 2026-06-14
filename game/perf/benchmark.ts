import type { ResolvedTier } from "./tiers";

/**
 * Map an average frame time (ms) to a quality tier. Pure + testable. Lower frame
 * times → more headroom → higher tier.
 */
export function pickTier(avgFrameMs: number): ResolvedTier {
  if (avgFrameMs <= 11) return "ultra";
  if (avgFrameMs <= 16.7) return "high";
  if (avgFrameMs <= 24) return "medium";
  return "low";
}

/**
 * Sample frame times over ~`durationMs` while doing light busy work, returning
 * the average frame time. Client-only (needs requestAnimationFrame). Used once on
 * first boot when the tier setting is 'auto'.
 */
export function measureFrames(durationMs = 1200, busy = 20000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "undefined") {
      resolve(16.7);
      return;
    }
    const samples: number[] = [];
    let last = performance.now();
    const start = last;
    const tick = (t: number) => {
      samples.push(t - last);
      last = t;
      // light synthetic load so the bench reflects compute headroom
      let acc = 0;
      for (let i = 0; i < busy; i++) acc += Math.sqrt(i);
      void acc;
      if (t - start < durationMs) requestAnimationFrame(tick);
      else {
        // drop the first couple of warm-up frames
        const useful = samples.slice(2);
        const avg = useful.reduce((a, b) => a + b, 0) / Math.max(1, useful.length);
        resolve(avg);
      }
    };
    requestAnimationFrame(tick);
  });
}

/** Resolve a tier: explicit tiers pass through; 'auto' runs the benchmark. */
export async function resolveTier(setting: ResolvedTier | "auto"): Promise<ResolvedTier> {
  if (setting !== "auto") return setting;
  const avg = await measureFrames();
  return pickTier(avg);
}
