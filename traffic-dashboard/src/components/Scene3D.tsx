"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type {
  Axis,
  IntersectionId,
  LightState,
  RoadId,
  TrafficSnapshot,
  VehicleType,
} from "@/types/traffic";
import { ROAD_IDS, roadAxis, roadNodes } from "@/lib/intersectionLayout";

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
const CAR_NOSE = 1.1;

/** Demo: only bottom EW (A–B) and left NS (A–C) carry traffic. */
const ACTIVE_EW_Z = -9;
const ACTIVE_NS_X = -14;

const ROAD_ACTIVE = "#6b6560";
const ROAD_IDLE = "#ddd6c8";
const MARK_ACTIVE = "#f5f0e8";
const MARK_IDLE = "#e8e0d4";

const SIGNAL_NODES: Record<
  IntersectionId,
  Axis[] | null
> = {
  A: ["EW", "NS"],
  B: ["EW"],
  C: ["NS"],
  D: null,
};

function lightFor(
  snapshot: TrafficSnapshot,
  node: IntersectionId,
  axis: Axis,
): LightState {
  return axis === "EW"
    ? snapshot.intersections[node].ewState
    : snapshot.intersections[node].nsState;
}

function signalCopy(
  snapshot: TrafficSnapshot,
  axis: Axis,
  state: LightState,
): { line1: string; line2: string; tone: string } {
  const decision = snapshot.decisions[0];
  const remaining = decision?.remaining ?? 0;

  if (state === "green") {
    return {
      line1: `GREEN ${remaining}s`,
      line2: snapshot.mode === "fixed" ? "Equal timer" : "Demand priority",
      tone: "#34c759",
    };
  }
  if (state === "yellow") {
    return {
      line1: `YELLOW ${remaining}s`,
      line2: "Clearing",
      tone: "#d4a017",
    };
  }

  if (snapshot.mode === "fixed") {
    return {
      line1: "STOP",
      line2: axis === "EW" ? "Empty lane green" : "Empty lane green",
      tone: "#ff3b30",
    };
  }

  return {
    line1: "STOP",
    line2: axis === "EW" ? "Heavy queue" : "Brief wait",
    tone: "#ff3b30",
  };
}


function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[90, 64]} />
        <meshStandardMaterial color="#f5f0e8" roughness={0.92} />
      </mesh>
      <gridHelper
        args={[120, 48, "#ddd6c8", "#ede8df"]}
        position={[0, -0.01, 0]}
      />
    </group>
  );
}

function RoadStrip({
  x,
  z,
  length,
  horizontal,
  active,
}: {
  x: number;
  z: number;
  length: number;
  horizontal: boolean;
  active: boolean;
}) {
  const asphalt = active ? ROAD_ACTIVE : ROAD_IDLE;
  const mark = active ? MARK_ACTIVE : MARK_IDLE;
  const size: [number, number, number] = horizontal
    ? [length, 0.04, ROAD_W]
    : [ROAD_W, 0.04, length];
  const edge: [number, number, number] = horizontal
    ? [length, 0.012, 0.05]
    : [0.05, 0.012, length];
  const half = ROAD_W / 2 - 0.12;

  return (
    <group position={[x, 0.015, z]}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={asphalt}
          roughness={active ? 0.88 : 0.95}
          transparent={!active}
          opacity={active ? 1 : 0.55}
        />
      </mesh>
      {active && (
        <>
          <mesh position={horizontal ? [0, 0.025, -half] : [-half, 0.025, 0]}>
            <boxGeometry args={edge} />
            <meshStandardMaterial color={mark} />
          </mesh>
          <mesh position={horizontal ? [0, 0.025, half] : [half, 0.025, 0]}>
            <boxGeometry args={edge} />
            <meshStandardMaterial color={mark} />
          </mesh>
          <mesh position={horizontal ? [0, 0.025, -0.06] : [-0.06, 0.025, 0]}>
            <boxGeometry
              args={
                horizontal ? [length, 0.01, 0.035] : [0.035, 0.01, length]
              }
            />
            <meshStandardMaterial color="#c4a574" transparent opacity={0.7} />
          </mesh>
          <mesh position={horizontal ? [0, 0.025, 0.06] : [0.06, 0.025, 0]}>
            <boxGeometry
              args={
                horizontal ? [length, 0.01, 0.035] : [0.035, 0.01, length]
              }
            />
            <meshStandardMaterial color="#c4a574" transparent opacity={0.7} />
          </mesh>
        </>
      )}
    </group>
  );
}

function isActiveSegment(roadId: RoadId): boolean {
  if (roadId === "AB" || roadId === "BA") return true;
  if (roadId === "AC" || roadId === "CA") return true;
  return false;
}

