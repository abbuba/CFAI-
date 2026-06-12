"use client";

import type { DecisionInfo, SimMode } from "@/types/traffic";

interface InfoPanelProps {
  mode: SimMode;
  open: boolean;
  waitEW: number;
  waitNS: number;
  decision: DecisionInfo;
  onToggle: () => void;
  onSwitchMode: () => void;
}

const NODES = [
  {
    id: "A",
    title: "Node A — Junction",
    body: "Where link A→B meets A→C. Signals here control both flows.",
  },
  {
    id: "B",
    title: "Node B — Busy link end",
    body: "End of the heavy A→B link. Queues form here on red.",
  },
  {
    id: "C",
    title: "Node C — Quiet link",
    body: "End of the light A→C link. Gets green even when A→B is packed.",
  },
  {
    id: "D",
    title: "Node D — Empty",
    body: "Part of the full grid. No traffic in this demo.",
  },
];

const DSA = [
  {
    name: "Queue",
    applied: "Cars line up at red on A→B",
    outcome: "Waiting line visible in 3D",
  },
  {
    name: "Priority Queue",
    applied: "Busy link ranked first in After mode",
    outcome: "A→B gets green before A→C",
  },
  {
    name: "Graph",
    applied: "Nodes A, B, C, D + road edges",
    outcome: "Full city network model",
  },
  {
    name: "Greedy",
    applied: "Green seconds follow congestion score",
    outcome: "Shorter avg wait on A→B in After",
  },
];

const REFERENCES = [
  {
    label: "Caltrans CA13-2157A",
    href: "https://dot.ca.gov/-/media/dot-media/programs/research-innovation-system-information/documents/final-reports/ca13-2157a-finalreport-a11y.pdf",
  },
  {
    label: "NACTO — Fixed vs Actuated",
    href: "https://nacto.org/publication/urban-street-design-guide/intersection-design-elements/traffic-signals/fixed-vs-actuated-signalization/",
  },
  {
    label: "arXiv 2505.14544",
    href: "https://arxiv.org/html/2505.14544v1",
  },
];

