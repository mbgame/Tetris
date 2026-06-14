"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";

/**
 * Client-only Phaser host. Phaser is dynamically imported inside useEffect so it
 * never reaches the server bundle (it needs window/document). The game is
 * destroyed on unmount to avoid duplicate WebGL contexts on route changes / HMR.
 */
export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let destroyed = false;
    (async () => {
      const { createGame } = await import("@/game/main");
      if (destroyed || !containerRef.current) return;
      gameRef.current = createGame(containerRef.current);
      setLoading(false);
    })();

    return () => {
      destroyed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} id="game-root" className="h-full w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3 font-mono text-teal-300">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
            <span className="text-sm">Loading ChromaSand…</span>
          </div>
        </div>
      )}
    </div>
  );
}
