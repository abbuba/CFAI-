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
import DemoNarrator from "@/components/DemoNarrator";

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#e8e4dc] text-xs font-light tracking-wide text-[#3a3632]/40">
      Loading
    </div>
  ),
});

export default function TrafficDashboard() {
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<TrafficSnapshot | null>(null);
  const [mode, setMode] = useState<SimMode>("fixed");
  const [panelOpen, setPanelOpen] = useState(true);
  const [cameraFlyKey, setCameraFlyKey] = useState(1);
  const [cameraInstant, setCameraInstant] = useState(true);
  const [modeSwitchKey, setModeSwitchKey] = useState(1);
  const modeRef = useRef<SimMode>("fixed");

  useEffect(() => {
    setSnapshot(createInitialSnapshot());
    setMounted(true);
  }, []);

  const snapToNodeA = useCallback((instant: boolean) => {
    setCameraInstant(instant);
    setCameraFlyKey((k) => k + 1);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next: SimMode = current === "fixed" ? "adaptive" : "fixed";
      modeRef.current = next;
      setSnapshot(resetSimulation(next));
      return next;
    });
    setModeSwitchKey((k) => k + 1);
    snapToNodeA(true);
  }, [snapToNodeA]);

  useEffect(() => {
    if (!mounted) return;
    const interval = window.setInterval(() => {
      setSnapshot((current) =>
        current
          ? advanceTrafficSnapshot(current, modeRef.current)
          : createInitialSnapshot(),
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, [mounted]);

  if (!mounted || !snapshot) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#e8e4dc] text-xs font-light tracking-wide text-[#3a3632]/40">
        Loading
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#e8e4dc]">
      <Scene3D
        snapshot={snapshot}
        cameraFlyKey={cameraFlyKey}
        cameraInstant={cameraInstant}
      />

      <DemoNarrator
        snapshot={snapshot}
        mode={mode}
        modeSwitchKey={modeSwitchKey}
      />

      <button
        type="button"
        onClick={() => snapToNodeA(false)}
        className="absolute bottom-6 left-6 z-20 rounded-full border border-[#ddd6c8]/90 bg-[#f5f0e8]/90 px-3 py-1.5 text-[10px] font-medium tracking-wide text-[#3a3632]/70 shadow-sm transition-colors hover:text-[#3a3632]"
      >
        Back to Node A
      </button>

      <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[10px] tracking-wide text-[#3a3632]/40">
        Drag to orbit · scroll to zoom · right-drag to pan
      </p>

      <InfoPanel
        mode={mode}
        open={panelOpen}
        waitEW={snapshot.stats.waitEW}
        onToggle={() => setPanelOpen((v) => !v)}
        onSwitchMode={toggleMode}
      />
    </div>
  );
}
