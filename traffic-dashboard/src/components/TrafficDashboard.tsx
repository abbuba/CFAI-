"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RoadId, SimMode, TrafficSnapshot } from "@/types/traffic";
import {
  advanceTrafficSnapshot,
  createInitialSnapshot,
} from "@/lib/trafficSimulator";
import DecisionPanel from "@/components/DecisionPanel";

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#07080c] text-xs tracking-[0.3em] text-white/30">
      INITIALIZING DIGITAL TWIN
    </div>
  ),
});

export default function TrafficDashboard() {
  const [snapshot, setSnapshot] = useState<TrafficSnapshot>(() =>
    createInitialSnapshot(),
  );
  const [mode, setMode] = useState<SimMode>("fixed");
  const modeRef = useRef<SimMode>("fixed");
  const ambulanceRoadRef = useRef<RoadId>("AC");

  const handleAmbulanceRoad = useCallback((road: RoadId) => {
    ambulanceRoadRef.current = road;
  }, []);

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next: SimMode = current === "fixed" ? "adaptive" : "fixed";
      modeRef.current = next;
      setSnapshot((snap) =>
        advanceTrafficSnapshot(snap, ambulanceRoadRef.current, next),
      );
      return next;
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSnapshot((current) =>
        advanceTrafficSnapshot(current, ambulanceRoadRef.current, modeRef.current),
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const adaptive = mode === "adaptive";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07080c]">
      <Scene3D snapshot={snapshot} onAmbulanceRoad={handleAmbulanceRoad} />

      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45)_100%)]" />

      {/* header */}
      <div className="absolute left-6 top-6 z-20 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 backdrop-blur-xl">
        <p className="text-[9px] uppercase tracking-[0.35em] text-white/40">
          Smart City Network
        </p>
        <h1 className="mt-0.5 text-sm font-medium tracking-wide text-white/85">
          Adaptive Signal Coordination
        </h1>
      </div>

      {/* decision panel */}
      <div className="absolute right-6 top-6 z-20">
        <DecisionPanel snapshot={snapshot} />
      </div>

      {/* simulation control — before / after */}
      <div className="absolute bottom-6 left-6 z-20 w-80 rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          Simulation
        </p>
        <p className="mt-1 text-[10px] text-white/30">
          Scenario: dense E{"\u2013"}W flow · very light N{"\u2013"}S flow
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              adaptive
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]"
            }`}
          />
          <p
            className={`text-[11px] font-semibold tracking-[0.15em] ${
              adaptive ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {adaptive ? "AFTER · ADAPTIVE COORDINATION" : "BEFORE · FIXED TIMING"}
          </p>
        </div>

        <p className="mt-1.5 text-[10px] leading-4 text-white/35">
          {adaptive
            ? "Signals hold green for the dense direction and serve the light side only briefly."
            : "Equal green time for both directions — the dense side queues while the empty side gets green."}
        </p>

        {/* live comparison metric */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <p className="text-[9px] uppercase tracking-wider text-white/35">
              Avg wait E{"\u2013"}W
            </p>
            <p
              className={`font-mono text-lg leading-6 ${
                snapshot.stats.waitEW > 25 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {snapshot.stats.waitEW.toFixed(0)}s
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <p className="text-[9px] uppercase tracking-wider text-white/35">
              Avg wait N{"\u2013"}S
            </p>
            <p className="font-mono text-lg leading-6 text-white/70">
              {snapshot.stats.waitNS.toFixed(0)}s
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMode}
          className={`mt-3 w-full rounded-xl border px-4 py-2.5 text-[11px] font-semibold tracking-[0.15em] transition-all duration-300 ${
            adaptive
              ? "border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"
              : "border-emerald-400/30 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
          }`}
        >
          {adaptive ? "BACK TO FIXED TIMING" : "ACTIVATE ADAPTIVE MODE"}
        </button>
      </div>

      {/* bottom legend */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 backdrop-blur-xl">
        <span className="flex items-center gap-1.5 text-[10px] tracking-wide text-white/50">
          <span className="h-1.5 w-4 rounded-full bg-emerald-400/80" />
          Low
        </span>
        <span className="flex items-center gap-1.5 text-[10px] tracking-wide text-white/50">
          <span className="h-1.5 w-4 rounded-full bg-amber-400/80" />
          Med
        </span>
        <span className="flex items-center gap-1.5 text-[10px] tracking-wide text-white/50">
          <span className="h-1.5 w-4 rounded-full bg-red-400/80" />
          High
        </span>
      </div>
    </div>
  );
}
