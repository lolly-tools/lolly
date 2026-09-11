// SPDX-License-Identifier: MPL-2.0
/**
 * User-supplied ICC profiles: ingest, storage, mounting, removal - and the
 * refusals.
 *
 * DOM-free. The host is an in-memory stand-in for the user-asset store with the
 * same four methods the real bridge exposes, so what these tests assert about
 * storage is what the bridge would be handed verbatim. The profiles are the
 * shared synthetic fixtures (tests/helpers/icc-fixture.ts) rather than the stock
 * ColorSync tree, so the suite is green on a box with no macOS profiles.
 *
 * The fuzz block is the point of the module's contract: `parseIccProfile` returns
 * null rather than throwing on ANY input, and this proves the layer above turns
 * that into one clean refusal with nothing written - a hostile `.icc` must not
 * leave a row in the panel or bytes in the storage meter.
 *
 * Run directly:  node --test shells/web/src/lib/color-profiles.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProfile, mft2, ascii, u32, oneWayProfileBytes,
} from '../../../../tests/helpers/icc-fixture.ts';
import { parseIccProfile, iccGamutSource } from '@lolly/engine';
import { getColorSpace } from '../components/color-spaces.ts';
import {
  ingestProfile, listProfiles, getProfile, activateProfile, activateProfileLimit,
  deactivateProfile, removeProfile, sourceFor, sourceForLimit, profileFor,
  parseProfileLimit, shortLabel, absentLabel, usableIntents, profileDigest,
  isIngestFailure, USER_PROFILE_PREFIX, INTENTS, _resetProfileCache,
} from './color-profiles.ts';
import type { ColorProfilesHost, ProfileEntry } from './color-profiles.ts';

// ── fixtures ──────────────────────────────────────────────────────────────────

/**
 * A four-ink printer profile that can be asked a gamut question. It carries the
 * perceptual (0) and relative (1) tables and NOT the saturation (2) one - the
 * ordinary structure of a real press profile, and what makes the disabled-intent
 * case testable without a second fixture.
 */
const pressBytes = (tint = 0x4000): Uint8Array => buildProfile({
  deviceClass: 'prtr', space: 'CMYK',
  tags: [
    ['A2B0', mft2(4, 3, [0x8000, 0x8080, 0x8080])],
    ['B2A0', mft2(3, 4, [tint, tint, tint, 0])],
    ['A2B1', mft2(4, 3, [0x8000, 0x8080, 0x8080])],
    ['B2A1', mft2(3, 4, [tint, tint, tint, 0])],
    // textDescriptionType: the ASCII count INCLUDES the trailing NUL.
    ['desc', [...ascii('desc'), 0, 0, 0, 0, ...u32(11), ...ascii('Test Press'), 0]],
  ],
});

/** An RGB display profile - mounts fine, simply has no ink to report. */
const displayBytes = (): Uint8Array => buildProfile({
  deviceClass: 'mntr', space: 'RGB ',
  tags: [
    ['A2B0', mft2(3, 3, [0x8000, 0x8080, 0x8080])],
    ['B2A0', mft2(3, 3, [0x8000, 0x8080, 0x8080])],
  ],
});

interface Stored { id: string; type: string; format: string; blob: Blob; meta?: Record<string, unknown> }

function fakeHost(): ColorProfilesHost & { store: Map<string, Stored> } {
  const store = new Map<string, Stored>();
  return {
    store,
    assets: {
      async _uploadUserAsset(rec) { store.set(rec.id, rec as Stored); },
      async _deleteUserAsset(id) { store.delete(id); },
      async _listUserAssets() { return [...store.values()].map(r => ({ id: r.id, type: r.type, meta: r.meta })); },
      async _getBlob(id) { return store.get(id)?.blob ?? null; },
    },
  };
}

const asFile = (bytes: Uint8Array, name = 'press.icc'): File =>
  new File([bytes as unknown as BlobPart], name, { type: 'application/vnd.iccprofile' });

const ok = (r: ProfileEntry | { error: string }): ProfileEntry => {
  assert.ok(!isIngestFailure(r as never), `expected an ingested profile, got ${JSON.stringify(r)}`);
  return r as ProfileEntry;
};

// ── ingest ────────────────────────────────────────────────────────────────────

