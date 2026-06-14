import Link from "next/link";

/**
 * Landing page — intentionally light: no Phaser, no game stores. Phaser loads
 * only on /play via dynamic import, keeping this route's bundle small.
 */
export default function Home() {
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center gap-8 bg-black px-6 text-center text-white">
      <div>
        <h1 className="bg-gradient-to-r from-teal-300 via-fuchsia-400 to-amber-300 bg-clip-text font-mono text-6xl font-bold tracking-tight text-transparent">
          ChromaSand
        </h1>
        <p className="mt-4 max-w-md font-mono text-sm text-zinc-400">
          A color-clearing tetromino puzzle. Rows clear only when full <em>and</em> all one
          color — then they pour away as sand. Ten worlds, one rule.
        </p>
      </div>

      <Link
        href="/play"
        className="rounded-xl bg-teal-400 px-10 py-3 font-mono text-lg font-semibold text-black transition hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
      >
        Play
      </Link>

      <p className="font-mono text-xs text-zinc-600">Keyboard · touch · gamepad</p>
    </div>
  );
}
