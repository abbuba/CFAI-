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
const REALLOC_PERIOD = 5;

/** Green durations by congestion rank (greedy allocation, best score first). */
const RANK_DURATIONS = [12, 9, 7, 5];
const RANK_REASONS = [
  "HIGHEST SCORE → MAX GREEN",
  "HIGH SCORE → EXTENDED GREEN",
  "LOW SCORE → REDUCED GREEN",
  "LOWEST SCORE → MIN GREEN",
];

interface Allocation {
  duration: number;
  rank: number;
}

const allocations: Record<IntersectionId, Allocation> = {
  A: { duration: 9, rank: 1 },
  B: { duration: 9, rank: 1 },
  C: { duration: 9, rank: 1 },
  D: { duration: 9, rank: 1 },
};

let tick = 0;

/**
 * Greedy allocation, run every REALLOC_PERIOD seconds: sort intersections
 * by congestion score (vehicle_count + queue_length) and hand the longest
 * green to the most congested node, shortest to the least.
 */
function reallocateGreen(scores: Record<IntersectionId, number>): void {
  const ranked = [...INTERSECTION_IDS].sort((a, b) => scores[b] - scores[a]);
  ranked.forEach((id, rank) => {
    allocations[id] = { duration: RANK_DURATIONS[rank], rank };
  });
}

