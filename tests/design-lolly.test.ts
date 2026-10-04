// SPDX-License-Identifier: MPL-2.0
/**
 * `packageDesign` (plan 291 W8): a Design document as a `.lolly` the app reopens.
 * Synthetic documents and pictures only, so the test is public and content-free: the
 * catalog is passed in, and the tool version too.
 *
 * Covered: keyed pictures rewritten to upload refs and carried; the session markers
 * (label, export name, size, tool); the readback; one document always writing the
 * same bytes; upload refs from a folder and from a source `.lolly`; `photo:<sha12>`
 * placeholders resolved by hash prefix; and every refusal
 * with its code.
 *
 * Run with: node --test tests/design-lolly.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DesignPackageError, designInputShape, mediaHashPrefixOfKey, packageDesign, packageTime, type DesignPackageOptions } from '../packages/node-shell/src/design-lolly.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';
import { designSessionFromCompiled } from '../packages/node-shell/src/rebrand/pipeline.ts';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const PNG = (tag: number): Uint8Array => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag, 1, 2, 3]);
const JPG = (tag: number): Uint8Array => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, tag, 9, 8, 7]);
const CATALOG = { profile: 'test', assets: [{ id: 'brand/logo/primary' }, { id: 'brand/icons/star' }] };
const AT = '2026-10-03T08:00:00.000Z';
const BASE: DesignPackageOptions = { catalog: CATALOG, toolVersion: '9.9.9', exportedAt: AT };

/** Two frames, one off the origin; a placeholder photo, a catalog logo, a themed icon, a path. */
function doc(): Array<Record<string, unknown>> {
  return [
    { id: 'a', kind: 'frame', name: 'One', x: 0, y: 0, w: 1280, h: 720, rot: 0, shape: 'rect', bg: '#ffffff' },
    { id: 'a-photo', kind: 'image', frame: 'a', x: 0, y: 0, w: 1280, h: 720, rot: 0, image: 'photo:hero', fit: 'cover' },
    { id: 'a-logo', kind: 'image', frame: 'a', x: 40, y: 40, w: 200, h: 60, rot: 0, image: 'brand/logo/primary' },
    { id: 'a-title', kind: 'text', frame: 'a', x: 40, y: 200, w: 900, h: 80, rot: 0, text: 'Hello' },
    { id: 'b', kind: 'frame', name: 'Two', x: 1400, y: 0, w: 1280, h: 720, rot: 0, shape: 'rect', bg: '#000000' },
    { id: 'b-icon', kind: 'image', frame: 'b', x: 1440, y: 40, w: 64, h: 64, rot: 0, image: 'brand/icons/star?theme=brand' },
    { id: 'b-photo', kind: 'image', frame: 'b', x: 1400, y: 0, w: 640, h: 720, rot: 0, image: 'photo:hero' },
  ];
}

async function refusal(promise: Promise<unknown>, code: string): Promise<DesignPackageError> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof DesignPackageError, `expected a DesignPackageError, got ${err}`);
    assert.equal(err.code, code, err.message);
    return err;
  }
  assert.fail(`expected ${code}`);
}

test('designInputShape tells a Design document from a compiled document', () => {
  assert.equal(designInputShape([]), 'design');
  assert.equal(designInputShape({ boxes: [] }), 'design');
  assert.equal(designInputShape({ values: { boxes: [] } }), 'design');
  assert.equal(designInputShape({ toolId: 'qr-code', hydrated: {}, values: { boxes: [] } }), 'compiled');
  assert.equal(designInputShape({ document: { toolId: 'qr-code' }, model: [], warnings: [] }), 'compiled');
  assert.equal(designInputShape({ values: {} }), 'other');
  assert.equal(designInputShape('boxes'), 'other');
});

