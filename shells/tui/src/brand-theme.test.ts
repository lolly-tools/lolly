// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenSet } from '../../../engine/src/tokens.ts';
import { contrastRatio } from '../../../engine/src/brand-derive.ts';
import { readableBrandAccent, readTerminalBrand } from './brand-theme.ts';
import { theme, setTerminalAppearance, setTerminalBrand, setBrandAccents } from './theme.ts';

test('brand accents retain their authored colour when readable and adjust for either backdrop', () => {
  assert.equal(readableBrandAccent('#30ba78', '#181818'), '#30ba78');
  for (const backdrop of ['#181818', '#ffffff']) {
    for (const value of ['#30ba78', '#002233', '#ffffee', '#b000db'])
      assert.ok(contrastRatio(readableBrandAccent(value, backdrop)!, backdrop) >= 4.5);
  }
  assert.equal(readableBrandAccent('not a colour', '#181818'), undefined);
});

test('document colourway reads are scoped and leave the default tokens unchanged', async () => {
  const doc = {
    day: { color: { semantic: { primary: { $type: 'color', $value: '#30ba78' } } } },
    night: { color: { semantic: { primary: { $type: 'color', $value: '#00d5e5' } } } },
    $themes: [
      { id: 'day', name: 'Day', group: 'colourway', selectedTokenSets: { day: 'enabled' } },
      { id: 'night', name: 'Night', group: 'colourway', selectedTokenSets: { night: 'enabled' } },
    ],
    $metadata: { activeThemeSelection: { colourway: 'day' } },
  };
  const host = {
    tokens: {
      get: async (options = {}) => createTokenSet(doc, options),
      snapshot: async () => ({
        document: doc,
        system: {
          id: 'fixture',
          label: 'Fixture brand',
          source: 'local' as const,
          active: true,
          locked: false,
          headId: null,
        },
        selection: {},
        version: null,
      }),
    },
  };
  const brand = await readTerminalBrand(host, { colourway: 'night' });
  assert.equal(brand?.primary, '#00d5e5');
  assert.deepEqual(brand?.choices, ['Night']);
  assert.equal(brand?.label, 'Fixture brand');
  assert.equal((await readTerminalBrand(host))?.primary, '#30ba78');
  assert.equal(await readTerminalBrand({}), null);
});

test('terminal brand preference and NO_COLOR affect chrome without changing brand tokens', () => {
  const previous = process.env.NO_COLOR;
  delete process.env.NO_COLOR;
  try {
    setTerminalAppearance('dark');
    setTerminalBrand('#00d5e5');
    setBrandAccents(true);
    assert.equal(theme.accentName, '#00d5e5');
    setBrandAccents(false);
    assert.equal(theme.accentName, 'green');
    process.env.NO_COLOR = '';
    setBrandAccents(true);
    assert.ok(Object.values(theme).every((value) => value === undefined));
  } finally {
    if (previous === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = previous;
    setTerminalBrand();
    setTerminalAppearance('terminal');
    setBrandAccents(true);
  }
});
