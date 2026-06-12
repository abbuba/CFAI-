import type { SimMode, TrafficSnapshot } from "@/types/traffic";

export interface NarratorMessage {
  title: string;
  reason: string;
}

export function getModeIntro(mode: SimMode): NarratorMessage {
  if (mode === "fixed") {
    return {
      title: "Before — Fixed timing",
      reason: "Watch cars queue when green goes to the empty road.",
    };
  }
  return {
    title: "After — Adaptive timing",
    reason: "Busy A→B gets more green; queues shrink.",
  };
}

export function getLiveNarrator(snapshot: TrafficSnapshot): NarratorMessage {
  const ewState = snapshot.intersections.A.ewState;
  const mode = snapshot.mode;

  if (ewState === "yellow") {
    return {
      title: "Signal clearing",
      reason: "All directions pause before the next phase.",
    };
  }

  if (ewState === "green") {
    if (mode === "fixed") {
      return {
        title: "Cars are moving on A→B",
        reason: "Equal timer — this link has green for now.",
      };
    }
    return {
      title: "Cars are moving on A→B",
      reason: "Adaptive mode keeps green longer on the busy link.",
    };
  }

  if (mode === "fixed") {
    return {
      title: "Cars are waiting on A→B",
      reason:
        "Fixed timer gives green to quiet A→C even though A→B is busy.",
    };
  }

  return {
    title: "Cars are waiting on A→B",
    reason: "Brief pause while the quiet link clears.",
  };
}
