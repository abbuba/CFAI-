"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RoadId, SimMode, TrafficSnapshot } from "@/types/traffic";
import {
  advanceTrafficSnapshot,
  createInitialSnapshot,
} from "@/lib/trafficSimulator";
import { AMBULANCE_PATH, roadNodes } from "@/lib/intersectionLayout";
import DecisionPanel from "@/components/DecisionPanel";
import type { AmbulanceSpawn } from "@/components/Scene3D";

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#07080c] text-xs tracking-[0.3em] text-white/30">
      INITIALIZING DIGITAL TWIN
    </div>
  ),
});

interface LogEvent {
  id: number;
  time: string;
  message: string;
  kind: "emergency" | "info";
}

let eventId = 0;

function timeNow(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export default function TrafficDashboard() {
  const [snapshot, setSnapshot] = useState<TrafficSnapshot>(() =>
    createInitialSnapshot(),
  );
  const [mode, setMode] = useState<SimMode>("fixed");
  const [ambulance, setAmbulance] = useState<AmbulanceSpawn | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const modeRef = useRef<SimMode>("fixed");
  const ambulanceRoadRef = useRef<RoadId | null>(null);

  const logEvent = useCallback(
    (message: string, kind: LogEvent["kind"] = "info") => {
      setEvents((current) =>
        [
          { id: (eventId += 1), time: timeNow(), message, kind },
          ...current,
        ].slice(0, 6),
      );
    },
    [],
  );

  const handleAmbulanceRoad = useCallback(
    (road: RoadId) => {
      ambulanceRoadRef.current = road;
      const target = roadNodes(road)[1];
      logEvent(`Emergency vehicle detected at Intersection ${target}`, "emergency");
      logEvent(`Signal priority granted \u2192 Node ${target}`, "emergency");
    },
    [logEvent],
  );

  const spawnAmbulance = useCallback(() => {
    const startSegment = Math.floor(Math.random() * AMBULANCE_PATH.length);
    const road = AMBULANCE_PATH[startSegment];
    ambulanceRoadRef.current = road;
    setAmbulance({ id: Date.now(), startSegment });
    logEvent(`Ambulance dispatched on road ${road}`, "emergency");
    const target = roadNodes(road)[1];
    logEvent(`Emergency vehicle detected at Intersection ${target}`, "emergency");
    logEvent(`Signal priority granted \u2192 Node ${target}`, "emergency");
  }, [logEvent]);

  const handleAmbulanceDone = useCallback(() => {
    setAmbulance(null);
    ambulanceRoadRef.current = null;
    logEvent("Ambulance passed \u00b7 normal signal control resumed");
  }, [logEvent]);

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next: SimMode = current === "fixed" ? "adaptive" : "fixed";
      modeRef.current = next;
      logEvent(
        next === "adaptive"
          ? "Adaptive coordination activated \u00b7 greedy green allocation"
          : "Reverted to fixed signal timing",
      );
      setSnapshot((snap) =>
        advanceTrafficSnapshot(snap, ambulanceRoadRef.current, next),
      );
      return next;
    });
  }, [logEvent]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSnapshot((current) =>
        advanceTrafficSnapshot(current, ambulanceRoadRef.current, modeRef.current),
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const adaptive = mode === "adaptive";
  const emergencyActive = ambulance !== null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07080c]">
      <Scene3D
        snapshot={snapshot}
        ambulance={ambulance}
        onAmbulanceRoad={handleAmbulanceRoad}
        onAmbulanceDone={handleAmbulanceDone}
      />

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

      {/* emergency override badge */}
      {emergencyActive && (
        <div className="absolute left-1/2 top-6 z-20 -translate-x-1/2 animate-pulse rounded-2xl border border-red-400/40 bg-red-500/15 px-5 py-2.5 backdrop-blur-xl">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-red-300">
            EMERGENCY OVERRIDE
            {snapshot.emergencyTarget
              ? ` \u00b7 NODE ${snapshot.emergencyTarget}`
              : ""}
          </p>
        </div>
      )}

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

        <button
          type="button"
          onClick={spawnAmbulance}
          disabled={emergencyActive}
          className={`mt-2 w-full rounded-xl border px-4 py-2.5 text-[11px] font-semibold tracking-[0.15em] transition-all duration-300 ${
            emergencyActive
              ? "cursor-not-allowed border-red-400/15 bg-red-400/5 text-red-300/40"
              : "border-red-400/30 bg-red-400/15 text-red-300 hover:bg-red-400/25"
          }`}
        >
          {emergencyActive ? "AMBULANCE ACTIVE" : "SPAWN AMBULANCE"}
        </button>
      </div>

      {/* event log */}
      <div className="absolute bottom-6 left-1/2 z-20 w-[26rem] -translate-x-1/2 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-xl">
        <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
          Event Log
        </p>
        {events.length === 0 ? (
          <p className="text-[10px] text-white/25">
            No events yet — spawn an ambulance or switch modes.
          </p>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <p
                key={event.id}
                className={`font-mono text-[10px] leading-4 ${
                  event.kind === "emergency" ? "text-blue-300" : "text-white/45"
                }`}
              >
                <span className="text-white/25">{event.time}</span>{" "}
                {event.message}
              </p>
            ))}
          </div>
        )}
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[9px] tracking-wide text-white/25">
          Queue · waiting vehicles &nbsp; PriorityQueue · emergency &nbsp; Graph ·
          road network &nbsp; Greedy · green allocation
        </p>
      </div>

      {/* bottom legend */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[10px] tracking-wide text-white/50">
            <span className="h-1.5 w-4 rounded-full bg-emerald-400/80" />
            0{"\u2013"}30
          </span>
          <span className="flex items-center gap-1.5 text-[10px] tracking-wide text-white/50">
            <span className="h-1.5 w-4 rounded-full bg-amber-400/80" />
            31{"\u2013"}80
          </span>
          <span className="flex items-center gap-1.5 text-[10px] tracking-wide text-white/50">
            <span className="h-1.5 w-4 rounded-full bg-red-400/80" />
            81+
          </span>
        </div>
        <p className="text-[9px] tracking-wide text-white/25">
          vehicles per segment
        </p>
      </div>
    </div>
  );
}
