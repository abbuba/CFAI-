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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#e8e4dc]">
      <Scene3D snapshot={snapshot} />

      <InfoPanel
        mode={mode}
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        onSwitchMode={toggleMode}
      />
    </div>
  );
}