test('keyed pictures become upload refs, carried once, and the file reads back whole', async () => {
  const hero = JPG(1);
  const { bytes, report } = await packageDesign(doc(), { ...BASE, assets: [{ key: 'photo:hero', bytes: hero, name: 'hero.jpg' }], label: 'Quarterly review' });
  const ref = `user/media/${sha(hero)}`;
  const back = readLollyFile(bytes);
  assert.equal(back.manifest.kind, 'session');
  assert.equal(back.manifest.tool.id, 'design');
  assert.equal(back.manifest.tool.version, '9.9.9');
  assert.equal(back.manifest.exportedAt, AT);
  const boxes = back.session.boxes as Array<Record<string, unknown>>;
  assert.equal(boxes.length, 7);
  assert.deepEqual(boxes[1]!.image, { id: ref, source: 'user' });
  assert.deepEqual(boxes[6]!.image, { id: ref, source: 'user' });
  assert.equal(boxes[2]!.image, 'brand/logo/primary', 'a catalog id is left as written');
  assert.deepEqual(Object.keys(boxes[1]!), Object.keys(doc()[1]!), 'the row keeps its key order');
  const part = back.files.get(`assets/uploads/${sha(hero)}.jpg`);
  assert.deepEqual(part && [...part], [...hero]);
  assert.equal(back.session.__toolId, 'design');
  assert.equal(back.session.__toolVersion, '9.9.9');
  assert.equal(back.session.__label, 'Quarterly review');
  assert.equal(back.session.__export_filename, 'Quarterly review');
  assert.equal(back.session.__export_width, '1280');
  assert.equal(back.session.__export_height, '720');
  assert.equal(back.session.__export_unit, 'px');

  assert.equal(report.format, 'lolly-package');
  assert.equal(report.bytes, bytes.byteLength);
  assert.equal(report.sha256, sha(bytes));
  assert.equal(report.artboards, 2);
  assert.equal(report.layers, 7);
  assert.deepEqual(report.size, { width: 1280, height: 720, unit: 'px' });
  assert.deepEqual(report.media, [{ ref, sha256: sha(hero), mime: 'image/jpeg', bytes: hero.length, origin: 'asset', keys: ['photo:hero'], layers: ['a-photo', 'b-photo'] }]);
  assert.deepEqual(report.references, { profile: 'test', catalog: 2, unchecked: 0, external: 0, unknown: [] });
  assert.deepEqual(report.readback, { ok: true, layers: 7, media: 1, label: 'Quarterly review', filename: 'Quarterly review' });
  assert.deepEqual(report.warnings, []);
});

test('one document always writes the same bytes, and SOURCE_DATE_EPOCH sets the time', async () => {
  const opts = { ...BASE, assets: [{ key: 'photo:hero', bytes: JPG(2) }] };
  const a = await packageDesign(doc(), opts);
  const b = await packageDesign(doc(), opts);
  assert.equal(sha(a.bytes), sha(b.bytes));
  assert.equal(packageTime({ SOURCE_DATE_EPOCH: '1790985600' }), '2026-10-03T00:00:00.000Z');
  assert.match(packageTime({}), /^\d{4}-\d\d-\d\dT/);
  // Before 1980 the zip entries are held at the format's first day; the manifest keeps the time given.
  const early = await packageDesign(doc(), { ...opts, exportedAt: '1970-01-01T00:00:00.000Z' });
  assert.equal(readLollyFile(early.bytes).manifest.exportedAt, '1970-01-01T00:00:00.000Z');
});

/** Every entry's DOS time and date, from the local headers and the central directory, as ISO text. */
function zipTimes(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const iso = (time: number, date: number): string =>
    `${(date >> 9) + 1980}-${String((date >> 5) & 15).padStart(2, '0')}-${String(date & 31).padStart(2, '0')}T` +
    `${String(time >> 11).padStart(2, '0')}:${String((time >> 5) & 63).padStart(2, '0')}:${String((time & 31) * 2).padStart(2, '0')}`;
  const end = bytes.byteLength - 22;
  let entry = view.getUint32(end + 16, true);
  const out: string[] = [];
  for (let i = 0; i < view.getUint16(end + 10, true); i += 1) {
    const local = view.getUint32(entry + 42, true);
    out.push(iso(view.getUint16(entry + 12, true), view.getUint16(entry + 14, true)), iso(view.getUint16(local + 10, true), view.getUint16(local + 12, true)));
    entry += 46 + view.getUint16(entry + 28, true) + view.getUint16(entry + 30, true) + view.getUint16(entry + 32, true);
  }
  return out;
}

