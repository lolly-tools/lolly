// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { brandRuleDisposition, checkBrandPolicyDigests, checkBrandPolicyValues, parseBrandPolicyMappings, resolveBrandPolicy } from '../engine/src/brand-policy.ts';
import { productionDigest } from '../engine/src/production/contract.ts';
import type { BrandSystemV1 } from '@lolly-tools/core/brand-system-v1';
const doc = { color: { beacon: { $type: 'color', $value: '#ffcc00' } } };
const system: BrandSystemV1 = { schemaVersion: 1, id: 'sample', label: 'Sample', roles: [{ id: 'beacon', label: 'Beacon', resources: [{ type: 'token', path: 'color.beacon' }] }], bindings: [{ id: 'accent', roleId: 'beacon', consumer: { tool: 'brand-poster', slot: 'accent' } }], rules: [
  { id: 'colour', label: 'Beacon', kind: 'color-choices', roleIds: ['beacon'], parameters: { slot: 'accent' }, scope: { tools: ['brand-poster'], outputs: ['png'] }, requirement: 'required', origin: { kind: 'manual', author: 'Author' }, review: { state: 'approved', authority: 'Author' } },
  { id: 'heading', label: 'Short heading', kind: 'text-length', roleIds: [], parameters: { slot: 'heading', max: 10 }, requirement: 'required', origin: { kind: 'manual', author: 'Author' }, review: { state: 'approved', authority: 'Author' } },
] };
const mapping = parseBrandPolicyMappings([{ toolId: 'campaign', example: 'brand-poster', mode: 'Default', fields: { accent: 'ink', heading: 'title' } }])[0]!;
const results = () => resolveBrandPolicy(system, doc, 'campaign', 'png', mapping);
test('managed mappings preserve custom names and explicit scopes', () => {
  assert.equal(brandRuleDisposition(checkBrandPolicyValues(results(), mapping, { ink: '#ffcc00', title: 'Hello' })), 'checked');
  assert.equal(brandRuleDisposition(checkBrandPolicyValues(results(), mapping, { ink: '#ff0000', title: 'Hello' })), 'blocked');
  assert.equal(resolveBrandPolicy(system, doc, 'campaign', 'svg', mapping)[0]!.state, 'outside');
  assert.equal(resolveBrandPolicy(system, doc, 'other', 'png')[0]!.state, 'outside');
  assert.equal(resolveBrandPolicy(system, doc, 'other', 'png')[1]!.state, 'unknown');
  assert.throws(() => resolveBrandPolicy(system, doc, 'other', 'png', mapping));
});
test('actual exported input digests are required and hook changes cannot borrow request facts', async () => {
  const initial = { ink: '#ffcc00', title: 'Hello' };
  const observed = { ink: await productionDigest(initial.ink), title: await productionDigest(initial.title) };
  assert.equal(brandRuleDisposition(await checkBrandPolicyDigests(results(), mapping, initial, observed)), 'checked');
  assert.equal(brandRuleDisposition(await checkBrandPolicyDigests(results(), mapping, initial, {})), 'draft');
  assert.equal(brandRuleDisposition(await checkBrandPolicyDigests(results(), mapping, initial, { ...observed, ink: await productionDigest('#ff0000') })), 'blocked');
  assert.equal(brandRuleDisposition(await checkBrandPolicyDigests(results(), mapping, initial, { ...observed, title: await productionDigest('Changed') })), 'draft');
});
test('duplicate, unsafe, unknown and oversized mapping declarations are refused', () => {
  for (const raw of [[mapping, mapping], [{ ...mapping, toolId: '../escape' }], [{ ...mapping, extra: true }], [{ ...mapping, fields: { accent: 'same', heading: 'same' } }], [{ ...mapping, fields: { unknown: 'ink' } }], Array(129).fill(mapping)]) assert.throws(() => parseBrandPolicyMappings(raw));
});
