// SPDX-License-Identifier: MPL-2.0
/**
 * `render.when`: render settings that follow one input's value. The schema's
 * admission of the form, the pure resolver, and the runtime's `getRender()`.
 *
 * Run directly: node --test tests/render-when.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_WHEN_KEYS, renderWhenMatches, resolveRender } from '../engine/src/render-when.ts';
import { validateManifest } from '../engine/src/validate.ts';
import { loadTool, type ToolManifest } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import type { HostV1 } from '../engine/src/bridge/host-v1.ts';
import type { RenderSpec } from '@lolly-tools/core';

type RenderBlock = Pick<RenderSpec, 'when'> & { formats: string[]; width: number; height: number; actions: string[] } & Record<string, unknown>;
const SET = { export: false, webPreview: true, actions: [] as string[] };
const manifest = (when?: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'two-modes', name: 'Two modes', version: '1.0.0', engineVersion: '>=1.356.0', status: 'community',
  // `when` arrives as written in a manifest, malformed cases included, so the block is typed as the engine reads it.
  render: { formats: ['svg', 'png'], width: 100, height: 100, actions: ['copy', 'download', 'save'], ...extra, ...(when === undefined ? {} : { when }) } as RenderBlock,
  inputs: [
    { id: 'mode', type: 'select', default: 'make', options: [{ value: 'make', label: 'Make' }, { value: 'scan', label: 'Scan' }, { value: 'read', label: 'Read' }] },
    { id: 'title', type: 'text', default: 'Hello' },
  ],
});
const WHEN = { input: 'mode', value: 'scan', set: SET };

const host = {
  version: '1', shell: 'cli', capabilities: [], log: () => {}, profile: { get: async () => ({}) },
  assets: { get: async () => null, query: async () => [] }, state: { load: async () => null, save: async () => {}, list: async () => [] },
  clipboard: {}, export: {},
} as unknown as HostV1;

async function mount(m: unknown, values: Record<string, unknown> = {}) {
  const tool = await loadTool('two-modes', async (path) => {
    if (path.endsWith('tool.json')) return JSON.stringify(m);
    if (path.endsWith('template.html')) return '<svg><text>{{title}}</text></svg>';
    throw new Error('No optional source');
  });
  return createRuntime(tool, host, values as never);
}

// ── schema ──────────────────────────────────────────────────────────────────

test('the schema admits the form, one value or a list', () => {
  assert.deepEqual(validateManifest(manifest(WHEN)).errors, []);
  assert.deepEqual(validateManifest(manifest({ ...WHEN, value: ['scan', 'read'] })).errors, []);
  assert.deepEqual(validateManifest(manifest({ input: 'mode', value: 'scan', set: { actions: ['save', 'share'] } })).errors, []);
  assert.deepEqual(validateManifest(manifest({ input: 'mode', value: 'scan',
    set: { live: true, liveFacing: 'environment', liveCameraWhen: { input: 'mode', value: 'scan' } } }, { live: false })).errors, []);
});

test('a manifest with no `when` validates as before', () => {
  assert.deepEqual(validateManifest(manifest()).errors, []);
});

test('the schema refuses a malformed block', () => {
  const refused = (when: unknown): void => { assert.equal(validateManifest(manifest(when)).valid, false, JSON.stringify(when)); };
  refused({ input: 'mode', value: 'scan' });                              // no set
  refused({ input: 'mode', set: SET });                                   // no value
  refused({ value: 'scan', set: SET });                                   // no input
  refused({ input: 'mode', value: 'scan', set: {} });                     // an empty set changes nothing
  refused({ input: 'mode', value: 'scan', set: { formats: ['png'] } });   // not a key that can be set
  refused({ input: 'mode', value: 'scan', set: { width: 10 } });
  refused({ input: 'mode', value: 'scan', set: { export: 'no' } });       // wrong type
  refused({ input: 'mode', value: 'scan', set: { actions: ['print'] } }); // not an action
  refused({ input: 'mode', value: [], set: SET });                        // an empty list matches nothing
  refused({ input: 'mode', value: { is: 'scan' }, set: SET });            // no expression language
  refused({ input: 'mode', value: 'scan', set: SET, otherwise: {} });     // one block, no second branch
  refused([WHEN]);                                                        // one block, not a list of them
});

test('a block keyed on an input the tool does not declare is refused', () => {
  const result = validateManifest(manifest({ ...WHEN, input: 'nope' }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [{ path: '/render/when/input', message: 'must be the id of a declared input' }]);
});

test('every key the resolver sets is a key the schema lets `set` hold, and no other', async () => {
  const { default: schema } = await import('../schemas/tool.schema.json', { with: { type: 'json' } });
  const set = (schema as unknown as { properties: { render: { properties: { when: { properties: { set: { properties: Record<string, unknown> } } } } } } })
    .properties.render.properties.when.properties.set.properties;
  assert.deepEqual(Object.keys(set).sort(), [...RENDER_WHEN_KEYS].sort());
});

// ── resolver ────────────────────────────────────────────────────────────────

test('the default: no `when`, or a value that does not match, gives the block itself', () => {
  const plain = manifest().render;
  assert.equal(resolveRender(plain, { mode: 'scan' }), plain);
  const keyed = manifest(WHEN).render;
  assert.equal(resolveRender(keyed, { mode: 'make' }), keyed);
  assert.equal(resolveRender(keyed, { mode: 'read' }), keyed, 'a value that matches nothing');
  assert.equal(resolveRender(keyed, { mode: '' }), keyed);
  assert.equal(resolveRender(keyed, {}), keyed, 'the input holds no value');
  assert.equal(renderWhenMatches(keyed, { mode: 'make' }), false);
});

test('the override: each flag takes the value under `set`, the rest stay', () => {
  const keyed = manifest(WHEN, { filenameFrom: ['title'] }).render as Record<string, unknown>;
  const resolved = resolveRender(keyed, { mode: 'scan' }) as Record<string, unknown>;
  assert.notEqual(resolved, keyed);
  assert.equal(resolved.export, false);
  assert.equal(resolved.webPreview, true);
  assert.deepEqual(resolved.actions, []);
  assert.deepEqual(resolved.formats, ['svg', 'png']);
  assert.equal(resolved.width, 100);
  assert.deepEqual(resolved.filenameFrom, ['title']);
  // The manifest's own block is not written to.
  assert.equal(keyed.export, undefined);
  assert.deepEqual(keyed.actions, ['copy', 'download', 'save']);
});

test('each flag alone', () => {
  const one = (set: Record<string, unknown>) => resolveRender(manifest({ input: 'mode', value: 'scan', set }).render, { mode: 'scan' }) as Record<string, unknown>;
  assert.equal(one({ export: false }).export, false);
  assert.equal(one({ export: false }).webPreview, undefined);
  assert.deepEqual(one({ export: false }).actions, ['copy', 'download', 'save']);
  assert.equal(one({ webPreview: true }).webPreview, true);
  assert.equal(one({ webPreview: true }).export, undefined);
  assert.deepEqual(one({ actions: ['save'] }).actions, ['save']);
  assert.equal(one({ live: true }).live, true);
  assert.equal(one({ liveFacing: 'environment' }).liveFacing, 'environment');
  assert.deepEqual(one({ liveCameraWhen: { input: 'mode', value: 'scan' } }).liveCameraWhen, { input: 'mode', value: 'scan' });
});

test('a list of values matches any one of them', () => {
  const keyed = manifest({ ...WHEN, value: ['scan', 'read'] }).render;
  assert.equal(renderWhenMatches(keyed, { mode: 'scan' }), true);
  assert.equal(renderWhenMatches(keyed, { mode: 'read' }), true);
  assert.equal(renderWhenMatches(keyed, { mode: 'make' }), false);
});

test('an unknown input id never matches, whatever the values hold', () => {
  const keyed = { ...manifest().render, when: { input: 'nope', value: 'scan', set: SET } } as RenderBlock;
  assert.equal(resolveRender(keyed, { mode: 'scan' }), keyed);
  // Not even a value of `undefined` against a missing key.
  const odd = { ...manifest().render, when: { input: 'nope', value: undefined as unknown as string, set: SET } } as RenderBlock;
  assert.equal(resolveRender(odd, { mode: 'scan' }), odd);
});

test('a key outside the list is not applied, even if a manifest got past the schema', () => {
  const keyed = { ...manifest().render, when: { input: 'mode', value: 'scan', set: { export: false, width: 9, formats: ['gif'] } as never } };
  const resolved = resolveRender(keyed, { mode: 'scan' }) as Record<string, unknown>;
  assert.equal(resolved.export, false);
  assert.equal(resolved.width, 100);
  assert.deepEqual(resolved.formats, ['svg', 'png']);
});

test('the comparison is strict, as showIf compares', () => {
  const keyed = manifest({ input: 'mode', value: 'true', set: SET }).render;
  assert.equal(renderWhenMatches(keyed, { mode: true }), false);
  assert.equal(renderWhenMatches(keyed, { mode: 'true' }), true);
});

// ── runtime ─────────────────────────────────────────────────────────────────

test('getRender() is the manifest block for a tool with no `when`', async () => {
  const runtime = await mount(manifest());
  assert.equal(runtime.getRender(), runtime.manifest.render);
  await runtime.setInput('mode', 'scan');
  assert.equal(runtime.getRender(), runtime.manifest.render);
});

test('getRender() follows the keyed input and keeps one object per answer', async () => {
  const runtime = await mount(manifest(WHEN));
  const make = runtime.getRender();
  assert.equal(make, runtime.manifest.render);
  assert.equal(make.export, undefined);

  await runtime.setInput('title', 'Another');
  assert.equal(runtime.getRender(), make, 'an input the block is not keyed on changes nothing');

  await runtime.setInput('mode', 'scan');
  const scan = runtime.getRender();
  assert.notEqual(scan, make);
  assert.equal(scan.export, false);
  assert.equal((scan as Record<string, unknown>).webPreview, true);
  assert.deepEqual(scan.actions, []);
  assert.equal(runtime.getRender(), scan, 'the same object until the answer changes');

  await runtime.setInput('mode', 'read');
  assert.equal(runtime.getRender(), make, 'back to the manifest block');
  assert.equal(runtime.manifest.render.export, undefined, 'the manifest is never written to');
});

test('a runtime born in the keyed mode answers the override at once (a link, a CLI flag)', async () => {
  const m = manifest(WHEN);
  const born = await mount(m, parseUrlState('mode=scan', m as unknown as ToolManifest).values);
  assert.equal(born.getRender().export, false);
  const plain = await mount(m, parseUrlState('title=Hi', m as unknown as ToolManifest).values);
  assert.equal(plain.getRender(), plain.manifest.render);
});

test('a tool whose engineVersion range excludes the running engine is refused, as any tool is', async () => {
  await assert.rejects(mount({ ...manifest(WHEN), engineVersion: '>=99.0.0' }));
});
