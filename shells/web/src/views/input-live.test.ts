// SPDX-License-Identifier: MPL-2.0
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTool, type ToolManifest } from '../../../../engine/src/loader.ts';
import { createRuntime } from '../../../../engine/src/runtime.ts';
import { buildInputModel, type InputSpec, type InputValue } from '../../../../engine/src/inputs.ts';
import { createLiveSession, documentRevision } from '../lib/live-agent.ts';
import { createHistory } from './tool-history.ts';
import { commitToolTransaction, transactionHistoryValues } from './tool-transaction.ts';
import { inputLiveEditor, liveInputState, type InputLiveDeps } from './input-live.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

let sequence = 0;
const call = async (session: ReturnType<typeof createLiveSession>, method: string, params?: unknown) => JSON.parse(await session.handle(JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, ...(params ? { params } : {}) })));
const hello = (session: ReturnType<typeof createLiveSession>) => call(session, 'hello', { protocol: 'live-v1', client: 'Input helper' });

const host: HostV1 = {
  version: '1', shell: 'web', capabilities: [], log() {},
  profile: { get: async () => ({}), subscribe: () => () => {} },
  assets: { get: async id => { throw new Error(`No fixture asset ${id}`); }, query: async () => [], pick: async () => null, isAvailable: async () => false },
  state: { load: async () => null, save: async () => {}, list: async () => [], delete: async () => {} },
  clipboard: { writeText: async () => {}, writeImage: async () => ({ method: 'clipboard' }) },
  export: { render: async () => new Blob(['<svg/>']), download: async () => {}, file: async () => {}, imprint: async bytes => bytes },
};

async function realTool(context: TestContext, id = 'qr-code') {
  const tool = await loadTool(id, path => readFile(new URL(`../../../../community/${path}`, import.meta.url), 'utf8'));
  const runtime = await createRuntime(tool, host, {});
  context.after(() => runtime.destroy());
  const history = createHistory();
  let readonly = false;
  const commit = (values: Record<string, unknown>, label: string) => commitToolTransaction(runtime, history, values, label);
  const editor = inputLiveEditor({
    documentId: `doc:${id}`, manifest: tool.manifest, runtime, engine: 'test', surface: 'web',
    context: async () => ({ designSystem: { id: 'document-system' }, themeSelection: { theme: 'light' } }),
    history: { commit, top: () => history.peekUndo(), undo() {
      const entry = history.undo();
      if (!entry) return;
      const values = transactionHistoryValues(runtime, entry, false);
      if (values) void runtime.applyPatch(values);
    } },
    size: () => ({ width: 800, height: 600 }), readOnly: () => readonly,
    label: (note, client) => `${client}: ${note}`, exportSvg: async () => new Blob([runtime.getHydrated()]),
  });
  return { runtime, history, editor, commit, lock: () => { readonly = true; } };
}

test('a QR agent reads the real schema and commits a validated patch as one labelled undo step', async context => {
  const fixture = await realTool(context), session = createLiveSession(fixture.editor);
  const joined = (await hello(session)).result;
  assert.equal(joined.tool, 'qr-code'); assert.equal(joined.adapter, 'inputs'); assert.equal(joined.mode, 'edit');
  assert.equal(joined.capabilities.inputValues, true); assert.equal(joined.capabilities.layerOperations, false);
  const doc = (await call(session, 'document.get')).result;
  assert.equal(doc.inputSchema.additionalProperties, false);
  assert.equal(doc.inputSchema.properties.url.type, 'string');
  assert.equal(doc.inputValues.url, fixture.runtime.getModel().find(item => item.id === 'url')!.value);
  const params = { documentId: doc.documentId, ifRevision: doc.revision, transactionId: 'qr-link', label: 'Change QR destination', inputValues: { url: 'https://example.com/agent', color: '#13579b' } };
  const first = await call(session, 'document.apply', params);
  assert.equal(first.error, undefined, JSON.stringify(first.error));
  assert.equal(first.result.changed, true); assert.deepEqual(first.result.changedInputIds, ['url', 'color']);
  assert.equal(fixture.history.sizes().undo, 1); assert.equal(fixture.history.peekUndo()!.label, 'Input helper: Change QR destination');
  assert.equal(fixture.runtime.getModel().find(item => item.id === 'url')!.value, 'https://example.com/agent');
  assert.notEqual(first.result.revision, doc.revision);
  assert.equal((await call(session, 'document.apply', params)).result.replayed, true);
  assert.equal(fixture.history.sizes().undo, 1);
  assert.match((await call(session, 'document.apply', { ...params, inputValues: { url: 'https://other.example' } })).error.message, /different edit/);
  assert.equal((await call(session, 'history.undo')).result.undone, true);
  assert.equal(fixture.runtime.getModel().find(item => item.id === 'url')!.value, doc.inputValues.url);
  assert.equal((await call(session, 'look')).error, undefined);
  const ctx = (await call(session, 'document.context')).result;
  assert.equal(ctx.designSystem.id, 'document-system'); assert.equal(ctx.adapter, 'inputs'); assert.deepEqual(ctx.capabilities.authoring, []);
  assert.match((await call(session, 'document.find', { query: 'agent' })).error.message, /inputs rather than layers/);
});

