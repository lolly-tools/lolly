// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInputModel, modelToValues, updateInput, type InputValue } from '../engine/src/inputs.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

const manifest = {
  id: 'paint-values', name: 'Paint values', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
  render: { width: 10, height: 10, formats: ['svg'] },
  inputs: [
    { id: 'paint', type: 'color' as const, default: '#123456' },
    { id: 'rows', type: 'blocks' as const, default: [{ paint: '#abcdef', label: 'first' }], fields: [
      { id: 'paint', type: 'color' }, { id: 'label', type: 'text' },
    ] },
  ],
};

const invalid: InputValue[] = ['invalid " paint', 'rgb(nope)', 'url(paint.svg)', 'red;blue', ['#fff'], { paint: '#fff' }, 7];

test('colour initial values and updates keep their fallback for unsupported paint', () => {
  for (const value of invalid) {
    const initial = buildInputModel(manifest, { initial: { paint: value } });
    assert.equal(initial[0]!.value, '#123456');
    const model = buildInputModel(manifest);
    assert.equal(updateInput(model, 'paint', value)[0]!.value, '#123456');
  }
});

test('colour values retain supported CSS paint, empty and cleared values', () => {
  for (const value of [
    '#abc', '#abcd', '#123456', '#12345678', 'transparent', '', 'none', 'currentColor',
    'rebeccapurple', 'rgb(1 2 3 / 50%)', 'rgba(1, 2, 3, 0.5)', 'hsl(150deg 50% 50%)',
    'oklch(62% 0.11 250)', 'color(display-p3 1 0 0)', 'var(--brand-surface, #fff)', null,
  ]) {
    const model = buildInputModel(manifest, { initial: { paint: value } });
    assert.equal(model[0]!.value, value);
    assert.equal(updateInput(buildInputModel(manifest), 'paint', value)[0]!.value, value);
  }
  assert.equal(buildInputModel(manifest, { initial: { paint: 'abc' } })[0]!.value, '#abc');
});

test('colour token caches are checked before hooks consume a saved value', () => {
  for (const cached of invalid) {
    const model = buildInputModel(manifest, { initial: { paint: { ref: '{color.gone}', value: cached } } });
    assert.deepEqual(model[0]!.value, { ref: '{color.gone}', value: undefined });
    assert.equal(modelToValues(model).paint, '');
  }
  const model = buildInputModel(manifest, { initial: { paint: { ref: '{color.gone}', value: '#aabbcc' } } });
  assert.equal(modelToValues(model).paint, '#aabbcc');
  assert.equal(modelToValues(buildInputModel(manifest, { initial: { paint: '{color.gone}' } })).paint, '');
});

test('block colours keep prior paint while other row fields remain editable', () => {
  const model = buildInputModel(manifest);
  for (const paint of invalid) {
    const rows = [{ paint, label: 'changed' }, { paint, label: 'new' }];
    assert.deepEqual(updateInput(model, 'rows', rows)[1]!.value, [
      { paint: '#abcdef', label: 'changed' }, { paint: '', label: 'new' },
    ]);
    assert.deepEqual(buildInputModel(manifest, { initial: { rows } })[1]!.value, [
      { paint: '#abcdef', label: 'changed' }, { paint: '', label: 'new' },
    ]);
  }
  const rows = [{ paint: '#abcdef', label: 'changed' }];
  assert.equal(updateInput(model, 'rows', rows)[1]!.value, rows);
});

test('URL and runtime batch writes validate colours before lifecycle hooks', async () => {
  const query = new URLSearchParams({ paint: 'invalid " paint', rows: JSON.stringify([{ paint: 'rgb(nope)', label: 'saved' }]) });
  const { values } = parseUrlState(query.toString(), manifest);
  const tool = {
    manifest: { ...manifest, hooks: { onInit: true, onInput: true } },
    template: '{{seen}}', hooksSource: 'function onInit({ model }) { return { seen: model.find(i => i.id === "paint").value }; } function onInput({ model }) { return onInit({ model }); }',
  };
  const runtime = await createRuntime(tool as never, baseHost(), values);
  assert.equal(runtime.getHydrated(), '#123456');
  assert.deepEqual(runtime.getModel().find(i => i.id === 'rows')!.value, [{ paint: '#abcdef', label: 'saved' }]);
  await runtime.applyPatch({ paint: 'invalid " paint' });
  assert.equal(runtime.getHydrated(), '#123456');
  await runtime.setInput('paint', '#778899');
  assert.equal(runtime.getHydrated(), '#778899');
});

test('block colour references keep their identity and validate cached paint', () => {
  const reference = { ref: '{color.primary}', value: '#123456' };
  const rows = [{ paint: reference, label: 'linked' }];
  const model = buildInputModel(manifest, { initial: { rows } });
  assert.equal((model[1]!.value as typeof rows)[0]!.paint, reference);
  for (const value of invalid) {
    const changed = updateInput(model, 'rows', [{ paint: { ...reference, value }, label: 'changed' }]);
    assert.deepEqual(changed[1]!.value, [{ paint: { ref: reference.ref, value: undefined }, label: 'changed' }]);
  }
});
