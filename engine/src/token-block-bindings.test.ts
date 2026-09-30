// SPDX-License-Identifier: MPL-2.0
/** Property links keep scalar rendering, portable overrides and explicit cached fallbacks. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTokenSet } from './tokens.ts';
import { readBlockTokenBindings, withBlockTokenBinding, resolveBlockTokenBindings } from './token-block-bindings.ts';
import { buildInputModel, updateInput, tokenRestoreRefsOf, type BlockFieldSpec, type InputValue } from './inputs.ts';
import { parseUrlState, serializeUrlState } from './url-mode.ts';
import { loadTool, type ToolManifest } from './loader.ts';
import { createRuntime } from './runtime.ts';
import type { HostV1 } from './bridge/host-v1.ts';
import { validateManifest } from './validate.ts';

const fields: BlockFieldSpec[] = [{ id: 'id', type: 'text' }, { id: 'w', type: 'number', min: 1, max: 1000 }, { id: 'bg', type: 'color' }, { id: 'font', type: 'select', brandFonts: true }, { id: 'links', type: 'text', default: '' }];
const manifest = {
  id: 'token-layers', name: 'Token layers', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
  render: { formats: ['svg'], width: 100, height: 100 },
  inputs: [{ id: 'gap', type: 'number', default: 10 }, { id: 'boxes', type: 'blocks', fields, tokenBindingsField: 'links', default: [] }],
} as ToolManifest;
const source = (width = 240) => ({ width: { $type: 'dimension', $value: { value: width, unit: 'px' } }, ink: { $type: 'color', $value: '#123456' }, face: { $type: 'fontFamily', $value: 'Beacon Sans' } });
const baseRow = () => ({ id: 'a', w: 120, bg: '#000000', font: 'sans-serif', links: '' });

test('layer links retain scalar geometry and refresh supported types without changing source', () => {
  let row = withBlockTokenBinding(baseRow(), 'links', 'w', { ref: '{width}', value: 120 });
  row = withBlockTokenBinding(row, 'links', 'bg', { ref: '{ink}', value: '#000000' });
  row = withBlockTokenBinding(row, 'links', 'font', { ref: '{face}', value: 'sans-serif' });
  const before = structuredClone(row);
  const next = resolveBlockTokenBindings([row], 'links', fields, createTokenSet(source()))[0] as typeof row;
  assert.equal(next.w, 240); assert.equal(next.bg, '#123456'); assert.equal(next.font, 'Beacon Sans');
  assert.equal(readBlockTokenBindings(next.links).w?.status, 'linked');
  assert.deepEqual(row, before);
  assert.equal(resolveBlockTokenBindings([next], 'links', fields, createTokenSet(source(320)))[0]!.w, 320);
});

test('ordinary local edits detach only the changed property and persist through URL and reopen', () => {
  const row = withBlockTokenBinding(baseRow(), 'links', 'w', { ref: '{width}', value: 120 });
  let model = buildInputModel(manifest, { initial: { boxes: [row] } });
  model = updateInput(model, 'boxes', [{ ...row, w: 178 }]);
  const wire = serializeUrlState(model), reopened = buildInputModel(manifest, { initial: parseUrlState(wire, manifest).values });
  const next = resolveBlockTokenBindings(reopened.find(item => item.id === 'boxes')!.value as InputValue[], 'links', fields, createTokenSet(source()))[0]!;
  assert.equal(Number(next.w), 178);
  assert.equal(readBlockTokenBindings(next.links).w?.custom, true);
  assert.equal(readBlockTokenBindings(next.links).w?.ref, '{width}');
  const custom = withBlockTokenBinding(row, 'links', 'w', 120);
  assert.equal(resolveBlockTokenBindings([custom], 'links', fields, createTokenSet(source()))[0]!.w, 120);
  const activeUrl = serializeUrlState(buildInputModel(manifest, { initial: { boxes: [row] } }));
  const activeRows = parseUrlState(activeUrl, manifest).values.boxes as InputValue[];
  assert.equal(resolveBlockTokenBindings(activeRows, 'links', fields, createTokenSet(source()))[0]!.w, 240);
});

test('missing and incompatible sources keep cached geometry with a reason', () => {
  const row = withBlockTokenBinding(baseRow(), 'links', 'w', { ref: '{width}', value: 120 });
  for (const [doc, status] of [[{}, 'unresolved'], [source(5000), 'incompatible'], [{ width: { $type: 'color', $value: '#ffffff' } }, 'incompatible']] as const) {
    const next = resolveBlockTokenBindings([row], 'links', fields, createTokenSet(doc))[0]!;
    assert.equal(next.w, 120);
    assert.equal(readBlockTokenBindings(next.links).w?.status, status);
    assert.ok(readBlockTokenBindings(next.links).w?.reason);
  }
  assert.deepEqual(readBlockTokenBindings('{"__proto__":{"ref":"{width}","value":1}}'), {});
  assert.deepEqual(readBlockTokenBindings('x'.repeat(32769)), {});
});

test('layer colour links use the existing SDR or wide-gamut face for the document', () => {
  const set = createTokenSet({ ink: { $type: 'color', $value: 'color(display-p3 1 0 0)' } });
  const row = withBlockTokenBinding(baseRow(), 'links', 'bg', { ref: '{ink}', value: '#ff0000' });
  const hdr = resolveBlockTokenBindings([row], 'links', fields, set, 'rec2020')[0]!;
  assert.match(String(hdr.bg), /color\(display-p3/);
  const sdr = resolveBlockTokenBindings([row], 'links', fields, set, 'srgb')[0]!;
  assert.match(String(sdr.bg), /^#[a-f\d]{6}$/i);
});

test('runtime hydrates layer links and saved scalar overrides on the same render path', async () => {
  const tool = await loadTool(manifest.id, async path => {
    if (path.endsWith('tool.json')) return JSON.stringify(manifest);
    if (path.endsWith('template.html')) return '<svg>{{#each boxes}}<rect width="{{w}}"/>{{/each}}</svg>';
    throw new Error('No optional source');
  });
  const host = { version: '1', shell: 'cli', capabilities: [], log: () => {}, profile: { get: async () => ({}) }, assets: { get: async () => null, query: async () => [] }, state: { load: async () => null, save: async () => {}, list: async () => [] }, clipboard: {}, export: {}, tokens: { get: async () => createTokenSet(source()) } } as unknown as HostV1;
  const runtime = await createRuntime(tool, host, { gap: 17, __tokenLinks: { gap: '{width}' }, boxes: [withBlockTokenBinding(baseRow(), 'links', 'w', { ref: '{width}', value: 120 })] });
  assert.match(runtime.getHydrated(), /width="240"/);
  assert.equal(runtime.getModel().find(item => item.id === 'gap')!.value, 17);
  assert.deepEqual(tokenRestoreRefsOf(runtime.getModel()), { gap: '{width}' });
  await runtime.setInput('gap', { ref: '{other}', value: 33 });
  await runtime.setInput('gap', 17, { restoreTokenRefs: { gap: '{width}' } });
  assert.deepEqual(tokenRestoreRefsOf(runtime.getModel()), { gap: '{width}' });
  await runtime.applyPatch({ gap: 17 }, { restoreTokenRefs: { gap: null } });
  assert.deepEqual(tokenRestoreRefsOf(runtime.getModel()), {});
  const offline = await createRuntime(tool, { ...host, tokens: { ...host.tokens!, get: async () => { throw new Error('Offline'); } } }, {
    gap: { ref: '{width}', value: 17, status: 'linked' }, boxes: [withBlockTokenBinding(baseRow(), 'links', 'w', { ref: '{width}', value: 120 })],
  });
  assert.deepEqual(offline.getModel().find(item => item.id === 'gap')!.value, { ref: '{width}', value: 17, status: 'unresolved', reason: 'The token has no resolved value.' });
  const offlineRow = (offline.getModel().find(item => item.id === 'boxes')!.value as InputValue[])[0]!;
  assert.equal(offlineRow.w, 120);
  assert.equal(readBlockTokenBindings(offlineRow.links).w?.status, 'unresolved');
});

test('custom scalar links survive share URLs and do not turn literal values into aliases', () => {
  let model = buildInputModel(manifest, { initial: { gap: { ref: '{width}', value: 240 } } });
  model = updateInput(model, 'gap', 178);
  const parsed = parseUrlState(serializeUrlState(model), manifest);
  assert.equal(parsed.values.gap, 178);
  assert.deepEqual(tokenRestoreRefsOf(buildInputModel(manifest, { initial: parsed.values })), { gap: '{width}' });
  assert.throws(() => parseUrlState('_restore.gap=no-braces', manifest), /token reference/);
});

test('Design appends its metadata field and the manifest rejects an undeclared storage field', () => {
  const design = JSON.parse(readFileSync(new URL('../../community/design/tool.json', import.meta.url), 'utf8')) as ToolManifest;
  const boxes = design.inputs.find(input => input.id === 'boxes')!;
  // Appended right after textDirection at slot 113; the web page box fields (plan 288)
  // were appended after it in turn, so position, not "last", is the durable pin.
  const ids = boxes.fields!.map(field => field.id);
  assert.equal(ids.indexOf('tokenLinks'), 113);
  assert.equal(ids[112], 'textDirection');
  assert.equal(validateManifest(design).valid, true);
  const bad = structuredClone(manifest); bad.inputs[1]!.tokenBindingsField = 'missing';
  assert.equal(validateManifest(bad).valid, false);
});
