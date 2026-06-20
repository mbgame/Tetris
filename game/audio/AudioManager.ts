import { bus } from "../state/events";
import { EventName, type SfxName, type SfxPayload, type LevelChangePayload } from "../state/EventNames";
import {
  type BusVolumes,
  DEFAULT_VOLUMES,
  gainFor,
  jitter,
  VoiceLimiter,
} from "./audioMath";

const MAX_VOICES = 8;
const CROSSFADE_MS = 320; // quick enough that the previous theme clearly stops
const DUCK_MS = 250;

// ── BGM score ──────────────────────────────────────────────────────────────
const BGM_LEVEL = 0.55;        // music group base gain
const PAD_LEVEL = 0.1;         // sustained chord pad
const LOOKAHEAD_MS = 25;       // scheduler tick
const SCHEDULE_AHEAD = 0.12;   // seconds queued ahead of the clock
const STEPS_PER_BAR = 16;      // 16th-note resolution

type Chord = { bass: number; triad: number[] };

/** A complete, self-contained loop for one world: harmony, tempo, timbre and
 *  rhythmic density. Two themes never share a score, so every level loops
 *  differently — not just at a different pitch. Semitones are offsets from the
 *  theme root. `arpDiv` = 16th-steps between arp notes (1 busy, 4 sparse). */
interface ThemeScore {
  root: number;          // root frequency (Hz)
  bpm: number;           // base tempo, level bump added in playBgm
  progression: Chord[];  // one chord per bar, looped
  padType: OscillatorType;
  bassType: OscillatorType;
  arpType: OscillatorType;
  arpDiv: number;        // arp note spacing in 16th steps
}

/**
 * Web Audio engine: master → {music, sfx, ambience} gain buses (docs/04 §1).
 * SFX are synthesized procedurally (no audio assets), BGM is a per-theme pad
 * crossfaded on level change. Handles the autoplay gate, ducking, voice cap, and
 * tab-visibility pause. Bound to the event bus for live settings + game events.
 */
