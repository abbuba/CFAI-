"use client";

import { Suspense, useEffect, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
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
import { NODE_A_CAMERA } from "@/lib/cameraPresets";

const NODE_POS: Record<IntersectionId, [number, number]> = {
  A: [-14, -9],
  B: [14, -9],
  C: [-14, 9],
  D: [14, 9],
};

const DEFAULT_TARGET = NODE_A_CAMERA.target.clone();
const CAMERA_ANIM_SEC = 0.65;

const ROAD_W = 3.4;
const LANE = 0.85;
const PAD = 2.6;
/** Simulation bounds for cars and stop logic. */
const SIM_EXTENT = 30;
const V_SIM_EXTENT = 21;
/** Visual road length — fades into fog. */
const VISUAL_EXTENT = 140;
const CAR_NOSE = 1.1;

/** Demo: only bottom EW (A–B) and left NS (A–C) carry traffic. */
const ACTIVE_EW_Z = -9;
const ACTIVE_NS_X = -14;

const ROAD_ACTIVE = "#6b6560";
const ROAD_QUIET = "#b8b0a4";
const MARK_WARM = "#f5f0e8";

const SIGNAL_NODES: Record<IntersectionId, Axis[]> = {
  A: ["EW", "NS"],
  B: ["EW"],
  C: ["NS"],
  D: ["EW", "NS"],
};

const ACTIVE_ROAD_IDS: RoadId[] = ["AB", "BA", "AC", "CA"];

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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-14, -0.02, -9]}>
      <planeGeometry args={[320, 320]} />
      <meshStandardMaterial color="#f5f0e8" roughness={0.92} />
    </mesh>
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
  const asphalt = active ? ROAD_ACTIVE : ROAD_QUIET;
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
        <meshStandardMaterial color={asphalt} roughness={0.88} />
      </mesh>
      <mesh position={horizontal ? [0, 0.025, -half] : [-half, 0.025, 0]}>
        <boxGeometry args={edge} />
        <meshStandardMaterial color={MARK_WARM} />
      </mesh>
      <mesh position={horizontal ? [0, 0.025, half] : [half, 0.025, 0]}>
        <boxGeometry args={edge} />
        <meshStandardMaterial color={MARK_WARM} />
      </mesh>
      <mesh position={horizontal ? [0, 0.025, -0.06] : [-0.06, 0.025, 0]}>
        <boxGeometry
          args={
            horizontal ? [length, 0.01, 0.035] : [0.035, 0.01, length]
          }
        />
        <meshStandardMaterial color="#c4a574" transparent opacity={0.75} />
      </mesh>
      <mesh position={horizontal ? [0, 0.025, 0.06] : [0.06, 0.025, 0]}>
        <boxGeometry
          args={
            horizontal ? [length, 0.01, 0.035] : [0.035, 0.01, length]
          }
        />
        <meshStandardMaterial color="#c4a574" transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

