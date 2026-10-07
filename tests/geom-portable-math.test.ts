// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as pmath from '../engine/src/geom/portable-math.ts';
import { PORTABLE_MATH_SHA256, PORTABLE_MATH_WASM } from '../engine/src/geom/portable-math-wasm.ts';
import { GEOMETRY_WORKFLOWS_SHA256, PORTABLE_MATH_RESULTS_SHA256, geometryRevisionRecord, portableMathResults } from './helpers/portable-math-cases.ts';

const same = (a: number, b: number) => Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b));

test('the embedded module is the committed import-free portable maths build', async () => {
  const file = await readFile(new URL('../packages/node-shell/wasm/portable-math/portable-math.wasm', import.meta.url));
  assert.deepEqual(Buffer.from(PORTABLE_MATH_WASM, 'base64'), file);
  assert.equal(createHash('sha256').update(file).digest('hex'), PORTABLE_MATH_SHA256);
  assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(file)), []);
});

test('portable hypot keeps V8 bits, including scaled, subnormal and non-finite inputs', () => {
  const bits = new Float64Array(2), words = new Uint32Array(bits.buffer);
  let seed = 7;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 200_000; i++) {
    for (let w = 0; w < 4; w++) words[w] = (next() * 4294967296) >>> 0;
    const [x, y] = i % 3 ? [(next() * 2 - 1) * 1000, (next() * 2 - 1) * 1000] : [bits[0]!, bits[1]!];
    assert.ok(same(pmath.hypot(x, y), Math.hypot(x, y)), `${x}, ${y}`);
  }
  for (const [x, y] of [[Infinity, NaN], [NaN, -Infinity], [NaN, 1], [0, -0], [5e-324, 5e-324], [Number.MAX_VALUE, Number.MAX_VALUE]] as const)
    assert.ok(same(pmath.hypot(x, y), Math.hypot(x, y)), `${x}, ${y}`);
});

test('TypeScript geometry and the portable fitting artifact run the same compiled scalar maths', async () => {
  const fitter = (await WebAssembly.instantiate(await readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-fit-portable.wasm', import.meta.url)), {})).instance.exports as Record<string, (...args: number[]) => number>;
  let seed = 11;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 100_000; i++) {
    const x = (next() * 2 - 1) * (i % 2 ? 50 : 1e6), y = (next() * 2 - 1) * 400, unit = next() * 2 - 1;
    assert.ok(same(pmath.sin(x), fitter.geom_math_sin!(x)));
    assert.ok(same(pmath.cos(x), fitter.geom_math_cos!(x)));
    assert.ok(same(pmath.cbrt(x), fitter.geom_math_cbrt!(x)));
    assert.ok(same(pmath.acos(unit), fitter.geom_math_acos!(unit)));
    assert.ok(same(pmath.atan2(y, x), fitter.geom_math_atan2!(y, x)));
  }
});

test('the seeded scalar set has the pinned digest', () => {
  const results = portableMathResults(pmath);
  assert.equal(results.length, 37_833);
  assert.equal(createHash('sha256').update(new Uint8Array(results.buffer)).digest('hex'), PORTABLE_MATH_RESULTS_SHA256);
});

test('the complete geometry workflows have the pinned revision digest', async () => {
  // Offsets, strokes, booleans, fitting pieces and curve pairs with their work counters.
  // A change here is a geometry revision: update GEOMETRY_REVISION and this digest together.
  assert.equal(createHash('sha256').update(await geometryRevisionRecord()).digest('hex'), GEOMETRY_WORKFLOWS_SHA256);
});
