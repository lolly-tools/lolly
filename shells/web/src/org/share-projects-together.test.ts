// SPDX-License-Identifier: MPL-2.0
/**
 * Private and shared projects together (lolly plan 299): the folder outline a
 * destination chooser offers, why a project is in Browse, and a shared session copied
 * into the person's own projects with its shared files under new local ids.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/#/p' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element });
let router: (url: string) => Response = () => new Response('', { status: 404 });
globalThis.fetch = (async (input: RequestInfo | URL) => router(String(input))) as typeof fetch;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const { folderOutline } = await import('./local-folder-chooser.ts');
const { browseReason } = await import('./project-browse-sheet.ts');
const { localSessionData } = await import('./team-local-copy.ts');

const folder = (id: string, name: string, parentId: string | null = null, extra: Record<string, unknown> = {}) =>
  ({ id, name, parentId, items: [], createdAt: '', updatedAt: '', ...extra });

test('the chooser outline nests folders, sorts names, and leaves out shortcuts and shared copies', () => {
  const outline = folderOutline([
    folder('b', 'Beta'), folder('a', 'Alpha'), folder('a1', 'Zed', 'a'), folder('a0', 'Ant', 'a'),
    folder('s', 'Shortcut', null, { link: { instance: 'x', projectId: 'p' } }),
    folder('t', 'Shared copy', null, { teamCopy: { instance: 'x', projectId: 'p', complete: true, copied: {} } }),
  ] as never);
  assert.deepEqual(outline.map((r) => `${r.depth}:${r.name}`), ['0:Alpha', '1:Ant', '1:Zed', '0:Beta']);
});

test('Browse says why each project is there', () => {
  assert.equal(browseReason({ via: 'everyone' }), 'Shared with everyone');
  assert.equal(browseReason({ via: 'admin' }), 'You can open this as an admin');
  assert.equal(browseReason({ via: 'member', listed: 'hidden' }), 'Hidden from your projects');
});

test('a copied shared session keeps its inputs and gets its shared files under new local ids', async () => {
  const checksum = 'a'.repeat(64);
  const fileId = `fil_${'b'.repeat(22)}`;
  router = (url) => url.endsWith('/api/v1/projects/prj_1/files')
    ? json({ files: [{ id: fileId, projectId: 'prj_1', checksum, size: 3, name: 'logo.png', contentType: 'image/png', ready: true, asset: {} }] })
    : new Response('', { status: 404 });
  const stored = new Map<string, Record<string, unknown>>();
  stored.set(`user/team/${fileId}`, { id: `user/team/${fileId}`, version: checksum, format: 'png', type: 'image', blob: new Blob(['abc']) });
  const host = {
    assets: {
      async _getUserRecord(id: string) { return (stored.get(id) as never) ?? null; },
      async _uploadUserAsset(record: Record<string, unknown>) { stored.set(record.id as string, record); },
    },
  };
  const data = await localSessionData(host as never, {
    toolId: 'poster', toolVersion: '1.2.0', projectId: 'prj_1', meta: { label: 'Launch' },
    inputs: { title: 'Hi', logo: { source: 'user', id: `user/team/${fileId}`, pin: { version: checksum, format: 'png' } } },
  });
  assert.equal(data.__toolId, 'poster');
  assert.equal(data.__toolVersion, '1.2.0');
  assert.equal(data.__label, 'Launch');
  assert.equal(data.title, 'Hi');
  const logo = data.logo as { id: string };
  assert.match(logo.id, /^user\/upload\//, 'the copy no longer depends on the workspace cache');
  assert.ok(stored.has(logo.id), 'the bytes were copied under the new id');
});

test('a session with no shared files copies without touching the asset store', async () => {
  const data = await localSessionData({ assets: {} } as never, { toolId: 'qr-code', inputs: { url: 'https://example.com' } });
  assert.deepEqual(data, { url: 'https://example.com', __toolId: 'qr-code' });
});