function Roads() {
  return (
    <group>
      <RoadStrip
        x={0}
        z={-9}
        length={H_EXTENT * 2}
        horizontal
        active
      />
      <RoadStrip x={0} z={9} length={H_EXTENT * 2} horizontal active={false} />
      <RoadStrip
        x={-14}
        z={0}
        length={V_EXTENT * 2}
        horizontal={false}
        active
      />
      <RoadStrip
        x={14}
        z={0}
        length={V_EXTENT * 2}
        horizontal={false}
        active={false}
      />

      {(["A", "B", "C", "D"] as IntersectionId[]).map((id) => {
        const [x, z] = NODE_POS[id];
        const active =
          id === "A" ||
          id === "B" ||
          id === "C";
        return (
          <mesh key={id} position={[x, 0.028, z]}>
            <boxGeometry args={[ROAD_W + 0.2, 0.015, ROAD_W + 0.2]} />
            <meshStandardMaterial
              color={active ? "#5c5752" : ROAD_IDLE}
              roughness={0.85}
              transparent={!active}
              opacity={active ? 1 : 0.4}
            />
          </mesh>
        );
      })}

      {ROAD_IDS.filter(isActiveSegment).map((roadId) => {
        const g = roadGeom(roadId);
        const stopD = g.len - 0.85;
        const sx = g.sx + g.ux * stopD;
        const sz = g.sz + g.uz * stopD;
        const horizontal = roadAxis(roadId) === "EW";
        return (
          <mesh key={`stop-${roadId}`} position={[sx, 0.04, sz]}>
            <boxGeometry
              args={
                horizontal
                  ? [0.14, 0.01, ROAD_W - 0.5]
                  : [ROAD_W - 0.5, 0.01, 0.14]
              }
            />
            <meshStandardMaterial color={MARK_ACTIVE} />
          </mesh>
        );
      })}
    </group>
  );
}

function roadGeom(roadId: RoadId) {
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

function SignalHead({
  position,
  labelOffset,
  rotationY,
  state,
  line1,
  line2,
  tone,
}: {
  position: [number, number, number];
  labelOffset: [number, number, number];
  rotationY: number;
  state: LightState;
  line1: string;
  line2: string;
  tone: string;
}) {
  const lens = (color: string, on: boolean, y: number) => (
    <mesh position={[0, y, 0.12]}>
      <sphereGeometry args={[0.1, 12, 12]} />
      <meshStandardMaterial
        color={on ? color : "#8e8880"}
        emissive={on ? color : "#000000"}
        emissiveIntensity={on ? 1.6 : 0}
      />
    </mesh>
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 2.0, 8]} />
        <meshStandardMaterial color="#8a8480" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[0.28, 0.82, 0.22]} />
        <meshStandardMaterial color="#4a4744" roughness={0.45} />
      </mesh>
      <group position={[0, 2.2, 0]}>
        {lens("#ff3b30", state === "red", 0.26)}
        {lens("#d4a017", state === "yellow", 0)}
        {lens("#34c759", state === "green", -0.26)}
      </group>

      <Html
        position={labelOffset}
        center
        distanceFactor={14}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="hologram-text min-w-[72px] text-center transition-opacity duration-500">
          <p
            className="text-[10px] font-medium leading-tight"
            style={{ color: tone }}
          >
            {line1}
          </p>
          <p className="text-[9px] leading-tight text-[#3a3632]/70">{line2}</p>
        </div>
      </Html>
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
        const axes = SIGNAL_NODES[id];
        if (!axes) return null;
        const [nx, nz] = NODE_POS[id];

        return APPROACHES.filter(({ axis }) => axes.includes(axis)).map(
          ({ dx, dz, axis }, i) => {
            const rx = -dz;
            const rz = dx;
            const px = nx - dx * (PAD + 0.35) + rx * (ROAD_W / 2 + 0.55);
            const pz = nz - dz * (PAD + 0.35) + rz * (ROAD_W / 2 + 0.55);
            const state = lightFor(snapshot, id, axis);
            const copy = signalCopy(snapshot, axis, state);
            return (
              <SignalHead
                key={`${id}-${i}-${axis}`}
                position={[px, 0, pz]}
                labelOffset={[0, 3.0, 0]}
                rotationY={Math.atan2(-dx, -dz)}
                state={state}
                line1={copy.line1}
                line2={copy.line2}
                tone={copy.tone}
              />
            );
          },
        );
      })}
    </group>
  );
}

