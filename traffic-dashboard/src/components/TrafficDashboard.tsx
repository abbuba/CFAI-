"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SimMode, TrafficSnapshot } from "@/types/traffic";
import {
  advanceTrafficSnapshot,
  createInitialSnapshot,
  resetSimulation,
} from "@/lib/trafficSimulator";

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#e8e4dc] text-xs font-light tracking-wide text-[#3a3632]/40">
      Loading
    </div>
  ),
});

export default function TrafficDashboard() {
  const [snapshot, setSnapshot] = useState<TrafficSnapshot>(() =>
    createInitialSnapshot(),
  );
  const [mode, setMode] = useState<SimMode>("fixed");
  const modeRef = useRef<SimMode>("fixed");

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next: SimMode = current === "fixed" ? "adaptive" : "fixed";
      modeRef.current = next;
      setSnapshot(resetSimulation(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSnapshot((current) =>
        advanceTrafficSnapshot(current, modeRef.current),
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const adaptive = mode === "adaptive";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#e8e4dc]">
      <Scene3D snapshot={snapshot} />

      <button
        type="button"
        onClick={toggleMode}
        className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 text-[12px] font-light tracking-wide text-[#3a3632]/70 transition-all duration-500 ease-out hover:text-[#3a3632]"
      >
        {adaptive ? "After · Adaptive" : "Before · Fixed"}
        <span className="mx-2 text-[#3a3632]/30">·</span>
        <span className="text-[#3a3632]/45">
          tap to {adaptive ? "show fixed timing" : "show adaptive timing"}
        </span>
      </button>
    </div>
  );
}
