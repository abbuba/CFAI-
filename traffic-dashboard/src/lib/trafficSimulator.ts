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

/**
 * Demo scenario: East-West corridors carry dense traffic while
 * North-South roads are nearly empty. Fixed timing splits green
 * equally (the "before" problem); adaptive mode holds green for the
 * dense axis and only briefly serves the light one (the "after" fix).
 */
const DENSE_AXIS: Axis = "EW";

interface NodeController {
  axis: Axis;
  phase: "green" | "yellow";
  t: number;
}

const controllers: Record<IntersectionId, NodeController> = {
  A: { axis: "EW", phase: "green", t: 0 },
  B: { axis: "NS", phase: "green", t: 0 },
  C: { axis: "NS", phase: "green", t: 0 },
  D: { axis: "EW", phase: "green", t: 0 },
};

const MIN_GREEN = 3;
const YELLOW_TICKS = 2;
const FIXED_GREEN = 6;

function stepController(
  id: IntersectionId,
  demandEW: number,
  demandNS: number,
  emergencyAxis: Axis | null,
  mode: SimMode,
): DecisionInfo & { ewState: LightState; nsState: LightState } {
  const c = controllers[id];
  let reason: string;

  if (mode === "fixed") {
    // Static plan: equal split, blind to demand and emergencies.
    if (c.phase === "green") {
      c.t += 1;
      reason = "FIXED TIMER";
      if (c.t >= FIXED_GREEN) {
        c.phase = "yellow";
        c.t = 0;
      }
    } else {
      c.t += 1;
      reason = "CLEARING";
      if (c.t >= YELLOW_TICKS) {
        c.axis = c.axis === "EW" ? "NS" : "EW";
        c.phase = "green";
        c.t = 0;
      }
    }
  } else {
    const curDemand = c.axis === "EW" ? demandEW : demandNS;
    const crossDemand = c.axis === "EW" ? demandNS : demandEW;

    if (c.phase === "green") {
      c.t += 1;
      const maxGreen = clamp(4 + Math.round(curDemand / 4), 4, 14);

      if (emergencyAxis && emergencyAxis !== c.axis) {
        c.phase = "yellow";
        c.t = 0;
        reason = "EMERGENCY PREEMPT";
      } else if (emergencyAxis && emergencyAxis === c.axis) {
        c.t = Math.min(c.t, 1);
        reason = "EMERGENCY HOLD";
      } else if (
        c.t >= maxGreen ||
        (c.t >= MIN_GREEN && crossDemand > curDemand * 1.3 + 2)
      ) {
        c.phase = "yellow";
        c.t = 0;
        reason = "DEMAND SHIFT";
      } else {
        reason = curDemand >= crossDemand ? "HIGH DEMAND" : "MIN GREEN";
      }
    } else {
      c.t += 1;
      reason = "CLEARING";
      if (c.t >= YELLOW_TICKS) {
        c.axis = c.axis === "EW" ? "NS" : "EW";
        c.phase = "green";
        c.t = 0;
      }
    }
  }

  const green: LightState = c.phase === "yellow" ? "yellow" : "green";
  return {
    id,
    demandEW,
    demandNS,
    activeAxis: c.axis,
    reason,
    ewState: c.axis === "EW" ? green : "red",
    nsState: c.axis === "NS" ? green : "red",
  };
}

function evolveRoad(current: RoadSegment): RoadSegment {
  const dense = roadAxis(current.id) === DENSE_AXIS;
  const vehicleCount = Math.round(
    randomWalk(current.vehicleCount, 3, dense ? 12 : 1, dense ? 20 : 4),
  );

  return {
    ...current,
    vehicleCount,
    congestionLevel: dense
      ? vehicleCount >= 17
        ? "high"
        : "medium"
      : "low",
  };
}

