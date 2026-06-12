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
  SimMode,
  TrafficSnapshot,
  VehicleType,
} from "@/types/traffic";
import { ROAD_IDS, roadAxis, roadNodes } from "@/lib/intersectionLayout";

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
const CAR_NOSE = 1.1;

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
  nodeId: IntersectionId,
  axis: Axis,
  state: LightState,
): { line1: string; line2: string; tone: string } {
  const decision = snapshot.decisions.find((d) => d.id === nodeId);
  const remaining = decision?.remaining ?? 0;
  const arrow = axis === "EW" ? "\u2194" : "\u2195";
  const other = axis === "EW" ? "N\u2013S" : "E\u2013W";

  if (state === "green") {
    return {
      line1: `${arrow} GREEN \u00b7 ${remaining}s`,
      line2: decision?.reason ?? "",
      tone: "#34c759",
    };
  }
  if (state === "yellow") {
    return {
      line1: `${arrow} YELLOW \u00b7 ${remaining}s`,
      line2: "Clearing",
      tone: "#ffcc00",
    };
  }

  if (snapshot.mode === "fixed") {
    return {
      line1: "STOP",
      line2: `Fixed \u00b7 empty ${other} has green`,
      tone: "#ff3b30",
    };
  }

  if (axis === "EW") {
    return {
      line1: "STOP",
      line2: "Adaptive \u00b7 heavy flow waits",
      tone: "#ff3b30",
    };
  }

  return {
    line1: "STOP",
    line2: "Adaptive \u00b7 brief wait",
    tone: "#ff3b30",
  };
}

// ---------------------------------------------------------------- ground

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
    ? [length, 0.012, 0.06]
    : [0.06, 0.012, length];
  const half = ROAD_W / 2 - 0.12;

  return (
    <group position={[x, 0.015, z]}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#2c2c2e" roughness={0.88} />
      </mesh>
      <mesh position={horizontal ? [0, 0.025, -half] : [-half, 0.025, 0]}>
        <boxGeometry args={edge} />
        <meshStandardMaterial color="#f5f0e8" />
      </mesh>
      <mesh position={horizontal ? [0, 0.025, half] : [half, 0.025, 0]}>
        <boxGeometry args={edge} />
        <meshStandardMaterial color="#f5f0e8" />
      </mesh>
      <mesh position={horizontal ? [0, 0.025, -0.06] : [-0.06, 0.025, 0]}>
        <boxGeometry
          args={
            horizontal ? [length, 0.01, 0.04] : [0.04, 0.01, length]
          }
        />
        <meshStandardMaterial color="#c9a227" transparent opacity={0.75} />
      </mesh>
      <mesh position={horizontal ? [0, 0.025, 0.06] : [0.06, 0.025, 0]}>
        <boxGeometry
          args={
            horizontal ? [length, 0.01, 0.04] : [0.04, 0.01, length]
          }
        />
        <meshStandardMaterial color="#c9a227" transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

function Roads() {
  return (
    <group>
      <RoadStrip x={0} z={-9} length={H_EXTENT * 2} horizontal />
      <RoadStrip x={0} z={9} length={H_EXTENT * 2} horizontal />
      <RoadStrip x={-14} z={0} length={V_EXTENT * 2} horizontal={false} />
      <RoadStrip x={14} z={0} length={V_EXTENT * 2} horizontal={false} />

      {(["A", "B", "C", "D"] as IntersectionId[]).map((id) => {
        const [x, z] = NODE_POS[id];
        return (
          <mesh key={id} position={[x, 0.028, z]}>
            <boxGeometry args={[ROAD_W + 0.2, 0.015, ROAD_W + 0.2]} />
            <meshStandardMaterial color="#333336" roughness={0.85} />
          </mesh>
        );
      })}

      {ROAD_IDS.map((roadId) => {
        const [from] = roadNodes(roadId);
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
            <meshStandardMaterial color="#f5f0e8" />
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

// ---------------------------------------------------------------- signals

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
        color={on ? color : "#3a3a3c"}
        emissive={on ? color : "#000000"}
        emissiveIntensity={on ? 1.8 : 0}
      />
    </mesh>
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 2.0, 8]} />
        <meshStandardMaterial color="#48484a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[0.28, 0.82, 0.22]} />
        <meshStandardMaterial color="#1c1c1e" roughness={0.45} />
      </mesh>
      <group position={[0, 2.2, 0]}>
        {lens("#ff3b30", state === "red", 0.26)}
        {lens("#ffcc00", state === "yellow", 0)}
        {lens("#34c759", state === "green", -0.26)}
      </group>

      <Html
        position={labelOffset}
        center
        distanceFactor={14}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="hologram-text text-center transition-opacity duration-500">
          <p
            className="text-[10px] font-medium tracking-wide"
            style={{ color: tone }}
          >
            {line1}
          </p>
          <p className="text-[9px] tracking-wide text-[#3a3632]/75">{line2}</p>
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
        const [nx, nz] = NODE_POS[id];
        return APPROACHES.map(({ dx, dz, axis }, i) => {
          const rx = -dz;
          const rz = dx;
          const px = nx - dx * (PAD + 0.35) + rx * (ROAD_W / 2 + 0.55);
          const pz = nz - dz * (PAD + 0.35) + rz * (ROAD_W / 2 + 0.55);
          const state = lightFor(snapshot, id, axis);
          const copy = signalCopy(snapshot, id, axis, state);
          return (
            <SignalHead
              key={`${id}-${i}`}
              position={[px, 0, pz]}
              labelOffset={[0, 3.1, 0]}
              rotationY={Math.atan2(-dx, -dz)}
              state={state}
              line1={copy.line1}
              line2={copy.line2}
              tone={copy.tone}
            />
          );
        });
      })}
    </group>
  );
}

