// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { presentInputs, inputFocus } from './input-presentation.ts';

test('conditional controls and options use engine OR/AND semantics without erasing hidden values', () => {
  const model = [
    { id: 'kind', value: 'wifi' },
    { id: 'url', value: 'keep this', showIf: { kind: 'url' } },
    { id: 'ssid', value: 'Guest', showIf: [{ kind: 'wifi' }, { kind: 'network' }] },
    {
      id: 'choice',
      value: 'saved',
      options: [
        { value: 'saved', showIf: { kind: 'url' } },
        { value: 'available', showIf: { kind: ['wifi', 'network'] } },
        { value: 'inactive', showIf: { kind: 'url' } },
      ],
    },
  ];
  const shown = presentInputs(model);
  assert.deepEqual(
    shown.map((input) => input.id),
    ['kind', 'ssid', 'choice']
  );
  assert.deepEqual(
    shown.at(-1)?.options?.map((option) => option.value),
    ['saved', 'available']
  );
  assert.equal(model[1]?.value, 'keep this');
  assert.equal(model.at(-1)?.options?.length, 3);
  assert.equal(inputFocus(shown, 'choice', 1), 2);
  assert.equal(inputFocus(shown, 'url', 8), 2);
  assert.equal(inputFocus([], 'url', 8), 0);
});
