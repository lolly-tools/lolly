// SPDX-License-Identifier: MPL-2.0
/**
 * One float64 answer on every JavaScript engine for the geometry's scalar maths.
 *
 * `Math.hypot`, `Math.sin` and the other transcendental functions are not required
 * to be correctly rounded, and V8, SpiderMonkey and JavaScriptCore round them
 * differently in the last bit. Geometry built on them gave different control points
 * and work counts in the CLI and in Safari or Firefox (plan 295, G2i). This module
 * replaces them for the geometry:
 *
 * - `hypot` is V8's two-argument algorithm (scale by the larger magnitude, sum the
 *   squares, square root, rescale) written in operations every engine rounds
 *   exactly, so Node and Chromium keep their existing bits.
 * - the transcendental functions and `pow` run in one embedded, import-free WebAssembly
 *   module built with pinned Rust (`packages/node-shell/wasm/portable-math`). The
 *   portable fitting artifact links the same compiled functions, so the TypeScript
 *   reference and the WASM kernels compute the same bits.
 *
 * The module is compiled synchronously on first use; it is about 16 KB.
 */
import { PORTABLE_MATH_WASM } from './portable-math-wasm.ts';

/** `Math.hypot(x, y)` as V8 computes it, in exactly rounded operations. */
export function hypot(x: number, y: number): number {
  const a = Math.abs(x), b = Math.abs(y);
  if (a === Infinity || b === Infinity) return Infinity;
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  const m = a > b ? a : b;
  if (m === 0) return 0;
  const p = a / m, q = b / m;
  return Math.sqrt(p * p + q * q) * m;
}

interface ScalarExports {
  math_sin(x: number): number;
  math_cos(x: number): number;
  math_tan(x: number): number;
  math_acos(x: number): number;
  math_cbrt(x: number): number;
  math_log2(x: number): number;
  math_atan2(y: number, x: number): number;
  math_pow(x: number, y: number): number;
}
const NAMES = ['math_sin', 'math_cos', 'math_tan', 'math_acos', 'math_cbrt', 'math_log2', 'math_atan2', 'math_pow'] as const;

let scalar: ScalarExports | undefined;
function scalarMath(): ScalarExports {
  if (!scalar) scalar = load();
  return scalar;
}
function load(): ScalarExports {
  const binary = atob(PORTABLE_MATH_WASM);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const module = new WebAssembly.Module(bytes);
  if (WebAssembly.Module.imports(module).length) throw new Error('geom: the portable maths module must not import host functions.');
  const exports = new WebAssembly.Instance(module, {}).exports as unknown as ScalarExports;
  for (const name of NAMES) if (typeof exports[name] !== 'function') throw new Error(`geom: the portable maths module lacks ${name}.`);
  return exports;
}

export function sin(x: number): number { return scalarMath().math_sin(x); }
export function cos(x: number): number { return scalarMath().math_cos(x); }
export function tan(x: number): number { return scalarMath().math_tan(x); }
export function acos(x: number): number { return scalarMath().math_acos(x); }
export function cbrt(x: number): number { return scalarMath().math_cbrt(x); }
export function log2(x: number): number { return scalarMath().math_log2(x); }
/** Arguments in the `Math.atan2(y, x)` order. */
export function atan2(y: number, x: number): number { return scalarMath().math_atan2(y, x); }
/** `x ** y` for a non-integer exponent; write squares as a multiply instead. */
export function pow(x: number, y: number): number { return scalarMath().math_pow(x, y); }
