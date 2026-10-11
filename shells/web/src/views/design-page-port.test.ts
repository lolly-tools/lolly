// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuntime } from '../../../../engine/src/runtime.ts';
import { modelToValues } from '../../../../engine/src/inputs.ts';
import type { HostV1 } from '../../../../engine/src/bridge/host-v1.ts';
import type { LoadedTool } from '../../../../engine/src/loader.ts';
import { createDesignPagePort } from './design-page-port.ts';

const host = { version: '1', profile: { get: async () => ({}) }, log() {} } as unknown as HostV1;
const tool: LoadedTool = {
  trustClass: 'development-unsigned', styles: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
  manifest: {
    id: 'page-port-test', name: 'Pages', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
    inputs: [{ id: 'pages', type: 'blocks', fields: [{ id: 'id', type: 'text' }, { id: 'name', type: 'text' }], default: [] }],
    render: { width: 100, height: 100, formats: ['svg'] }, hooks: { onInit: true, onInput: true },
  }, template: '{{visible}}', hooksSource: 'function onInit(ctx){ return {visible:ctx.view?.pageId}; } function onInput(ctx){ return {visible:ctx.view?.pageId}; }',
};
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
async function fixture(editable = true, initialPage = 'one', gate?: Promise<unknown>) {
  const mountedTool = gate ? { ...tool, hooksSource: tool.hooksSource + ' function onInput(ctx){ctx.report({visible:ctx.view.pageId});return host.net.fetch();}' } : tool;
  const mountedHost = gate ? { ...host, net: { fetch: () => gate } } as unknown as HostV1 : host;
  const runtime = await createRuntime(mountedTool, mountedHost, { pages: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }] }, { viewState: { pageId: initialPage } });
  let selection = ['first'], viewport = { scale: 2, x: 10, y: 20 }, writes = 0, changes = 0, flushes = 0;
  const selectionListeners = new Set<(ids: string[]) => void>();
  const select = (ids: string[]) => { selection = ids; for (const listener of selectionListeners) listener(ids); };
  const errors: unknown[] = [];
  const controller = createDesignPagePort(runtime, {
    canEdit: () => editable, onError: error => { errors.push(error); }, flush: () => { flushes++; },
    stage: () => ({ viewState: () => ({ ...viewport }), applyView: value => { viewport = value; }, fit: () => { viewport = { scale: 1, x: 0, y: 0 }; } }),
  });
  controller.bind({
    design: { model: { getBoxes: () => [{ id: 'first' }, { id: 'second' }], commit: () => { writes++; } }, selection: { get: () => [...selection], set: select, onChange(listener) { selectionListeners.add(listener); return () => { selectionListeners.delete(listener); }; } } },
    pageChanged: () => { changes++; select([]); }, duplicatePage: async () => 'two', removePage: () => { writes++; },
  });
  return { runtime, controller, errors, get selection() { return selection; }, get viewport() { return viewport; }, get writes() { return writes; }, get changes() { return changes; }, get flushes() { return flushes; },
    choose(ids: string[], view: typeof viewport) { select(ids); viewport = view; }, destroy() { controller.destroy(); runtime.destroy(); assert.equal(selectionListeners.size, 0); } };
}

test('page switching retains each selection and viewport without document writes', async () => {
  const f = await fixture();
  try {
    const before = modelToValues(f.runtime.getModel()), pages = f.controller.port.get();
    assert.equal(f.controller.port.get(), pages, 'page metadata identity remains stable between model revisions');
    f.controller.port.setActive('two'); await settle();
    assert.equal(f.controller.port.active(), 'two'); assert.deepEqual(f.selection, []);
    assert.deepEqual(f.viewport, { scale: 1, x: 0, y: 0 });
    f.choose(['second'], { scale: 3, x: 30, y: 40 });
    f.controller.port.setActive('one'); await settle();
    assert.deepEqual(f.selection, ['first']); assert.deepEqual(f.viewport, { scale: 2, x: 10, y: 20 });
    f.controller.port.setActive('two'); await settle();
    assert.deepEqual(f.selection, ['second']); assert.deepEqual(f.viewport, { scale: 3, x: 30, y: 40 });
    assert.equal(f.writes, 0); assert.equal(f.changes, 3); assert.equal(f.flushes, 3);
    assert.deepEqual(modelToValues(f.runtime.getModel()), before); assert.deepEqual(f.errors, []);
  } finally { f.destroy(); }
});

test('readonly viewers can navigate; removed active pages recover to an existing page', async () => {
  const f = await fixture(false, 'two');
  try {
    assert.equal(f.controller.port.active(), 'two');
    f.controller.port.commit([], [], 'Denied'); f.controller.port.duplicate('two'); f.controller.port.remove('two');
    assert.equal(f.writes, 0);
    await f.runtime.setInput('pages', [{ id: 'one', name: 'Remaining' }]); await settle();
    assert.equal(f.controller.port.active(), 'one'); assert.equal(f.runtime.getViewState!()?.pageId, 'one');
    assert.equal(f.runtime.getHydrated(), 'one'); assert.deepEqual(f.errors, []);
    const changes = f.changes;
    f.controller.port.setActive('missing'); await settle(); assert.equal(f.changes, changes);
  } finally { f.destroy(); }
});

test('late page rendering preserves a newer selection and pan from the viewer', async () => {
  let release!: (patch: unknown) => void;
  const gate = new Promise(resolve => { release = resolve; }), f = await fixture(true, 'one', gate);
  try {
    f.controller.port.setActive('two'); await settle();
    assert.equal(f.runtime.getHydrated(), 'two', 'progressive hooks can expose the new page before their final result');
    f.choose(['second'], { scale: 4, x: 80, y: 90 });
    release({ visible: 'two' }); await settle();
    assert.deepEqual(f.selection, ['second']); assert.deepEqual(f.viewport, { scale: 4, x: 80, y: 90 });
    assert.equal(f.writes, 0); assert.deepEqual(f.errors, []);
  } finally { release({}); f.destroy(); }
});
