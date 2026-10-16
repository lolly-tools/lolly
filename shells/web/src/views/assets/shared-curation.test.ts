// SPDX-License-Identifier: MPL-2.0
/** Inspect, edit and review through the real DOM controls; extraction alone never writes. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountSharedMetadata } from './shared-metadata.ts';
import { prepareSharedTextReview } from './shared-text-index.ts';
import { _setBaseForTests } from '../../lib/instance.ts';
import type { AssetInspection } from '../../catalog/curation.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { inspectedFile } from '../../catalog/curation.ts';

const fileId = 'a'.repeat(24);
const ref: AssetRef = { id: 'ext/dam/art?file=' + fileId, source: 'library', type: 'vector', format: 'svg', url: '/catalog/ext/dam/art/preview?v=v1', version: 'v1',
  meta: { provider: 'dam', selectedFile: fileId, fileRole: 'rendition' } };
const value = (): AssetInspection => ({ id: 'ext/dam/art', provider: 'dam', type: 'vector', name: 'Artwork', version: 'v1', formats: [{ format: 'svg', url: '/catalog/ext/dam/art/preview' }], canEdit: true,
  meta: { providerLabel: '<Source>', providerOriginalsAvailable: false }, fields: { campaign: 'Launch' },
  fieldDefs: [{ id: 'campaign', label: 'Campaign', kind: 'text' }, { id: 'region', label: 'Region', kind: 'select', options: ['EMEA', 'APAC'] }],
  textIndex: { revision: 'revision-one', assetVersion: 'v1', status: 'none', characters: 0 },
  textIndexFiles: [{ id: fileId, name: 'preview.svg', format: 'svg', url: '/catalog/ext/dam/art/preview', role: 'rendition' }] });
function dom() {
  const env = new JSDOM('<body><dialog open><div id="root"></div></dialog></body>', { url: 'http://localhost/#/a' });
  for (const key of ['document', 'HTMLElement', 'HTMLFormElement', 'HTMLInputElement', 'HTMLSelectElement', 'FormData', 'Event'] as const) Object.defineProperty(globalThis, key, { value: env.window[key], configurable: true, writable: true });
  _setBaseForTests(''); return { env, root: env.window.document.getElementById('root')! };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 20));

test('source facts preserve unknown approval and render upstream values as literal text', async () => {
  const { env, root } = dom(), original = globalThis.fetch;
  globalThis.fetch = async () => Response.json(value());
  try {
    await mountSharedMetadata(root, ref, () => {});
    assert.match(root.textContent!, /<Source>/); assert.match(root.textContent!, /Unknown/);
    assert.match(root.textContent!, /Rendition/); assert.match(root.textContent!, /Unavailable through this connection/);
    assert.equal(root.querySelector('source'), null); assert.doesNotMatch(root.textContent!, /Approved in source/);
  } finally { globalThis.fetch = original; env.window.close(); }
});

test('a cached primary file is identifiable only when its format is unambiguous', () => {
  const cached = { ...ref, id: 'inst/art', url: 'blob:http://localhost/cache', meta: {} };
  assert.equal(inspectedFile(value(), cached)?.id, fileId);
  const multiple = value(); multiple.textIndexFiles!.push({ ...multiple.textIndexFiles![0]!, id: 'b'.repeat(24) });
  assert.equal(inspectedFile(multiple, cached), undefined);
});

test('cached Work files accept the current head number but refuse an older checksum', async () => {
  const { env, root } = dom(), original = globalThis.fetch;
  const snapshot = value(); snapshot.id = 'inst/art'; snapshot.version = '1'; snapshot.textIndex!.assetVersion = '';
  snapshot.textIndexFiles![0]!.checksum = 'new-checksum';
  globalThis.fetch = async () => Response.json(snapshot);
  const cached = { ...ref, id: 'inst/art', version: '1', url: 'blob:http://localhost/cache', meta: { originalChecksum: 'old-checksum' } };
  try {
    const old = await prepareSharedTextReview(cached, root, () => {}); old!.offer('old', 'digital'); assert.equal(root.querySelector('form'), null);
    const current = await prepareSharedTextReview({ ...cached, meta: { originalChecksum: 'new-checksum' } }, root, () => {});
    current!.offer('current', 'digital'); assert.ok(root.querySelector('form'));
  } finally { globalThis.fetch = original; env.window.close(); }
});

test('organisation fields retain failed edits and save only changed overlay fields', async () => {
  const { env, root } = dom(), original = globalThis.fetch, writes: any[] = []; let fail = true, refreshed = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === 'PUT') { writes.push(JSON.parse(String(init.body))); return Response.json({ ok: true }, { status: fail ? 403 : 200 }); }
    return Response.json(value());
  };
  try {
    await mountSharedMetadata(root, ref, () => { refreshed++; });
    const field = root.querySelector<HTMLInputElement>('[name="campaign"]')!, form = root.querySelector('form')!;
    field.value = 'Changed'; form.dispatchEvent(new env.window.Event('submit', { cancelable: true })); await tick();
    assert.equal(field.value, 'Changed'); assert.equal(field.disabled, false); assert.match(root.textContent!, /edits are still here/); assert.equal(refreshed, 0);
    fail = false; form.dispatchEvent(new env.window.Event('submit', { cancelable: true })); await tick();
    assert.deepEqual(writes, [{ fields: { campaign: 'Changed' } }, { fields: { campaign: 'Changed' } }]); assert.equal(refreshed, 1);
    assert.match(root.textContent!, /Metadata saved/);
    form.dispatchEvent(new env.window.Event('submit', { cancelable: true })); await tick(); assert.equal(writes.length, 2);
  } finally { globalThis.fetch = original; env.window.close(); }
});

test('read-only inspection has no editor and failed reads offer an explicit retry', async () => {
  const { env, root } = dom(), original = globalThis.fetch; let failing = false;
  globalThis.fetch = async () => failing ? new Response('', { status: 503 }) : Response.json({ ...value(), canEdit: false });
  try {
    await mountSharedMetadata(root, ref, () => {}); assert.equal(root.querySelector('form'), null); assert.match(root.textContent!, /Launch/);
    failing = true; await mountSharedMetadata(root, ref, () => {}); assert.match(root.textContent!, /could not be loaded/); assert.match(root.querySelector('button')!.textContent!, /Retry details/);
  } finally { globalThis.fetch = original; env.window.close(); }
});

test('review offers local text without a write, then submits corrected words for the selected rendition', async () => {
  const { env, root } = dom(), original = globalThis.fetch, writes: any[] = []; let refreshed = 0;
  globalThis.fetch = async (_input, init) => { if (init?.method === 'PUT') writes.push(JSON.parse(String(init.body))); return Response.json(init?.method === 'PUT' ? { ok: true } : value()); };
  try {
    const review = await prepareSharedTextReview(ref, root, () => { refreshed++; }); assert.ok(review);
    review.offer('recognised words', 'ocr'); assert.equal(writes.length, 0); assert.match(root.textContent!, /Nothing has been sent yet/);
    root.querySelector('textarea')!.value = 'corrected words'; root.querySelector('form')!.dispatchEvent(new env.window.Event('submit', { cancelable: true })); await tick();
    assert.deepEqual(writes, [{ sourceRevision: 'revision-one', text: 'corrected words', fileId, method: 'ocr' }]); assert.equal(refreshed, 1);
    assert.match(root.textContent!, /Reviewed text added/);
  } finally { globalThis.fetch = original; env.window.close(); }
});

test('changed files, stale saves, closed panels and workspace changes cannot silently publish', async () => {
  const { env, root } = dom(), original = globalThis.fetch; let changed = true, writes = 0;
  globalThis.fetch = async (_input, init) => { if (init?.method === 'PUT') { writes++; return Response.json({}, { status: 409 }); } const next = value(); if (changed) next.textIndex!.assetVersion = 'v2'; return Response.json(next); };
  try {
    const old = await prepareSharedTextReview(ref, root, () => {}); old!.offer('old', 'digital'); assert.equal(root.querySelector('form'), null); assert.match(root.textContent!, /no longer matches/);
    changed = false; const current = await prepareSharedTextReview(ref, root, () => {}); current!.offer('new', 'digital');
    root.querySelector('form')!.dispatchEvent(new env.window.Event('submit', { cancelable: true })); await tick();
    assert.match(root.textContent!, /source has changed/); assert.equal(root.querySelector('textarea')!.value, 'new'); assert.equal(writes, 1);
    _setBaseForTests('https://different.example'); root.querySelector('form')!.dispatchEvent(new env.window.Event('submit', { cancelable: true })); await tick(); assert.equal(writes, 1); _setBaseForTests('');
    root.closest('dialog')!.dispatchEvent(new env.window.Event('close')); current!.offer('late', 'ocr'); assert.equal(root.querySelector('textarea')!.value, 'new');
  } finally { globalThis.fetch = original; _setBaseForTests(''); env.window.close(); }
});

test('a curator can explicitly remove indexed text without sending the words or overwriting fields', async () => {
  const { env, root } = dom(), original = globalThis.fetch, writes: unknown[] = [];
  globalThis.fetch = async (_input, init) => { if (init?.method === 'PUT') { writes.push(JSON.parse(String(init.body))); return Response.json({ ok: true }); } const next = value(); next.textIndex!.status = 'current'; return Response.json(next); };
  try {
    await mountSharedMetadata(root, ref, () => {});
    root.querySelector<HTMLButtonElement>('[data-clear-index]')!.click(); await tick();
    assert.deepEqual(writes, [{ sourceRevision: 'revision-one', text: null }]); assert.match(root.textContent!, /Shared text removed/);
    assert.equal(root.querySelector<HTMLInputElement>('[name="campaign"]')!.value, 'Launch');
  } finally { globalThis.fetch = original; env.window.close(); }
});


test('metadata labels, values and select choices cannot create executable DOM', async () => {
  const { env, root } = dom(), original = globalThis.fetch;
  const payload = '<img src=x onerror=alert(1)>';
  globalThis.fetch = async () => Response.json({ ...value(), fields: { campaign: payload, region: payload }, fieldDefs: [
    { id: 'campaign', label: '<script>literal</script>', kind: 'text' },
    { id: 'region', label: 'Region', kind: 'select', options: [payload] },
  ] });
  try {
    await mountSharedMetadata(root, ref, () => {});
    assert.equal(root.querySelector<HTMLInputElement>('[name="campaign"]')!.value, payload);
    assert.equal(root.querySelector<HTMLSelectElement>('[name="region"]')!.value, payload);
    assert.match(root.textContent!, /<script>literal<\/script>/);
    assert.equal(root.querySelector('img, script'), null);
  } finally { globalThis.fetch = original; env.window.close(); }
});