test('ingest stores a profile as a user asset under its content digest', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const entry = ok(await ingestProfile(host, asFile(pressBytes())));

  assert.match(entry.digest, /^[0-9a-f]{16}$/, 'the digest is the id a limit link is written with');
  assert.equal(entry.assetId, `${USER_PROFILE_PREFIX}${entry.digest}`);
  assert.equal(entry.colourSpace, 'CMYK');
  assert.equal(entry.deviceClass, 'prtr');
  assert.equal(entry.channels, 4);
  assert.equal(entry.description, 'Test Press', 'the profile names itself; the filename is only a fallback');
  assert.equal(entry.name, 'press.icc');
  assert.ok(entry.intents.length > 0);

  const rec = host.store.get(entry.assetId)!;
  assert.ok(rec, 'the bytes must be on the user-asset rail, not in a store of their own');
  assert.equal(rec.type, 'profile');
  assert.equal(rec.format, 'icc');
  assert.equal(rec.meta?.channels, 4);
  assert.deepEqual(rec.meta?.intents, entry.intents, 'the row renders from meta alone - no re-parse to draw it');
});

test('the stored digest is the one iccGamutSource mints - a shared link matches by construction', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const bytes = pressBytes();
  const entry = ok(await ingestProfile(host, asFile(bytes)));
  const direct = iccGamutSource(parseIccProfile(bytes)!, 'relative');
  assert.equal(direct.id, `icc:${entry.digest}:relative`);
  assert.equal(profileDigest(parseIccProfile(bytes)!), entry.digest);
});

test('re-adding the same bytes overwrites rather than duplicating', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const a = ok(await ingestProfile(host, asFile(pressBytes(), 'first.icc')));
  const b = ok(await ingestProfile(host, asFile(pressBytes(), 'second.icc')));
  assert.equal(a.digest, b.digest);
  assert.equal(host.store.size, 1, 'content-addressed: one file, one row');
  assert.equal((await listProfiles(host)).length, 1);
});

test('different bytes are different profiles', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const a = ok(await ingestProfile(host, asFile(pressBytes(0x4000))));
  const b = ok(await ingestProfile(host, asFile(pressBytes(0x5000))));
  assert.notEqual(a.digest, b.digest);
  assert.equal(host.store.size, 2);
});

test('an RGB display profile mounts - it is a comparison target with no ink', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const entry = ok(await ingestProfile(host, asFile(displayBytes(), 'monitor.icc')));
  assert.equal(entry.deviceClass, 'mntr');
  const src = await activateProfile(host, entry.digest, entry.activeIntent);
  assert.ok(src);
  assert.equal(src!.inkCoverage!(0.5, 0.05, 30), null, 'additive light has no total ink');
});

// ── the two refusals ──────────────────────────────────────────────────────────

test('a profile that can answer no intent is refused and NOT stored', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const r = await ingestProfile(host, asFile(oneWayProfileBytes(), 'oneway.icc'));
  assert.ok(isIngestFailure(r));
  assert.equal((r as { error: string }).error, 'no-gamut');
  assert.equal(host.store.size, 0, 'a row we can say nothing about must not reach the storage meter');
});

test('hostile and malformed bytes are one clean refusal, never an exception', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const good = pressBytes();
  const cases: Array<[string, Uint8Array]> = [
    ['zero length', new Uint8Array(0)],
    ['one byte', new Uint8Array([0])],
    ['header only, no acsp', new Uint8Array(128)],
    ['truncated mid-header', good.slice(0, 100)],
    ['truncated mid-tag-table', good.slice(0, 140)],
    ['truncated just short', good.slice(0, good.length - 1)],
    ['wrong magic', (() => { const b = good.slice(); b.set(ascii('nope'), 36); return b; })()],
    ['size field larger than the buffer', (() => {
      const b = good.slice(); b.set(u32(0x7fffff00), 0); return b;
    })()],
    ['size field zero', (() => { const b = good.slice(); b.set(u32(0), 0); return b; })()],
    ['absurd tag count', (() => { const b = good.slice(); b.set(u32(0x00ffffff), 128); return b; })()],
    ['all 0xff', new Uint8Array(512).fill(0xff)],
    ['text file', new TextEncoder().encode('this is definitely not a colour profile\n'.repeat(8))],
  ];
  for (const [why, bytes] of cases) {
    const r = await ingestProfile(host, asFile(bytes, `${why}.icc`));
    assert.ok(isIngestFailure(r), `${why}: must refuse`);
    assert.ok(
      ['unreadable', 'no-gamut'].includes((r as { error: string }).error),
      `${why}: the refusal must be one of the two the UI has a line for`,
    );
  }
  assert.equal(host.store.size, 0, 'nothing refused may be stored');
});