test('the zip times are the UTC time of exportedAt in any time zone, a skipped local hour included', async () => {
  const opts = { ...BASE, assets: [{ key: 'photo:hero', bytes: JPG(2) }] };
  const was = process.env.TZ;
  try {
    // 01:30 UTC on 2026-03-29 is an hour the London clock skips.
    for (const exportedAt of [AT, '2026-03-29T01:30:00.000Z']) {
      const hashes = new Set<string>();
      for (const tz of ['UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo']) {
        process.env.TZ = tz;
        const { bytes, report } = await packageDesign(doc(), { ...opts, exportedAt });
        hashes.add(report.sha256);
        const times = zipTimes(bytes);
        assert.ok(times.length >= 4, 'every entry has a time in both headers');
        assert.deepEqual(new Set(times), new Set([exportedAt.slice(0, 19)]), `${tz}: ${times.join(', ')}`);
      }
      assert.equal(hashes.size, 1, `one ${exportedAt} writes one file in every time zone`);
    }
    process.env.TZ = 'Asia/Tokyo';
    const early = await packageDesign(doc(), { ...opts, exportedAt: '1970-01-01T00:00:00.000Z' });
    assert.deepEqual(new Set(zipTimes(early.bytes)), new Set(['1980-01-02T00:00:00']), 'the 1980 floor is a UTC day too');
  } finally {
    if (was === undefined) delete process.env.TZ;
    else process.env.TZ = was;
  }
});

test('a refusal names the remedies in the caller\'s words and a key that matched no layer', async () => {
  const typo = [{ key: 'photo:heor', bytes: JPG(4) }];
  const plain = await refusal(packageDesign(doc(), { ...BASE, assets: typo }), 'media.missing');
  assert.match(plain.message, /No layer names photo:heor \(did you mean photo:hero\?\), so that file was not used\./);
  assert.match(plain.message, /give each placeholder a file in assets, or set allowMissingMedia to write them as references\.$/i);
  assert.deepEqual(plain.detail?.unusedAssets, ['photo:heor']);
  const hints = { asset: 'give each placeholder a file with --asset=KEY=PATH', upload: 'give --asset-dir', allowMissing: 'pass --allow-missing-media' };
  const worded = await refusal(packageDesign(doc(), { ...BASE, hints }), 'media.missing');
  assert.match(worded.message, /Give each placeholder a file with --asset=KEY=PATH, or pass --allow-missing-media to write them as references\.$/);
  assert.doesNotMatch(worded.message, /No layer names/, 'no note when every key was used');
  const far = await refusal(packageDesign(doc(), { ...BASE, assets: [{ key: 'something/else', bytes: JPG(4) }] }), 'media.missing');
  assert.match(far.message, /No layer names something\/else, so that file was not used\./, 'no guess when nothing is close');
  const unknownLogo = doc().map((r) => (r.id === 'a-logo' ? { ...r, image: 'brand/logo/primry' } : r));
  const unknown = await refusal(packageDesign(unknownLogo, { ...BASE, assets: [{ key: 'photo:hero', bytes: JPG(5) }, { key: 'brand/logo/primary', bytes: PNG(5) }] }), 'reference.unknown'); // gitleaks:allow - synthetic image asset keys, not credentials
  assert.match(unknown.message, /No layer names brand\/logo\/primary \(did you mean brand\/logo\/primry\?\)/);
});

test('every input value is kept, and the label falls back to the session, the file stem, then Design', async () => {
  const assets = [{ key: 'photo:hero', bytes: JPG(3) }];
  const session = { values: { boxes: doc(), transition: 'fade', __label: 'Own name', __export_filename: 'Own file' } };
  const own = await packageDesign(session, { ...BASE, assets });
  const back = readLollyFile(own.bytes).session;
  assert.equal(back.transition, 'fade');
  assert.equal(back.__label, 'Own name');
  assert.equal(back.__export_filename, 'Own file', 'a session keeps its own export name');
  const relabelled = readLollyFile((await packageDesign(session, { ...BASE, assets, label: 'New name' })).bytes).session;
  assert.equal(relabelled.__label, 'New name');
  assert.equal(relabelled.__export_filename, 'New name', 'an explicit label names the export too');
  assert.equal((await packageDesign({ boxes: doc() }, { ...BASE, assets, fileStem: 'deck' })).report.label, 'deck');
  assert.equal((await packageDesign({ boxes: doc() }, { ...BASE, assets })).report.label, 'Design');
});

