"""Generate a synthetic STAC-format keypoint dataset for stress-testing.

The web UI's load-keypoints endpoint reads `tracks` (F, K, 3), optionally
`point_scores` (F, K), and `node_names` (K,). We emit smooth periodic
trajectories with periodic NaN gaps so the heatmap and confidence row both
have something to draw.

Usage:
    python tools/make_synth_dataset.py [--frames 210000] [--keypoints 100] \\
        [--out data/synth_stress.h5]
"""
from __future__ import annotations

import argparse
from pathlib import Path

import h5py
import numpy as np


def build(num_frames: int, num_keypoints: int, seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)

    # Smooth-ish trajectories: a base offset per kp + a low-frequency sinusoid
    # in each axis. Cheap and gives the 3D viewport something recognizable.
    base = rng.uniform(-0.1, 0.1, size=(num_keypoints, 3)).astype(np.float32)
    freqs = rng.uniform(0.001, 0.01, size=(num_keypoints, 3)).astype(np.float32)
    phases = rng.uniform(0, 2 * np.pi, size=(num_keypoints, 3)).astype(np.float32)
    amps = rng.uniform(0.02, 0.08, size=(num_keypoints, 3)).astype(np.float32)

    t = np.arange(num_frames, dtype=np.float32)[:, None, None]
    tracks = base[None, :, :] + amps[None, :, :] * np.sin(freqs[None, :, :] * t + phases[None, :, :])

    # NaN gaps: each keypoint drops out for short bursts ~3% of the time.
    miss_mask = rng.random((num_frames, num_keypoints)) < 0.03
    tracks[miss_mask] = np.nan

    # Confidence: high baseline, noisy dips around the gap windows.
    scores = rng.uniform(0.85, 1.0, size=(num_frames, num_keypoints)).astype(np.float32)
    dip = rng.random((num_frames, num_keypoints)) < 0.05
    scores[dip] = rng.uniform(0.3, 0.7, size=int(dip.sum())).astype(np.float32)
    scores[miss_mask] = np.nan

    names = np.array([f"kp_{i:03d}" for i in range(num_keypoints)], dtype="S")

    return {"tracks": tracks, "point_scores": scores, "node_names": names}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--frames", type=int, default=210_000)
    ap.add_argument("--keypoints", type=int, default=100)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path, default=Path("data/synth_stress.h5"))
    args = ap.parse_args()

    data = build(args.frames, args.keypoints, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with h5py.File(args.out, "w") as f:
        for k, v in data.items():
            f.create_dataset(k, data=v, compression="gzip", compression_opts=4)
    size_mb = args.out.stat().st_size / 1e6
    print(f"Wrote {args.out} ({args.frames} frames x {args.keypoints} kp, {size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
