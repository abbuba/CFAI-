"use client";

import type { SimMode } from "@/types/traffic";

interface InfoPanelProps {
  mode: SimMode;
  open: boolean;
  waitEW: number;
  onToggle: () => void;
  onSwitchMode: () => void;
}

function SystemFlowchart({ mode }: { mode: SimMode }) {
  const adaptive = mode === "adaptive";

  const steps = [
    {
      label: "Sense",
      detail: "Count vehicles and queue length on each link",
    },
    {
      label: "Score",
      detail: "Busy A→B ranks above quiet A→C",
    },
    {
      label: "Decide",
      detail: adaptive
        ? "Keep green on A→B until the queue clears · A→C waits"
        : "Split green time equally · fixed timer",
    },
    {
      label: "Signal",
      detail: "Update traffic lights at Node A",
    },
  ];

  return (
    <div className="mt-5 rounded-xl border border-[#ddd6c8]/80 bg-[#f5f0e8]/80 px-3 py-3">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[#3a3632]/70">
        How it works
      </p>
      <div className="flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="rounded-lg border border-[#ddd6c8]/60 bg-[#ede8df] px-3 py-2">
              <p className="text-[11px] font-medium text-[#3a3632]">
                {i + 1}. {step.label}
              </p>
              <p className="mt-0.5 text-[10px] leading-4 text-[#3a3632]/75">
                {step.detail}
              </p>
            </div>
            {i < steps.length - 1 && (
              <p className="py-0.5 text-center text-[10px] text-[#3a3632]/35">
                ↓
              </p>
            )}
          </div>
        ))}
        <div className="mt-1 flex gap-2">
          <div className="flex-1 rounded-lg bg-[#ff3b30]/12 px-2 py-2 text-center">
            <p className="text-[10px] font-medium text-[#ff3b30]">Red</p>
            <p className="text-[9px] text-[#3a3632]/70">Cars queue</p>
          </div>
          <div className="flex-1 rounded-lg bg-[#34c759]/12 px-2 py-2 text-center">
            <p className="text-[10px] font-medium text-[#34c759]">Green</p>
            <p className="text-[9px] text-[#3a3632]/70">Cars flow</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InfoPanel({
  mode,
  open,
  waitEW,
  onToggle,
  onSwitchMode,
}: InfoPanelProps) {
  const adaptive = mode === "adaptive";

  return (
    <div
      className={`absolute right-0 top-0 z-30 flex h-full transition-transform duration-[450ms] ease-out ${
        open ? "translate-x-0" : "translate-x-[calc(100%-1.75rem)]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Close info panel" : "Open info panel"}
        className="flex w-7 shrink-0 items-center justify-center self-center rounded-l-xl border border-r-0 border-[#ddd6c8]/90 bg-[#f5f0e8]/95 text-[#3a3632]/60 shadow-sm transition-colors hover:text-[#3a3632]"
      >
        <span
          className={`inline-block text-sm transition-transform duration-[450ms] ease-out ${
            open ? "rotate-180" : "rotate-0"
          }`}
        >
          ‹
        </span>
      </button>

      <aside className="flex h-full w-80 flex-col border-l border-[#ddd6c8]/80 bg-[#f5f0e8]/95 backdrop-blur-sm">
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-5">
          <h2 className="text-[15px] font-medium tracking-tight text-[#3a3632]">
            Traffic Signal Demo
          </h2>

          <span
            className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
              adaptive
                ? "bg-[#34c759]/15 text-[#34c759]"
                : "bg-[#ff3b30]/10 text-[#ff3b30]"
            }`}
          >
            {adaptive ? "After · Adaptive" : "Before · Fixed"}
          </span>

          <p className="mt-4 text-[12px] leading-5 text-[#3a3632]/85">
            {adaptive
              ? "Busy A→B keeps green until its queue clears. Quiet A→C waits."
              : "Green time is split evenly. A→B waits while A→C moves."}
          </p>
          <p className="mt-2 text-[12px] leading-5 text-[#3a3632]/75">
            Nodes A (junction), B (busy end), C (quiet link), D (empty) are
            labeled in the 3D view.
          </p>

          <div className="mt-5 rounded-xl bg-[#ede8df]/80 px-3.5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#3a3632]/70">
              Avg wait · A→B
            </p>
            <p
              className={`mt-1 font-mono text-[28px] font-medium leading-none ${
                waitEW > 25
                  ? "text-[#ff3b30]"
                  : waitEW < 20
                    ? "text-[#34c759]"
                    : "text-[#3a3632]"
              }`}
            >
              {waitEW.toFixed(0)}s
            </p>
            <p className="mt-2 text-[10px] text-[#3a3632]/60">
              Simulated demo numbers, not real city data.
            </p>
          </div>

          <SystemFlowchart mode={mode} />
        </div>

        <div className="border-t border-[#ddd6c8]/70 px-5 py-4">
          <button
            type="button"
            onClick={onSwitchMode}
            className="w-full rounded-xl bg-[#3a3632]/10 py-2.5 text-[12px] font-medium text-[#3a3632] transition-colors duration-300 hover:bg-[#3a3632]/15"
          >
            {adaptive ? "Switch to Before · Fixed" : "Switch to After · Adaptive"}
          </button>
        </div>
      </aside>
    </div>
  );
}
