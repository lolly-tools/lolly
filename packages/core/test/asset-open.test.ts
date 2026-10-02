// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { assetOpenChoices, assetOpenErrors, type AssetOpenToolV1 } from '../src/asset-open-v1.ts';
import type { AssetRef } from '../src/host-v1.ts';
import { validateTool } from '../src/validate.ts';
import { readFileSync } from 'node:fs';
const photo = { id: 'photo', type: 'raster', format: 'png' } as AssetRef;
const audio = { id: 'audio', type: 'audio', format: 'wav' } as AssetRef;
const tools: AssetOpenToolV1[] = [
  { id: 'image', openWith: [{ id: 'photo', types: ['raster'], formats: ['png'], binding: { kind: 'input', input: 'source' } }] },
  { id: 'editor', openWith: [{ id: 'media', types: ['raster', 'audio'], multiple: true, binding: { kind: 'canvas' } }] },
  { id: 'legacy' },
];
test('opening matches the whole selection, format and declared cardinality', () => {
  assert.deepEqual(assetOpenChoices(tools, [photo]).map(c => c.tool.id), ['image', 'editor']);
  assert.deepEqual(assetOpenChoices(tools, [photo, photo]).map(c => c.tool.id), ['editor']);
  assert.deepEqual(assetOpenChoices(tools, [photo, audio]).map(c => c.tool.id), ['editor']);
  assert.deepEqual(assetOpenChoices(tools, [{ ...photo, format: 'tiff' }]).map(c => c.tool.id), ['editor']);
  assert.deepEqual(assetOpenChoices(tools, []), []);
  assert.deepEqual(assetOpenChoices(tools, [{ ...photo, meta: { animated: true } }]), []);
  tools[1]!.openWith![0]!.animated = true;
  assert.equal(assetOpenChoices(tools, [{ ...photo, meta: { animated: true } }]).length, 1);
  delete tools[1]!.openWith![0]!.animated;
});
test('invalid bindings and duplicate intents fail canonical validation', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../community/filter/tool.json', import.meta.url), 'utf8'));
  assert.equal(validateTool(manifest).valid, true);
  manifest.openWith[0].binding.input = 'missing';
  assert.equal(validateTool(manifest).valid, false);
  assert.match(assetOpenErrors(manifest)[0]!.message, /declared/);
  manifest.openWith.push(manifest.openWith[0]);
  assert.ok(assetOpenErrors(manifest).some(issue => /unique/.test(issue.message)));
  manifest.openWith[0].binding = { kind: 'execute', method: 'anything' };
  assert.equal(validateTool(manifest).valid, false);
});
test('multi-file opening must bind a multiple file input', () => {
  const intent = { id: 'files', types: ['raster'] as AssetRef['type'][], multiple: true, binding: { kind: 'input' as const, input: 'files' } };
  assert.equal(assetOpenErrors({ openWith: [intent], inputs: [{ id: 'files', type: 'file', multiple: true }] }).length, 0);
  assert.equal(assetOpenErrors({ openWith: [intent], inputs: [{ id: 'files', type: 'asset' }] }).length, 1);
});
