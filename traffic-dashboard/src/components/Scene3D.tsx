"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type {
  Axis,
  IntersectionId,
  LightState,
  RoadId,
  TrafficSnapshot,
  VehicleType,
} from "@/types/traffic";
import {
  AMBULANCE_PATH,
  ROAD_IDS,
  roadAxis,
  roadNodes,
} from "@/lib/intersectionLayout";

// ---------------------------------------------------------------- layout

const NODE_POS: Record<IntersectionId, [number, number]> = {
  A: [-14, -9],
  B: [14, -9],
  C: [-14, 9],
  D: [14, 9],
};

const ROAD_W = 3.4;
const LANE = 0.85;
const PAD = 2.6;
const H_EXTENT = 30;
const V_EXTENT = 21;

interface DirGeom {
  sx: number;
  sz: number;
  ux: number;
  uz: number;
  rx: number;
  rz: number;
  len: number;
}

function roadGeom(roadId: RoadId): DirGeom {
  const [from, to] = roadNodes(roadId);
  const [fx, fz] = NODE_POS[from];
  const [tx, tz] = NODE_POS[to];
  const dx = tx - fx;
  const dz = tz - fz;
  const dist = Math.hypot(dx, dz) || 1;
  const ux = dx / dist;
  const uz = dz / dist;
  return {
    sx: fx + ux * PAD,
    sz: fz + uz * PAD,
    ux,
    uz,
    rx: -uz,
    rz: ux,
    len: dist - PAD * 2,
  };
}

function lightFor(
  snapshot: TrafficSnapshot,
  node: IntersectionId,
  axis: Axis,
): LightState {
  return axis === "EW"
    ? snapshot.intersections[node].ewState
    : snapshot.intersections[node].nsState;
}

const CONGESTION_COLOR = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#ef4444",
} as const;

// ---------------------------------------------------------------- ground

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <planeGeometry args={[90, 64]} />
        <meshStandardMaterial color="#0b0d12" roughness={0.95} />
      </mesh>
      <gridHelper
        args={[120, 60, "#181d28", "#10141c"]}
        position={[0, -0.02, 0]}
      />
    </group>
  );
}

// ---------------------------------------------------------------- roads

