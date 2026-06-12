import type { CongestionLevel, LightState } from "@/types/traffic";

export const CONGESTION_HEX: Record<CongestionLevel, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#ef4444",
};

export const CONGESTION_THREE: Record<CongestionLevel, number> = {
  low: 0x22c55e,
  medium: 0xeab308,
  high: 0xef4444,
};

export const LIGHT_HEX: Record<LightState, string> = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
};

export function congestionLabel(level: CongestionLevel): string {
  return level === "low" ? "LOW" : level === "medium" ? "MEDIUM" : "HIGH";
}

export function congestionTextClass(level: CongestionLevel): string {
  return level === "low"
    ? "text-emerald-600"
    : level === "medium"
      ? "text-amber-600"
      : "text-red-600";
}

export function lightTextClass(state: LightState): string {
  return state === "green"
    ? "text-emerald-600"
    : state === "yellow"
      ? "text-amber-600"
      : "text-red-600";
}
