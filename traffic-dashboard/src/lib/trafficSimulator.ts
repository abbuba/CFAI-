import type {
  Axis,
  CongestionLevel,
  DecisionInfo,
  IntersectionData,
  IntersectionId,
  LightState,
  RoadId,
  RoadSegment,
  SimMode,
  TrafficSnapshot,
} from "@/types/traffic";
import {
  EW_INBOUND,
  INTERSECTION_IDS,
  NS_INBOUND,
  ROAD_IDS,
  roadAxis,
  roadNodes,
} from "@/lib/intersectionLayout";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomWalk(
  current: number,
  delta: number,
  min: number,
  max: number,
): number {
  return clamp(current + (Math.random() - 0.5) * delta, min, max);
}

/** Traffic tiers: Green = 0-30 vehicles, Yellow = 31-80, Red = 81+. */
export function congestionByCount(count: number): CongestionLevel {
  if (count <= 30) return "low";
  if (count <= 80) return "medium";
  return "high";
}

function averageCongestion(levels: CongestionLevel[]): CongestionLevel {
  const score =
    levels.reduce((sum, level) => {
      if (level === "low") return sum + 0.2;
      if (level === "medium") return sum + 0.55;
      return sum + 0.9;
    }, 0) / levels.length;

  if (score < 0.35) return "low";
  if (score < 0.7) return "medium";
  return "high";
}

/** Demo: dense East-West corridors, nearly empty North-South. */
const DENSE_AXIS: Axis = "EW";

const YELLOW_TICKS = 2;
const FIXED_GREEN = 6;
const ADAPTIVE_EW_GREEN = 13;
const ADAPTIVE_NS_GREEN = 3;

/** One network-wide phase — all intersections flip EW/NS together. */
interface NetworkPhase {
  axis: Axis;
  phase: "green" | "yellow";
  t: number;
}

let network: NetworkPhase = { axis: "EW", phase: "green", t: 0 };
let tick = 0;

function resetNetwork(): void {
  network = { axis: "EW", phase: "green", t: 0 };
  tick = 0;
}

/** Reset module state when toggling Before/After. */
export function resetSimulation(mode: SimMode): TrafficSnapshot {
  resetNetwork();
  const roads = initialRoads();
  const intersections = INTERSECTION_IDS.reduce(
    (acc, id) => {
      acc[id] = {
        id,
        ewState: "green",
        nsState: "red",
        vehicleCount: roadAxis(EW_INBOUND[id]) === DENSE_AXIS ? 72 : 2,
        queueLength: mode === "fixed" ? 12 : 5,
        congestionLevel: "medium",
      };
      return acc;
    },
    {} as Record<IntersectionId, IntersectionData>,
  );

  const reason =
    mode === "fixed" ? "Fixed · equal split" : "Adaptive · heavy flow";

  return buildSnapshot(mode, intersections, roads, {
    activeAxis: "EW",
    ewState: "green",
    nsState: "red",
    greenDuration: mode === "fixed" ? FIXED_GREEN : ADAPTIVE_EW_GREEN,
    remaining: mode === "fixed" ? FIXED_GREEN : ADAPTIVE_EW_GREEN,
    reason,
  });
}

function greenDurationFor(mode: SimMode, axis: Axis): number {
  if (mode === "fixed") return FIXED_GREEN;
  return axis === DENSE_AXIS ? ADAPTIVE_EW_GREEN : ADAPTIVE_NS_GREEN;
}

function reasonFor(
  mode: SimMode,
  activeAxis: Axis,
  phase: "green" | "yellow",
): string {
  if (phase === "yellow") return "Clearing";
  if (mode === "fixed") return "Fixed · equal split";
  return activeAxis === DENSE_AXIS
    ? "Adaptive · heavy flow"
    : "Adaptive · light flow";
}

function stepNetwork(mode: SimMode): {
  activeAxis: Axis;
  ewState: LightState;
  nsState: LightState;
  greenDuration: number;
  remaining: number;
  reason: string;
} {
  const duration = greenDurationFor(mode, network.axis);

  if (network.phase === "green") {
    network.t += 1;
    if (network.t >= duration) {
      network.phase = "yellow";
      network.t = 0;
    }
  } else {
    network.t += 1;
    if (network.t >= YELLOW_TICKS) {
      network.axis = network.axis === "EW" ? "NS" : "EW";
      network.phase = "green";
      network.t = 0;
    }
  }

  const phaseDuration =
    network.phase === "green"
      ? greenDurationFor(mode, network.axis)
      : YELLOW_TICKS;
  const remaining = Math.max(0, phaseDuration - network.t);
  const active: LightState =
    network.phase === "yellow" ? "yellow" : "green";

  return {
    activeAxis: network.axis,
    ewState: network.axis === "EW" ? active : "red",
    nsState: network.axis === "NS" ? active : "red",
    greenDuration: duration,
    remaining,
    reason: reasonFor(mode, network.axis, network.phase),
  };
}

function evolveRoad(current: RoadSegment, mode: SimMode): RoadSegment {
  const dense = roadAxis(current.id) === DENSE_AXIS;
  const vehicleCount = Math.round(
    randomWalk(
      current.vehicleCount,
      dense ? 4 : 1,
      dense ? (mode === "fixed" ? 55 : 38) : 1,
      dense ? (mode === "fixed" ? 88 : 72) : 3,
    ),
  );

  return {
    ...current,
    vehicleCount,
    congestionLevel: congestionByCount(vehicleCount),
  };
}

