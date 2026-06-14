"use client";

import type { ReactNode } from "react";

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  const base =
    "rounded-lg px-5 py-2.5 font-mono text-sm font-semibold transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900";
  const styles =
    variant === "primary"
      ? "bg-teal-400 text-black hover:bg-teal-300"
      : "bg-white/10 text-white hover:bg-white/20";
  return (
    <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 font-mono text-sm">
      <span>{label}</span>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`h-6 w-11 rounded-full transition ${value ? "bg-teal-400" : "bg-white/20"}`}
      >
        <span
          className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block py-1.5 font-mono text-sm">
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="opacity-70">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-teal-400"
      />
    </label>
  );
}

export function Panel({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="pointer-events-auto w-[min(92vw,440px)] rounded-2xl bg-zinc-900/95 p-6 text-white shadow-2xl ring-1 ring-white/10">
      {title && <h2 className="mb-4 font-mono text-xl font-bold">{title}</h2>}
      {children}
    </div>
  );
}
