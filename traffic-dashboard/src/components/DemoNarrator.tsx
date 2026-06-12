"use client";

import { useEffect, useState } from "react";
import type { SimMode, TrafficSnapshot } from "@/types/traffic";
import { getLiveNarrator, getModeIntro } from "@/lib/demoNarrator";

interface DemoNarratorProps {
  snapshot: TrafficSnapshot;
  mode: SimMode;
  modeSwitchKey: number;
}

export default function DemoNarrator({
  snapshot,
  mode,
  modeSwitchKey,
}: DemoNarratorProps) {
  const [introActive, setIntroActive] = useState(true);
  const [message, setMessage] = useState(() => getModeIntro(mode));

  useEffect(() => {
    setIntroActive(true);
    setMessage(getModeIntro(mode));
    const timer = window.setTimeout(() => setIntroActive(false), 3000);
    return () => window.clearTimeout(timer);
  }, [modeSwitchKey, mode]);

  useEffect(() => {
    if (introActive) return;
    setMessage(getLiveNarrator(snapshot));
  }, [snapshot, introActive]);

  return (
    <div className="pointer-events-none absolute left-1/2 top-5 z-20 max-w-md -translate-x-1/2 px-4">
      <div className="rounded-2xl border border-[#ddd6c8]/90 bg-[#f5f0e8]/95 px-4 py-3 shadow-sm backdrop-blur-sm">
        <p className="text-[13px] font-medium text-[#3a3632]">{message.title}</p>
        <p className="mt-1 text-[12px] leading-5 text-[#3a3632]/80">
          {message.reason}
        </p>
      </div>
    </div>
  );
}