function stepController(
  id: IntersectionId,
  demandEW: number,
  demandNS: number,
  score: number,
  emergencyAxis: Axis | null,
  mode: SimMode,
): DecisionInfo & { ewState: LightState; nsState: LightState } {
  const c = controllers[id];
  const alloc = allocations[id];
  let reason: string;
  let greenDuration: number;

  if (mode === "fixed") {
    greenDuration = FIXED_GREEN;
    // Static plan: equal split, blind to demand.
    if (emergencyAxis) {
      // Emergency preemption overrides even the fixed plan.
      if (c.axis !== emergencyAxis) {
        if (c.phase === "green") {
          c.phase = "yellow";
          c.t = 0;
          reason = "EMERGENCY PREEMPT";
        } else {
          c.t += 1;
          reason = "EMERGENCY PREEMPT";
          if (c.t >= YELLOW_TICKS) {
            c.axis = emergencyAxis;
            c.phase = "green";
            c.t = 0;
          }
        }
      } else {
        c.phase = "green";
        c.t = Math.min(c.t, 1);
        reason = "EMERGENCY HOLD";
      }
    } else if (c.phase === "green") {
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
    const share = curDemand / Math.max(1, demandEW + demandNS);
    // Allocated node green, weighted toward the axis that actually has demand.
    greenDuration = clamp(Math.round(alloc.duration * 2 * share), 3, 14);

    if (emergencyAxis && emergencyAxis !== c.axis) {
      if (c.phase === "green") {
        c.phase = "yellow";
        c.t = 0;
      } else {
        c.t += 1;
        if (c.t >= YELLOW_TICKS) {
          c.axis = emergencyAxis;
          c.phase = "green";
          c.t = 0;
        }
      }
      reason = "EMERGENCY PREEMPT";
    } else if (emergencyAxis && emergencyAxis === c.axis) {
      c.phase = "green";
      c.t = Math.min(c.t, 1);
      reason = "EMERGENCY HOLD";
    } else if (c.phase === "green") {
      c.t += 1;
      if (c.t >= Math.max(MIN_GREEN, greenDuration)) {
        c.phase = "yellow";
        c.t = 0;
        reason = "PHASE COMPLETE";
      } else {
        reason = RANK_REASONS[alloc.rank];
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

  const phaseDuration = c.phase === "green" ? greenDuration : YELLOW_TICKS;
  const remaining = Math.max(0, phaseDuration - c.t);
  const green: LightState = c.phase === "yellow" ? "yellow" : "green";

  return {
    id,
    demandEW,
    demandNS,
    activeAxis: c.axis,
    reason,
    score,
    greenDuration,
    remaining,
    ewState: c.axis === "EW" ? green : "red",
    nsState: c.axis === "NS" ? green : "red",
  };
}

function evolveRoad(current: RoadSegment): RoadSegment {
  const dense = roadAxis(current.id) === DENSE_AXIS;
  const vehicleCount = Math.round(
    randomWalk(current.vehicleCount, 9, dense ? 40 : 2, dense ? 96 : 26),
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
      const vehicleCount = dense ? 72 : 9;
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
      const c = controllers[id];
      const vehicleCount = 62 + Math.floor(Math.random() * 30);
      acc[id] = {
        id,
        ewState: c.axis === "EW" ? "green" : "red",
        nsState: c.axis === "NS" ? "green" : "red",
        vehicleCount,
        queueLength: 10 + Math.floor(Math.random() * 5),
        congestionLevel: congestionByCount(vehicleCount),
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
      score:
        intersections[id].vehicleCount + intersections[id].queueLength,
      greenDuration: FIXED_GREEN,
      remaining: FIXED_GREEN,
    })),
    emergencyTarget: null,
    totalVehicles: Object.values(intersections).reduce(
      (sum, i) => sum + i.vehicleCount,
      0,
    ),
    averageCongestion: "medium",
    stats: { waitEW: 46, waitNS: 7 },
  };
}

export function advanceTrafficSnapshot(
  previous: TrafficSnapshot,
  ambulanceRoad: RoadId | null,
  mode: SimMode,
): TrafficSnapshot {
  tick += 1;

  const emergencyTarget = ambulanceRoad ? roadNodes(ambulanceRoad)[1] : null;
  const emergencyAxis = ambulanceRoad ? roadAxis(ambulanceRoad) : null;

  const roads = ROAD_IDS.reduce(
    (acc, id) => {
      acc[id] = evolveRoad(previous.roads[id]);
      return acc;
    },
    {} as Record<RoadId, RoadSegment>,
  );

  const queueTarget = mode === "fixed" ? 13 : 3;

  // First pass: evolve per-node counts and congestion scores.
  const counts = {} as Record<
    IntersectionId,
    { vehicleCount: number; queueLength: number; score: number }
  >;
  INTERSECTION_IDS.forEach((id) => {
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
    const vehicleCount = Math.round(
      randomWalk(current.vehicleCount, 14, 24, 112),
    );
    counts[id] = {
      vehicleCount,
      queueLength,
      score: vehicleCount + queueLength,
    };
  });

  // Every 5 seconds: compare scores across all intersections and greedily
  // reassign green durations (longest green to the most congested).
  if (tick % REALLOC_PERIOD === 0) {
    reallocateGreen({
      A: counts.A.score,
      B: counts.B.score,
      C: counts.C.score,
      D: counts.D.score,
    });
  }

  const decisions: DecisionInfo[] = [];

  const intersections = INTERSECTION_IDS.reduce(
    (acc, id) => {
      const current = previous.intersections[id];
      const { vehicleCount, queueLength, score } = counts[id];

      const demandEW =
        roads[EW_INBOUND[id]].vehicleCount + Math.round(queueLength / 2);
      const demandNS = roads[NS_INBOUND[id]].vehicleCount;

      const result = stepController(
        id,
        demandEW,
        demandNS,
        score,
        id === emergencyTarget ? emergencyAxis : null,
        mode,
      );
      decisions.push({
        id: result.id,
        demandEW: result.demandEW,
        demandNS: result.demandNS,
        activeAxis: result.activeAxis,
        reason: result.reason,
        score: result.score,
        greenDuration: result.greenDuration,
        remaining: result.remaining,
      });

      acc[id] = {
        ...current,
        ewState: result.ewState,
        nsState: result.nsState,
        vehicleCount,
        queueLength,
        congestionLevel: congestionByCount(vehicleCount),
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
