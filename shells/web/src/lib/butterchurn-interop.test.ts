// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the butterchurn module-shape resolution.
 *
 * The package is a webpack UMD bundle whose `module.exports` is already
 * `{ default: { createVisualizer } }`. How many `default` hops sit on top of that
 * then depends on the toolchain's ES-module interop - Node's `require` presents one,
 * Vite's esbuild pre-bundle presents two. Hard-coding a depth works in one
 * environment and throws `mod.createVisualizer is not a function` in the other, and
 * since the visualizer is lazily imported the failure only appears when a user opens
 * it. So the resolver walks, and this test covers every shape it might be handed - 
 * including the REAL installed package, so an upgrade that changes the wrapping is
 * caught here rather than in the browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveButterchurn } from './butterchurn-viz.ts';

const createVisualizer = (): void => { /* stand-in */ };

test('resolves an already-flat namespace', () => {
  const mod = { createVisualizer };
  assert.equal(resolveButterchurn(mod).createVisualizer, createVisualizer);
});

test('resolves one level of default (Node require interop)', () => {
  const mod = { default: { createVisualizer } };
  assert.equal(resolveButterchurn(mod).createVisualizer, createVisualizer);
});

test('resolves two levels of default (Vite/esbuild pre-bundle)', () => {
  // The shape that actually broke: esbuild's default wrapping the UMD bundle's own.
  const mod = { default: { default: { createVisualizer } } };
  assert.equal(resolveButterchurn(mod).createVisualizer, createVisualizer);
});

test('prefers the shallowest object that actually has createVisualizer', () => {
  const inner = (): void => { /* deeper, should NOT win */ };
  const mod = { createVisualizer, default: { default: { createVisualizer: inner } } };
  assert.equal(resolveButterchurn(mod).createVisualizer, createVisualizer);
});

test('throws a legible error rather than returning something unusable', () => {
  for (const bad of [null, undefined, {}, { default: {} }, { default: { nope: 1 } }, 42, 'butterchurn']) {
    assert.throws(() => resolveButterchurn(bad), /no createVisualizer/, JSON.stringify(bad) ?? 'undefined');
  }
});

test('a self-referential default terminates instead of spinning', () => {
  const mod: Record<string, unknown> = {};
  mod.default = mod;
  assert.throws(() => resolveButterchurn(mod), /no createVisualizer/);
});

test('the REAL installed butterchurn resolves', async () => {
  // Guards against an upgrade quietly changing the export wrapping. The UMD touches
  // `window` at module scope, so stub the globals it reads before importing.
  const g = globalThis as Record<string, unknown>;
  const hadWindow = 'window' in g;
  const hadDocument = 'document' in g;
  if (!hadWindow) g.window = { devicePixelRatio: 1 };
  if (!hadDocument) g.document = { createElement: () => ({ getContext: () => null }) };
  try {
    const mod = await import('butterchurn');
    assert.equal(typeof resolveButterchurn(mod).createVisualizer, 'function');
  } finally {
    if (!hadWindow) delete g.window;
    if (!hadDocument) delete g.document;
  }
});
