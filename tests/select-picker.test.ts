// SPDX-License-Identifier: MPL-2.0
// The select display "picker" (engine 1.348.0): the manifest surface the web
// sidebar draws as one button and a panel of option tiles. The engine only
// carries the fields; these tests hold the schema bounds, the input model's
// pass-through and the translation key for a group heading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../engine/src/validate.ts';
import { validateTool } from '../packages/core/src/validate.ts';
import { buildInputModel } from '../engine/src/inputs.ts';
import { applyManifestI18n } from '../engine/src/loader.ts';
import type { ToolManifest } from '../engine/src/loader.ts';

const BAR = 'M5 20V11 M12 20V5 M19 20v-7';
const LINE = 'M4 17l5-6 4 3 7-8';

function manifestWith(options: unknown[], display = 'picker'): Record<string, unknown> {
  return {
    id: 'picker-demo',
    name: 'Picker demo',
    version: '1.0.0',
    engineVersion: '^1.348.0',
    status: 'community',
    render: { width: 100, height: 100, formats: ['svg'] },
    inputs: [{ id: 'kind', type: 'select', default: 'bar', display, options }],
  };
}

const validBoth = (m: unknown): [boolean, boolean] => [validateManifest(m).valid, validateTool(m).valid];

test('a picker select with glyphs and groups is valid in the engine and the SDK schema', () => {
  const m = manifestWith([
    { value: 'bar', label: 'Bar', glyph: BAR, group: 'Compare' },
    { value: 'line', label: 'Line', glyph: LINE, group: 'Change over time' },
    { value: 'plain', label: 'Plain' },
  ]);
  assert.deepEqual(validBoth(m), [true, true]);
});

test('glyph accepts path commands and numbers only, at most 900 characters', () => {
  for (const hostile of [
    '"><script>alert(1)</script>',
    'M0 0 L10 10" onload="x',
    'url(#a)',
    'M0 0 <path/>',
    'M0 0\nL1 1',
    '',
  ]) {
    assert.deepEqual(validBoth(manifestWith([{ value: 'bar', glyph: hostile }])), [false, false], hostile);
  }
  const long = `M0 0${' L1 1'.repeat(180)}`;
  assert.ok(long.length > 900);
  assert.deepEqual(validBoth(manifestWith([{ value: 'bar', glyph: long }])), [false, false]);
  assert.deepEqual(validBoth(manifestWith([{ value: 'bar', glyph: 'M1.5-2.25a3 3 0 1 0 6 0Z' }])), [true, true]);
});

test('group is a short non-empty heading', () => {
  assert.deepEqual(validBoth(manifestWith([{ value: 'bar', group: '' }])), [false, false]);
  assert.deepEqual(validBoth(manifestWith([{ value: 'bar', group: 'x'.repeat(61) }])), [false, false]);
});

test('an unknown select display is still refused', () => {
  assert.deepEqual(validBoth(manifestWith([{ value: 'bar' }], 'carousel')), [false, false]);
});

test('the input model carries display, glyph and group through unchanged', () => {
  const m = manifestWith([
    { value: 'bar', label: 'Bar', glyph: BAR, group: 'Compare' },
    { value: 'line', label: 'Line', group: 'Change over time' },
  ]);
  const [kind] = buildInputModel(m as never, { initial: { kind: 'line' } });
  assert.equal(kind!.control, 'select');
  assert.equal(kind!.display, 'picker');
  assert.equal(kind!.value, 'line');
  assert.deepEqual(kind!.options!.map((o) => [o.value, o.glyph, o.group]), [['bar', BAR, 'Compare'], ['line', undefined, 'Change over time']]);
});

test('a sidecar translates a group heading by the manifest heading, once', () => {
  const m = manifestWith([
    { value: 'bar', label: 'Bar', group: 'Compare' },
    { value: 'dot', label: 'Dot', group: 'Compare' },
    { value: 'line', label: 'Line', group: 'Change over time' },
    { value: 'plain', label: 'Plain' },
  ]) as unknown as ToolManifest;
  const overlay = { 'inputs.kind.groups.Compare': 'Vergleichen', 'inputs.kind.options.bar': 'Balken' };
  applyManifestI18n(m, overlay);
  applyManifestI18n(m, overlay);
  const opts = m.inputs[0]!.options!;
  assert.deepEqual(opts.map((o) => o.group), ['Vergleichen', 'Vergleichen', 'Change over time', undefined]);
  assert.equal(opts[0]!.label, 'Balken');
});

test('a translated heading is never matched by a second key', () => {
  const m = manifestWith([
    { value: 'a', group: 'One' },
    { value: 'b', group: 'Two' },
  ]) as unknown as ToolManifest;
  // "One" becomes "Two", then the key for the manifest's "Two" must move only b.
  applyManifestI18n(m, { 'inputs.kind.groups.One': 'Two', 'inputs.kind.groups.Two': 'Deux' });
  assert.deepEqual(m.inputs[0]!.options!.map((o) => o.group), ['Two', 'Deux']);
});

test('a group key for an unknown heading or input changes nothing', () => {
  const m = manifestWith([{ value: 'a', group: 'One' }]) as unknown as ToolManifest;
  applyManifestI18n(m, { 'inputs.kind.groups.Missing': 'X', 'inputs.nope.groups.One': 'Y' });
  assert.equal(m.inputs[0]!.options![0]!.group, 'One');
});
