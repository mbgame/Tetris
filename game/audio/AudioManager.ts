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
const CROSSFADE_MS = 800;
const DUCK_MS = 250;

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

  private bgmGain?: GainNode; // current track gain (under musicBus)
  private bgmNodes: AudioScheduledSourceNode[] = [];
  private currentTheme = "dawn";

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
    this.currentTheme = p.theme;
    if (this.started) this.playBgm(p.theme);
  };

  /** Crossfade to a new themed pad. */
  private playBgm(theme: string): void {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // fade out + stop the old track
    if (this.bgmGain) {
      const old = this.bgmGain;
      const oldNodes = this.bgmNodes;
      old.gain.cancelScheduledValues(t);
      old.gain.setValueAtTime(old.gain.value, t);
      old.gain.linearRampToValueAtTime(0, t + CROSSFADE_MS / 1000);
      oldNodes.forEach((n) => { try { n.stop(t + CROSSFADE_MS / 1000 + 0.05); } catch { /* */ } });
    }

    // build new pad: 3 detuned saws through a lowpass, slow LFO on cutoff
    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0, t);
    trackGain.gain.linearRampToValueAtTime(0.18, t + CROSSFADE_MS / 1000);
    trackGain.connect(this.musicBus);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.connect(trackGain);

    const root = themeRoot(theme);
    const nodes: AudioScheduledSourceNode[] = [];
    for (const [mult, detune] of [[1, -6], [1.5, 0], [2, 6]] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = root * mult;
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(t);
      nodes.push(osc);
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start(t);
    nodes.push(lfo);

    this.bgmGain = trackGain;
    this.bgmNodes = nodes;
    this.startAmbience(theme);
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
    if (this.ambienceFilter) this.ambienceFilter.frequency.value = themeRoot(theme) * 4;
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
    this.bgmGain.gain.linearRampToValueAtTime(cur * 0.85, t + 0.04);
    this.bgmGain.gain.linearRampToValueAtTime(cur, t + DUCK_MS / 1000);
  }

  private onState = (p: { state: string }) => {
    if (!this.ctx || !this.bgmGain) return;
    const t = this.ctx.currentTime;
    if (p.state === "PAUSED") {
      this.bgmGain.gain.setTargetAtTime(0.05, t, 0.05); // duck, don't stop
    } else if (p.state === "PLAYING") {
      this.bgmGain.gain.setTargetAtTime(0.18, t, 0.05);
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
    bus.off(EventName.Sfx, this.onSfx);
    bus.off(EventName.SettingsChange, this.onSettings);
    bus.off(EventName.LevelChange, this.onLevelChange);
    bus.off(EventName.StateChange, this.onState);
    bus.off(EventName.LinesCleared, this.onClear);
    document.removeEventListener("visibilitychange", this.onVisibility);
    void this.ctx?.close();
  }
}

/** Map a scene theme to a musical root frequency so each world sounds distinct. */
function themeRoot(theme: string): number {
  const roots: Record<string, number> = {
    dawn: 130.8, neon: 146.8, crystal: 164.8, dunes: 110, ocean: 98,
    forge: 87.3, aurora: 174.6, sky: 196, void: 73.4, prism: 220,
  };
  return roots[theme] ?? 130.8;
}
