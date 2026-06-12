import * as THREE from "three";

export type CameraPresetId = "overview" | "nodeA" | "nodeB";

export interface CameraPreset {
  position: THREE.Vector3;
  target: THREE.Vector3;
  label: string;
}

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPreset> = {
  overview: {
    position: new THREE.Vector3(0, 28, 24),
    target: new THREE.Vector3(0, 0, 0),
    label: "Overview",
  },
  nodeA: {
    position: new THREE.Vector3(-14, 18, 12),
    target: new THREE.Vector3(-14, 0, -9),
    label: "Node A",
  },
  nodeB: {
    position: new THREE.Vector3(14, 18, 12),
    target: new THREE.Vector3(14, 0, -9),
    label: "Node B",
  },
};
