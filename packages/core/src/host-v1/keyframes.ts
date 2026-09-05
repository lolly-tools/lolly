// SPDX-License-Identifier: MPL-2.0

// ─── Keyframes (optional) ───────────────────────────────────────────────────────

export interface KeyframesAPI {
  /**
   * Evaluate a `kf` track at `count` times evenly spaced across its OWN span (first to last
   * keyframe), returning each pose as a channel→value map (`x`, `y`, `z`, `rx`, `ry`, `p`,
   * `f`, `a`, …). Runs the engine's `parseKf` + `evaluateKf`, so the interpolation and
   * easing are canonical - a template's motion matches the Design tool's exactly. An
   * empty / parse-failed track returns `[]`. The caller maps the channels onto its own
   * camera or transform (a real-3D tool interprets `rx`/`ry`/`z` differently from the
   * Design tool's 2.5D homography, which is why the mapping stays with the caller).
   */
  sample(kf: string, count: number): Promise<Record<string, number>[]>;
}