function initialRoads(): Record<RoadId, RoadSegment> {
  return ROAD_IDS.reduce(
    (acc, id) => {
      const [from, to] = roadNodes(id);
      const dense = roadAxis(id) === DENSE_AXIS;
      const vehicleCount = dense ? 78 : 2;
      acc[id] = {
        id,
        from,
        to,
        congestionLevel: congestionByCount(vehicleCount),
        vehicleCount,
      };
      return acc;
    },
    {} as Record<RoadId, RoadSegment>,
  );
}

export function createInitialSnapshot(): TrafficSnapshot {
  const roads = initialRoads();

  const intersections = INTERSECTION_IDS.reduce(
    (acc, id) => {
      acc[id] = {
        id,
        ewState: "green",
        nsState: "red",
        vehicleCount: roadAxis(EW_INBOUND[id]) === DENSE_AXIS ? 72 : 2,
        queueLength: 8,
        congestionLevel: "medium",
      };
      return acc;
    },
    {} as Record<IntersectionId, IntersectionData>,
  );

  return buildSnapshot("fixed", intersections, roads, {
    activeAxis: "EW",
    ewState: "green",
    nsState: "red",
    greenDuration: FIXED_GREEN,
    remaining: FIXED_GREEN,
    reason: "Fixed · equal split",
  });
}

function buildSnapshot(
  mode: SimMode,
  intersections: Record<IntersectionId, IntersectionData>,
  roads: Record<RoadId, RoadSegment>,
  phase: {
    activeAxis: Axis;
    ewState: LightState;
    nsState: LightState;
    greenDuration: number;
    remaining: number;
    reason: string;
  },
): TrafficSnapshot {
  const decisions: DecisionInfo[] = INTERSECTION_IDS.map((id) => {
    const demandEW =
      roads[EW_INBOUND[id]].vehicleCount +
      Math.round(intersections[id].queueLength / 2);
    const demandNS = roads[NS_INBOUND[id]].vehicleCount;
    const score =
      intersections[id].vehicleCount + intersections[id].queueLength;

    return {
      id,
      demandEW,
      demandNS,
      activeAxis: phase.activeAxis,
      reason: phase.reason,
      score,
      greenDuration: phase.greenDuration,
      remaining: phase.remaining,
    };
  });

  const congestionLevels = [
    ...Object.values(intersections).map((item) => item.congestionLevel),
    ...Object.values(roads).map((item) => item.congestionLevel),
  ];

  const waitEW = mode === "fixed" ? 48 : 14;
  const waitNS = mode === "fixed" ? 6 : 9;

  return {
    timestamp: Date.now(),
    mode,
    intersections,
    roads,
    decisions,
    emergencyTarget: null,
    totalVehicles: Object.values(intersections).reduce(
      (sum, i) => sum + i.vehicleCount,
      0,
    ),
    averageCongestion: averageCongestion(congestionLevels),
    stats: { waitEW, waitNS },
  };
}

export function advanceTrafficSnapshot(
  previous: TrafficSnapshot,
  mode: SimMode,
): TrafficSnapshot {
  tick += 1;

  const phase = stepNetwork(mode);

  const roads = ROAD_IDS.reduce(
    (acc, id) => {
      acc[id] = evolveRoad(previous.roads[id], mode);
      return acc;
    },
    {} as Record<RoadId, RoadSegment>,
  );

  const queueTarget = mode === "fixed" ? 14 : 4;

  const intersections = INTERSECTION_IDS.reduce(
    (acc, id) => {
      const current = previous.intersections[id];
      const queueLength = Math.round(
        clamp(
          current.queueLength +
            (queueTarget - current.queueLength) * 0.2 +
            (Math.random() - 0.5) * 1.5,
          2,
          22,
        ),
      );
      const denseInbound = roadAxis(EW_INBOUND[id]) === DENSE_AXIS;
      const vehicleCount = Math.round(
        randomWalk(
          current.vehicleCount,
          denseInbound ? 6 : 1,
          denseInbound ? 48 : 1,
          denseInbound ? 96 : 4,
        ),
      );

      acc[id] = {
        ...current,
        ewState: phase.ewState,
        nsState: phase.nsState,
        vehicleCount,
        queueLength,
        congestionLevel: congestionByCount(vehicleCount),
      };
      return acc;
    },
    {} as Record<IntersectionId, IntersectionData>,
  );

  const targetEW = mode === "fixed" ? 48 : 14;
  const targetNS = mode === "fixed" ? 6 : 9;
  const waitEW = clamp(
    previous.stats.waitEW +
      (targetEW - previous.stats.waitEW) * 0.12 +
      (Math.random() - 0.5) * 1.2,
    5,
    60,
  );
  const waitNS = clamp(
    previous.stats.waitNS +
      (targetNS - previous.stats.waitNS) * 0.12 +
      (Math.random() - 0.5) * 0.8,
    3,
    30,
  );

  const snapshot = buildSnapshot(mode, intersections, roads, phase);
  return { ...snapshot, stats: { waitEW, waitNS } };
}