function initialRoads(): Record<RoadId, RoadSegment> {
  return ROAD_IDS.reduce(
    (acc, id) => {
      const [from, to] = roadNodes(id);
      const dense = roadAxis(id) === DENSE_AXIS;
      acc[id] = {
        id,
        from,
        to,
        congestionLevel: dense ? "high" : "low",
        vehicleCount: dense ? 16 : 2,
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
      const c = controllers[id];
      acc[id] = {
        id,
        ewState: c.axis === "EW" ? "green" : "red",
        nsState: c.axis === "NS" ? "green" : "red",
        vehicleCount: 14 + Math.floor(Math.random() * 8),
        queueLength: 10 + Math.floor(Math.random() * 5),
        congestionLevel: "high",
      };
      return acc;
    },
    {} as Record<IntersectionId, IntersectionData>,
  );

  return {
    timestamp: Date.now(),
    mode: "fixed",
    intersections,
    roads,
    decisions: INTERSECTION_IDS.map((id) => ({
      id,
      demandEW: roads[EW_INBOUND[id]].vehicleCount,
      demandNS: roads[NS_INBOUND[id]].vehicleCount,
      activeAxis: controllers[id].axis,
      reason: "FIXED TIMER",
    })),
    emergencyTarget: "C",
    totalVehicles: Object.values(intersections).reduce(
      (sum, i) => sum + i.vehicleCount,
      0,
    ),
    averageCongestion: "high",
    stats: { waitEW: 46, waitNS: 7 },
  };
}

export function advanceTrafficSnapshot(
  previous: TrafficSnapshot,
  ambulanceRoad: RoadId,
  mode: SimMode,
): TrafficSnapshot {
  const emergencyTarget = roadNodes(ambulanceRoad)[1];
  const emergencyAxis = roadAxis(ambulanceRoad);

  const roads = ROAD_IDS.reduce(
    (acc, id) => {
      acc[id] = evolveRoad(previous.roads[id]);
      return acc;
    },
    {} as Record<RoadId, RoadSegment>,
  );

  const decisions: DecisionInfo[] = [];
  const queueTarget = mode === "fixed" ? 13 : 3;

  const intersections = INTERSECTION_IDS.reduce(
    (acc, id) => {
      const current = previous.intersections[id];
      const queueLength = Math.round(
        clamp(
          current.queueLength +
            (queueTarget - current.queueLength) * 0.22 +
            (Math.random() - 0.5) * 2,
          0,
          20,
        ),
      );

      const demandEW =
        roads[EW_INBOUND[id]].vehicleCount + Math.round(queueLength / 2);
      const demandNS = roads[NS_INBOUND[id]].vehicleCount;

      const result = stepController(
        id,
        demandEW,
        demandNS,
        mode === "adaptive" && id === emergencyTarget ? emergencyAxis : null,
        mode,
      );
      decisions.push({
        id: result.id,
        demandEW: result.demandEW,
        demandNS: result.demandNS,
        activeAxis: result.activeAxis,
        reason: result.reason,
      });

      const vehicleCount = Math.round(
        randomWalk(current.vehicleCount, 4, 8, 26),
      );

      acc[id] = {
        ...current,
        ewState: result.ewState,
        nsState: result.nsState,
        vehicleCount,
        queueLength,
        congestionLevel:
          queueLength >= 9 ? "high" : queueLength >= 4 ? "medium" : "low",
      };
      return acc;
    },
    {} as Record<IntersectionId, IntersectionData>,
  );

  const targetEW = mode === "fixed" ? 46 : 13;
  const targetNS = mode === "fixed" ? 7 : 10;
  const waitEW = clamp(
    previous.stats.waitEW +
      (targetEW - previous.stats.waitEW) * 0.16 +
      (Math.random() - 0.5) * 1.6,
    5,
    60,
  );
  const waitNS = clamp(
    previous.stats.waitNS +
      (targetNS - previous.stats.waitNS) * 0.16 +
      (Math.random() - 0.5) * 1.2,
    3,
    30,
  );

  const congestionLevels = [
    ...Object.values(intersections).map((item) => item.congestionLevel),
    ...Object.values(roads).map((item) => item.congestionLevel),
  ];

  return {
    timestamp: Date.now(),
    mode,
    intersections,
    roads,
    decisions,
    emergencyTarget,
    totalVehicles: Object.values(intersections).reduce(
      (sum, i) => sum + i.vehicleCount,
      0,
    ),
    averageCongestion: averageCongestion(congestionLevels),
    stats: { waitEW, waitNS },
  };
}