test('a profile with ONE corrupt tag is judged on what it can still answer', async () => {
  // Not a refusal test: a tag table where one entry points into space is a real
  // file that a reader may legitimately survive, and a press profile carries
  // several tables. What must hold either way is that ingest resolves, and that
  // anything it did accept is a coherent row backed by the exact bytes handed in.
  const good = pressBytes();
  const wounded: Array<[string, Uint8Array]> = [
    ['tag 0 offset off the end', (() => { const b = good.slice(); b.set(u32(0x7ffffff0), 128 + 8); return b; })()],
    ['tag 0 size absurd', (() => { const b = good.slice(); b.set(u32(0xfffffff0), 128 + 12); return b; })()],
    ['tag 0 signature junk', (() => { const b = good.slice(); b.set([0xff, 0xff, 0xff, 0xff], 132); return b; })()],
  ];
  for (const [why, bytes] of wounded) {
    _resetProfileCache();
    const host = fakeHost();
    const r = await ingestProfile(host, asFile(bytes, `${why}.icc`));
    if (isIngestFailure(r)) {
      assert.equal(host.store.size, 0, `${why}: a refusal stores nothing`);
      continue;
    }
    assert.match(r.digest, /^[0-9a-f]{16}$/, `${why}: an accepted profile still has a real identity`);
    assert.ok(r.intents.length > 0, `${why}: accepted means at least one intent answers`);
    const stored = host.store.get(r.assetId)!;
    assert.equal(stored.blob.size, bytes.byteLength, `${why}: the user's own bytes are what is kept`);
    const src = await activateProfile(host, r.digest, r.activeIntent);
    assert.ok(src && typeof src.contains(0.5, 0.05, 30) === 'boolean', `${why}: it answers rather than throwing`);
  }
  _resetProfileCache();
});

test('a blob whose bytes cannot be read is unreadable, not a crash', async () => {
  const host = fakeHost();
  const hostile = { arrayBuffer: () => Promise.reject(new Error('gone')) } as unknown as Blob;
  const r = await ingestProfile(host, hostile);
  assert.deepEqual(r, { error: 'unreadable' });
});

// ── list ──────────────────────────────────────────────────────────────────────

test('listing is newest first and ignores every other kind of user asset', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const old = ok(await ingestProfile(host, asFile(pressBytes(0x4000), 'old.icc')));
  host.store.get(old.assetId)!.meta!.addedAt = 1;
  const fresh = ok(await ingestProfile(host, asFile(pressBytes(0x5000), 'new.icc')));
  host.store.get(fresh.assetId)!.meta!.addedAt = 2;
  // The store also holds fonts, palettes and images - none of them are profiles.
  host.store.set('user/fonts/inter/0', { id: 'user/fonts/inter/0', type: 'font', format: 'woff2', blob: new Blob() });
  host.store.set('user/uploads/1', { id: 'user/uploads/1', type: 'raster', format: 'png', blob: new Blob() });

  const rows = await listProfiles(host);
  assert.deepEqual(rows.map(r => r.name), ['new.icc', 'old.icc']);
  assert.equal((await getProfile(host, old.digest))!.name, 'old.icc');
  assert.equal(await getProfile(host, 'deadbeefdeadbeef'), null);
});

// ── mounting ──────────────────────────────────────────────────────────────────

test('activating mounts a picker tab and answers gamut questions', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const entry = ok(await ingestProfile(host, asFile(pressBytes())));
  const src = await activateProfile(host, entry.digest, 'relative');
  assert.ok(src, 'a stored profile must mount');
  assert.equal(src!.id, `icc:${entry.digest}:relative`);
  assert.ok(getColorSpace(src!.id), 'mounting registers the space - the picker tab needs no enum edit');
  assert.equal(sourceFor(entry.digest)!.id, src!.id);
  assert.equal(sourceForLimit(src!.id)!.id, src!.id);
  assert.equal(typeof src!.contains(0.5, 0.05, 30), 'boolean');
  assert.ok(profileFor(entry.digest), 'the parsed profile is cached for the paper-white / device readouts');
  _resetProfileCache();
});

test('one intent at a time: switching unmounts the previous tab', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const entry = ok(await ingestProfile(host, asFile(pressBytes())));
  const rel = (await activateProfile(host, entry.digest, 'relative'))!;
  const per = (await activateProfile(host, entry.digest, 'perceptual'))!;
  assert.notEqual(rel.id, per.id, 'the same profile under another intent is another gamut');
  assert.equal(getColorSpace(rel.id), undefined, 'four tabs per profile would blow the output row apart');
  assert.ok(getColorSpace(per.id));
  assert.equal(sourceFor(entry.digest, 'relative'), null);
  assert.equal(sourceFor(entry.digest, 'perceptual')!.id, per.id);
  _resetProfileCache();
});

test('an intent the profile cannot answer mounts nothing rather than guessing', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const entry = ok(await ingestProfile(host, asFile(pressBytes())));
  const p = parseIccProfile(pressBytes())!;
  const missing = INTENTS.find(i => !usableIntents(p).includes(i));
  assert.ok(missing, 'fixture must lack at least one intent table');
  assert.equal(await activateProfile(host, entry.digest, missing!), null);
  assert.equal(getColorSpace(`icc:${entry.digest}:${missing}`), undefined);
});

