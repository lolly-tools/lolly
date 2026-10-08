// SPDX-License-Identifier: MPL-2.0
/** Seeded scalar inputs whose results must be the same bits in every JavaScript engine. */

/** SHA-256 of `portableMathResults` bytes, which Node and every browser realm must reproduce. */
export const PORTABLE_MATH_RESULTS_SHA256 = '0355555bc7f20ced3cc049f5d3889008344d31fafec6d66f4663258bc31b6b17';

export interface PortableMath {
  hypot(x: number, y: number): number;
  sin(x: number): number;
  cos(x: number): number;
  tan(x: number): number;
  acos(x: number): number;
  cbrt(x: number): number;
  log2(x: number): number;
  atan2(y: number, x: number): number;
  pow(x: number, y: number): number;
}

/** Inputs mix geometry-sized values, angles, large magnitudes and arbitrary bit patterns. */
export function portableMathResults(math: PortableMath, perFunction = 4096): Float64Array<ArrayBuffer> {
  const bits = new Float64Array(1), words = new Uint32Array(bits.buffer);
  let seed = 0x2951a7;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const value = (): number => {
    const r = next();
    if (r < 0.3) return (next() * 2 - 1) * 1000;
    if (r < 0.55) return (next() * 2 - 1) * Math.PI * 8;
    if (r < 0.7) return (next() * 2 - 1) * 1e-9;
    if (r < 0.8) return (next() * 2 - 1) * 1e12;
    words[0] = (next() * 4294967296) >>> 0;
    words[1] = (next() * 4294967296) >>> 0;
    return bits[0]!;
  };
  const edges = [0, -0, 1, -1, 0.5, -0.5, 2, 8, Math.PI, -Math.PI, Math.PI / 2, 1e-310, -1e-310, Number.MAX_VALUE, Infinity, -Infinity, NaN];
  const unary = [math.sin, math.cos, math.tan, math.acos, math.cbrt, math.log2];
  const out: number[] = [];
  for (const fn of unary) {
    for (const edge of edges) out.push(fn(edge));
    for (let i = 0; i < perFunction; i++) out.push(fn(fn === math.acos && next() < 0.8 ? next() * 2 - 1 : value()));
  }
  for (const binary of [math.atan2, math.hypot, math.pow]) {
    for (const a of edges) for (const b of edges) out.push(binary(a, b));
    for (let i = 0; i < perFunction; i++) out.push(binary(value(), value()));
  }
  // WebAssembly leaves NaN payload bits to the engine and only typed-array bytes can
  // observe them, so every NaN is written as the one canonical quiet NaN.
  const results = Float64Array.from(out), view = new DataView(results.buffer);
  for (let i = 0; i < results.length; i++) {
    if (!Number.isNaN(results[i]!)) continue;
    view.setUint32(i * 8, 0, true);
    view.setUint32(i * 8 + 4, 0x7ff80000, true);
  }
  return results;
}

/**
 * SHA-256 of `geometryRevisionRecord()`: revision `geom-portable-v1` in every engine, with
 * the engine's 16,384-node `CLIP_BUDGET`. The record carries the clipping work counters, so
 * the budget is part of the answer: during main's brief 512-node budget the digest was
 * e00e2880...c624.
 */
export const GEOMETRY_WORKFLOWS_SHA256 = '7d0709d69fe35906cc9c41a52f388b1f542e3188171b9e219b208d65f75b76e7';

/** Every stage workflow through the TypeScript reference, with the clipping work counters each one used. */
export async function geometryRevisionRecord(): Promise<string> {
  const [{ geometryStageWorkflows }, { CLIP_COUNTS }] = await Promise.all([
    import('./geometry-stage-workflows.ts'),
    import('../../engine/src/geom/intersect.ts'),
  ]);
  const zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
  return JSON.stringify(geometryStageWorkflows().map(row => {
    Object.assign(CLIP_COUNTS, zero);
    const result = row.run();
    return { id: row.id, result, counts: { ...CLIP_COUNTS } };
  }));
}