test('Diagrams uses its DSL inputs and refuses invented keys, choices, layer commands and mixed applies', async context => {
  const fixture = await realTool(context, 'diagram-builder'), session = createLiveSession(fixture.editor);
  await hello(session);
  const doc = (await call(session, 'document.get')).result;
  assert.ok(doc.editableInputIds.includes('dsl'));
  const apply = await call(session, 'document.apply', { inputValues: { source: 'text', diagramType: 'process', dsl: 'Plan -> Build -> Review' }, ifRevision: doc.revision });
  assert.equal(apply.error, undefined); assert.equal(fixture.runtime.getModel().find(item => item.id === 'dsl')!.value, 'Plan -> Build -> Review');
  assert.ok(fixture.runtime.getHydrated().includes('Review'));
  for (const params of [{ inputValues: { invented: 'x' } }, { inputValues: { diagramType: 'invented-type' } }, { inputValues: { dsl: 5 } }, { layerPatches: [{ id: 'box', set: { text: 'x' } }] }, { inputValues: { dsl: 'x' }, layerOperations: [] }, { inputValues: { dsl: 'x' }, extra: true }]) {
    assert.ok((await call(session, 'document.apply', params)).error, JSON.stringify(params));
  }
  assert.equal(fixture.history.sizes().undo, 1);
});

test('input revisions fence human edits and undo belongs to the connection that recorded the step', async context => {
  const fixture = await realTool(context), session = createLiveSession(fixture.editor);
  await hello(session);
  const doc = (await call(session, 'document.get')).result;
  await fixture.commit({ url: 'https://person.example' }, 'Person changes destination');
  assert.notEqual((await call(session, 'document.get')).result.revision, doc.revision);
  assert.match((await call(session, 'document.apply', { inputValues: { url: 'https://agent.example' }, ifRevision: doc.revision })).error.message, /changed since/);
  await call(session, 'document.apply', { inputValues: { url: 'https://agent.example' } });
  await fixture.commit({ color: '#abcdef' }, 'Person changes color');
  assert.match((await call(session, 'history.undo')).error.message, /not this agent/);
  fixture.lock();
  assert.equal((await call(session, 'document.context')).result.capabilities.inputValues, false);
  assert.match((await call(session, 'document.apply', { inputValues: { url: 'https://blocked.example' } })).error.message, /read-only/);
});

test('human edits, pause, disconnect or readonly changes while validation awaits refuse the input commit', async context => {
  for (const change of ['person', 'pause', 'close', 'readonly']) {
    const fixture = await realTool(context), session = createLiveSession(fixture.editor);
    await hello(session);
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const validate = fixture.editor.validateInputs!;
    fixture.editor.validateInputs = async values => { const errors = await validate(values); entered(); await waiting; return errors; };
    const pending = call(session, 'document.apply', { inputValues: { url: 'https://agent.example' } });
    await started;
    if (change === 'person') await fixture.commit({ url: 'https://person.example' }, 'Human edit');
    else if (change === 'pause') session.pause(true);
    else if (change === 'close') session.close();
    else fixture.lock();
    release(); assert.ok((await pending).error, change);
    assert.equal(fixture.history.sizes().undo, change === 'person' ? 1 : 0, change);
  }
});

test('the admitted input receipt stays stable when rendering later sees another input value or canvas size', async context => {
  const fixture = await realTool(context), session = createLiveSession(fixture.editor);
  let width = 800;
  fixture.editor.size = () => ({ width, height: 600 });
  const commit = fixture.editor.commitInputs!;
  fixture.editor.commitInputs = async (...args) => { const outcome = await commit(...args); await fixture.commit({ color: '#abc123' }, 'Later human edit'); width = 900; return outcome; };
  await hello(session);
  const result = (await call(session, 'document.apply', { inputValues: { url: 'https://agent.example' }, transactionId: 'stable' })).result;
  assert.notEqual(result.revision, result.currentRevision);
  assert.equal(result.currentRevision, documentRevision([], 900, 600, fixture.editor.revisionInputs!()));
  assert.equal((await call(session, 'document.apply', { inputValues: { url: 'https://agent.example' }, transactionId: 'stable' })).result.revision, result.revision);
});

function simple(inputs: InputSpec[], history: InputLiveDeps['history'] = { commit: async () => { throw new Error('must not commit'); }, top: () => null, undo() {} }) {
  const manifest: ToolManifest = { id: 'input-fixture', name: 'Inputs', version: '1.0.0', engineVersion: '^1.0.0', status: 'official', render: { width: 100, height: 100, formats: ['svg'], convertPaths: false }, inputs };
  const model = buildInputModel(manifest);
  const runtime = { getModel: () => model };
  const editor = inputLiveEditor({ documentId: 'doc:restricted', manifest, runtime, engine: 'test', surface: 'web', size: () => ({ width: 100, height: 100 }), history, readOnly: () => false, label: note => note, exportSvg: async () => new Blob(['<svg/>']) });
  return { manifest, model, editor };
}