function PhaseTimeline({ decision, mode }: { decision: DecisionInfo; mode: SimMode }) {
  const ewActive = decision.activeAxis === "EW";
  const nsActive = decision.activeAxis === "NS";
  const phase = decision.reason === "Clearing" ? "yellow" : ewActive || nsActive ? "green" : "red";

  const linkAB =
    ewActive && phase === "green"
      ? "green"
      : ewActive && phase === "yellow"
        ? "yellow"
        : "red";
  const linkAC =
    nsActive && phase === "green"
      ? "green"
      : nsActive && phase === "yellow"
        ? "yellow"
        : "red";

  const barColor = {
    green: "bg-[#34c759]",
    yellow: "bg-[#d4a017]",
    red: "bg-[#ff3b30]/70",
  };

  const rows = [
    { label: "Link A→B", state: linkAB as keyof typeof barColor },
    { label: "Link A→C", state: linkAC as keyof typeof barColor },
  ];

  return (
    <div className="mt-4 rounded-xl bg-[#ede8df]/70 px-3.5 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#3a3632]/70">
          Phase timeline
        </p>
        <p className="font-mono text-[11px] text-[#3a3632]/80">
          {decision.remaining}s left
        </p>
      </div>
      <p className="mt-1 text-[10px] text-[#3a3632]/60">
        {mode === "fixed" ? "Before · equal timer" : "After · demand priority"}
      </p>
      <div className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-[10px] text-[#3a3632]/75">
              <span>{row.label}</span>
              <span className="uppercase">{row.state}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#ddd6c8]">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${barColor[row.state]}`}
                style={{
                  width:
                    row.state === "green"
                      ? `${Math.max(15, (decision.remaining / Math.max(decision.greenDuration, 1)) * 100)}%`
                      : row.state === "yellow"
                        ? "40%"
                        : "100%",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemFlowchart({ mode }: { mode: SimMode }) {
  return (
    <div className="mt-4 rounded-xl border border-[#ddd6c8]/80 bg-[#f5f0e8]/80 px-3 py-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[#3a3632]/70">
        How it works
      </p>
      <div className="flex flex-col items-center gap-1 text-[10px] text-[#3a3632]/85">
        <div className="rounded-lg bg-[#ede8df] px-3 py-1.5">Count vehicles + queue</div>
        <span className="text-[#3a3632]/40">↓</span>
        <div className="rounded-lg bg-[#ede8df] px-3 py-1.5">Score = count + queue</div>
        <span className="text-[#3a3632]/40">↓</span>
        <div className="rounded-lg bg-[#ede8df] px-3 py-1.5">
          {mode === "fixed" ? "Equal green timer" : "Greedy · longer green for busy link"}
        </div>
        <span className="text-[#3a3632]/40">↓</span>
        <div className="rounded-lg bg-[#ede8df] px-3 py-1.5">Update signals at A, B, C</div>
        <span className="text-[#3a3632]/40">↓</span>
        <div className="flex gap-2">
          <div className="rounded-lg bg-[#ff3b30]/15 px-2 py-1.5 text-[#ff3b30]">Queue at red</div>
          <div className="rounded-lg bg-[#34c759]/15 px-2 py-1.5 text-[#34c759]">Flow on green</div>
        </div>
      </div>
    </div>
  );
}

export default function InfoPanel({
  mode,
  open,
  waitEW,
  waitNS,
  decision,
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

      <aside className="flex h-full w-72 flex-col border-l border-[#ddd6c8]/80 bg-[#f5f0e8]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#3a3632]/60">
            Demo
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          <h2 className="text-[15px] font-medium tracking-tight text-[#3a3632]">
            Adaptive Signals
          </h2>
          <p className="mt-2 text-[12px] leading-5 text-[#3a3632]/80">
            Grid A—B / C—D. Traffic on link A→B (busy) and A→C (quiet). Other
            links stay empty.
          </p>

          <div className="mt-4 rounded-xl border border-[#ddd6c8]/70 bg-[#ede8df]/80 px-3.5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#3a3632]/70">
              Live metrics
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <p
                className={`font-mono text-[22px] font-medium leading-none ${
                  waitEW > 25
                    ? "text-[#ff3b30]"
                    : waitEW < 20
                      ? "text-[#34c759]"
                      : "text-[#3a3632]"
                }`}
              >
                {waitEW.toFixed(0)}s
              </p>
              <p className="text-[12px] text-[#3a3632]/80">avg wait · A→B</p>
            </div>
            <p className="mt-1 font-mono text-[11px] text-[#3a3632]/70">
              A→C · {waitNS.toFixed(0)}s
            </p>
            <p className="mt-2 text-[10px] leading-4 text-[#3a3632]/65">
              Simulated metric. Literature shows adaptive control cuts delay vs
              fixed-time plans (NACTO; Caltrans CA13-2157A).
            </p>
          </div>

          <PhaseTimeline decision={decision} mode={mode} />
          <SystemFlowchart mode={mode} />

          <div className="mt-4 space-y-2">
            {NODES.map((node) => (
              <div
                key={node.id}
                className="rounded-xl bg-[#ede8df]/55 px-3.5 py-2.5"
              >
                <p className="text-[12px] font-medium text-[#3a3632]">
                  {node.title}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#3a3632]/75">
                  {node.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-[#ede8df]/70 px-3.5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#3a3632]/70">
              {adaptive ? "After" : "Before"}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[#3a3632]/85">
              {adaptive
                ? "Longer green on busy A→B. Queues shrink."
                : "Equal green time. A→B waits while A→C moves."}
            </p>
          </div>

          <div className="mt-5 border-t border-[#ddd6c8]/70 pt-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#3a3632]/70">
              Data structures
            </p>
            <ul className="mt-2 space-y-2.5">
              {DSA.map((item) => (
                <li key={item.name} className="text-[11px] leading-4">
                  <span className="font-medium text-[#3a3632]">{item.name}</span>
                  <span className="text-[#3a3632]/75"> · {item.applied}</span>
                  <span className="block text-[#3a3632]/65">→ {item.outcome}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 border-t border-[#ddd6c8]/70 pt-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#3a3632]/70">
              References
            </p>
            <ul className="mt-2 space-y-1.5">
              {REFERENCES.map((ref) => (
                <li key={ref.label}>
                  <a
                    href={ref.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#3a3632]/75 underline decoration-[#3a3632]/25 hover:text-[#3a3632]"
                  >
                    {ref.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
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