function CarBody({ truck }: { truck?: boolean }) {
  if (truck) {
    return (
      <group>
        <RoundedBox args={[1.05, 0.6, 2.5]} radius={0.12} position={[0, 0.45, 0]}>
          <meshStandardMaterial color="#d4cbb8" metalness={0.2} roughness={0.5} />
        </RoundedBox>
        <Wheels w={0.48} l={0.95} />
      </group>
    );
  }

  return (
    <group>
      <RoundedBox args={[0.9, 0.3, 1.9]} radius={0.12} position={[0, 0.3, 0]}>
        <meshStandardMaterial color="#f3ecdd" metalness={0.35} roughness={0.32} />
      </RoundedBox>
      <RoundedBox args={[0.74, 0.26, 1.0]} radius={0.11} position={[0, 0.52, -0.08]}>
        <meshStandardMaterial color="#e8dfd0" metalness={0.3} roughness={0.28} />
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
          <meshStandardMaterial color="#5c5752" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

interface Corridor {
  axis: Axis;
  sx: number;
  sz: number;
  ux: number;
  uz: number;
  len: number;
  stops: { dist: number; node: IntersectionId }[];
  road: RoadId;
  active: boolean;
}

const STOP_BACK = PAD + 1.7;

function buildCorridors(): Corridor[] {
  const list: Corridor[] = [];

  for (const z of [-9, 9]) {
    const [n1, n2]: [IntersectionId, IntersectionId] =
      z < 0 ? ["A", "B"] : ["C", "D"];
    const ewActive = z === ACTIVE_EW_Z;
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
      active: ewActive,
    });
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
      active: false,
    });
  }

  for (const x of [-14, 14]) {
    const [n1, n2]: [IntersectionId, IntersectionId] =
      x < 0 ? ["A", "C"] : ["B", "D"];
    const nsActive = x === ACTIVE_NS_X;
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
      active: nsActive,
    });
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
      active: false,
    });
  }

  return list;
}

const CORRIDORS = buildCorridors();
const CAR_GAP = 3.2;
/** Distance past the stop line before the car is treated as cleared. */
const INTERSECTION_CLEAR = PAD + 0.8;

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
    if (!corridor.active) return;
    const count = corridor.axis === "EW" ? 9 : 2;
    for (let i = 0; i < count; i += 1) {
      cars.push({
        id: `c${ci}-${i}`,
        corridor: ci,
        d: (corridor.len / (count + 1)) * (i + 1),
        speed: 2.4 + Math.random() * 0.8,
        type: "sedan",
      });
    }
  });
  return cars;
}

function stopLimit(
  carD: number,
  corridor: Corridor,
  data: TrafficSnapshot,
): number | null {
  for (const stop of corridor.stops) {
    const line = stop.dist - CAR_NOSE;
    // Only skip after the car has fully cleared this intersection.
    if (carD > line + INTERSECTION_CLEAR) continue;

    const state = lightFor(data, stop.node, corridor.axis);
    if (state !== "green") return line;

    // Nearest upcoming intersection is green — do not check further yet.
    return null;
  }
  return null;
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
      if (!corridor.active) continue;

      const cars = carsRef.current
        .filter((c) => c.corridor === ci)
        .sort((a, b) => b.d - a.d);

      let ahead = Infinity;
      for (const car of cars) {
        let cap = ahead - CAR_GAP;
        const signalStop = stopLimit(car.d, corridor, data);
        if (signalStop !== null) {
          cap = Math.min(cap, signalStop);
        }

        const next = car.d + car.speed * dt;
        car.d = Math.min(next, cap);

        if (car.d >= corridor.len - 1) {
          car.d = 2;
        }

        ahead = car.d;

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

interface Scene3DProps {
  snapshot: TrafficSnapshot;
}

export default function Scene3D({ snapshot }: Scene3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 28, 24], fov: 42, near: 0.1, far: 150 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      className="h-full w-full"
    >
      <Suspense fallback={null}>
        <color attach="background" args={["#e8e4dc"]} />

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={18}
          maxDistance={55}
          maxPolarAngle={Math.PI / 2.15}
          target={[0, 0, 0]}
        />

        <ambientLight intensity={0.7} color="#f5f0e8" />
        <directionalLight
          position={[12, 28, 8]}
          intensity={1.25}
          color="#fff8f0"
        />
        <directionalLight
          position={[-8, 16, -6]}
          intensity={0.3}
          color="#e8e4dc"
        />
        <hemisphereLight args={["#f0ebe3", "#ede8df", 0.5]} />

        <Ground />
        <Roads />
        <Signals snapshot={snapshot} />
        <CarsLayer snapshot={snapshot} />
      </Suspense>
    </Canvas>
  );
}
