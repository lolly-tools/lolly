// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRuntime } from '../engine/src/runtime.ts';
import type { HostV1 } from '../engine/src/bridge/host-v1.ts';
import type { LoadedTool } from '../engine/src/loader.ts';
import { modelToValues } from '../engine/src/inputs.ts';

let serial = 0;
function tool(source: string): LoadedTool {
  return {
    trustClass: 'development-unsigned', styles: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
    manifest: {
      id: `view-test-${++serial}`, name: 'View', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      inputs: [{ id: 'title', type: 'text', default: 'Document' }],
      render: { width: 100, height: 100, formats: ['svg'] }, hooks: { onInit: true, onInput: true },
    }, template: '{{title}}:{{visible}}', hooksSource: source,
  };
}
const host = { version: '1', profile: { get: async () => ({}) }, log() {} } as unknown as HostV1;
const hooks = 'function onInit(ctx) { return {visible:ctx.view?.pageId || "all"}; } function onInput(ctx) { return {visible:ctx.view?.pageId || "all", ...(ctx.id === "__view" ? {title:"Unexpected write"} : {})}; }';

test('local views refresh hook output while canonical input values stay unchanged', async () => {
  const runtime = await createRuntime(tool(hooks), host, {}, { viewState: { pageId: 'one' } });
  try {
    const before = modelToValues(runtime.getModel());
    assert.equal(runtime.getHydrated(), 'Document:one');
    await runtime.setViewState!({ pageId: 'two' });
    assert.equal(runtime.getHydrated(), 'Document:two');
    assert.deepEqual(modelToValues(runtime.getModel()), before);
    await runtime.setInput('title', 'Edited');
    assert.equal(runtime.getHydrated(), 'Edited:two');
    assert.deepEqual(runtime.getViewState!(), { pageId: 'two' });
  } finally { runtime.destroy(); }
});

test('one-shot runtimes leave view selection absent', async () => {
  const runtime = await createRuntime(tool(hooks), host);
  try { assert.equal(runtime.getHydrated(), 'Document:all'); assert.equal(runtime.getViewState!(), undefined); }
  finally { runtime.destroy(); }
});

test('a slow page render cannot replace a newer view', async () => {
  let release!: (patch: unknown) => void;
  const gate = new Promise(resolve => { release = resolve; });
  const viewHost = { ...host, net: { fetch: () => gate } } as unknown as HostV1;
  const runtime = await createRuntime(tool('function onInit(){return {visible:"all"};} function onInput(ctx){ if(ctx.view.pageId === "slow") return host.net.fetch(); return {visible:ctx.view.pageId}; }'), viewHost);
  try {
    const pending = runtime.setViewState!({ pageId: 'slow' });
    await runtime.setViewState!({ pageId: 'latest' });
    release({ visible: 'stale', title: 'Unexpected write' });
    await pending;
    assert.equal(runtime.getHydrated(), 'Document:latest');
    assert.deepEqual(runtime.getViewState!(), { pageId: 'latest' });
  } finally { runtime.destroy(); }
});