test('deactivating unmounts the tab but keeps the file', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const entry = ok(await ingestProfile(host, asFile(pressBytes())));
  const src = (await activateProfile(host, entry.digest, 'relative'))!;
  deactivateProfile(entry.digest);
  assert.equal(getColorSpace(src.id), undefined);
  assert.equal(sourceFor(entry.digest), null);
  assert.equal(host.store.size, 1, 'unmounting is not deleting');
});

// ── shared links ──────────────────────────────────────────────────────────────

test('a limit id round-trips, and junk is refused', () => {
  assert.deepEqual(parseProfileLimit('icc:0123456789abcdef:relative'), { digest: '0123456789abcdef', intent: 'relative' });
  for (const bad of [
    'rec2020', 'icc:', 'icc:0123456789abcdef', 'icc:0123456789abcdef:rel',
    'icc:0123456789ABCDEF:relative', 'icc:0123456789abcde:relative',
    'icc:0123456789abcdef0:relative', 'icc:0123456789abcdef:perceptual ',
    'icc:../../etc:relative', '',
  ]) assert.equal(parseProfileLimit(bad), null, `${bad} must not parse as a profile limit`);
});

test('a link whose profile is not on this device mounts nothing', async () => {
  _resetProfileCache();
  const host = fakeHost();
  assert.equal(await activateProfileLimit(host, 'icc:0123456789abcdef:relative'), null);
  assert.equal(await activateProfileLimit(host, 'rec2020'), null);
  assert.equal(sourceForLimit('icc:0123456789abcdef:relative'), null);
  assert.equal(host.store.size, 0);
});

test('a link heals the moment the matching file is added', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const bytes = pressBytes();
  const digest = profileDigest(parseIccProfile(bytes)!);
  const link = `icc:${digest}:relative`;
  assert.equal(await activateProfileLimit(host, link), null);
  ok(await ingestProfile(host, asFile(bytes)));
  const src = await activateProfileLimit(host, link);
  assert.ok(src, 'the same bytes anywhere produce the same id - that is what content addressing buys');
  assert.equal(src!.id, link);
  _resetProfileCache();
});

test('a stored row whose bytes will not parse mounts nothing', async () => {
  _resetProfileCache();
  const host = fakeHost();
  host.store.set(`${USER_PROFILE_PREFIX}0123456789abcdef`, {
    id: `${USER_PROFILE_PREFIX}0123456789abcdef`, type: 'profile', format: 'icc',
    blob: new Blob([new Uint8Array(64) as unknown as BlobPart]),
    meta: { name: 'corrupt.icc', addedAt: 1 },
  });
  assert.equal((await listProfiles(host)).length, 1, 'the row still lists - it is the user’s file');
  assert.equal(await activateProfile(host, '0123456789abcdef'), null);
});

// ── removal ───────────────────────────────────────────────────────────────────

test('removing unmounts every intent and deletes the bytes', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const entry = ok(await ingestProfile(host, asFile(pressBytes())));
  const src = (await activateProfile(host, entry.digest, 'relative'))!;
  await removeProfile(host, entry.digest);
  for (const intent of INTENTS) {
    assert.equal(getColorSpace(`icc:${entry.digest}:${intent}`), undefined, `${intent} tab must be gone`);
  }
  assert.equal(getColorSpace(src.id), undefined);
  assert.equal(sourceFor(entry.digest), null);
  assert.equal(profileFor(entry.digest), null, 'the parse cache must not outlive the file');
  assert.equal(host.store.size, 0);
  assert.deepEqual(await listProfiles(host), []);
});

// ── labels ────────────────────────────────────────────────────────────────────

test('pill labels stay short and name the intent', async () => {
  _resetProfileCache();
  const host = fakeHost();
  const entry = ok(await ingestProfile(host, asFile(pressBytes())));
  assert.equal(shortLabel(entry, 'relative'), 'Test Press · rel');
  const long: ProfileEntry = { ...entry, description: 'Coated FOGRA39 (ISO 12647-2:2004)' };
  const label = shortLabel(long, 'perceptual');
  assert.ok(label.length <= 22, `pill text must fit: ${label} (${label.length})`);
  assert.ok(label.endsWith('· per'));
  assert.ok(label.includes('…'), 'a truncated name must say so');
  assert.equal(absentLabel('icc:0123456789abcdef:relative'), 'icc 012345… · rel');
  assert.equal(absentLabel('rec2020'), 'icc');
});
