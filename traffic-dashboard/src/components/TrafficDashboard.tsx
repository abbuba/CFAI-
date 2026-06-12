"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SimMode, TrafficSnapshot } from "@/types/traffic";
import {
  advanceTrafficSnapshot,
  createInitialSnapshot,
  resetSimulation,
} from "@/lib/trafficSimulator";
import InfoPanel from "@/components/InfoPanel";

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
  const [panelOpen, setPanelOpen] = useState(true);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [resetSpin, setResetSpin] = useState(false);
  const modeRef = useRef<SimMode>("fixed");

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next: SimMode = current === "fixed" ? "adaptive" : "fixed";
      modeRef.current = next;
      setSnapshot(resetSimulation(next));
      return next;
    });
  }, []);

  const resetView = useCallback(() => {
    setCameraResetKey((k) => k + 1);
    setResetSpin(true);
    window.setTimeout(() => setResetSpin(false), 650);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSnapshot((current) =>
        advanceTrafficSnapshot(current, modeRef.current),
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#e8e4dc]">
      <Scene3D snapshot={snapshot} cameraResetKey={cameraResetKey} />

      <button
        type="button"
        onClick={resetView}
        aria-label="Reset camera view"
        className="absolute bottom-6 left-6 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd6c8]/90 bg-[#f5f0e8]/90 text-[#3a3632]/55 shadow-sm transition-all duration-300 hover:border-[#c9c0b4] hover:text-[#3a3632] hover:shadow-md"
      >
        <span
          className={`inline-block text-base leading-none transition-transform duration-[650ms] ease-out ${
            resetSpin ? "rotate-[360deg]" : "rotate-0"
          }`}
        >
          ↻
        </span>
      </button>

      <InfoPanel
        mode={mode}
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        onSwitchMode={toggleMode}
      />
    </div>
  );
}
