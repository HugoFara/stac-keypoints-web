import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";

// Reusable target vector to avoid per-frame allocation
const _targetVec = new THREE.Vector3();

export default function FollowCamera() {
  const followCamera = useStore((s) => s.followCamera);
  const positions = useStore((s) => s.adjustedPositions ?? s.alignedPositions ?? s.acmPositions);
  const numKp = useStore((s) => s.acmNumKeypoints);
  const currentFrame = useStore((s) => s.currentFrame);
  const mocapScale = useStore((s) => s.mocapScaleFactor);
  const { controls } = useThree();

  useFrame(() => {
    if (!followCamera || !positions || numKp === 0) return;
    const orbitControls = controls as any;
    if (!orbitControls?.target) return;

    // Average all present (non-NaN) keypoints in the current frame. Was
    // previously hardcoded to ["SpineL", "SpineM", "SpineF"] which made
    // Follow do nothing for non-rat species.
    const offset = currentFrame * numKp * 3;
    let cx = 0, cy = 0, cz = 0, count = 0;
    for (let k = 0; k < numKp; k++) {
      const i = offset + k * 3;
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      // Inline mjToThree: (x, y, z) → (x, z, -y)
      cx += x * mocapScale;
      cy += z * mocapScale;
      cz += -y * mocapScale;
      count++;
    }
    if (count === 0) return;
    cx /= count; cy /= count; cz /= count;

    _targetVec.set(cx, cy, cz);
    (orbitControls.target as THREE.Vector3).lerp(_targetVec, 0.1);
    orbitControls.update();
  });

  return null;
}
