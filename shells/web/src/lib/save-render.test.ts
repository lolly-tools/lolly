// SPDX-License-Identifier: MPL-2.0
/**
 * WP-B - the "save every render into my library" helper (lib/save-render.ts).
 *
 * Run directly:  node --test shells/web/src/lib/save-render.test.ts
 *
 * jsdom with a real origin so importing the confirm-dialog/modal chain the
 * helper pulls in never trips on `about:blank`. The confirm decision itself is
 * driven through the injectable `confirm` seam - no live modal is mounted - so
 * the prompt path is deterministic.
 *
 * What is pinned here:
 *   - the size policy (image auto / audio auto / video always confirms /
 *     anything over the threshold confirms),
 *   - the profile toggle off-switch suppresses the save entirely,
 *   - checksum dedupe: identical bytes land ONE 'renders' asset, never two,
 *   - the saved blob is byte-identical to the downloaded blob (the provenance
 *     gate: the credentialed bytes are stored verbatim).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const {
  renderKindForFormat, renderSavePolicy, RENDER_SAVE_MAX_BYTES,
  saveRenderToLibrary,
} = await import('./save-render.ts');

interface StoredRecord {
  id: string; type: string; format: string; blob: Blob; checksum?: string;
  meta: Record<string, unknown>;
}
function makeHost(saveRenders?: boolean) {
  const store: StoredRecord[] = [];
  const host = {
    assets: {
      async _uploadUserAsset(rec: StoredRecord) { store.push(rec); },
      async _listUserAssets() { return store.map(r => ({ checksum: r.checksum, meta: r.meta })); },
    },
    profile: { async get() { return { saveRenders }; } },
  };
  return { host, store };
}

const bytesEqual = async (a: Blob, b: Blob) => {
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const ua = new Uint8Array(x), ub = new Uint8Array(y);
  if (ua.length !== ub.length) return false;
  return ua.every((v, i) => v === ub[i]);
};

test('renderKindForFormat classifies by format', () => {
  assert.equal(renderKindForFormat('png'), 'image');
  assert.equal(renderKindForFormat('JPG'), 'image');
  assert.equal(renderKindForFormat('svg'), 'image');
  assert.equal(renderKindForFormat('wav'), 'audio');
  assert.equal(renderKindForFormat('mp3'), 'audio');
  assert.equal(renderKindForFormat('mp4'), 'video');
  assert.equal(renderKindForFormat('webm'), 'video');
  assert.equal(renderKindForFormat('pdf'), 'other');
  assert.equal(renderKindForFormat('zip'), 'other');
});

test('renderSavePolicy: image + audio auto-save, video + over-threshold confirm', () => {
  const small = 1024;
  const big = RENDER_SAVE_MAX_BYTES + 1;
  assert.equal(renderSavePolicy('image', small), 'auto');
  assert.equal(renderSavePolicy('audio', small), 'auto');
  assert.equal(renderSavePolicy('other', small), 'auto');
  // A video always asks, regardless of size.
  assert.equal(renderSavePolicy('video', small), 'confirm');
  assert.equal(renderSavePolicy('video', big), 'confirm');
  // Anything over the threshold asks, even an image.
  assert.equal(renderSavePolicy('image', big), 'confirm');
  assert.equal(renderSavePolicy('audio', big), 'confirm');
});

test('auto path: a small image saves one credentialed asset tagged renders', async () => {
  const { host, store } = makeHost();
  const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' });
  const res = await saveRenderToLibrary(host, { blob, format: 'png', toolId: 'qr-code', name: 'my-code', width: 512, height: 512 });
  assert.equal(res, 'saved');
  assert.equal(store.length, 1);
  const rec = store[0]!;
  assert.equal(rec.type, 'raster');
  assert.equal(rec.format, 'png');
  assert.deepEqual(rec.meta.tags, ['renders']);
  assert.equal(rec.meta.toolId, 'qr-code');
  assert.equal(rec.meta.dimensions, '512×512');
  assert.ok(typeof rec.checksum === 'string' && rec.checksum!.length > 0);
});

test('provenance gate: the saved blob is byte-identical to the downloaded blob', async () => {
  const { host, store } = makeHost();
  const blob = new Blob([new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])], { type: 'image/webp' });
  await saveRenderToLibrary(host, { blob, format: 'webp', toolId: 'chart-creator', name: 'chart' });
  assert.equal(store.length, 1);
  // Same reference AND same bytes - stored verbatim, no re-encode.
  assert.equal(store[0]!.blob, blob);
  assert.ok(await bytesEqual(store[0]!.blob, blob));
});

test('dedupe: identical bytes land exactly one renders asset', async () => {
  const { host, store } = makeHost();
  const b1 = new Blob([new Uint8Array([42, 42, 42, 42])], { type: 'image/png' });
  const b2 = new Blob([new Uint8Array([42, 42, 42, 42])], { type: 'image/png' }); // distinct object, same bytes
  const r1 = await saveRenderToLibrary(host, { blob: b1, format: 'png', toolId: 't', name: 'a' });
  const r2 = await saveRenderToLibrary(host, { blob: b2, format: 'png', toolId: 't', name: 'b' });
  assert.equal(r1, 'saved');
  assert.equal(r2, 'skipped-dupe');
  assert.equal(store.length, 1);
});

test('dedupe leaves DIFFERENT bytes as separate assets', async () => {
  const { host, store } = makeHost();
  const b1 = new Blob([new Uint8Array([1, 1, 1])], { type: 'image/png' });
  const b2 = new Blob([new Uint8Array([2, 2, 2])], { type: 'image/png' });
  await saveRenderToLibrary(host, { blob: b1, format: 'png', toolId: 't', name: 'a' });
  await saveRenderToLibrary(host, { blob: b2, format: 'png', toolId: 't', name: 'b' });
  assert.equal(store.length, 2);
});

test('toggle off: saveRenders === false suppresses the save entirely', async () => {
  const { host, store } = makeHost(false);
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  const res = await saveRenderToLibrary(host, { blob, format: 'png', toolId: 't', name: 'a' });
  assert.equal(res, 'skipped-off');
  assert.equal(store.length, 0);
});

test('toggle unset defaults ON (a render still saves)', async () => {
  const { host, store } = makeHost(undefined);
  const blob = new Blob([new Uint8Array([5, 5, 5])], { type: 'image/png' });
  const res = await saveRenderToLibrary(host, { blob, format: 'png', toolId: 't', name: 'a' });
  assert.equal(res, 'saved');
  assert.equal(store.length, 1);
});

test('video prompts: decline (Esc/Cancel) saves nothing, accept saves', async () => {
  const vid = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])], { type: 'video/webm' });

  // Declined - no asset written, and the confirm saw the real byte size.
  const declined = makeHost();
  let sawSize = -1;
  const dRes = await saveRenderToLibrary(declined.host, { blob: vid, format: 'webm', toolId: 't', name: 'clip' }, async (size) => { sawSize = size; return false; });
  assert.equal(dRes, 'declined');
  assert.equal(declined.store.length, 0);
  assert.equal(sawSize, vid.size);

  // Accepted - the video is saved as an audio/video-kind 'renders' asset.
  const accepted = makeHost();
  const aRes = await saveRenderToLibrary(accepted.host, { blob: vid, format: 'webm', toolId: 't', name: 'clip' }, async () => true);
  assert.equal(aRes, 'saved');
  assert.equal(accepted.store.length, 1);
  assert.equal(accepted.store[0]!.type, 'video');
});

test('over-threshold image prompts too (not just video)', async () => {
  const { host, store } = makeHost();
  // A blob that reports an over-threshold size without allocating 50 MB.
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  Object.defineProperty(blob, 'size', { value: RENDER_SAVE_MAX_BYTES + 1 });
  let asked = false;
  const res = await saveRenderToLibrary(host, { blob, format: 'png', toolId: 't', name: 'big' }, async () => { asked = true; return false; });
  assert.equal(asked, true);
  assert.equal(res, 'declined');
  assert.equal(store.length, 0);
});