// ---------------------------------------------------------------- mode narrative

function ModeNarrative({ mode }: { mode: SimMode }) {
  const text =
    mode === "fixed"
      ? "Fixed timing \u2014 dense road stopped while nearly empty road has green"
      : "Adaptive timing \u2014 green follows demand; traffic flows";

  return (
    <Html
      position={[0, 5.5, 0]}
      center
      distanceFactor={18}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <p className="hologram-text max-w-md text-center text-[11px] font-light tracking-wide text-[#3a3632]/80 transition-opacity duration-500">
        {text}
      </p>
    </Html>
  );
}

// ---------------------------------------------------------------- vehicles

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
          <meshStandardMaterial color="#2c2c2e" roughness={0.7} />
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
}

const STOP_BACK = PAD + 1.7;

function buildCorridors(): Corridor[] {
  const list: Corridor[] = [];

  for (const z of [-9, 9]) {
    const [n1, n2]: [IntersectionId, IntersectionId] =
      z < 0 ? ["A", "B"] : ["C", "D"];
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
const CARS_PER_CORRIDOR: Record<Axis, number> = { EW: 9, NS: 2 };
const CAR_GAP = 3.2;

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
        d: (corridor.len / (count + 1)) * (i + 1),
        speed: 2.4 + Math.random() * 0.8,
        type: Math.random() > 0.88 ? "truck" : "sedan",
      });
    }
  });
  return cars;
}

/** Nearest upcoming stop only — red/yellow halts before the line. */
function stopLimit(
  carD: number,
  corridor: Corridor,
  data: TrafficSnapshot,
): number | null {
  for (const stop of corridor.stops) {
    if (carD >= stop.dist - CAR_NOSE) continue;
    const state = lightFor(data, stop.node, corridor.axis);
    if (state !== "green") return stop.dist - CAR_NOSE;
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
      const cars = carsRef.current
        .filter((c) => c.corridor === ci)
        .sort((a, b) => b.d - a.d);

      let ahead = Infinity;
      for (const car of cars) {
        let limit = ahead - CAR_GAP;
        const signalStop = stopLimit(car.d, corridor, data);
        if (signalStop !== null) {
          limit = Math.min(limit, signalStop);
        }

        const next = car.d + car.speed * dt;
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

// ---------------------------------------------------------------- camera

function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.04;
    camera.position.x = Math.sin(t) * 0.8;
    camera.position.y = 26 + Math.sin(t * 0.5) * 0.3;
    camera.position.z = 22 + Math.cos(t) * 0.5;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ---------------------------------------------------------------- scene

interface Scene3DProps {
  snapshot: TrafficSnapshot;
}

export default function Scene3D({ snapshot }: Scene3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 26, 22], fov: 40, near: 0.1, far: 150 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      className="h-full w-full"
    >
      <Suspense fallback={null}>
        <color attach="background" args={["#e8e4dc"]} />
        <CameraRig />

        <ambientLight intensity={0.65} color="#f5f0e8" />
        <directionalLight
          position={[12, 28, 8]}
          intensity={1.35}
          color="#fff8f0"
        />
        <directionalLight
          position={[-8, 16, -6]}
          intensity={0.35}
          color="#e8e4dc"
        />
        <hemisphereLight args={["#f0ebe3", "#ede8df", 0.55]} />

        <Ground />
        <Roads />
        <Signals snapshot={snapshot} />
        <CarsLayer snapshot={snapshot} />
        <ModeNarrative mode={snapshot.mode} />
      </Suspense>
    </Canvas>
  );
}
