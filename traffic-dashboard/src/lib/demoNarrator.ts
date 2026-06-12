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
    reason: "Busy A→B stays green until cleared · A→C waits.",
  };
}

export function getLiveNarrator(snapshot: TrafficSnapshot): NarratorMessage {
  const ewState = snapshot.intersections.A.ewState;
  const mode = snapshot.mode;
  const decision = snapshot.decisions.find((d) => d.id === "A");

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
      reason:
        decision?.reason === "Clearing busy link"
          ? "Green stays on until the busy queue clears."
          : "Adaptive mode keeps green on the busy link.",
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
    reason: "A→C has green briefly · busy A→B waits its turn.",
  };
}
