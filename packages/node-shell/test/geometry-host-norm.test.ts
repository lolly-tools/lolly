// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createGeometryClipping } from '../src/geometry-clipping.ts';
import { createGeometryFitting } from '../src/geometry-fitting.ts';
import { createGeometryHost } from '../src/geometry-host.ts';

test('host norm artifacts require explicit import selection and matching fitting and clipping maths', async () => {
  const [clip, fit, oldClip, oldFit] = await Promise.all(['clip-host-norm', 'fit-host-norm', 'clip', 'fit'].map(name => readFile(new URL(`../wasm/geometry-kernel/geometry-${name}.wasm`, import.meta.url))));
  await assert.rejects(() => createGeometryClipping(clip!), { code: 'internal' });
  await assert.rejects(() => createGeometryFitting(fit!), { code: 'internal' });
  await assert.rejects(() => createGeometryClipping(oldClip!, 'host-norm'), { code: 'internal' });
  await assert.rejects(() => createGeometryFitting(oldFit!, 'host-norm'), { code: 'internal' });
  await assert.rejects(() => createGeometryFitting(fit!, 'portable'), { code: 'internal' });
  const clipping = await createGeometryClipping(clip!, 'host-norm'), fitting = await createGeometryFitting(fit!, 'host-norm');
  const retainedFitting = await createGeometryFitting(oldFit!), retainedClipping = await createGeometryClipping(oldClip!);
  assert.throws(() => createGeometryHost({ clipping, fitting: retainedFitting }), /requires host maths/);
  assert.throws(() => createGeometryHost({ clipping: retainedClipping, fitting }), /requires host maths/);
  assert.equal(createGeometryHost({ clipping, fitting }).backend, 'wasm-host-norm-fitting');
  for (const kernel of [clipping, fitting]) { assert.equal(kernel.stats().results, 0); assert.equal(kernel.stats().bufferBytes, 0); }
});
