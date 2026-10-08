// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { encodeCanvasAsset, decodeCanvasAsset } from '@lolly-tools/core/canvas-asset-v1';
import { createWorkCanvasAssets } from './canvas-assets.ts';
import { shareCanvasToolImage } from './canvas-tool-image.ts';
import { setHostRef } from '../lib/host-ref.ts';
import type { BeamAssetRecord } from '../lib/beam-pack.ts';
import type { TeamFile } from './team-files.ts';

const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR4sAAAAASUVORK5CYII=', 'base64');
const recipe = 'https://lolly.tools/tool/qr-code.png?url=https%3A%2F%2Fexample.com';
const ref: AssetRef = { id: recipe, source: 'remote', type: 'raster', format: 'png', width: 1, height: 1,
  url: `data:image/png;base64,${bytes.toString('base64')}`, meta: { name: 'QR code', toolUrl: recipe } };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
type Render = { url: string; thumbnail: boolean | undefined };
async function withProject(run: (context: { files: TeamFile[]; uploads: () => number; records: Map<string, BeamAssetRecord>; renders: Render[] }) => Promise<void>): Promise<void> {
  const original = globalThis.fetch; const files: TeamFile[] = [], parts: Blob[] = [], renders: Render[] = []; let uploads = 0;
  const records = new Map<string, BeamAssetRecord>();
  setHostRef({ compose: { renderUrl: async (url: string, opts?: { thumbnail?: boolean }) => { renders.push({ url, thumbnail: opts?.thumbnail }); return { ...ref, id: url }; } },
    assets: { _getUserRecord: async (id: string) => records.get(id) ?? null,
    _uploadUserAsset: async (record: BeamAssetRecord) => { records.set(record.id, record); },
    get: async (id: string) => { const record = records.get(id)!; return { ...record, source: 'user', url: URL.createObjectURL(record.blob!) }; },
  } } as unknown as HostV1);
  globalThis.fetch = async (input, init) => {
    const url = String(input), method = init?.method ?? 'GET';
    if (url.startsWith('data:') || url.startsWith('blob:')) return original(input, init);
    if (url.endsWith('/sessions/session')) return json({ id: 'session', projectId: 'project', toolId: 'design', inputs: {} });
    if (url.endsWith('/files') && method === 'GET') return json({ files: files.filter(file => file.ready),
      limits: { partBytes: 1024 * 1024, maxBytes: 25 * 1024 * 1024, projectBudgetBytes: 128 * 1024 * 1024, projectUsedBytes: 0, instanceRemainingBytes: 256 * 1024 * 1024 } });
    if (url.endsWith('/files') && method === 'POST') {
      uploads++; const file = { ...JSON.parse(String(init?.body)), id: 'fil_abcdefghijklmnopqrstuv', projectId: 'project', ready: false };
      files.push(file); return json({ file });
    }
    if (url.endsWith('/parts/0')) { assert.ok(init?.body instanceof Blob); parts.push(init.body); return new Response(null, { status: 204 }); }
    if (url.endsWith('/finalize')) { files[0]!.ready = true; return json({ file: files[0] }); }
    if (url.endsWith('/fil_abcdefghijklmnopqrstuv')) return new Response(new Blob(parts), { headers: { 'content-length': String(files[0]!.size) } });
    throw new Error(`Unexpected project request: ${url}`);
  };
  try { await run({ files, uploads: () => uploads, records, renders }); } finally { globalThis.fetch = original; }
}

test('a placed tool travels as its link and is drawn again on another client', async () => {
  await withProject(async ({ uploads, renders }) => {
    const assets = createWorkCanvasAssets('session', () => 'person'); let message = '';
    assets.status.subscribe(state => { message = state.message; });
    const shared = await assets.prepare(ref);
    assert.equal(shared, ref, 'the editor keeps the render it already holds');
    assert.equal(message, ''); assert.equal(uploads(), 0, 'a tool render is never uploaded as a project file');
    const wire = encodeCanvasAsset(shared)!; assert.ok(wire); assert.doesNotMatch(wire, /data:image|blob:/);
    const decoded = decodeCanvasAsset(wire)!; assert.equal(decoded.id, recipe); assert.equal(decoded.source, 'remote');
    const peer = createWorkCanvasAssets('session', () => 'person');
    const restored = await peer.resolve(decoded);
    assert.deepEqual(renders, [{ url: recipe, thumbnail: false }], 'the peer redraws the tool from its own link');
    assert.equal(restored.id, recipe);
    assert.equal(uploads(), 0); assets.close(); peer.close();
  });
});
test('tool sharing never fetches a remote render URL or treats arbitrary web images as tool recipes', async () => {
  const original = globalThis.fetch; let fetched = false; globalThis.fetch = async () => { fetched = true; throw new Error('Unexpected fetch'); };
  try {
    assert.equal(await shareCanvasToolImage('project', { ...ref, id: 'https://evil.example/tool/qr-code.png' }, null, {}), null);
    await assert.rejects(shareCanvasToolImage('project', { ...ref, url: 'https://tracker.example/image.png' }, null, {}), /could not be rendered/);
    assert.equal(fetched, false);
  } finally { globalThis.fetch = original; }
});
test('closed or changed-account canvases cannot start a generated-image upload', async () => {
  await withProject(async ({ uploads }) => {
    let person = 'person'; const assets = createWorkCanvasAssets('session', () => person); person = 'another';
    await assert.rejects(assets.prepare(ref), /access changed/); assert.equal(uploads(), 0);
    person = 'person'; assets.close(); await assert.rejects(assets.prepare(ref), /access changed/);
  });
});


test('SVG tool images use the shared sanitiser and retain drawable content', async () => {
  const dom = new JSDOM('<!doctype html>');
  const previous = { window: globalThis.window, document: globalThis.document, DOMParser: globalThis.DOMParser, XMLSerializer: globalThis.XMLSerializer };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser, XMLSerializer: dom.window.XMLSerializer });
  try {
    await withProject(async ({ records }) => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" onload="alert(1)"><script>alert(1)</script><rect width="1" height="1" fill="red"/></svg>';
      // A link too long for the live-canvas lane still shares, as an uploaded project file.
      const long = `https://lolly.tools/tool/qr-code.svg?url=${'a'.repeat(3900)}`;
      const assets = createWorkCanvasAssets('session', () => 'person');
      const shared = await assets.prepare({ ...ref, id: long, type: 'vector', format: 'svg', url: `data:image/svg+xml,${encodeURIComponent(svg)}` });
      assert.match(shared.id, /^user\/team\/fil_/);
      assert.equal(shared.type, 'vector'); assert.equal(shared.format, 'svg');
      const text = await records.get(shared.id)!.blob!.text(); assert.match(text, /<rect/); assert.doesNotMatch(text, /script|onload/);
      assets.close(); URL.revokeObjectURL(shared.url);
    });
  } finally { Object.assign(globalThis, previous); dom.window.close(); }
});
