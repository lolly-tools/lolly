// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { fixture, style } from '../../../../tests/helpers/emoji-fixtures.ts';
import { emojiParams, parseEmojiParams } from '../../../../engine/src/emoji-style.ts';
import { createEmojiAPI } from './emoji.ts';
import type { EmojiStorage, EmojiAssetRecord } from './emoji-storage.ts';
import { buildLollyFile, ingestLollyFile } from '../lib/lolly-pack.ts';
import type { BeamPackHost } from '../lib/beam-pack.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

function memory() {
  const records = new Map<string, EmojiAssetRecord>();
  const sessions = new Map<string, unknown>();
  const assets: EmojiStorage = {
    query: async () => [],
    get: async id => { const record = records.get(id); if (!record) throw new Error('No network in this host.');
      return { source: 'user', id, type: 'data', format: 'json', meta: record.meta } as AssetRef; },
    bytes: async ref => new Uint8Array(await records.get(typeof ref === 'string' ? ref : ref.id)!.blob!.arrayBuffer()),
    _exportUserAssets: async () => [...records.values()],
    _uploadUserAsset: async record => { records.set(record.id, record); },
    _getUserRecord: async id => records.get(id) ?? null,
  };
  const state = { list: async () => [...sessions.keys()].map(slot => ({ slot })), load: async (slot: string) => sessions.get(slot),
    save: async (slot: string, data: unknown) => { sessions.set(slot, data); }, delete: async (slot: string) => { sessions.delete(slot); } };
  return { assets, state, records, sessions };
}
const f = await fixture();
const bundle = { schemaVersion: 1 as const, kind: 'emoji-pack-bundle' as const, manifest: new TextDecoder().decode(f.bytes), artwork: { '1f600.svg': new TextDecoder().decode(f.artwork) } };
const bytes = () => new TextEncoder().encode(JSON.stringify(bundle));

test('imported emoji packs survive .lolly on a fresh offline host with exact style and artwork', async () => {
  const dom = new JSDOM('');
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = dom.window.DOMParser;
  try {
    const sender = memory(); const source = createEmojiAPI(sender.assets);
    const info = await source.install!(bytes());
    const chosen = style(info.pin); chosen.treatment = { mode: 'mono', strengthBps: 10000, recipe: 'emoji-treatment-v1', palette: [{ id: 'brand', hex: '#123456' }] };
    const session = { __toolId: 'design', __emoji: emojiParams(chosen), __emojiAssets: await source.dependencies!([info.pin]), title: '\u{1f600}' };
    const saved = await buildLollyFile({ session, toolId: 'design', userAssets: [...sender.records.values()] });
    assert.equal(saved.manifest.counts.assets, 1);
    const receiver = memory();
    await ingestLollyFile(new Uint8Array(await saved.blob.arrayBuffer()), receiver as unknown as BeamPackHost);
    const api = createEmojiAPI(receiver.assets);
    const reopened = [...receiver.sessions.values()][0] as typeof session;
    assert.deepEqual(parseEmojiParams(reopened.__emoji, await api.sets(), []).style, chosen);
    assert.deepEqual(await api.manifest(info.pin), new Uint8Array(f.bytes));
    assert.deepEqual(await api.artwork(info.pin, f.manifest.glyphs[0]!.asset), new Uint8Array(f.artwork));
    assert.equal((await api.sets()).length, 1);
  } finally { globalThis.DOMParser = previous; dom.window.close(); }
});

test('custom pack admission rejects modified artwork before creating any record', async () => {
  const dom = new JSDOM(''); const previous = globalThis.DOMParser; globalThis.DOMParser = dom.window.DOMParser;
  try {
    const target = memory(); const api = createEmojiAPI(target.assets);
    const bad = { ...bundle, artwork: { '1f600.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' } };
    await assert.rejects(api.install!(new TextEncoder().encode(JSON.stringify(bad))), /checksum|digest|match/i);
    assert.equal(target.records.size, 0);
  } finally { globalThis.DOMParser = previous; dom.window.close(); }
});