export class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private ambienceBus?: GainNode;

  private vols: BusVolumes = { ...DEFAULT_VOLUMES };
  private unlocked = false;
  private started = false;

  private voices = new VoiceLimiter<AudioScheduledSourceNode>(MAX_VOICES, (v) => {
    try { v.stop(); } catch { /* already stopped */ }
  });

  // BGM is a layered, sequenced score (pad + sub-bass pulse + arp) driven by a
  // lookahead scheduler, not a static drone. bgmGain is the persistent music
  // group (pause/duck control point); padGain crossfades on theme change.
  private bgmGain?: GainNode;   // persistent group under musicBus
  private seqGain?: GainNode;   // bass + arp layer (persistent, under bgmGain)
  private padGain?: GainNode;   // per-theme sustained chord pad (crossfaded)
  private padOscs: OscillatorNode[] = [];
  private currentTheme = "dawn";
  private currentLevel = 1;
  private score: ThemeScore = themeScore("dawn");

  // sequencer state
  private seqTimer?: ReturnType<typeof setInterval>;
  private seqStep = 0;
  private nextStepTime = 0;
  private bpm = 92;
  private root = 130.8;

  constructor() {
    bus.on(EventName.Sfx, this.onSfx);
    bus.on(EventName.SettingsChange, this.onSettings);
    bus.on(EventName.LevelChange, this.onLevelChange);
    bus.on(EventName.StateChange, this.onState);
    bus.on(EventName.LinesCleared, this.onClear);
  }

  /** Attach one-shot listeners that unlock audio on the first user gesture. */
  attachUnlock(target: Window | HTMLElement = window): void {
    const unlock = () => this.unlock();
    const opts = { once: true } as AddEventListenerOptions;
    target.addEventListener("pointerdown", unlock, opts);
    target.addEventListener("keydown", unlock, opts);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.ambienceBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambienceBus.connect(this.master);
      this.applyVolumes();
    }
    return this.ctx;
  }

  /** Resume the audio context + start BGM. Safe to call repeatedly. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") void ctx.resume();
    this.unlocked = true;
    if (!this.started) {
      this.started = true;
      this.playBgm(this.currentTheme);
    }
  }

  // ── settings (live volume) ───────────────────────────────────────────────
  setVolumes(v: Partial<BusVolumes>): void {
    this.vols = { ...this.vols, ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(gainFor(this.vols.master, this.vols.muteMaster), t, 0.02);
    this.musicBus?.gain.setTargetAtTime(gainFor(this.vols.music, this.vols.muteMusic), t, 0.02);
    this.sfxBus?.gain.setTargetAtTime(gainFor(this.vols.sfx, this.vols.muteSfx), t, 0.02);
    this.ambienceBus?.gain.setTargetAtTime(gainFor(this.vols.ambience, this.vols.muteAmbience), t, 0.02);
  }

  // ── SFX (synthesized) ────────────────────────────────────────────────────
  private onSfx = (p: SfxPayload) => this.playSfx(p.name, p.intensity);

  playSfx(name: SfxName, intensity = 0): void {
    if (!this.unlocked || !this.ctx || !this.sfxBus) return;
    switch (name) {
      case "move": this.tick(220, 0.03, "square", 0.18); break;
      case "rotate": this.tick(440, 0.04, "triangle", 0.2); break;
      case "softdrop": this.tick(180, 0.02, "sine", 0.12); break;
      case "harddrop": this.thud(); break;
      case "lock": this.tick(130, 0.05, "square", 0.25); break;
      case "hold": this.tick(330, 0.05, "triangle", 0.2); break;
      case "telegraph": this.tick(880, 0.08, "sine", 0.1); break;
      case "clear": this.sandClear(intensity); break;
      case "levelup": this.arp([523, 659, 784, 1047], 0.09); break;
      case "gameover": this.arp([392, 330, 262, 196], 0.16); break;
      case "ui": this.tick(660, 0.03, "sine", 0.15); break;
    }
  }

  private tick(freq: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * jitter(0.05);
    const v = vol * jitter(0.06);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.trackVoice(osc);
  }

  private thud(): void {
    const ctx = this.ctx!;
    // low body
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(this.sfxBus!);
    osc.start(t); osc.stop(t + 0.18);
    this.trackVoice(osc);
    // whoosh
    this.noise(0.12, 0.18, "highpass", 1200);
  }

  private sandClear(intensity: number): void {
    // hero clear: impact + falling-sand hiss + sparkle (+ combo pitch)
    this.thud();
    this.noise(0.6, 0.22, "highpass", 2600); // granular hiss
    const base = 880 + intensity * 120;
    this.arp([base, base * 1.25, base * 1.5], 0.06, 0.12);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number): void {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = filter;
    bp.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.sfxBus!);
    src.start(t);
    src.stop(t + dur);
    this.trackVoice(src);
  }

  private arp(freqs: number[], step: number, vol = 0.2): void {
    const ctx = this.ctx!;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      const t = ctx.currentTime + i * step;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.5);
      osc.connect(g).connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + step * 1.6);
      this.trackVoice(osc);
    });
  }

  private trackVoice(node: AudioScheduledSourceNode): void {
    this.voices.add(node);
    node.onended = () => this.voices.release(node);
  }

  // ── BGM (per-theme pad) + crossfade ──────────────────────────────────────
  private onLevelChange = (p: LevelChangePayload) => {
    const themeChanged = p.theme !== this.currentTheme;
    this.currentTheme = p.theme;
    this.currentLevel = p.level;
    if (!this.started) return;
    // Only rebuild the loop when the world's theme actually changes — replays /
    // same-theme transitions keep the music flowing instead of restacking it.
    if (themeChanged) this.playBgm(p.theme);
    else this.bpm = this.score.bpm + Math.min(this.currentLevel, 18);
  };

  /** (Re)start the layered score for a theme: crossfade a new chord pad, retune
   *  the root/tempo, and ensure the sequencer (bass + arp) is running. */
  private playBgm(theme: string): void {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    this.score = themeScore(theme);
    this.root = this.score.root;
    this.bpm = this.score.bpm + Math.min(this.currentLevel, 18); // ramps with level

    // persistent group + sequencer layer (first run only)
    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.value = BGM_LEVEL;
      this.bgmGain.connect(this.musicBus);
    }
    if (!this.seqGain) {
      this.seqGain = ctx.createGain();
      this.seqGain.gain.value = 1;
      this.seqGain.connect(this.bgmGain);
    }

    // crossfade out the old pad
    if (this.padGain) {
      const oldGain = this.padGain;
      const oldOscs = this.padOscs;
      oldGain.gain.cancelScheduledValues(t);
      oldGain.gain.setValueAtTime(oldGain.gain.value, t);
      oldGain.gain.linearRampToValueAtTime(0, t + CROSSFADE_MS / 1000);
      oldOscs.forEach((n) => { try { n.stop(t + CROSSFADE_MS / 1000 + 0.05); } catch { /* */ } });
    }

    // new pad: 3 detuned saws → lowpass (slow LFO on cutoff) → fade-in gain.
    // Oscillators are retuned to each chord by the sequencer (setChordPad).
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0, t);
    padGain.gain.linearRampToValueAtTime(PAD_LEVEL, t + CROSSFADE_MS / 1000);
    padGain.connect(this.bgmGain);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800;
    lp.connect(padGain);

    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = this.score.padType;
      osc.detune.value = (i - 1) * 8; // slight spread for width
      osc.connect(lp);
      osc.start(t);
      oscs.push(osc);
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start(t);
    oscs.push(lfo);

    this.padGain = padGain;
    this.padOscs = oscs;
    this.setChordPad(0, t); // tune to first chord

    // Restart the sequence at the downbeat so each world's loop begins fresh
    // (reinforces that the previous theme stopped and a new one started).
    this.seqStep = 0;
    this.nextStepTime = t + 0.08;
    if (this.seqTimer === undefined) {
      this.seqTimer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
    }
    this.startAmbience(theme);
  }

  /** Lookahead scheduler: queue any 16th-note steps falling inside the window. */
  private scheduler(): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.seqStep, this.nextStepTime);
      this.nextStepTime += 15 / this.bpm; // one 16th note = (60/bpm)/4
      this.seqStep++;
    }
  }

  /** Emit the layers for a single 16th-note step at absolute time `t`. */
  private scheduleStep(step: number, t: number): void {
    const prog = this.score.progression;
    const s = step % STEPS_PER_BAR;
    const chordIdx = Math.floor(step / STEPS_PER_BAR) % prog.length;
    const chord = prog[chordIdx];

    if (s === 0) this.setChordPad(chordIdx, t); // retune pad at each bar

    // sub-bass: punchy root pulse on every beat (octave below), louder on the "1"
    if (s % 4 === 0) {
      const accent = s === 0 ? 1 : 0.7;
      this.bassNote(this.semi(chord.bass) / 2, t, accent);
    }
    // arpeggio: plucky notes climbing the chord (density per theme), an octave+
    // up → "epic" sparkle. arpDiv sets the spacing so each world has its own feel.
    const div = this.score.arpDiv;
    if (s % div === 0) {
      const arp = chord.triad;
      const beat = s / div;
      const note = arp[beat % arp.length] + (beat >= arp.length ? 12 : 0);
      this.arpNote(this.semi(note) * 2, t);
    }
  }

  /** semitone offset from current root → frequency. */
  private semi(n: number): number {
    return this.root * Math.pow(2, n / 12);
  }

  /** Retune the 3 pad saws to a chord triad (smooth glide, anti-zipper). */
  private setChordPad(chordIdx: number, t: number): void {
    const triad = this.score.progression[chordIdx].triad;
    this.padOscs.slice(0, 3).forEach((osc, i) => {
      osc.frequency.setTargetAtTime(this.semi(triad[i % triad.length]), t, 0.08);
    });
  }

  private bassNote(freq: number, t: number, accent: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = this.score.bassType;
    osc.frequency.setValueAtTime(freq * 2, t);          // quick pitch drop = thump
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * accent, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(g).connect(this.seqGain!);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  private arpNote(freq: number, t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = this.score.arpType;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g).connect(this.seqGain!);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  // ── ambience (optional per-scene low loop, 6.5) ──────────────────────────
  private ambienceSrc?: AudioBufferSourceNode;
  private ambienceFilter?: BiquadFilterNode;

  private startAmbience(theme: string): void {
    if (!this.ctx || !this.ambienceBus) return;
    const ctx = this.ctx;
    if (!this.ambienceSrc) {
      // 2s looping noise bed, low-passed → soft "room tone" under the music
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.02) * 0.98; // brown-ish noise
        d[i] = last;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(filt).connect(g).connect(this.ambienceBus);
      src.start();
      this.ambienceSrc = src;
      this.ambienceFilter = filt;
    }
    // retune the bed per theme
    if (this.ambienceFilter) this.ambienceFilter.frequency.value = themeScore(theme).root * 4;
  }

  // ── ducking + pause ──────────────────────────────────────────────────────
  private onClear = (p: { count: number }) => {
    this.playSfx("clear", p.count); // hero sand SFX, pitch scales with rows cleared
    this.duckMusic();
  };

  private duckMusic(): void {
    if (!this.ctx || !this.bgmGain) return;
    const t = this.ctx.currentTime;
    const cur = this.bgmGain.gain.value;
    this.bgmGain.gain.cancelScheduledValues(t);
    this.bgmGain.gain.setValueAtTime(cur, t);
    this.bgmGain.gain.linearRampToValueAtTime(cur * 0.7, t + 0.04);
    this.bgmGain.gain.linearRampToValueAtTime(BGM_LEVEL, t + DUCK_MS / 1000);
  }

  private onState = (p: { state: string }) => {
    if (!this.ctx || !this.bgmGain) return;
    const t = this.ctx.currentTime;
    if (p.state === "PAUSED") {
      this.bgmGain.gain.setTargetAtTime(BGM_LEVEL * 0.25, t, 0.05); // duck, don't stop
    } else if (p.state === "PLAYING") {
      this.bgmGain.gain.setTargetAtTime(BGM_LEVEL, t, 0.05);
    } else if (p.state === "LEVEL_COMPLETE") {
      this.playSfx("levelup");
    } else if (p.state === "GAME_OVER") {
      this.playSfx("gameover");
    }
  };

  private onSettings = (s: Record<string, unknown>) => {
    // Accept a nested { audio: {...} } or flat keys.
    const a = (s.audio as Partial<BusVolumes>) ?? (s as Partial<BusVolumes>);
    this.setVolumes(a);
  };

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else if (this.unlocked) void this.ctx.resume();
  };

  dispose(): void {
    if (this.seqTimer !== undefined) { clearInterval(this.seqTimer); this.seqTimer = undefined; }
    bus.off(EventName.Sfx, this.onSfx);
    bus.off(EventName.SettingsChange, this.onSettings);
    bus.off(EventName.LevelChange, this.onLevelChange);
    bus.off(EventName.StateChange, this.onState);
    bus.off(EventName.LinesCleared, this.onClear);
    document.removeEventListener("visibilitychange", this.onVisibility);
    void this.ctx?.close();
  }
}

