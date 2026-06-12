"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SimMode, TrafficSnapshot } from "@/types/traffic";
import {
  advanceTrafficSnapshot,
  createInitialSnapshot,
  resetSimulation,
} from "@/lib/trafficSimulator";
import {
  CAMERA_PRESETS,
  type CameraPresetId,
} from "@/lib/cameraPresets";
import InfoPanel from "@/components/InfoPanel";

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#e8e4dc] text-xs font-light tracking-wide text-[#3a3632]/40">
      Loading
    </div>
  ),
});

const PRESET_ORDER: CameraPresetId[] = ["overview", "nodeA", "nodeB"];

export default function TrafficDashboard() {
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<TrafficSnapshot | null>(null);
  const [mode, setMode] = useState<SimMode>("fixed");
  const [panelOpen, setPanelOpen] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>("overview");
  const [cameraFlyKey, setCameraFlyKey] = useState(0);
  const [resetSpin, setResetSpin] = useState(false);
  const modeRef = useRef<SimMode>("fixed");

  useEffect(() => {
    setSnapshot(createInitialSnapshot());
    setMounted(true);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next: SimMode = current === "fixed" ? "adaptive" : "fixed";
      modeRef.current = next;
      setSnapshot(resetSimulation(next));
      return next;
    });
  }, []);

  const flyToPreset = useCallback((preset: CameraPresetId) => {
    setCameraPreset(preset);
    setCameraFlyKey((k) => k + 1);
    if (preset === "overview") {
      setResetSpin(true);
      window.setTimeout(() => setResetSpin(false), 650);
    }
  }, []);

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

  const decision = snapshot.decisions[0];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#e8e4dc]">
      <Scene3D
        snapshot={snapshot}
        cameraFlyKey={cameraFlyKey}
        cameraPreset={cameraPreset}
      />

      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-[#ddd6c8]/90 bg-[#f5f0e8]/90 px-1 py-1 shadow-sm">
          {PRESET_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => flyToPreset(id)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide transition-colors duration-200 ${
                cameraPreset === id
                  ? "bg-[#3a3632]/12 text-[#3a3632]"
                  : "text-[#3a3632]/50 hover:text-[#3a3632]/80"
              }`}
            >
              {CAMERA_PRESETS[id].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => flyToPreset("overview")}
          aria-label="Reset camera view"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd6c8]/90 bg-[#f5f0e8]/90 text-[#3a3632]/55 shadow-sm transition-all duration-300 hover:border-[#c9c0b4] hover:text-[#3a3632] hover:shadow-md"
        >
          <span
            className={`inline-block text-base leading-none transition-transform duration-[650ms] ease-out ${
              resetSpin ? "rotate-[360deg]" : "rotate-0"
            }`}
          >
            ↻
          </span>
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[10px] tracking-wide text-[#3a3632]/40">
        Drag to orbit · scroll to zoom · right-drag to pan
      </p>

      <InfoPanel
        mode={mode}
        open={panelOpen}
        waitEW={snapshot.stats.waitEW}
        waitNS={snapshot.stats.waitNS}
        decision={decision}
        onToggle={() => setPanelOpen((v) => !v)}
        onSwitchMode={toggleMode}
      />
    </div>
  );
}
