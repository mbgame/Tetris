/**
 * Pure audio helpers — NO Web Audio / Phaser imports, so they're unit-testable.
 */

export interface BusVolumes {
  master: number; // 0..100
  music: number;
  sfx: number;
  ambience: number;
  muteMaster: boolean;
  muteMusic: boolean;
  muteSfx: boolean;
  muteAmbience: boolean;
}

export const DEFAULT_VOLUMES: BusVolumes = {
  master: 80,
  music: 80,
  sfx: 80,
  ambience: 80,
  muteMaster: false,
  muteMusic: false,
  muteSfx: false,
  muteAmbience: false,
};

/** Convert a 0..100 volume + mute into a 0..1 gain. */
export function gainFor(vol: number, mute: boolean): number {
  if (mute) return 0;
  return Math.max(0, Math.min(1, vol / 100));
}

/** ±pct random multiplier (e.g. pct=0.05 → 0.95..1.05) for anti-fatigue jitter. */
export function jitter(pct: number, rng: () => number = Math.random): number {
  return 1 + (rng() * 2 - 1) * pct;
}

/**
 * Tracks active SFX voices and enforces a hard cap, evicting the oldest when the
 * limit is exceeded. Generic over a voice handle so it stays Web-Audio-free.
 */
export class VoiceLimiter<T> {
  private voices: T[] = [];
  constructor(
    private cap: number,
    private stop: (v: T) => void,
  ) {}

  add(voice: T): void {
    this.voices.push(voice);
    while (this.voices.length > this.cap) {
      const oldest = this.voices.shift()!;
      this.stop(oldest);
    }
  }

  /** Remove a voice that ended on its own. */
  release(voice: T): void {
    const i = this.voices.indexOf(voice);
    if (i >= 0) this.voices.splice(i, 1);
  }

  get count(): number {
    return this.voices.length;
  }
}
