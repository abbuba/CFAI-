"use client";

import type { SimMode } from "@/types/traffic";

interface InfoPanelProps {
  mode: SimMode;
  open: boolean;
  onToggle: () => void;
  onSwitchMode: () => void;
}

const DSA = [
  { name: "Queue", use: "Vehicles waiting at red" },
  { name: "Priority Queue", use: "Greedy green ranking" },
  { name: "Graph", use: "Road network (A–B–C–D)" },
  { name: "Greedy", use: "Longer green for busy roads" },
];

export default function InfoPanel({
  mode,
  open,
  onToggle,
  onSwitchMode,
}: InfoPanelProps) {
  const adaptive = mode === "adaptive";

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Open info panel"
        className="absolute right-0 top-1/2 z-30 flex h-16 w-7 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-[#ddd6c8]/80 bg-[#f5f0e8]/95 text-[#3a3632]/50 shadow-sm transition-colors duration-300 hover:text-[#3a3632]"
      >
        <span className="text-sm">‹</span>
      </button>
    );
  }

  return (
    <aside className="absolute right-0 top-0 z-30 flex h-full w-72 flex-col border-l border-[#ddd6c8]/80 bg-[#f5f0e8]/92 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 pt-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#3a3632]/45">
          Demo
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close info panel"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#3a3632]/45 transition-colors duration-300 hover:bg-[#ede8df] hover:text-[#3a3632]"
        >
          ›
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">
        <h2 className="text-[15px] font-medium tracking-tight text-[#3a3632]">
          Adaptive Signals
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-[#3a3632]/65">
          Two active roads only: dense east–west (A→B) and light north–south
          (A→C). Other roads stay empty.
        </p>

        <div className="mt-4 rounded-xl bg-[#ede8df]/60 px-3.5 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#3a3632]/45">
            {adaptive ? "After" : "Before"}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#3a3632]/75">
            {adaptive
              ? "Green stays on the busy road. Queues shrink."
              : "Equal green time. Busy road waits while the empty road moves."}
          </p>
        </div>

        <p className="mt-4 text-[11px] leading-5 text-[#3a3632]/55">
          Drag to rotate the 3D view. Scroll to zoom. Read live status on each
          traffic light.
        </p>

        <div className="mt-5 border-t border-[#ddd6c8]/60 pt-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#3a3632]/45">
            Data structures
          </p>
          <ul className="mt-2 space-y-2">
            {DSA.map((item) => (
              <li key={item.name} className="text-[11px] leading-4">
                <span className="font-medium text-[#3a3632]/80">{item.name}</span>
                <span className="text-[#3a3632]/50"> — {item.use}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#ddd6c8]/60 px-5 py-4">
        <button
          type="button"
          onClick={onSwitchMode}
          className="w-full rounded-xl bg-[#3a3632]/8 py-2.5 text-[12px] font-medium text-[#3a3632]/80 transition-colors duration-300 hover:bg-[#3a3632]/12"
        >
          {adaptive ? "Switch to Before · Fixed" : "Switch to After · Adaptive"}
        </button>
      </div>
    </aside>
  );
}