test('a label with punctuation is the document name as typed, so the app opens on it (plan 291 W8)', async () => {
  const assets = [{ key: 'photo:hero', bytes: JPG(3) }];
  const label = 'AI: are we sleepwalking into our next vendor lock-in?';
  const packed = await packageDesign(doc(), { ...BASE, assets, label });
  assert.equal(packed.report.filename, label, 'the report names the document as typed');
  const back = readLollyFile(packed.bytes).session;
  assert.equal(back.__label, label);
  assert.equal(back.__export_filename, label, 'the editor shows __export_filename as the title, so it is never made file-safe here');
  const own = await packageDesign({ boxes: doc(), __label: 'Q3: plan?' }, { ...BASE, assets });
  assert.equal(readLollyFile(own.bytes).session.__export_filename, 'Q3: plan?', 'a session label with no export name keeps its punctuation');
  const handoff = designSessionFromCompiled(
    { frames: [], report: { entries: [] }, planRevision: 'r', source: {}, lineage: {} } as never,
    { label, projectId: 'p' },
  );
  assert.equal(handoff.values.__export_filename, label, 'the rebrand handoff names the document as typed');
});

test('upload refs resolve from a keyed file with that hash, a folder, or a source .lolly', async () => {
  const photo = PNG(4);
  const hex = sha(photo);
  const rows = doc().map((r) => (r.image === 'photo:hero' ? { ...r, image: `user/media/${hex}` } : r));

  const keyed = await packageDesign(rows, { ...BASE, assets: [{ key: 'anything', bytes: photo }] });
  assert.deepEqual(keyed.report.media.map((m) => [m.origin, m.keys]), [['asset', ['anything']]]);
  assert.deepEqual(keyed.report.unusedAssets, []);

  const dir = await mkdtemp(join(tmpdir(), 'lolly-package-'));
  try {
    await writeFile(join(dir, `${hex}.png`), photo);
    const folder = await packageDesign(rows, { ...BASE, assetDir: dir });
    assert.deepEqual(folder.report.media.map((m) => m.origin), ['asset-dir']);
    const source = await packageDesign(rows, { ...BASE, source: { bytes: folder.bytes, name: 'earlier.lolly' } });
    assert.deepEqual(source.report.media.map((m) => [m.origin, m.ref]), [['source', `user/media/${hex}`]]);
    const boxes = readLollyFile(source.bytes).session.boxes as Array<Record<string, unknown>>;
    assert.deepEqual(boxes[1]!.image, { id: `user/media/${hex}`, source: 'user' }, 'a bare ref string becomes a user asset object');

    await writeFile(join(dir, `${'0'.repeat(64)}.png`), photo);
    const wrong = rows.map((r) => (r.id === 'a-photo' ? { ...r, image: `user/media/${'0'.repeat(64)}` } : r));
    await refusal(packageDesign(wrong, { ...BASE, assetDir: dir }), 'media.mismatch');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a placeholder ending in a hash prefix (photo:<sha12>) resolves from a folder or a source, when one picture matches', async () => {
  const photo = PNG(11);
  const hex = sha(photo);
  const key = `photo:${hex.slice(0, 12)}`;
  const rows = doc().map((r) => (r.image === 'photo:hero' ? { ...r, image: key } : r));
  assert.equal(mediaHashPrefixOfKey(key), hex.slice(0, 12));
  assert.equal(mediaHashPrefixOfKey('photo:hero'), null, 'a word is no hash');
  assert.equal(mediaHashPrefixOfKey('photo:abc'), null, 'fewer than 8 hex is no hash');
  assert.equal(mediaHashPrefixOfKey(`https:${hex.slice(0, 12)}`), null);

  const dir = await mkdtemp(join(tmpdir(), 'lolly-package-'));
  try {
    await writeFile(join(dir, `${hex}.png`), photo);
    const folder = await packageDesign(rows, { ...BASE, assetDir: dir });
    assert.deepEqual(folder.report.media.map((m) => [m.origin, m.ref, m.keys, m.layers]), [['asset-dir', `user/media/${hex}`, [key], ['a-photo', 'b-photo']]]);
    const boxes = readLollyFile(folder.bytes).session.boxes as Array<Record<string, unknown>>;
    assert.deepEqual(boxes[1]!.image, { id: `user/media/${hex}`, source: 'user' });
    assert.deepEqual(boxes[6]!.image, { id: `user/media/${hex}`, source: 'user' });

    const source = await packageDesign(rows, { ...BASE, source: { bytes: folder.bytes, name: 'earlier.lolly' } });
    assert.deepEqual(source.report.media.map((m) => [m.origin, m.keys]), [['source', [key]]]);

    // A second picture sharing the prefix makes the key ambiguous, so it stays unresolved.
    await writeFile(join(dir, `${hex.slice(0, 12)}${'f'.repeat(52)}.png`), PNG(12));
    const twice = await refusal(packageDesign(rows, { ...BASE, assetDir: dir }), 'media.missing');
    assert.match(twice.message, /assetDir/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  await refusal(packageDesign(rows, BASE), 'media.missing');
});

test('refusals carry their codes', async () => {
  const hero = [{ key: 'photo:hero', bytes: JPG(5) }];
  await refusal(packageDesign({ toolId: 'qr-code', hydrated: {} }, BASE), 'input.unsupported');
  await refusal(packageDesign({ values: {} }, BASE), 'input.unsupported');
  const missing = await refusal(packageDesign(doc(), BASE), 'media.missing');
  assert.match(missing.message, /photo:hero \(a-photo, b-photo\)/);
  await refusal(packageDesign(doc(), { ...BASE, assets: [{ key: 'photo:hero', bytes: new TextEncoder().encode('%PDF-1.7') }] }), 'asset.not-image');
  await refusal(packageDesign(doc(), { ...BASE, assets: [{ key: 'photo:hero', bytes: new Uint8Array() }] }), 'asset.invalid');
  await refusal(packageDesign(doc(), { ...BASE, assets: [{ key: 'photo:hero', bytes: JPG(5) }, { key: 'photo:hero', bytes: JPG(6) }] }), 'asset.invalid');
  await refusal(packageDesign(doc(), { ...BASE, assets: [...hero, { key: `user/media/${'1'.repeat(64)}`, bytes: PNG(1) }] }), 'media.mismatch');
  const unknownLogo = doc().map((r) => (r.id === 'a-logo' ? { ...r, image: 'brand/logo/retired' } : r));
  const unknown = await refusal(packageDesign(unknownLogo, { ...BASE, assets: hero }), 'reference.unknown'); // gitleaks:allow - synthetic image asset keys, not credentials
  assert.match(unknown.message, /brand\/logo\/retired \(a-logo\)/);
  const badPath = [...doc(), { id: 'p', kind: 'path', frame: 'a', x: 0, y: 0, w: 10, h: 10, path: 'not a path' }];
  await refusal(packageDesign(badPath, { ...BASE, assets: hero }), 'path.invalid');
  const upload = doc().map((r) => (r.id === 'a-photo' ? { ...r, image: `user/media/${'2'.repeat(64)}` } : r));
  await refusal(packageDesign(upload, { ...BASE, assets: hero }), 'media.missing');
});

test('allowMissingMedia writes unresolved pictures as references and says so', async () => {
  const rows = doc().map((r) => (r.id === 'a-logo' ? { ...r, image: 'brand/logo/retired' } : r));
  rows.push({ id: 'a-old', kind: 'image', frame: 'a', x: 0, y: 0, w: 10, h: 10, image: `user/media/${'3'.repeat(64)}` });
  const { bytes, report } = await packageDesign(rows, { ...BASE, allowMissingMedia: true, assets: [{ key: 'photo:spare', bytes: PNG(9) }] });
  assert.deepEqual(report.missingMedia, [
    { ref: `user/media/${'3'.repeat(64)}`, layers: ['a-old'] },
    { ref: 'photo:hero', layers: ['a-photo', 'b-photo'] },
  ]);
  assert.deepEqual(report.references.unknown, [{ ref: 'brand/logo/retired', layers: ['a-logo'] }]);
  assert.deepEqual(report.unusedAssets, ['photo:spare']);
  assert.deepEqual(report.warnings.map((w) => w.code).sort(), ['asset.unused', 'media.missing', 'media.missing', 'reference.unknown']);
  const back = readLollyFile(bytes);
  const refRow = (back.manifest.assets ?? []).find((a) => a.id === `user/media/${'3'.repeat(64)}`);
  assert.equal(refRow?.kind, 'asset-ref', 'an unresolved upload travels as a reference');
});

test('with no catalog, catalog ids are counted as unchecked rather than refused', async () => {
  const { report } = await packageDesign(doc(), { ...BASE, catalog: null, assets: [{ key: 'photo:hero', bytes: JPG(7) }] });
  assert.equal(report.references.unchecked, 2);
  assert.equal(report.references.catalog, 0);
  assert.equal(report.references.profile, undefined);
  assert.deepEqual(report.warnings.map((w) => w.code), ['reference.unchecked']);
});

test('the rebrand session names its export after its label', () => {
  const session = designSessionFromCompiled(
    { frames: [], report: { entries: [] }, planRevision: 'r', source: {}, lineage: {} } as never,
    { label: 'Deck rebranded', projectId: 'p' },
  );
  assert.equal(session.values.__export_filename, 'Deck rebranded');
});

test('authoring keys and macros are expanded before the file is written', async () => {
  const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
  const input = read('./fixtures/author/input.json');
  const expected = read('./fixtures/author/expected.json') as unknown[];
  const { bytes, report } = await packageDesign(input, { ...BASE, catalog: null, allowMissingMedia: true });
  assert.equal(report.expanded, true);
  const back = readLollyFile(bytes).session;
  assert.deepEqual(back.boxes, Array.isArray(expected) ? expected : (expected as { boxes: unknown[] }).boxes);
  assert.ok(!Object.keys(back).some((k) => k.startsWith('$')), 'no authoring key is stored');
  await refusal(packageDesign({ boxes: [{ id: 'x', $nope: 1 }] }, BASE), 'authoring.invalid');
});

test('with the brand tokens, colour references are stored as literals plus links, not as raw references (plan 291 W4)', async () => {
  const { createTokenSet } = await import('../engine/src/tokens.ts');
  const { readBlockRunBindings, readBlockTokenBindings } = await import('../engine/src/token-block-bindings.ts');
  const tokensDoc = {
    $themes: [
      { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
      { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
    ],
    base: { color: { $type: 'color', ramp: { n1: { $value: '#1d1d1d' }, n9: { $value: '#ffffff' }, a3: { $value: '#008657' } } } },
    light: { color: { $type: 'color', semantic: { surface: { $value: '{color.ramp.n9}' } }, role: { 'accent-ink': { $value: '{color.ramp.a3}' } } } },
    dark: { color: { $type: 'color', semantic: { surface: { $value: '{color.ramp.n1}' } }, role: { 'accent-ink': { $value: '{color.ramp.n9}' } } } },
  };
  const input = { boxes: [
    { id: 'a', $artboard: true, x: 0, y: 0, w: 1280, h: 720, bg: '{color.semantic.surface}' },
    { id: 't', $in: 'a', kind: 'text', x: 40, y: 40, w: 600, h: 80, fg: '#1d1d1d', text: 'An {@color.role.accent-ink w500|assumption}' },
  ] };
  const raw = await packageDesign(input, { ...BASE, catalog: null });
  const rawRows = readLollyFile(raw.bytes).session.boxes as Array<Record<string, unknown>>;
  assert.equal(rawRows[0]!.bg, '{color.semantic.surface}', 'without tokens the reference is left for the runtime');
  assert.ok(raw.report.warnings.some((w) => /colour\.deferred/.test(w.message)));

  const { bytes, report } = await packageDesign(input, { ...BASE, catalog: null, tokens: createTokenSet(tokensDoc, {}) });
  const rows = readLollyFile(bytes).session.boxes as Array<Record<string, unknown>>;
  assert.equal(rows[0]!.bg, '#ffffff');
  assert.equal(readBlockTokenBindings(rows[0]!.tokenLinks).bg?.ref, '{color.semantic.surface}');
  assert.equal(rows[1]!.text, 'An {#008657 w500|assumption}');
  assert.deepEqual(Object.keys(readBlockRunBindings(rows[1]!.tokenLinks)), ['008657']);
  assert.ok(!report.warnings.some((w) => /colour\.deferred/.test(w.message)), 'nothing is deferred');
});