function RoadStrip({
  x,
  z,
  length,
  horizontal,
}: {
  x: number;
  z: number;
  length: number;
  horizontal: boolean;
}) {
  const size: [number, number, number] = horizontal
    ? [length, 0.04, ROAD_W]
    : [ROAD_W, 0.04, length];
  const edge: [number, number, number] = horizontal
    ? [length, 0.012, 0.07]
    : [0.07, 0.012, length];
  const half = ROAD_W / 2 - 0.12;

  return (
    <group position={[x, 0.02, z]}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#1b1e26" roughness={0.9} />
      </mesh>
      {/* white edge lines */}
      <mesh position={horizontal ? [0, 0.03, -half] : [-half, 0.03, 0]}>
        <boxGeometry args={edge} />
        <meshStandardMaterial color="#e8edf4" transparent opacity={0.5} />
      </mesh>
      <mesh position={horizontal ? [0, 0.03, half] : [half, 0.03, 0]}>
        <boxGeometry args={edge} />
        <meshStandardMaterial color="#e8edf4" transparent opacity={0.5} />
      </mesh>
      {/* double yellow center */}
      <mesh position={horizontal ? [0, 0.03, -0.06] : [-0.06, 0.03, 0]}>
        <boxGeometry args={horizontal ? [length, 0.012, 0.05] : [0.05, 0.012, length]} />
        <meshStandardMaterial color="#d8b13a" transparent opacity={0.7} />
      </mesh>
      <mesh position={horizontal ? [0, 0.03, 0.06] : [0.06, 0.03, 0]}>
        <boxGeometry args={horizontal ? [length, 0.012, 0.05] : [0.05, 0.012, length]} />
        <meshStandardMaterial color="#d8b13a" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function Roads({ snapshot }: { snapshot: TrafficSnapshot }) {
  return (
    <group>
      <RoadStrip x={0} z={-9} length={H_EXTENT * 2} horizontal />
      <RoadStrip x={0} z={9} length={H_EXTENT * 2} horizontal />
      <RoadStrip x={-14} z={0} length={V_EXTENT * 2} horizontal={false} />
      <RoadStrip x={14} z={0} length={V_EXTENT * 2} horizontal={false} />

      {/* intersection pads */}
      {(["A", "B", "C", "D"] as IntersectionId[]).map((id) => {
        const [x, z] = NODE_POS[id];
        return (
          <mesh key={id} position={[x, 0.035, z]}>
            <boxGeometry args={[ROAD_W + 0.3, 0.02, ROAD_W + 0.3]} />
            <meshStandardMaterial color="#232730" roughness={0.85} />
          </mesh>
        );
      })}

      {/* congestion tint on connecting segments */}
      {(["AB", "CD", "AC", "BD"] as RoadId[]).map((roadId) => {
        const g = roadGeom(roadId);
        const cx = g.sx + g.ux * (g.len / 2);
        const cz = g.sz + g.uz * (g.len / 2);
        const horizontal = roadAxis(roadId) === "EW";
        const level = snapshot.roads[roadId].congestionLevel;
        return (
          <mesh key={roadId} position={[cx, 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry
              args={horizontal ? [g.len, ROAD_W - 0.5] : [ROAD_W - 0.5, g.len]}
            />
            <meshBasicMaterial
              color={CONGESTION_COLOR[level]}
              transparent
              opacity={level === "low" ? 0.05 : level === "medium" ? 0.11 : 0.18}
            />
          </mesh>
        );
      })}

      {/* stop lines + crosswalk bands for connecting approaches */}
      {ROAD_IDS.map((roadId) => {
        const g = roadGeom(roadId);
        const stopD = g.len - 0.9;
        const sx = g.sx + g.ux * stopD + g.rx * (ROAD_W / 4);
        const sz = g.sz + g.uz * stopD + g.rz * (ROAD_W / 4);
        const cwD = g.len - 0.35;
        const cx = g.sx + g.ux * cwD;
        const cz = g.sz + g.uz * cwD;
        const horizontal = roadAxis(roadId) === "EW";
        return (
          <group key={`mark-${roadId}`}>
            <mesh position={[sx, 0.055, sz]}>
              <boxGeometry
                args={
                  horizontal
                    ? [0.16, 0.012, ROAD_W / 2 - 0.25]
                    : [ROAD_W / 2 - 0.25, 0.012, 0.16]
                }
              />
              <meshStandardMaterial color="#eef2f7" transparent opacity={0.85} />
            </mesh>
            <mesh position={[cx, 0.05, cz]}>
              <boxGeometry
                args={
                  horizontal
                    ? [0.45, 0.01, ROAD_W - 0.4]
                    : [ROAD_W - 0.4, 0.01, 0.45]
                }
              />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.18} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------- signals

function SignalHead({
  position,
  rotationY,
  state,
}: {
  position: [number, number, number];
  rotationY: number;
  state: LightState;
}) {
  const lens = (color: string, on: boolean, y: number) => (
    <mesh position={[0, y, 0.14]}>
      <sphereGeometry args={[0.11, 12, 12]} />
      <meshStandardMaterial
        color={on ? color : "#181a1f"}
        emissive={on ? color : "#000000"}
        emissiveIntensity={on ? 2.2 : 0}
      />
    </mesh>
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 2.2, 8]} />
        <meshStandardMaterial color="#2c2f36" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[0.34, 0.95, 0.26]} />
        <meshStandardMaterial color="#13151a" roughness={0.5} />
      </mesh>
      <group position={[0, 2.5, 0]}>
        {lens("#ef4444", state === "red", 0.3)}
        {lens("#eab308", state === "yellow", 0)}
        {lens("#22c55e", state === "green", -0.3)}
      </group>
    </group>
  );
}

const APPROACHES: { dx: number; dz: number; axis: Axis }[] = [
  { dx: 1, dz: 0, axis: "EW" },
  { dx: -1, dz: 0, axis: "EW" },
  { dx: 0, dz: 1, axis: "NS" },
  { dx: 0, dz: -1, axis: "NS" },
];

function Signals({ snapshot }: { snapshot: TrafficSnapshot }) {
  return (
    <group>
      {(["A", "B", "C", "D"] as IntersectionId[]).map((id) => {
        const [nx, nz] = NODE_POS[id];
        return APPROACHES.map(({ dx, dz, axis }, i) => {
          // travel direction (dx,dz); light sits before the pad, on the right.
          const rx = -dz;
          const rz = dx;
          const px = nx - dx * (PAD + 0.4) + rx * (ROAD_W / 2 + 0.7);
          const pz = nz - dz * (PAD + 0.4) + rz * (ROAD_W / 2 + 0.7);
          return (
            <SignalHead
              key={`${id}-${i}`}
              position={[px, 0, pz]}
              rotationY={Math.atan2(-dx, -dz)}
              state={lightFor(snapshot, id, axis)}
            />
          );
        });
      })}
    </group>
  );
}

// ---------------------------------------------------------------- vehicles

function CarBody({ truck }: { truck?: boolean }) {
  if (truck) {
    return (
      <group>
        <RoundedBox args={[1.05, 0.6, 2.5]} radius={0.12} position={[0, 0.45, 0]}>
          <meshStandardMaterial color="#c9c0ae" metalness={0.35} roughness={0.45} />
        </RoundedBox>
        <RoundedBox args={[0.95, 0.5, 0.8]} radius={0.1} position={[0, 0.42, 1.0]}>
          <meshStandardMaterial color="#dcd3c1" metalness={0.4} roughness={0.4} />
        </RoundedBox>
        <Wheels w={0.48} l={0.95} />
      </group>
    );
  }

  return (
    <group>
      <RoundedBox args={[0.9, 0.3, 1.9]} radius={0.12} position={[0, 0.3, 0]}>
        <meshStandardMaterial color="#f3ecdd" metalness={0.55} roughness={0.28} />
      </RoundedBox>
      <RoundedBox args={[0.74, 0.26, 1.0]} radius={0.11} position={[0, 0.52, -0.08]}>
        <meshStandardMaterial color="#ded4c0" metalness={0.45} roughness={0.25} />
      </RoundedBox>
      <Wheels w={0.42} l={0.62} />
    </group>
  );
}

function Wheels({ w, l }: { w: number; l: number }) {
  return (
    <group>
      {[
        [-w, l],
        [w, l],
        [-w, -l],
        [w, -l],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.16, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.16, 0.14, 14]} />
          <meshStandardMaterial color="#14161b" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Cars drive full corridors (the entire road strip, through both
 * intersections) and wrap around off-screen — they are never added or
 * removed at runtime, so nothing pops in or out of view.
 */
interface Corridor {
  axis: Axis;
  sx: number;
  sz: number;
  ux: number;
  uz: number;
  len: number;
  stops: { dist: number; node: IntersectionId }[];
  road: RoadId;
}

const STOP_BACK = PAD + 1.7;

function buildCorridors(): Corridor[] {
  const list: Corridor[] = [];

  for (const z of [-9, 9]) {
    const [n1, n2]: [IntersectionId, IntersectionId] =
      z < 0 ? ["A", "B"] : ["C", "D"];
    // eastbound
    list.push({
      axis: "EW",
      sx: -H_EXTENT,
      sz: z,
      ux: 1,
      uz: 0,
      len: H_EXTENT * 2,
      stops: [
        { dist: -14 + H_EXTENT - STOP_BACK, node: n1 },
        { dist: 14 + H_EXTENT - STOP_BACK, node: n2 },
      ],
      road: z < 0 ? "AB" : "CD",
    });
    // westbound
    list.push({
      axis: "EW",
      sx: H_EXTENT,
      sz: z,
      ux: -1,
      uz: 0,
      len: H_EXTENT * 2,
      stops: [
        { dist: H_EXTENT - 14 - STOP_BACK, node: n2 },
        { dist: H_EXTENT + 14 - STOP_BACK, node: n1 },
      ],
      road: z < 0 ? "BA" : "DC",
    });
  }

  for (const x of [-14, 14]) {
    const [n1, n2]: [IntersectionId, IntersectionId] =
      x < 0 ? ["A", "C"] : ["B", "D"];
    // southbound
    list.push({
      axis: "NS",
      sx: x,
      sz: -V_EXTENT,
      ux: 0,
      uz: 1,
      len: V_EXTENT * 2,
      stops: [
        { dist: -9 + V_EXTENT - STOP_BACK, node: n1 },
        { dist: 9 + V_EXTENT - STOP_BACK, node: n2 },
      ],
      road: x < 0 ? "AC" : "BD",
    });
    // northbound
    list.push({
      axis: "NS",
      sx: x,
      sz: V_EXTENT,
      ux: 0,
      uz: -1,
      len: V_EXTENT * 2,
      stops: [
        { dist: V_EXTENT - 9 - STOP_BACK, node: n2 },
        { dist: V_EXTENT + 9 - STOP_BACK, node: n1 },
      ],
      road: x < 0 ? "CA" : "DB",
    });
  }

  return list;
}

const CORRIDORS = buildCorridors();
/** Dense traffic on EW corridors, very light on NS — the demo scenario. */
const CARS_PER_CORRIDOR: Record<Axis, number> = { EW: 6, NS: 2 };
const CAR_GAP = 3.1;

interface CorridorCar {
  id: string;
  corridor: number;
  d: number;
  speed: number;
  type: VehicleType;
}

function createCorridorCars(): CorridorCar[] {
  const cars: CorridorCar[] = [];
  CORRIDORS.forEach((corridor, ci) => {
    const count = CARS_PER_CORRIDOR[corridor.axis];
    for (let i = 0; i < count; i += 1) {
      cars.push({
        id: `c${ci}-${i}`,
        corridor: ci,
        d: (corridor.len / count) * i + Math.random() * 1.5,
        speed: 2.8 + Math.random() * 1.4,
        type: Math.random() > 0.82 ? "truck" : "sedan",
      });
    }
  });
  return cars;
}

function CarsLayer({ snapshot }: { snapshot: TrafficSnapshot }) {
  const carsRef = useRef<CorridorCar[]>(null!);
  if (!carsRef.current) carsRef.current = createCorridorCars();
  const snapRef = useRef(snapshot);
  const groupRefs = useRef(new Map<string, THREE.Group>());

  useEffect(() => {
    snapRef.current = snapshot;
  }, [snapshot]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const data = snapRef.current;

    for (let ci = 0; ci < CORRIDORS.length; ci += 1) {
      const corridor = CORRIDORS[ci];
      const cars = carsRef.current
        .filter((c) => c.corridor === ci)
        .sort((a, b) => b.d - a.d);

      const congestion = data.roads[corridor.road].congestionLevel;
      const speedMul =
        congestion === "low" ? 1 : congestion === "medium" ? 0.85 : 0.7;

      let ahead = Infinity;
      for (const car of cars) {
        let limit = ahead - CAR_GAP;

        for (const stop of corridor.stops) {
          if (
            car.d < stop.dist - 0.05 &&
            lightFor(data, stop.node, corridor.axis) !== "green"
          ) {
            limit = Math.min(limit, stop.dist);
            break;
          }
        }

        const next = car.d + car.speed * speedMul * dt;
        car.d = Math.min(next, Math.max(car.d, limit));

        if (car.d >= corridor.len) {
          car.d -= corridor.len;
          ahead = car.d + corridor.len;
        } else {
          ahead = car.d;
        }

        const group = groupRefs.current.get(car.id);
        if (group) {
          const rx = -corridor.uz;
          const rz = corridor.ux;
          group.position.set(
            corridor.sx + corridor.ux * car.d + rx * LANE,
            0,
            corridor.sz + corridor.uz * car.d + rz * LANE,
          );
          group.rotation.y = Math.atan2(corridor.ux, corridor.uz);
        }
      }
    }
  });

  return (
    <group>
      {carsRef.current.map((car) => (
        <group
          key={car.id}
          ref={(node) => {
            if (node) groupRefs.current.set(car.id, node);
            else groupRefs.current.delete(car.id);
          }}
        >
          <CarBody truck={car.type === "truck"} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- ambulance

/** Blue route highlight — one strip per remaining path segment. */
function routeStripProps(roadId: RoadId) {
  const g = roadGeom(roadId);
  const horizontal = roadAxis(roadId) === "EW";
  return {
    position: [
      g.sx + g.ux * (g.len / 2) + g.rx * LANE,
      0.058,
      g.sz + g.uz * (g.len / 2) + g.rz * LANE,
    ] as [number, number, number],
    args: (horizontal ? [g.len, 1.15] : [1.15, g.len]) as [number, number],
  };
}

function Ambulance({
  startSegment,
  onRoadChange,
  onComplete,
}: {
  startSegment: number;
  onRoadChange: (road: RoadId) => void;
  onComplete: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const corridorRef = useRef<THREE.Mesh>(null);
  const barRef = useRef<THREE.MeshStandardMaterial>(null);
  const routeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const state = useRef({ progress: 0, segment: startSegment, traveled: 0 });

  useFrame(({ clock }, dt) => {
    const s = state.current;
    const roadId = AMBULANCE_PATH[s.segment];
    const g = roadGeom(roadId);

    s.progress += (3.6 * Math.min(dt, 0.05)) / g.len;
    if (s.progress >= 1) {
      s.progress = 0;
      s.traveled += 1;
      if (s.traveled >= AMBULANCE_PATH.length) {
        onComplete();
        return;
      }
      s.segment = (s.segment + 1) % AMBULANCE_PATH.length;
      onRoadChange(AMBULANCE_PATH[s.segment]);
    }

    // Blue route lines stay visible only for the not-yet-driven segments.
    routeRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const k = (i - startSegment + AMBULANCE_PATH.length) % AMBULANCE_PATH.length;
      mesh.visible = k >= s.traveled;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.22 + Math.sin(clock.elapsedTime * 4) * 0.07;
    });

    const d = s.progress * g.len;
    if (groupRef.current) {
      groupRef.current.position.set(
        g.sx + g.ux * d + g.rx * LANE,
        0,
        g.sz + g.uz * d + g.rz * LANE,
      );
      groupRef.current.rotation.y = Math.atan2(g.ux, g.uz);
    }

    if (corridorRef.current) {
      const remaining = g.len - d;
      const cx = g.sx + g.ux * (d + remaining / 2);
      const cz = g.sz + g.uz * (d + remaining / 2);
      corridorRef.current.position.set(cx, 0.06, cz);
      const horizontal = Math.abs(g.ux) > 0.5;
      corridorRef.current.scale.set(
        horizontal ? remaining : ROAD_W - 0.6,
        horizontal ? ROAD_W - 0.6 : remaining,
        1,
      );
      const mat = corridorRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + Math.sin(clock.elapsedTime * 5) * 0.04;
    }

    if (barRef.current) {
      const flash = Math.sin(clock.elapsedTime * 12) > 0;
      barRef.current.emissive.set(flash ? "#ef4444" : "#3b82f6");
      barRef.current.emissiveIntensity = 2.5;
    }
  });

  return (
    <group>
      {/* blue highlighted route */}
      {AMBULANCE_PATH.map((roadId, i) => {
        const strip = routeStripProps(roadId);
        return (
          <mesh
            key={roadId}
            ref={(node) => {
              routeRefs.current[i] = node;
            }}
            position={strip.position}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={strip.args} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.25} />
          </mesh>
        );
      })}

      <mesh ref={corridorRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.12} />
      </mesh>

      <group ref={groupRef}>
        <RoundedBox args={[0.95, 0.42, 2.15]} radius={0.1} position={[0, 0.36, 0]}>
          <meshStandardMaterial color="#faf6ec" metalness={0.3} roughness={0.25} />
        </RoundedBox>
        <RoundedBox args={[0.8, 0.34, 0.95]} radius={0.1} position={[0, 0.66, -0.25]}>
          <meshStandardMaterial color="#f0e9da" metalness={0.3} roughness={0.25} />
        </RoundedBox>
        {/* red stripe */}
        <mesh position={[0, 0.36, 1.08]}>
          <boxGeometry args={[0.96, 0.12, 0.02]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        {/* light bar */}
        <mesh position={[0, 0.88, -0.25]}>
          <boxGeometry args={[0.6, 0.08, 0.22]} />
          <meshStandardMaterial ref={barRef} color="#ffffff" emissive="#ef4444" emissiveIntensity={2} />
        </mesh>
        <Wheels w={0.45} l={0.75} />
        <pointLight color="#22c55e" intensity={1.2} distance={5} position={[0, 0.8, 1.2]} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- labels

function NodeLabels({ snapshot }: { snapshot: TrafficSnapshot }) {
  return (
    <group>
      {(["A", "B", "C", "D"] as IntersectionId[]).map((id) => {
        const [x, z] = NODE_POS[id];
        const info = snapshot.intersections[id];
        const decision = snapshot.decisions.find((d) => d.id === id);
        const emergency = snapshot.emergencyTarget === id;
        const dirX = x < 0 ? -1 : 1;
        const dirZ = z < 0 ? -1 : 1;
        return (
          <Html
            key={id}
            position={[x + dirX * 4.2, 2.6, z + dirZ * 3.2]}
            center
            distanceFactor={16}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <div
              className={`rounded-xl border px-3 py-1.5 text-center backdrop-blur-md ${
                emergency
                  ? "border-blue-400/40 bg-blue-400/[0.12]"
                  : "border-white/10 bg-white/[0.06]"
              }`}
            >
              <p className="text-[12px] font-semibold tracking-[0.2em] text-white/80">
                {id}
              </p>
              <p className="font-mono text-[9px] text-white/40">
                {info.vehicleCount} veh
              </p>
              {decision && (
                <p className="font-mono text-[9px] text-white/55">
                  {decision.remaining}s
                </p>
              )}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------- camera

function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.07;
    camera.position.x = Math.sin(t) * 2;
    camera.position.y = 24 + Math.sin(t * 0.6) * 0.7;
    camera.position.z = 21 + Math.cos(t) * 1.2;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ---------------------------------------------------------------- scene

export interface AmbulanceSpawn {
  id: number;
  startSegment: number;
}

interface Scene3DProps {
  snapshot: TrafficSnapshot;
  ambulance: AmbulanceSpawn | null;
  onAmbulanceRoad: (road: RoadId) => void;
  onAmbulanceDone: () => void;
}

export default function Scene3D({
  snapshot,
  ambulance,
  onAmbulanceRoad,
  onAmbulanceDone,
}: Scene3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 24, 21], fov: 42, near: 0.1, far: 150 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      className="h-full w-full"
    >
      <Suspense fallback={null}>
        <color attach="background" args={["#07080c"]} />
        <fog attach="fog" args={["#07080c", 42, 95]} />
        <CameraRig />

        <ambientLight intensity={0.45} />
        <directionalLight position={[14, 26, 10]} intensity={1.1} color="#dce6f2" />
        <directionalLight position={[-10, 14, -8]} intensity={0.25} color="#8899bb" />
        <hemisphereLight args={["#33415c", "#0b0d12", 0.5]} />

        <Ground />
        <Roads snapshot={snapshot} />
        <Signals snapshot={snapshot} />
        <CarsLayer snapshot={snapshot} />
        {ambulance && (
          <Ambulance
            key={ambulance.id}
            startSegment={ambulance.startSegment}
            onRoadChange={onAmbulanceRoad}
            onComplete={onAmbulanceDone}
          />
        )}
        <NodeLabels snapshot={snapshot} />
      </Suspense>
    </Canvas>
  );
}