function Roads() {
  return (
    <group>
      <RoadStrip
        x={0}
        z={ACTIVE_EW_Z}
        length={VISUAL_EXTENT * 2}
        horizontal
        active
      />
      <RoadStrip
        x={ACTIVE_NS_X}
        z={0}
        length={VISUAL_EXTENT * 2}
        horizontal={false}
        active={false}
      />

      <mesh position={[-14, 0.028, -9]}>
        <boxGeometry args={[ROAD_W + 0.2, 0.015, ROAD_W + 0.2]} />
        <meshStandardMaterial color="#5c5752" roughness={0.85} />
      </mesh>

      {ACTIVE_ROAD_IDS.map((roadId) => {
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
            <meshStandardMaterial color={MARK_WARM} />
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
        <div className="hologram-text min-w-[78px] text-center transition-opacity duration-500">
          <p
            className="text-[11px] font-semibold leading-tight"
            style={{ color: tone }}
          >
            {line1}
          </p>
          <p className="text-[10px] leading-tight text-[#3a3632]/85">{line2}</p>
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
  const id: IntersectionId = "A";
  const axes = SIGNAL_NODES[id];
  const [nx, nz] = NODE_POS[id];

  return (
    <group>
      {APPROACHES.filter(({ axis }) => axes.includes(axis)).map(
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
      )}
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
      sx: -SIM_EXTENT,
      sz: z,
      ux: 1,
      uz: 0,
      len: SIM_EXTENT * 2,
      stops: [
        { dist: -14 + SIM_EXTENT - STOP_BACK, node: n1 },
        { dist: 14 + SIM_EXTENT - STOP_BACK, node: n2 },
      ],
      road: z < 0 ? "AB" : "CD",
      active: ewActive,
    });
    list.push({
      axis: "EW",
      sx: SIM_EXTENT,
      sz: z,
      ux: -1,
      uz: 0,
      len: SIM_EXTENT * 2,
      stops: [
        { dist: SIM_EXTENT - 14 - STOP_BACK, node: n2 },
        { dist: SIM_EXTENT + 14 - STOP_BACK, node: n1 },
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
      sz: -V_SIM_EXTENT,
      ux: 0,
      uz: 1,
      len: V_SIM_EXTENT * 2,
      stops: [
        { dist: -9 + V_SIM_EXTENT - STOP_BACK, node: n1 },
        { dist: 9 + V_SIM_EXTENT - STOP_BACK, node: n2 },
      ],
      road: x < 0 ? "AC" : "BD",
      active: nsActive,
    });
    list.push({
      axis: "NS",
      sx: x,
      sz: V_SIM_EXTENT,
      ux: 0,
      uz: -1,
      len: V_SIM_EXTENT * 2,
      stops: [
        { dist: V_SIM_EXTENT - 9 - STOP_BACK, node: n2 },
        { dist: V_SIM_EXTENT + 9 - STOP_BACK, node: n1 },
      ],
      road: x < 0 ? "CA" : "DB",
      active: false,
    });
  }

  return list;
}

const CORRIDORS = buildCorridors();
const CAR_GAP = 2.8;
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
    const count = corridor.axis === "EW" ? 13 : 3;
    for (let i = 0; i < count; i += 1) {
      cars.push({
        id: `c${ci}-${i}`,
        corridor: ci,
        d: (corridor.len / (count + 1)) * (i + 1),
        speed: 2.8 + Math.random() * 0.6,
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

function NodeMarkers() {
  const [x, z] = NODE_POS.A;

  return (
    <Html
      position={[x, 1.2, z - 2.6]}
      center
      distanceFactor={14}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div className="hologram-text text-center">
        <p className="text-[14px] font-semibold tracking-[0.28em] text-[#3a3632]">
          A
        </p>
        <p className="text-[10px] tracking-wide text-[#3a3632]/75">Junction</p>
      </div>
    </Html>
  );
}

function CameraFlyAnimator({
  flyKey,
  instant,
  controlsRef,
}: {
  flyKey: number;
  instant?: boolean;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const anim = useRef({
    active: false,
    elapsed: 0,
    startPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
  });

  useEffect(() => {
    if (flyKey === 0) return;
    anim.current.endPos.copy(NODE_A_CAMERA.position);
    anim.current.endTarget.copy(NODE_A_CAMERA.target);

    if (instant) {
      camera.position.copy(anim.current.endPos);
      if (controlsRef.current) {
        controlsRef.current.target.copy(anim.current.endTarget);
        controlsRef.current.update();
      }
      anim.current.active = false;
      return;
    }

    anim.current.active = true;
    anim.current.elapsed = 0;
    anim.current.startPos.copy(camera.position);
    anim.current.startTarget.copy(
      controlsRef.current?.target ?? DEFAULT_TARGET,
    );
  }, [flyKey, instant, camera, controlsRef]);

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!anim.current.active || !controls) return;

    anim.current.elapsed += dt;
    const t = Math.min(anim.current.elapsed / CAMERA_ANIM_SEC, 1);
    const ease = 1 - (1 - t) ** 3;

    camera.position.lerpVectors(
      anim.current.startPos,
      anim.current.endPos,
      ease,
    );
    controls.target.lerpVectors(
      anim.current.startTarget,
      anim.current.endTarget,
      ease,
    );
    controls.update();

    if (t >= 1) anim.current.active = false;
  });

  return null;
}


interface Scene3DProps {
  snapshot: TrafficSnapshot;
  cameraFlyKey?: number;
  cameraInstant?: boolean;
}

export default function Scene3D({
  snapshot,
  cameraFlyKey = 0,
  cameraInstant = false,
}: Scene3DProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <Canvas
      camera={{
        position: [-11, 5, -5],
        fov: 42,
        near: 0.1,
        far: 150,
      }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      className="h-full w-full"
    >
      <Suspense fallback={null}>
        <color attach="background" args={["#e8e4dc"]} />
        <fog attach="fog" args={["#e8e4dc", 25, 85]} />

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={40}
          target={[-14, 1.2, -9]}
        />
        <CameraFlyAnimator
          flyKey={cameraFlyKey}
          instant={cameraInstant}
          controlsRef={controlsRef}
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
        <NodeMarkers />
      </Suspense>
    </Canvas>
  );
}
