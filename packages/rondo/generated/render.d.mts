// SPDX-License-Identifier: MPL-2.0
// Hand-written types for generated/render.mjs (scripts/build-rondo.ts builds the JS).
// Only the surface packages/rondo/src/render.ts reads is typed here.

export interface RenderMixResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  perSynth: Record<string, { events: number; rms: number }>;
  normalized: boolean;
}

export function renderMix(
  synths: Map<string, unknown>,
  events: Map<string, unknown[]>,
  durationSec: number,
  opts: Record<string, unknown>,
): RenderMixResult;

export function validateGraph(graph: unknown): void;
export function sampleNamesIn(graph: unknown): string[];
export function usesMicIn(graph: unknown): boolean;
export function validateWavetableFrames(what: string, frames: unknown): void;
export function builtInSampleNames(): readonly string[];