/**
 * One unique loop per world. Each entry is a full composition — distinct
 * harmony (mode/progression), tempo, timbre and arp density — so every level's
 * background music is its own track, not a transposition of a shared loop.
 * Semitone offsets are relative to the theme root.
 */
const THEMES: Record<string, ThemeScore> = {
  // warm, bright major (I–V–vi–IV) — gentle plucky triangles
  dawn: {
    root: 130.8, bpm: 88, padType: "sawtooth", bassType: "sine", arpType: "triangle", arpDiv: 2,
    progression: [
      { bass: 0, triad: [0, 4, 7] }, { bass: 7, triad: [7, 11, 14] },
      { bass: 9, triad: [9, 12, 16] }, { bass: 5, triad: [5, 9, 12] },
    ],
  },
  // driving synthwave minor (i–VI–VII–v) — busy square arp
  neon: {
    root: 146.8, bpm: 104, padType: "sawtooth", bassType: "sawtooth", arpType: "square", arpDiv: 1,
    progression: [
      { bass: 0, triad: [0, 3, 7] }, { bass: 8, triad: [8, 12, 15] },
      { bass: 10, triad: [10, 14, 17] }, { bass: 7, triad: [7, 10, 14] },
    ],
  },
  // dreamy lydian sparkle — soft sine arp climbing in 4ths
  crystal: {
    root: 164.8, bpm: 96, padType: "triangle", bassType: "triangle", arpType: "sine", arpDiv: 2,
    progression: [
      { bass: 0, triad: [0, 4, 7] }, { bass: 2, triad: [2, 6, 9] },
      { bass: 5, triad: [5, 9, 12] }, { bass: 7, triad: [7, 11, 14] },
    ],
  },
  // phrygian exotic (i–bII–i–bVII) — that flat-2 desert tension
  dunes: {
    root: 110, bpm: 84, padType: "sawtooth", bassType: "square", arpType: "triangle", arpDiv: 2,
    progression: [
      { bass: 0, triad: [0, 3, 7] }, { bass: 1, triad: [1, 5, 8] },
      { bass: 0, triad: [0, 3, 7] }, { bass: 10, triad: [10, 13, 17] },
    ],
  },
  // calm, suspended/open chords — sparse sine arp, lots of air
  ocean: {
    root: 98, bpm: 80, padType: "sine", bassType: "sine", arpType: "sine", arpDiv: 4,
    progression: [
      { bass: 0, triad: [0, 5, 7] }, { bass: -2, triad: [-2, 3, 5] },
      { bass: 3, triad: [3, 7, 10] }, { bass: 5, triad: [5, 10, 12] },
    ],
  },
  // heavy minor power (i–bVI–bVII–i) — square bass + arp, molten
  forge: {
    root: 87.3, bpm: 100, padType: "sawtooth", bassType: "square", arpType: "square", arpDiv: 2,
    progression: [
      { bass: 0, triad: [0, 3, 7] }, { bass: 8, triad: [8, 12, 15] },
      { bass: 10, triad: [10, 14, 17] }, { bass: 0, triad: [0, 3, 7] },
    ],
  },
  // shimmering major7 — bright triangle arp, slow and wide
  aurora: {
    root: 174.6, bpm: 92, padType: "sawtooth", bassType: "sine", arpType: "triangle", arpDiv: 2,
    progression: [
      { bass: 0, triad: [0, 4, 7] }, { bass: 9, triad: [9, 12, 16] },
      { bass: 5, triad: [5, 9, 12] }, { bass: 7, triad: [7, 11, 14] },
    ],
  },
  // uplifting major (IV–V–I–vi) — anthemic, soaring
  sky: {
    root: 196, bpm: 98, padType: "sawtooth", bassType: "sine", arpType: "triangle", arpDiv: 2,
    progression: [
      { bass: 5, triad: [5, 9, 12] }, { bass: 7, triad: [7, 11, 14] },
      { bass: 0, triad: [0, 4, 7] }, { bass: 9, triad: [9, 12, 16] },
    ],
  },
  // dark, dissonant diminished/tritone colour — sawtooth arp, unsettling
  void: {
    root: 73.4, bpm: 76, padType: "sawtooth", bassType: "sine", arpType: "sawtooth", arpDiv: 2,
    progression: [
      { bass: 0, triad: [0, 3, 6] }, { bass: -1, triad: [-1, 2, 6] },
      { bass: 3, triad: [3, 6, 9] }, { bass: -2, triad: [-2, 1, 5] },
    ],
  },
  // bright whole-tone-ish augmented — busy square arp, kaleidoscopic
  prism: {
    root: 220, bpm: 108, padType: "sawtooth", bassType: "triangle", arpType: "square", arpDiv: 1,
    progression: [
      { bass: 0, triad: [0, 4, 8] }, { bass: 2, triad: [2, 6, 10] },
      { bass: 4, triad: [4, 8, 12] }, { bass: -2, triad: [-2, 2, 6] },
    ],
  },
};

/** Resolve a scene theme to its unique loop score (falls back to dawn). */
function themeScore(theme: string): ThemeScore {
  return THEMES[theme] ?? THEMES.dawn;
}