// Several meanings share fixture artwork so closure selection can be checked
// without adding another upstream artwork file to the test suite.
async function multiSource(keys = ['1f600', '1f603', '1f604'], suffix = '') {
  const { encoded } = await import('../../../../tests/helpers/emoji-fixtures.ts');
  const { readEmojiBundle } = await import('../../../../engine/src/emoji-bundle.ts');
  const { storeEmojiBundle } = await import('./emoji-storage.ts');
  const manifest = structuredClone(f.manifest);
  manifest.id += suffix;
  manifest.glyphs = keys.map(key => ({ ...structuredClone(f.manifest.glyphs[0]!),
    meaning: { kind: 'unicode', key }, label: key,
    asset: { ...f.manifest.glyphs[0]!.asset, id: `${manifest.id}/${key}`, url: `${key}.svg` } }));
  const pack = { ...bundle, manifest: new TextDecoder().decode(encoded(manifest).bytes),
    artwork: Object.fromEntries(keys.map(key => [`${key}.svg`, bundle.artwork['1f600.svg']])) };
  const read = await readEmojiBundle(new TextEncoder().encode(JSON.stringify(pack)));
  const sender = memory();
  const ref = await storeEmojiBundle(sender.assets, pack, read.info);
  const session = { __toolId: 'design', __emoji: emojiParams(style(read.info.pin)), __emojiAssets: [ref], __emojiUsage: [], text: '' };
  return { sender, session, read, manifest };
}
async function unpack(saved: Awaited<ReturnType<typeof buildLollyFile>>) {
  const { readLollyFile } = await import('../lib/lolly-pack.ts');
  const parsed = await readLollyFile(new Uint8Array(await saved.blob.arrayBuffer()));
  const packs = parsed.manifest.assets.filter(a => a.kind === 'asset' && a.meta?.emoji).map(a => {
    assert.equal(a.kind, 'asset');
    return JSON.parse(new TextDecoder().decode(parsed.files[a.path!]!)) as typeof bundle;
  });
  return { parsed, packs };
}

test('plain text exports omit chosen packs and ignore emoji in document metadata', async () => {
  const { sender, session } = await multiSource();
  const source = { ...session, text: 'One change. Every detail.', __label: '😀', metadata: { meta: { specimen: '😀' } } };
  const before = structuredClone(source);
  const saved = await buildLollyFile({ session: source, toolId: 'design', userAssets: [...sender.records.values()] });
  const { parsed, packs } = await unpack(saved);
  assert.equal(saved.manifest.counts.assets, 0);
  assert.deepEqual((parsed.session as typeof session).__emojiAssets, []);
  assert.deepEqual((parsed.session as typeof session).__emoji, session.__emoji);
  assert.deepEqual(packs, []);
  assert.deepEqual(source, before, 'saving leaves the editable session unchanged');
  assert.equal(Object.keys(JSON.parse(await [...sender.records.values()][0]!.blob!.text()).artwork).length, 3);
});

test('a document carries distinct used glyphs across timed layers and escaped rich text', async () => {
  const { sender, session, read } = await multiSource();
  const source = { ...session, text: '😀😀', boxes: [{ hidden: true, start: 12, text: '{"runs":[{"text":"\\ud83d\\ude03"}]}' }] };
  const saved = await buildLollyFile({ session: source, toolId: 'design', userAssets: [...sender.records.values()] });
  const { packs } = await unpack(saved);
  assert.equal(packs.length, 1);
  assert.equal(saved.manifest.minReader, 5, 'older hosts cannot merge document subsets safely');
  assert.deepEqual(Object.keys(packs[0]!.artwork), ['1f600.svg', '1f603.svg']);
  assert.equal(packs[0]!.manifest, read.bundle.manifest, 'manifest checksum, notices and source identity remain exact');
  const receiver = memory();
  await ingestLollyFile(new Uint8Array(await saved.blob.arrayBuffer()), receiver as unknown as BeamPackHost);
  const api = createEmojiAPI(receiver.assets);
  for (const glyph of read.manifest.glyphs.slice(0, 2)) assert.deepEqual(await api.artwork(read.info.pin, glyph.asset), new Uint8Array(f.artwork));
  assert.equal(await api.artwork(read.info.pin, read.manifest.glyphs[2]!.asset), null);
  const again = await buildLollyFile({ session: [...receiver.sessions.values()][0], toolId: 'design', userAssets: [...receiver.records.values()] });
  assert.deepEqual((await unpack(again)).packs, packs, 'repeated saves do not grow the subset');
});

