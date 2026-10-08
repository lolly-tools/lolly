// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createPsdKernel, type PsdKernel } from '../packages/node-shell/src/adobe-psd.ts';
import { loadPsdKernel, readPsdPortable } from '../packages/node-shell/src/adobe-psd-node.ts';

function source(mode: number, depth: number, values: number[]): Uint8Array {
  const bytes = new Uint8Array(40 + values.length * depth / 8), v = new DataView(bytes.buffer);
  bytes.set([56, 66, 80, 83]); v.setUint16(4, 1); v.setUint16(12, values.length);
  v.setUint32(14, 1); v.setUint32(18, 1); v.setUint16(22, depth); v.setUint16(24, mode);
  values.forEach((value, i) => { const at = 40 + i * depth / 8; if (depth === 32) v.setFloat32(at, value); else if (depth === 16) v.setUint16(at, value); else bytes[at] = value; });
  return bytes;
}
test('portable reader admits 32-bit linear RGB with an explicit clipped preview', async () => {
  const bytes = source(3, 32, [0.5, 0, 2]);
  const doc = await readPsdPortable(bytes);
  assert.equal(doc.depth, 32); assert.equal(doc.colorMode, 'rgb');
  assert.deepEqual([...doc.composite!.pixels], [188, 0, 255, 255]);
  assert.ok(doc.warnings.includes('psd.hdr-preview'));
  assert.deepEqual([...(await readPsdPortable(source(1, 32, [0.5]))).composite!.pixels], [188, 188, 188, 255]);
  assert.deepEqual((await loadPsdKernel()).roundTrip(bytes), bytes);
});
test('Lab conversion produces a neutral preview and keeps the original bytes', async () => {
  const bytes = source(9, 8, [128, 128, 128]), kernel = await loadPsdKernel();
  const doc = kernel.read(bytes); const p = doc.composite!.pixels;
  assert.equal(doc.colorMode, 'lab'); assert.ok(p[0]! > 115 && p[0]! < 125);
  assert.ok(Math.abs(p[0]! - p[1]!) <= 1); assert.ok(Math.abs(p[0]! - p[2]!) <= 1);
  assert.equal(kernel.inspect(bytes).mode, 9); assert.deepEqual(kernel.roundTrip(bytes), bytes);
});
test('bounds refusals leave the shared instance usable and browser mapping matches Node', async () => {
  const kernel = await loadPsdKernel(), bytes = source(3, 16, [65535, 0, 0]);
  assert.throws(() => kernel.read(bytes, { maxDecodedBytes: 1 }), /budget/);
  assert.throws(() => kernel.read(bytes.subarray(0, 12)), /header|end|truncat|EOF/i);
  assert.throws(() => kernel.read(bytes, { maxDecodedBytes: Infinity }), /budget/);
  const browser = await createPsdKernel(new Uint8Array(readFileSync(new URL('../packages/node-shell/wasm/adobe-psd/adobe-psd.wasm', import.meta.url))));
  assert.deepEqual(browser.read(bytes), kernel.read(bytes));
  for (let i = 0; i < 30; i++) assert.deepEqual(kernel.roundTrip(bytes), bytes);
});

test('bundled PSD loader works with both adjacent CLI assets and traced serverless assets', async () => {
  const base = resolve('plans/artifacts'); await mkdir(base, { recursive: true });
  const scratch = await mkdtemp(join(base, 'adobe-loader-'));
  try {
    await writeFile(join(scratch, 'profiles.json'), '{}');
    const paths = ['wasm/adobe-psd', 'packages/node-shell/wasm/adobe-psd'];
    for (const path of paths) {
      await mkdir(join(scratch, path), { recursive: true });
      await copyFile(new URL('../packages/node-shell/wasm/adobe-psd/adobe-psd.wasm', import.meta.url), join(scratch, path, 'adobe-psd.wasm'));
    }
    for (const path of ['dist/cli.mjs', 'api/mcp/function.mjs']) {
      const outfile = join(scratch, path);
      await build({ entryPoints: [new URL('../packages/node-shell/src/adobe-psd-node.ts', import.meta.url).pathname], outfile,
        bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' });
      const { loadPsdKernel } = await import(pathToFileURL(outfile).href) as { loadPsdKernel(): Promise<PsdKernel> };
      const kernel = await loadPsdKernel(), bytes = source(3, 32, [0.5, 0, 2]);
      assert.deepEqual([...kernel.read(bytes).composite!.pixels], [188, 0, 255, 255]);
      assert.deepEqual(kernel.roundTrip(bytes), bytes);
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
