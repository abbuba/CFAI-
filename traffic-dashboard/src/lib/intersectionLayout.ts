import type { Axis, IntersectionId, RoadId } from "@/types/traffic";

export const INTERSECTION_IDS: IntersectionId[] = ["A", "B", "C", "D"];

export const ROAD_IDS: RoadId[] = [
  "AB",
  "BA",
  "CD",
  "DC",
  "AC",
  "CA",
  "BD",
  "DB",
];

const ROAD_PAIRS: Record<RoadId, [IntersectionId, IntersectionId]> = {
  AB: ["A", "B"],
  BA: ["B", "A"],
  CD: ["C", "D"],
  DC: ["D", "C"],
  AC: ["A", "C"],
  CA: ["C", "A"],
  BD: ["B", "D"],
  DB: ["D", "B"],
};

/** One representative per physical (bidirectional) road. */
export const UNIQUE_ROADS: RoadId[] = ["AB", "CD", "AC", "BD"];

/** Continuous loop: A -> C -> D -> B -> A. */
export const AMBULANCE_PATH: RoadId[] = ["AC", "CD", "DB", "BA"];

export function roadNodes(roadId: RoadId): [IntersectionId, IntersectionId] {
  return ROAD_PAIRS[roadId];
}

export function roadAxis(roadId: RoadId): Axis {
  return roadId === "AB" || roadId === "BA" || roadId === "CD" || roadId === "DC"
    ? "EW"
    : "NS";
}

/** Incoming connecting road per axis, for each node (used for demand scores). */
export const EW_INBOUND: Record<IntersectionId, RoadId> = {
  A: "BA",
  B: "AB",
  C: "DC",
  D: "CD",
};

export const NS_INBOUND: Record<IntersectionId, RoadId> = {
  A: "CA",
  B: "DB",
  C: "AC",
  D: "BD",
};