test('render census preserves fixed template artwork, while explicit file inputs keep full bundles', async () => {
  const { sender, session, read } = await multiSource();
  const fixed = { ...session, __toolId: 'chart', __emojiUsage: [{ packId: read.info.pin.id, version: read.info.pin.pin.version, checksum: read.info.pin.checksum, assetId: read.manifest.glyphs[1]!.asset.id }] };
  const saved = await buildLollyFile({ session: fixed, toolId: 'chart', userAssets: [...sender.records.values()] });
  assert.deepEqual(Object.keys((await unpack(saved)).packs[0]!.artwork), ['1f603.svg']);
  const explicit = await buildLollyFile({ session: { ...session, download: session.__emojiAssets[0] }, toolId: 'design', userAssets: [...sender.records.values()] });
  assert.equal(Object.keys((await unpack(explicit)).packs[0]!.artwork).length, 3);
});

test('project sessions and saved templates contribute their union of glyphs once', async () => {
  const { sender, session } = await multiSource();
  const one = { ...session, text: '😀' }, two = { ...session, text: '😃' };
  const input = { session: one, toolId: 'design', userAssets: [...sender.records.values()] };
  const template = { id: 't', name: 'Second', toolId: 'design', createdAt: '', updatedAt: '', values: two };
  const saved = await buildLollyFile({ ...input, templates: [template] });
  assert.deepEqual(Object.keys((await unpack(saved)).packs[0]!.artwork), ['1f600.svg', '1f603.svg']);
  const project = await buildLollyFile({ ...input, session: null, kind: 'project', project: { name: 'Test',
    folders: [{ id: 'root', name: 'Test', parentId: null, items: [{ type: 'session', ref: 'a' }, { type: 'session', ref: 'b' }] }],
    sessions: [{ key: 'a', toolId: 'design', data: one }, { key: 'b', toolId: 'design', data: two }] } });
  assert.equal(project.manifest.counts.assets, 1);
  assert.deepEqual(Object.keys((await unpack(project)).packs[0]!.artwork), ['1f600.svg', '1f603.svg']);
});

test('multiple imported subsets remain visible under one exact pack pin', async () => {
  const { sender, session, read } = await multiSource();
  const receiver = memory();
  const api = createEmojiAPI(receiver.assets);
  for (const text of ['😀', '😃']) {
    const saved = await buildLollyFile({ session: { ...session, text }, toolId: 'design', userAssets: [...sender.records.values()] });
    await ingestLollyFile(new Uint8Array(await saved.blob.arrayBuffer()), receiver as unknown as BeamPackHost);
    await api.sets();
  }
  assert.equal((await api.sets()).length, 1);
  for (const glyph of read.manifest.glyphs.slice(0, 2)) assert.deepEqual(await api.artwork(read.info.pin, glyph.asset), new Uint8Array(f.artwork));
  const refs = await api.dependencies!([read.info.pin]);
  const saved = await buildLollyFile({ session: { ...session, text: '😀😃', __emojiAssets: refs }, toolId: 'design', userAssets: [...receiver.records.values()] });
  assert.deepEqual(Object.keys((await unpack(saved)).packs[0]!.artwork), ['1f600.svg', '1f603.svg']);
});

