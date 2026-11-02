// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAffinityKernel } from '@lolly-tools/node-shell/affinity';
import { importAffinity, isAffinity } from './affinity-import.ts';
import type { AffinityRead } from '../bridge/affinity-protocol.ts';

const corpus = (name: string) => fileURLToPath(new URL(`../../../../plans/corpora/affinity/${name}`, import.meta.url));
const wasm = new Uint8Array(readFileSync(new URL('../../../../packages/node-shell/wasm/affinity/affinity.wasm', import.meta.url)));
const have = existsSync(corpus('patchy-artboards.af'));

test('an Affinity file is recognised by its signature or its name', () => {
  assert.equal(isAffinity(new Uint8Array([0, 0xff, 0x4b, 0x41, ...new Array(20).fill(0)])), true);
  assert.equal(isAffinity(new Uint8Array(4), 'Logo.AFDESIGN'), true);
  assert.equal(isAffinity(new Uint8Array(4), 'logo.svg'), false);
});

test('bytes that are not an Affinity container are refused in plain words', async () => {
  await assert.rejects(importAffinity(new Uint8Array(64), new File([], 'x.af'), { warn: () => {} }), /isn’t an Affinity document/);
});

test('artboards open as editable frames and the report reaches the warnings', { skip: have ? false : 'corpus fixtures not fetched: run `node scripts/affinity-corpus.ts fetch` first' }, async () => {
  const kernel = await createAffinityKernel(wasm);
  const bytes = new Uint8Array(readFileSync(corpus('patchy-artboards.af')));
  const read = async (b: Uint8Array, name: string): Promise<AffinityRead> => ({ inspection: kernel.inspect(b, name), ...kernel.model(b) });
  const warnings: string[] = [];
  const result = await importAffinity(bytes, new File([], 'patchy-artboards.af'), { warn: m => warnings.push(m), read });
  assert.equal(result.mode, 'layers'); assert.equal(result.frames.length, 2);
  assert.ok(warnings.some(w => /editable/.test(w)));
});

test('with no layers and no storage to place the preview, the failure is plain and names the way out', { skip: have ? false : 'corpus fixtures not fetched: run `node scripts/affinity-corpus.ts fetch` first' }, async () => {
  const kernel = await createAffinityKernel(wasm);
  const bytes = new Uint8Array(readFileSync(corpus('patchy-artboards.af')));
  const read = async (b: Uint8Array, name: string): Promise<AffinityRead> => ({ inspection: kernel.inspect(b, name), modelError: 'damaged Affinity file: test' });
  await assert.rejects(importAffinity(bytes, new File([], 'a.af'), { warn: () => {}, read }), /could not be opened as layers.*Export SVG or PDF/);
});
