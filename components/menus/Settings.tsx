"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings, type QualityTier } from "@/store/useSettings";
import { Button, Panel, Slider, Toggle } from "@/components/ui";

type Tab = "audio" | "graphics" | "gameplay";
const TIERS: QualityTier[] = ["auto", "low", "medium", "high", "ultra"];

/** Live FPS readout via rAF sampling. */
function useFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const loop = (t: number) => {
      frames++;
      if (t - last >= 500) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("audio");
  const [advanced, setAdvanced] = useState(false);
  const s = useSettings();
  const fps = useFps();
  const initialBroadcast = useRef(false);

  // ensure game has current values when panel opens
  useEffect(() => {
    if (!initialBroadcast.current) {
      s.broadcast();
      initialBroadcast.current = true;
    }
  }, [s]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Panel title="Settings">
        <div className="mb-4 flex gap-2 font-mono text-sm">
          {(["audio", "graphics", "gameplay"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 capitalize ${tab === t ? "bg-teal-400 text-black" : "bg-white/10"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "audio" && (
          <div>
            <Slider label="Master" value={s.audio.master} onChange={(v) => s.setAudio({ master: v })} />
            <Slider label="Music" value={s.audio.music} onChange={(v) => s.setAudio({ music: v })} />
            <Slider label="SFX" value={s.audio.sfx} onChange={(v) => s.setAudio({ sfx: v })} />
            <Toggle label="Mute all" value={s.audio.muteAll} onChange={(v) => s.setAudio({ muteAll: v })} />
          </div>
        )}

        {tab === "graphics" && (
          <div>
            <label className="block py-1.5 font-mono text-sm">
              <div className="flex justify-between">
                <span>Quality tier</span>
                <span className="opacity-70">{fps} fps</span>
              </div>
              <select
                value={s.graphics.tier}
                onChange={(e) => s.setGraphics({ tier: e.target.value as QualityTier })}
                className="mt-1 w-full rounded bg-white/10 p-2 capitalize"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t} className="bg-zinc-800 capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <Slider
              label="Background dim"
              value={Math.round(s.graphics.bgDim * 100)}
              onChange={(v) => s.setGraphics({ bgDim: v / 100 })}
              suffix="%"
            />
            <Toggle label="Bloom" value={s.graphics.bloom} onChange={(v) => s.setGraphics({ bloom: v })} />
            <Toggle label="Screen shake" value={s.graphics.screenShake} onChange={(v) => s.setGraphics({ screenShake: v })} />
            <Toggle label="Reduce motion" value={s.graphics.reduceMotion} onChange={(v) => s.setGraphics({ reduceMotion: v })} />
            <Toggle label="Colorblind glyphs" value={s.graphics.colorblindGlyphs} onChange={(v) => s.setGraphics({ colorblindGlyphs: v })} />
          </div>
        )}

        {tab === "gameplay" && (
          <div>
            <label className="block py-1.5 font-mono text-sm">
              <span>Rule mode</span>
              <select
                value={s.gameplay.ruleMode}
                onChange={(e) => s.setGameplay({ ruleMode: e.target.value as "color" | "classic" })}
                className="mt-1 w-full rounded bg-white/10 p-2"
              >
                <option value="color" className="bg-zinc-800">Color (default)</option>
                <option value="classic" className="bg-zinc-800">Classic / assist</option>
              </select>
              <p className="mt-1 text-xs opacity-60">
                Color: a row clears only when full AND all one color. Classic: any full row
                clears (easier assist mode).
              </p>
            </label>
            <label className="block py-1.5 font-mono text-sm">
              <span>Touch controls</span>
              <select
                value={s.gameplay.controlScheme}
                onChange={(e) => s.setGameplay({ controlScheme: e.target.value as "buttons" | "gestures" })}
                className="mt-1 w-full rounded bg-white/10 p-2 capitalize"
              >
                <option value="buttons" className="bg-zinc-800">Buttons</option>
                <option value="gestures" className="bg-zinc-800">Gestures</option>
              </select>
            </label>
            <Toggle label="Haptics (vibrate)" value={s.gameplay.haptics} onChange={(v) => s.setGameplay({ haptics: v })} />
            <Toggle label="Ghost piece" value={s.gameplay.ghostPiece} onChange={(v) => s.setGameplay({ ghostPiece: v })} />
            <label className="block py-1.5 font-mono text-sm">
              <span>Next pieces shown</span>
              <select
                value={s.gameplay.showNextCount}
                onChange={(e) => s.setGameplay({ showNextCount: Number(e.target.value) as 1 | 2 | 3 })}
                className="mt-1 w-full rounded bg-white/10 p-2"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n} className="bg-zinc-800">{n}</option>
                ))}
              </select>
            </label>
            <button onClick={() => setAdvanced((a) => !a)} className="mt-2 font-mono text-xs underline opacity-70">
              {advanced ? "▾" : "▸"} Advanced (DAS/ARR)
            </button>
            {advanced && (
              <div className="mt-1">
                <Slider label="DAS" value={s.gameplay.das} min={0} max={300} suffix="ms" onChange={(v) => s.setGameplay({ das: v })} />
                <Slider label="ARR" value={s.gameplay.arr} min={0} max={120} suffix="ms" onChange={(v) => s.setGameplay({ arr: v })} />
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </Panel>
    </div>
  );
}