test('missing or corrupt used artwork fails export, and removing emoji drops the dependency', async () => {
  const { sender, session } = await multiSource();
  const saved = await buildLollyFile({ session: { ...session, text: '😀' }, toolId: 'design', userAssets: [...sender.records.values()] });
  const receiver = memory();
  await ingestLollyFile(new Uint8Array(await saved.blob.arrayBuffer()), receiver as unknown as BeamPackHost);
  const reopened = [...receiver.sessions.values()][0] as typeof session;
  await assert.rejects(buildLollyFile({ session: { ...reopened, text: '😃' }, toolId: 'design', userAssets: [...receiver.records.values()] }), /Restore the saved artwork/);
  const record = [...receiver.records.values()][0]!;
  const data = JSON.parse(await record.blob!.text()); data.artwork['1f600.svg'] += 'modified';
  record.blob = new Blob([JSON.stringify(data)]);
  await assert.rejects(buildLollyFile({ session: reopened, toolId: 'design', userAssets: [...receiver.records.values()] }), /failed verification/);
  const cleared = await buildLollyFile({ session: { ...reopened, text: 'Done.' }, toolId: 'design', userAssets: [...receiver.records.values()] });
  assert.equal(cleared.manifest.counts.assets, 0);
});

test('text presentation selectors carry no artwork, and ordered fallback retains only used SVGs', async () => {
  const { sender, session } = await multiSource();
  const plain = await buildLollyFile({ session: { ...session, text: '\u00a9\ufe0e' }, toolId: 'design', userAssets: [...sender.records.values()] });
  assert.equal(plain.manifest.counts.assets, 0);
  const fallback = await multiSource(['1f603'], '/fallback');
  const primary = await multiSource(['1f600']);
  const chosen = style(primary.read.info.pin, [fallback.read.info.pin]);
  const saved = await buildLollyFile({ session: { ...primary.session, __emoji: emojiParams(chosen),
    __emojiAssets: [...primary.session.__emojiAssets, ...fallback.session.__emojiAssets], text: '😃' }, toolId: 'design',
    userAssets: [...primary.sender.records.values(), ...fallback.sender.records.values()] });
  const { packs } = await unpack(saved);
  assert.deepEqual(packs.map(pack => Object.keys(pack.artwork)), [[], ['1f603.svg']]);
  const receiver = memory();
  await ingestLollyFile(new Uint8Array(await saved.blob.arrayBuffer()), receiver as unknown as BeamPackHost);
  const api = createEmojiAPI(receiver.assets);
  assert.deepEqual(parseEmojiParams(emojiParams(chosen), await api.sets(), []).style, chosen);
  assert.deepEqual(await api.artwork(fallback.read.info.pin, fallback.manifest.glyphs[0]!.asset), new Uint8Array(f.artwork));
});

// A pack the catalog serves is named in the document, not held by it. The file still has
// to open offline with its own artwork, so the used glyphs are read from the catalog.
async function catalogSource(keys = ['1f600', '1f603', '1f604']) {
  const multi = await multiSource(keys);
  const file = new TextEncoder().encode(JSON.stringify({ ...JSON.parse(await [...multi.sender.records.values()][0]!.blob!.text()) }));
  const version = multi.read.info.pin.pin.version;
  const ref = { source: 'library', id: multi.read.info.pin.id, type: 'data', format: 'json', version, pin: { version, format: 'json' } };
  const resolved: string[] = [];
  const resolveLibrary = async (id: string) => { resolved.push(id); return { bytes: file, mime: 'application/json', type: 'data', format: 'json', label: multi.read.info.label }; };
  return { ...multi, ref, file, resolved, resolveLibrary, session: { ...multi.session, __emojiAssets: [ref] } };
}