test('file-only tools are inspectable, omit uploaded bytes and refuse edits; hidden bytes still affect revision', async () => {
  const fixture = simple([{ id: 'file', type: 'file', label: 'Private file' }]);
  fixture.model[0]!.value = { __file: true, name: 'private.txt', mime: 'text/plain', size: 4, bytes: new Uint8Array([10, 20, 30, 40]), url: 'blob:private' };
  const session = createLiveSession(fixture.editor); await hello(session);
  const doc = (await call(session, 'document.get')).result;
  assert.equal(doc.mode, 'read'); assert.equal(doc.inputSchema.properties.file.readOnly, true);
  assert.deepEqual(doc.inputValues, {}); assert.deepEqual(doc.omittedInputs, [{ id: 'file', reason: 'file' }]);
  assert.ok(!JSON.stringify(doc).includes('private.txt')); assert.ok(!JSON.stringify(doc).includes('10,20,30,40'));
  // A new pick replaces the bytes. Same name and size, different content.
  const file = fixture.model[0]!.value as { bytes: Uint8Array };
  fixture.model[0]!.value = { ...file, bytes: new Uint8Array([99, 20, 30, 40]) };
  assert.notEqual((await call(session, 'document.get')).result.revision, doc.revision);
  assert.match((await call(session, 'document.apply', { inputValues: { file: null } })).error.message, /read-only/);
});

test('each file buffer is hashed once across document.get, ifRevision and apply', async () => {
  let committed: object | null = null;
  const fixture = simple([{ id: 'file', type: 'file', label: 'Private file' }, { id: 'text', type: 'text' }], {
    commit: async values => { for (const [id, value] of Object.entries(values)) fixture.model.find(item => item.id === id)!.value = value as InputValue; committed = { values }; },
    top: () => committed, undo() {},
  });
  const bytes = new Uint8Array(1 << 20).fill(7);
  fixture.model[0]!.value = { __file: true, name: 'large.bin', mime: 'application/octet-stream', size: bytes.length, bytes, url: null };
  const session = createLiveSession(fixture.editor); await hello(session);
  const doc = (await call(session, 'document.get')).result;
  // A write into the same buffer is invisible once it has been hashed, so an
  // unchanged revision shows that later reads did not walk the bytes again.
  bytes[0] = 99;
  assert.equal((await call(session, 'document.get')).result.revision, doc.revision);
  const applied = await call(session, 'document.apply', { inputValues: { text: 'agent' }, ifRevision: doc.revision });
  assert.equal(applied.error, undefined, JSON.stringify(applied.error));
  assert.equal(applied.result.revision, applied.result.currentRevision);
  assert.equal((await call(session, 'document.get')).result.revision, applied.result.currentRevision);
  // The hash follows content, not identity: a fresh copy of the written bytes is read.
  fixture.model[0]!.value = { ...fixture.model[0]!.value as object, bytes: bytes.slice() };
  assert.notEqual((await call(session, 'document.get')).result.revision, applied.result.currentRevision);
});

test('generic snapshots and patches reject uploaded references and non-JSON values, including nested unknown fields', async () => {
  const fixture = simple([{ id: 'text', type: 'text' }, { id: 'image', type: 'asset' }, { id: 'position', type: 'vector', fields: [{ id: 'x', min: 0, max: 10 }] }, { id: 'table', type: 'table' }, { id: 'rows', type: 'blocks', fields: [{ id: 'text', type: 'text' }] }]);
  fixture.model.find(item => item.id === 'image')!.value = { source: 'user', id: 'private', type: 'raster', url: 'data:image/png;base64,secret', format: 'png' };
  const snapshot = liveInputState(fixture.manifest, fixture.model);
  assert.equal(snapshot.inputValues.image, undefined); assert.ok(!JSON.stringify(snapshot).includes('secret'));
  for (const patch of [{ image: 'data:image/png;base64,secret' }, { image: { source: 'library', id: 'image', bytes: [1, 2] } }, { position: { x: 5, invented: 2 } }, { position: { x: '5' } }, { table: { columns: ['A'], rows: [['x', 'y']] } }, { rows: [{ text: 'safe', invented: true }] }, { text: new Uint8Array([1, 2]) }]) {
    assert.ok((await fixture.editor.validateInputs!(patch)).length, JSON.stringify(patch));
  }
  fixture.model.find(item => item.id === 'image')!.value = null;
  assert.deepEqual(await fixture.editor.validateInputs!({ image: 'catalog/image', position: { x: 5 }, table: { columns: ['A'], rows: [['x']] }, rows: [{ text: 'safe' }] }), []);
});

test('a tool without SVG output advertises no live preview and refuses look', async () => {
  const fixture = simple([{ id: 'text', type: 'text' }]);
  fixture.manifest.render.formats = ['png'];
  const session = createLiveSession(fixture.editor);
  assert.equal((await hello(session)).result.capabilities.look, false);
  assert.match((await call(session, 'look')).error.message, /does not support a live SVG preview/);
});
