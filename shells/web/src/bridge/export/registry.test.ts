// SPDX-License-Identifier: MPL-2.0
// Unit tests for the format-adapter registry (finding 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, UnknownExportFormatError } from './registry.ts';
import type { FormatAdapter } from './types.ts';

// A stub adapter that yields a labelled Blob so we can assert which one resolved.
function stub(formats: FormatAdapter['formats'], label: string): FormatAdapter {
  return { formats, render: async () => new Blob([label]) };
}

test('resolve returns the adapter registered for a format', () => {
  const reg = createRegistry();
  const raster = stub(['png', 'jpg', 'jpeg'], 'raster');
  reg.register(raster);
  assert.equal(reg.resolve('png'), raster);
  assert.equal(reg.resolve('jpg'), raster);
  assert.equal(reg.resolve('jpeg'), raster);
});

test('resolve routes each format to its own adapter', () => {
  const reg = createRegistry();
  const raster = stub(['png'], 'raster');
  const svg = stub(['svg'], 'svg');
  reg.register(raster);
  reg.register(svg);
  assert.equal(reg.resolve('png'), raster);
  assert.equal(reg.resolve('svg'), svg);
});

test('resolve throws a typed error matching the old switch default', () => {
  const reg = createRegistry();
  assert.throws(
    () => reg.resolve('nope'),
    (e: unknown) => e instanceof UnknownExportFormatError
      && e.format === 'nope'
      && e.message === 'Unsupported export format: nope',
  );
});

test('register rejects a duplicate format registration', () => {
  const reg = createRegistry();
  reg.register(stub(['png'], 'a'));
  assert.throws(() => reg.register(stub(['png'], 'b')), /Duplicate export adapter for format: png/);
});
