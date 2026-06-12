export type LightState = "red" | "yellow" | "green";
export type CongestionLevel = "low" | "medium" | "high";
export type VehicleType = "sedan" | "truck" | "ambulance";
export type Axis = "EW" | "NS";
/** Before = static timing plans; After = adaptive coordination. */
export type SimMode = "fixed" | "adaptive";

export type IntersectionId = "A" | "B" | "C" | "D";

export interface IntersectionData {
  id: IntersectionId;
  /** Signal state shown to East-West approaches. */
  ewState: LightState;
  /** Signal state shown to North-South approaches. */
  nsState: LightState;
  vehicleCount: number;
  queueLength: number;
  congestionLevel: CongestionLevel;
}

export type RoadId = "AB" | "BA" | "CD" | "DC" | "AC" | "CA" | "BD" | "DB";

export interface RoadSegment {
  id: RoadId;
  from: IntersectionId;
  to: IntersectionId;
  congestionLevel: CongestionLevel;
  vehicleCount: number;
}

/** Why a controller chose its current phase — rendered in the decision panel. */
export interface DecisionInfo {
  id: IntersectionId;
  demandEW: number;
  demandNS: number;
  activeAxis: Axis;
  reason: string;
}

export interface TrafficSnapshot {
  timestamp: number;
  mode: SimMode;
  intersections: Record<IntersectionId, IntersectionData>;
  roads: Record<RoadId, RoadSegment>;
  decisions: DecisionInfo[];
  /** Node the ambulance is currently approaching (green corridor target). */
  emergencyTarget: IntersectionId;
  totalVehicles: number;
  averageCongestion: CongestionLevel;
  /** Average wait per axis (seconds) — the before/after comparison metric. */
  stats: { waitEW: number; waitNS: number };
}

export interface Point {
  x: number;
  y: number;
}

export interface VehicleEntity {
  id: string;
  roadId: RoadId;
  progress: number;
  speed: number;
  type: VehicleType;
}
