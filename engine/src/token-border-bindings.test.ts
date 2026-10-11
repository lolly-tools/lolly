// SPDX-License-Identifier: MPL-2.0
/** Border links preserve a usable stroke and its portable dash overrides. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTokenSet } from './tokens.ts';
import { resolveTokenBinding } from './token-binding.ts';
import { readBlockTokenBindings, reconcileBlockTokenBindings, resolveBlockTokenBindings, withBlockTokenBinding } from './token-block-bindings.ts';
import { buildInputModel, type BlockFieldSpec, type InputValue } from './inputs.ts';
import type { ToolManifest } from './loader.ts';
import type { TokenAdapter } from './token-consumer-adapters.ts';
import { parseUrlState, serializeUrlState } from './url-mode.ts';

const border = { color: '#12345680', width: { value: 3, unit: 'pt' }, style: 'dashed' };
const tokens = (value: unknown = border) => createTokenSet({ outline: { $type: 'border', $value: value } });
const fields: BlockFieldSpec[] = [{ id: 'id', type: 'text' }, { id: 'stroke', type: 'color' }, { id: 'strokeW', type: 'number', min: 0, max: 400 }, { id: 'strokeDash', type: 'select', options: [{ value: '' }, { value: 'dashed' }, { value: 'dotted' }] }, { id: 'strokeDashArray', type: 'text' }, { id: 'strokeDashLen', type: 'number' }, { id: 'strokeGapLen', type: 'number' }, { id: 'links', type: 'text' }];
const targets: Array<[string, TokenAdapter]> = [['stroke', 'border.color'], ['strokeW', 'border.width'], ['strokeDash', 'border.style'], ['strokeDashArray', 'border.dashArray'], ['strokeDashLen', 'border.dashLength'], ['strokeGapLen', 'border.gapLength']];
function linked(row: Record<string, InputValue | undefined> = { id: 'a' }, value: unknown = border) {
  for (const [id, adapter] of targets) {
    const field = fields.find(field => field.id === id)!;
    const result = resolveTokenBinding(tokens(value).get('outline'), { ...field, type: field.type!, adapter });
    assert.equal(result.status, 'linked');
    row = withBlockTokenBinding(row, 'links', id, { ref: '{outline}', value: result.value }, adapter);
  }
  return row;
}
test('border adapters use absolute widths and the existing solid, dashed and dotted wire values', () => {
  assert.equal(resolveTokenBinding(tokens().get('outline'), { type: 'number', adapter: 'border.width' }).value, 4);
  assert.equal(resolveTokenBinding(tokens().get('outline'), { type: 'color', adapter: 'border.color' }).value, '#12345680');
  for (const [authored, wire] of [['solid', ''], ['dashed', 'dashed'], ['dotted', 'dotted']]) {
    const entry = tokens({ ...border, style: authored }).get('outline');
    assert.equal(resolveTokenBinding(entry, { type: 'text', adapter: 'border' }).status, 'linked');
    assert.equal(resolveTokenBinding(entry, { type: 'select', adapter: 'border.style', options: fields[3]!.options }).value, wire);
  }
  for (const value of [{ ...border, width: { value: 2, unit: 'rem' } }, { ...border, width: { value: -1, unit: 'px' } }, { ...border, style: 'double' }, { ...border, style: { dashArray: [{ value: 2, unit: 'px' }], lineCap: 'round' } }, { width: border.width, style: 'solid' }, { color: border.color, style: 'solid' }, [border]]) {
    assert.notEqual(resolveTokenBinding(tokens(value).get('outline'), { type: 'text', adapter: 'border' }).status, 'linked');
  }
});
test('border refresh is atomic on an invalid source and resumes when representable', () => {
  const row = linked({ id: 'a', strokeDashArray: '7 3', strokeDashLen: 7, strokeGapLen: 3 });
  assert.deepEqual([row.strokeDashArray, row.strokeDashLen, row.strokeGapLen], ['', 0, 0]);
  for (const value of [{ ...border, color: '#abcdef', width: { value: 401, unit: 'px' } }, { ...border, color: '#abcdef', width: { value: 2, unit: 'rem' } }, { ...border, color: '#abcdef', style: 'double' }]) {
    const held = resolveBlockTokenBindings([row], 'links', fields, tokens(value))[0]!;
    for (const [id] of targets) assert.equal(held[id], row[id]);
    assert.ok(Object.values(readBlockTokenBindings(held.links)).every(link => link.status === 'incompatible' && link.reason));
  }
  const missing = resolveBlockTokenBindings([row], 'links', fields, undefined)[0]!;
  assert.ok(Object.values(readBlockTokenBindings(missing.links)).every(link => link.status === 'unresolved'));
  const next = resolveBlockTokenBindings([missing], 'links', fields, tokens({ color: '#abcdef', width: { value: 6, unit: 'px' }, style: 'solid' }))[0]!;
  assert.deepEqual([next.stroke, next.strokeW, next.strokeDash], ['#abcdef', 6, '']);
  assert.equal(resolveBlockTokenBindings([next], 'links', fields, tokens({ color: '#abcdef', width: { value: 6, unit: 'px' }, style: 'solid' }))[0], next);
});
test('local dash edits detach the whole style consumer while other border properties refresh', () => {
  for (const patch of [{ strokeDashArray: '7 3' }, { strokeDashLen: 7 }, { strokeGapLen: 3 }, { strokeDash: 'dotted' }]) {
    const row = { ...linked(), ...patch };
    const next = resolveBlockTokenBindings([row], 'links', fields, tokens({ ...border, color: '#abcdef', width: { value: 8, unit: 'px' }, style: 'solid' }))[0]!;
    assert.deepEqual(Object.fromEntries(Object.keys(patch).map(key => [key, next[key]])), patch);
    assert.equal(next.stroke, '#abcdef'); assert.equal(next.strokeW, 8);
    const links = readBlockTokenBindings(next.links);
    for (const id of ['strokeDash', 'strokeDashArray', 'strokeDashLen', 'strokeGapLen']) assert.equal(links[id]?.custom, true);
    assert.equal(links.stroke?.custom, undefined);
    const restored = linked(next, { ...border, style: 'solid' });
    assert.deepEqual([restored.strokeDash, restored.strokeDashArray, restored.strokeDashLen, restored.strokeGapLen], ['', '', 0, 0]);
    assert.ok(Object.values(readBlockTokenBindings(restored.links)).every(link => !link.custom));
  }
});
test('border links and custom dash overrides survive compact URLs and reopening', () => {
  const manifest = { id: 'border-test', name: 'Border', version: '1.0.0', engineVersion: '^1.0.0', status: 'community', render: { formats: ['svg'], width: 100, height: 100 }, inputs: [{ id: 'boxes', type: 'blocks', fields, tokenBindingsField: 'links', default: [] }] } as ToolManifest;
  const row = reconcileBlockTokenBindings([{ ...linked(), strokeDashArray: '9 4' }], 'links')[0]!;
  const wire = serializeUrlState(buildInputModel(manifest, { initial: { boxes: [row] } }));
  const reopened = parseUrlState(wire, manifest).values.boxes as InputValue[];
  const next = resolveBlockTokenBindings(reopened, 'links', fields, tokens({ ...border, color: '#abcdef', style: 'solid' }))[0]!;
  assert.equal(next.strokeDashArray, '9 4'); assert.equal(next.strokeDash, 'dashed'); assert.equal(next.stroke, '#abcdef');
  assert.equal(readBlockTokenBindings(next.links).strokeDashArray?.adapter, 'border.dashArray');
  assert.equal(readBlockTokenBindings(next.links).strokeDash?.ref, '{outline}');
});
test('the downloadable Beacon border composes appearance and density choices', () => {
  const doc = JSON.parse(readFileSync(new URL('../../shells/web/public/examples/beacon.tokens.json', import.meta.url), 'utf8'));
  for (const [appearance, density, color, width, style] of [['day', 'compact', '#7c3aed', 2, ''], ['night', 'roomy', '#b5a0ff', 4, 'dotted']] as const) {
    const entry = createTokenSet(doc, { selection: { appearance, density } }).get('border.exampleOutline');
    assert.equal(resolveTokenBinding(entry, { type: 'text', adapter: 'border' }).status, 'linked');
    assert.equal(resolveTokenBinding(entry, { type: 'color', adapter: 'border.color' }).value, color);
    assert.equal(resolveTokenBinding(entry, { type: 'number', adapter: 'border.width' }).value, width);
    assert.equal(resolveTokenBinding(entry, { type: 'select', adapter: 'border.style' }).value, style);
  }
});
