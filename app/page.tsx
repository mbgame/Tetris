import Link from "next/link";

/**
 * Landing page — game picker. Intentionally light: no Phaser, no game stores.
 * Each card routes to /play with a ?mode= param; Phaser loads only on /play.
 */
export default function Home() {
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-10 bg-black px-6 py-12 text-center text-white">
      <div>
        <h1 className="bg-gradient-to-r from-teal-300 via-fuchsia-400 to-amber-300 bg-clip-text font-mono text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
          ChromaSand
        </h1>
        <p className="mt-4 max-w-md font-mono text-sm text-zinc-400">
          Two color puzzles, one palette. Pick your game.
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-5 sm:grid-cols-2">
        <Link
          href="/play?mode=classic"
          className="group flex flex-col items-start gap-3 rounded-2xl bg-zinc-900 p-6 text-left ring-1 ring-white/10 transition hover:ring-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
        >
          <span className="text-3xl">🟦</span>
          <h2 className="font-mono text-xl font-bold text-teal-300">Tetromino Sand</h2>
          <p className="font-mono text-xs text-zinc-400">
            Falling tetrominoes. Fill rows, watch them pour into sand. Ten worlds.
          </p>
          <span className="mt-2 font-mono text-sm font-semibold text-teal-300 group-hover:underline">
            Play →
          </span>
        </Link>

        <Link
          href="/play?mode=blast"
          className="group flex flex-col items-start gap-3 rounded-2xl bg-zinc-900 p-6 text-left ring-1 ring-white/10 transition hover:ring-fuchsia-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200"
        >
          <span className="text-3xl">🧩</span>
          <h2 className="font-mono text-xl font-bold text-fuchsia-300">Block Drop</h2>
          <p className="font-mono text-xs text-zinc-400">
            Drag blocks onto the grid. Fill rows or columns to clear. Reach the
            score target each level.
          </p>
          <span className="mt-2 font-mono text-sm font-semibold text-fuchsia-300 group-hover:underline">
            Play →
          </span>
        </Link>
      </div>

      <p className="font-mono text-xs text-zinc-600">Keyboard · touch · gamepad</p>
    </div>
  );
}