test('a catalog pack travels as the glyphs the document uses and opens offline on a fresh device', async () => {
  const { session, read, resolveLibrary, resolved } = await catalogSource();
  const source = { ...session, text: '😀' };
  const before = structuredClone(source);
  const saved = await buildLollyFile({ session: source, toolId: 'design', userAssets: [], resolveLibrary });
  assert.ok(resolved.length, 'the bytes came from the catalog, because the sender holds no copy');
  const { packs, parsed } = await unpack(saved);
  assert.deepEqual(packs.map(pack => Object.keys(pack.artwork)), [['1f600.svg']], 'one glyph, never the set');
  assert.equal(packs[0]!.manifest, read.bundle.manifest, 'with the exact manifest, so the pin still holds');
  assert.equal(parsed.manifest.assets.filter(a => a.kind === 'asset' && a.source === 'library').length, 0, 'and no whole catalog file rides along');
  assert.deepEqual(source, before, 'saving leaves the editable session unchanged');
  const receiver = memory();
  await ingestLollyFile(new Uint8Array(await saved.blob.arrayBuffer()), receiver as unknown as BeamPackHost);
  const api = createEmojiAPI(receiver.assets);
  assert.deepEqual(await api.artwork(read.info.pin, read.manifest.glyphs[0]!.asset), new Uint8Array(f.artwork));
  assert.equal(await api.artwork(read.info.pin, read.manifest.glyphs[1]!.asset), null);
});

test('a document with no emoji carries nothing from a catalog pack', async () => {
  const { session, resolveLibrary, resolved } = await catalogSource();
  const saved = await buildLollyFile({ session: { ...session, text: 'One change. Every detail.' }, toolId: 'design', userAssets: [], resolveLibrary });
  assert.equal(saved.manifest.counts.assets, 0);
  assert.deepEqual(resolved, [], 'the pack is not even read');
  assert.deepEqual(((await unpack(saved)).parsed.session as { __emojiAssets: unknown[] }).__emojiAssets, []);
});

test('a catalog pack with no way to read its bytes travels by name, without failing the export', async () => {
  const { session, ref } = await catalogSource();
  const saved = await buildLollyFile({ session: { ...session, text: '😀' }, toolId: 'design', userAssets: [] });
  const { parsed, packs } = await unpack(saved);
  assert.deepEqual(packs, []);
  assert.deepEqual((parsed.session as { __emojiAssets: unknown[] }).__emojiAssets, [ref], 'the document still names its set');
});

test('a caller that sends other catalog files by name can still carry the used glyphs', async () => {
  const { session, resolveLibrary } = await catalogSource();
  const saved = await buildLollyFile({ session: { ...session, text: '😃' }, toolId: 'design', userAssets: [], resolveEmojiPack: resolveLibrary });
  assert.deepEqual((await unpack(saved)).packs.map(pack => Object.keys(pack.artwork)), [['1f603.svg']]);
});

test('a catalog pack the sender\'s rules hold back stays out of the file', async () => {
  const { session, resolveLibrary } = await catalogSource();
  const held = async (id: string) => ({ ...await resolveLibrary(id), licensed: true, holdReason: 'a rule' });
  const withheld = await buildLollyFile({ session: { ...session, text: '😀' }, toolId: 'design', userAssets: [], resolveLibrary: held });
  assert.deepEqual((await unpack(withheld)).packs, []);
  assert.equal(withheld.manifest.assets.some(asset => asset.kind === 'asset'), false);
  const chosen = await buildLollyFile({ session: { ...session, text: '😀' }, toolId: 'design', userAssets: [], resolveLibrary: held, includeLicensed: true });
  assert.deepEqual((await unpack(chosen)).packs.map(pack => Object.keys(pack.artwork)), [['1f600.svg']], 'the sender can still choose to carry it');
});

test('with no render census the whole catalog set travels, as a held pack does', async () => {
  const { session, resolveLibrary } = await catalogSource();
  const { __emojiUsage: _dropped, ...unknownCensus } = { ...session, __toolId: 'chart', text: 'No emoji typed here.' };
  const saved = await buildLollyFile({ session: unknownCensus, toolId: 'chart', userAssets: [], resolveLibrary });
  assert.equal(Object.keys((await unpack(saved)).packs[0]!.artwork).length, 3, 'a template can draw fixed emoji its inputs do not show');
});
