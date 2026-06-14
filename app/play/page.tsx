"use client";

import dynamic from "next/dynamic";
import HudBridge from "@/components/HUD/HudBridge";
import PlayOverlay from "@/components/PlayOverlay";

// ssr:false keeps Phaser off the server; allowed here because this is a client component.
const GameCanvas = dynamic(() => import("@/components/GameCanvas"), { ssr: false });

export default function PlayPage() {
  return (
    <main
      className="relative w-screen overflow-hidden bg-black"
      style={{
        height: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <GameCanvas />
      {/* bus → stores wiring (renders nothing) */}
      <HudBridge />
      {/* DOM HUD + menus on top of the canvas */}
      <PlayOverlay />
    </main>
  );
}
