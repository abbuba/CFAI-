"use client";

import type { Axis, LightState, TrafficSnapshot } from "@/types/traffic";

const STATE_TEXT: Record<LightState, string> = {
  green: "text-emerald-400",
  yellow: "text-amber-300",
  red: "text-red-400/50",
};

function AxisArrow({
  axis,
  state,
  active,
}: {
  axis: Axis;
  state: LightState;
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-base font-bold transition-all duration-500 ${
        active ? "bg-white/10 scale-110" : "bg-transparent opacity-60"
      } ${STATE_TEXT[state]}`}
      style={
        state === "green" && active
          ? { textShadow: "0 0 10px rgba(52,211,153,0.9)" }
          : undefined
      }
    >
      {axis === "EW" ? "\u2194" : "\u2195"}
    </span>
  );
}

export default function DecisionPanel({
  snapshot,
}: {
  snapshot: TrafficSnapshot;
}) {
  const emergencyActive = snapshot.emergencyTarget !== null;

  return (
    <div className="w-80 rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-white/40">
        Signal Decisions
      </p>
      <p className="mb-3 text-[10px] text-white/30">
        Greedy allocation every 5s · score = vehicles + queue
      </p>

      {emergencyActive ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-400/[0.08] px-3 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
          <p className="text-[11px] font-medium tracking-wide text-blue-300">
            GREEN CORRIDOR {"\u2192"} NODE {snapshot.emergencyTarget}
          </p>
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <p className="text-[11px] font-medium tracking-wide text-white/35">
            NO ACTIVE EMERGENCY
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {snapshot.decisions.map((d) => {
          const node = snapshot.intersections[d.id];
          const emergency = d.reason.startsWith("EMERGENCY");
          return (
            <div
              key={d.id}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-500 ${
                emergency
                  ? "border border-blue-400/30 bg-blue-400/[0.07]"
                  : "border border-white/[0.06] bg-white/[0.03]"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-[13px] font-semibold text-white/85">
                {d.id}
              </span>

              <AxisArrow
                axis="EW"
                state={node.ewState}
                active={d.activeAxis === "EW"}
              />
              <AxisArrow
                axis="NS"
                state={node.nsState}
                active={d.activeAxis === "NS"}
              />

              <div className="ml-auto text-right">
                <p className="font-mono text-[10px] leading-4 text-white/60">
                  SCORE {d.score} · G {d.greenDuration}s
                </p>
                <p className="font-mono text-[10px] leading-4 text-white/40">
                  {"\u2194"} {d.demandEW} · {"\u2195"} {d.demandNS} ·{" "}
                  <span className="text-emerald-300/80">{d.remaining}s left</span>
                </p>
                <p
                  className={`text-[9px] uppercase tracking-wider ${
                    emergency ? "text-blue-300" : "text-white/35"
                  }`}
                >
                  {d.reason}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
