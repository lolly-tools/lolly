// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TokenEntry } from '../../../../engine/src/bridge/host-v1.ts';
import { buildInputModel } from '../../../../engine/src/inputs.ts';
import type { InputManifest } from '../../../../engine/src/inputs.ts';
import { countBulkLink, customValuesOf, planBulkTokenLink, sharedTokenState, storedRestoreRef, writeStoredInput, type BulkLinkTarget } from './token-bulk-link.ts';

const gap = (value: number): TokenEntry => ({ path: 'space.gap', type: 'number', value } as TokenEntry);
const consumer = { type: 'number', min: 0, max: 100 };
const target = (key: string, over: Partial<BulkLinkTarget> = {}): BulkLinkTarget => ({ key, label: key.toUpperCase(), value: 12, consumer, entry: gap(36), ...over });

test('a bulk link selects plain values and keeps overrides, other links and unsupported targets', () => {
  const plan = planBulkTokenLink('{space.gap}', [
    target('plain'),
    target('override', { value: 20, restoreRef: '{space.gap}' }),
    target('other', { value: { ref: '{space.pad}', value: 8 } }),
    target('same', { value: { ref: '{space.gap}', value: 36 } }),
    target('range', { entry: gap(400) }),
    target('locked', { readOnly: true }),
    target('colour', { consumer: { type: 'color' } }),
  ]);
  assert.equal(plan.path, 'space.gap');
  const byKey = Object.fromEntries(plan.items.map(item => [item.key, item]));
  assert.deepEqual(
    plan.items.map(item => [item.key, item.status, item.include, item.optional]),
    [
      ['plain', 'change', true, true],
      ['override', 'override', false, true],
      ['other', 'other-link', false, true],
      ['same', 'linked', false, false],
      ['range', 'incompatible', false, false],
      ['locked', 'read-only', false, false],
      ['colour', 'incompatible', false, false],
    ],
  );
  assert.deepEqual(byKey.plain!.value, { ref: '{space.gap}', value: 36 });
  assert.equal(byKey.plain!.before, '12');
  assert.equal(byKey.plain!.after, '36');
  assert.equal(byKey.override!.previous, 'space.gap');
  assert.equal(byKey.other!.previous, 'space.pad');
  assert.equal(byKey.range!.reason, 'The resolved value is outside this field range.');
  assert.equal(byKey.range!.value, undefined, 'an unsupported target has nothing to write');
});

test('Restore link selects the overrides that replaced the same token, and only those', () => {
  const plan = planBulkTokenLink('{space.gap}', [
    target('same', { value: 20, restoreRef: '{space.gap}' }),
    target('elsewhere', { value: 20, restoreRef: '{space.pad}' }),
  ], { restore: true });
  assert.deepEqual(plan.items.map(item => [item.key, item.status, item.include]), [['same', 'override', true], ['elsewhere', 'override', false]]);
});

test('each target resolves the token in its own theme choices and against its own declaration', () => {
  const plan = planBulkTokenLink('{tone}', [
    target('day', { consumer: { type: 'select', options: [{ value: 'light' }, { value: 'dark' }] }, entry: { path: 'tone', type: 'string', value: 'light' } as TokenEntry }),
    target('night', { consumer: { type: 'select', options: [{ value: 'light' }, { value: 'dark' }] }, entry: { path: 'tone', type: 'string', value: 'dark' } as TokenEntry }),
    target('narrow', { consumer: { type: 'select', options: [{ value: 'light' }] }, entry: { path: 'tone', type: 'string', value: 'dark' } as TokenEntry }),
    target('missing', { entry: undefined }),
  ]);
  assert.deepEqual(plan.items.map(item => [item.key, item.status, item.after]), [
    ['day', 'change', 'light'], ['night', 'change', 'dark'], ['narrow', 'incompatible', undefined], ['missing', 'incompatible', undefined],
  ]);
  assert.equal(plan.items[2]!.reason, 'This token is not one of the allowed choices.');
});

test('counts follow the reviewer selection, not the default one', () => {
  const plan = planBulkTokenLink('{space.gap}', [target('a'), target('b', { value: 3, restoreRef: '{space.gap}' }), target('c', { readOnly: true })]);
  assert.equal(countBulkLink(plan.items, new Set(['a'])).selected, 1);
  const counts = countBulkLink(plan.items, new Set(['a', 'b', 'c']));
  assert.equal(counts.selected, 2, 'a read-only item never counts as selected');
  assert.deepEqual([counts.change, counts.override, counts['read-only']], [1, 1, 1]);
});

test('the shared field shows a common link, mixed states and a common Restore reference', () => {
  assert.deepEqual(sharedTokenState([{ value: { ref: '{a}', value: 1 } }, { value: { ref: '{a}', value: 2 } }]), { value: { ref: '{a}', value: 1 }, mixed: false });
  const mixed = sharedTokenState([{ value: 4 }, { value: { ref: '{a}', value: 2 } }]);
  assert.equal(mixed.mixed, true);
  assert.deepEqual(mixed.value, { ref: '{a}', value: 2 }, 'a mixed field carries a link so Make custom stays available');
  assert.deepEqual(sharedTokenState([{ value: 4, restoreRef: '{a}' }, { value: 5, restoreRef: '{a}' }]), { value: 4, mixed: false, restoreRef: '{a}' });
  assert.equal(sharedTokenState([{ value: 4, restoreRef: '{a}' }, { value: 5 }]).restoreRef, undefined);
  assert.equal(sharedTokenState([{ value: 4, restoreRef: '{a}' }, { value: 5, restoreRef: '{b}' }]).restoreRef, undefined);
});

test('Make custom keeps each linked target at its own value', () => {
  const custom = customValuesOf([{ key: 'a', value: { ref: '{gap}', value: 10 } }, { key: 'b', value: 7 }, { key: 'c', value: { ref: '{gap}', value: 30 } }]);
  assert.deepEqual(custom.map(({ target, value, ref }) => [target.key, value, ref]), [['a', 10, '{gap}'], ['c', 30, '{gap}']]);
});

test('stored writes follow the engine restore rule, and the engine reads them back', () => {
  const values: Record<string, unknown> = { gap: { ref: '{space.gap}', value: 36 } };
  writeStoredInput(values, 'gap', 20);
  assert.deepEqual(values, { gap: 20, __tokenLinks: { gap: '{space.gap}' } });
  assert.equal(storedRestoreRef(values, 'gap'), '{space.gap}');
  writeStoredInput(values, 'gap', 24);
  assert.equal(storedRestoreRef(values, 'gap'), '{space.gap}', 'a value over a value keeps the recorded link');
  const manifest = { inputs: [{ id: 'gap', type: 'number', default: 0 }] } as unknown as InputManifest;
  assert.equal(buildInputModel(manifest, { initial: values as never })[0]!.restoreTokenRef, '{space.gap}');
  writeStoredInput(values, 'gap', { ref: '{space.gap}', value: 36 });
  assert.deepEqual(values, { gap: { ref: '{space.gap}', value: 36 } }, 'a link clears its record');
  writeStoredInput(values, 'gap', undefined);
  assert.deepEqual(values, { __tokenLinks: { gap: '{space.gap}' } }, 'clearing a linked cell keeps the link for Restore');
  assert.equal(storedRestoreRef({ gap: { ref: '{x}' }, __tokenLinks: { gap: '{y}' } }, 'gap'), undefined, 'a linked value has no restore reference');
});
