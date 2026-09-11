// SPDX-License-Identifier: MPL-2.0
/**
 * Resolving the user's own profile into an embeddable DestOutputProfile - and,
 * more importantly, into an identity the file may honestly declare.
 *
 * The tests that matter here are the refusals. Embedding bytes is easy; the
 * failure mode worth engineering against is the confidently-wrong file, where a
 * PDF says FOGRA39 and carries somebody else's measurements. So: a registry-name
 * condition never embeds anything, a `desc` that merely LOOKS like a condition
 * proves nothing, and the registry's own SWOP profile - whose data set is CGATS
 * TR003 while an export declares CGATS TR 001 - pairs with nothing.
 *
 * DOM-free, with the same in-memory user-asset host color-profiles.test.ts uses.
 * Run directly:  node --test shells/web/src/lib/press-profile-embed.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pressProfileBytes } from '../../../../tests/helpers/icc-fixture.ts';
import { ingestProfile, isIngestFailure, USER_PROFILE_PREFIX, _resetProfileCache } from './color-profiles.ts';
import type { ColorProfilesHost, ProfileEntry, ProfileOrigin } from './color-profiles.ts';
import {
  resolveEmbeddedProfile, listEligible, isOwnProfile, ownDigest, urlProfileValue,
  embedRowLabel, _resetEmbedCache, originContradicted,
} from './press-profile-embed.ts';
import { PRESS_CONDITIONS, sourceIsExact } from './press-conditions.ts';

// ── harness ───────────────────────────────────────────────────────────────────

interface Stored { id: string; type: string; format: string; blob: Blob; meta?: Record<string, unknown> }

function fakeHost(): ColorProfilesHost & { store: Map<string, Stored>; blobReads: string[]; listCalls: number[] } {
  const store = new Map<string, Stored>();
  const blobReads: string[] = [];
  const listCalls: number[] = [];
  return {
    store, blobReads, listCalls,
    assets: {
      async _uploadUserAsset(rec) { store.set(rec.id, rec as Stored); },
      async _deleteUserAsset(id) { store.delete(id); },
      async _listUserAssets() { listCalls.push(1); return [...store.values()].map(r => ({ id: r.id, type: r.type, meta: r.meta })); },
      async _getBlob(id) { blobReads.push(id); return store.get(id)?.blob ?? null; },
    },
  };
}

const asFile = (bytes: Uint8Array, name = 'press.icc'): File =>
  new File([bytes as unknown as BlobPart], name, { type: 'application/vnd.iccprofile' });

async function add(
  host: ColorProfilesHost, bytes: Uint8Array, name: string, origin?: ProfileOrigin,
): Promise<ProfileEntry> {
  const r = await ingestProfile(host, asFile(bytes, name), origin ? { origin } : {});
  assert.ok(!isIngestFailure(r), `fixture must ingest: ${JSON.stringify(r)}`);
  return r as ProfileEntry;
}

const reset = (): void => { _resetProfileCache(); _resetEmbedCache(); };

// ── the value spellings ───────────────────────────────────────────────────────

test('own values are recognised, and a digest never travels in a URL', () => {
  assert.equal(isOwnProfile('own'), true);
  assert.equal(isOwnProfile('own:0123456789abcdef'), true);
  assert.equal(isOwnProfile('fogra39'), false);
  assert.equal(isOwnProfile(undefined), false);
  assert.equal(isOwnProfile('ownership'), false, 'a prefix match is not a value match');

  assert.equal(ownDigest('own:0123456789abcdef'), '0123456789abcdef');
  assert.equal(ownDigest('own'), null);
  assert.equal(ownDigest('own:not-hex'), null, 'junk resolves to nothing rather than to some profile');
  assert.equal(ownDigest('own:0123456789ABCDEF'), '0123456789abcdef');

  // A shared link must not name a device-local profile: the recipient does not
  // have it, and a link's file size must not depend on their IndexedDB.
  assert.equal(urlProfileValue('own:0123456789abcdef'), 'own');
  assert.equal(urlProfileValue('fogra51'), 'fogra51');
});

test('the row label states the size as arithmetic', () => {
  const entry = { description: 'PSO Coated v3', name: 'PSOcoated_v3.icc', bytes: 1_753_880 } as ProfileEntry;
  assert.equal(embedRowLabel(entry), 'Embed PSO Coated v3 (≈1.7 MB)');
  assert.match(embedRowLabel({ ...entry, bytes: 8_652_444 }), /≈8\.3 MB/);
  assert.match(embedRowLabel({ ...entry, bytes: 64_000 }), /63 kB/);
});

// ── what may be offered, and what may be embedded ─────────────────────────────

test('only a prtr CMYK profile is eligible for a CMYK output intent', async () => {
  reset();
  const host = fakeHost();
  const press = await add(host, pressProfileBytes({ desc: 'Fixture Coated' }), 'press.icc');
  await add(host, pressProfileBytes({ desc: 'Fixture Display', deviceClass: 'mntr', space: 'RGB ' }), 'display.icc');
  await add(host, pressProfileBytes({ desc: 'Fixture RGB Printer', space: 'RGB ' }), 'rgbprinter.icc');

  const rows = await listEligible(host, 'CMYK');
  assert.deepEqual(rows.map(r => r.digest), [press.digest],
    'a monitor profile and an RGB printer profile are not CMYK output intents');
});

test('a registry-name condition never embeds anything, even with a profile loaded', async () => {
  reset();
  const host = fakeHost();
  // Loaded, eligible, and its desc says FOGRA39 - the tempting shortcut.
  await add(host, pressProfileBytes({ desc: 'Coated FOGRA39 lookalike' }), 'fogra39ish.icc');
  for (const value of ['fogra39', 'fogra51', 'swop', 'gracol', 'srgb', 'none', undefined]) {
    assert.equal(await resolveEmbeddedProfile(host, value, 'CMYK'), null, String(value));
  }
  assert.deepEqual(host.blobReads, [], 'nothing was even read - the registry rows are name-only');
});

test('the identity trap: a desc that looks like a condition proves nothing', async () => {
  reset();
  const host = fakeHost();
  // The real counter-example: SWOP2006_Coated3v2 has "SWOP" in its desc, and is
  // built from CGATS TR003 - while an export's `swop` condition declares CGATS
  // TR 001. A desc match would put TR 001 on TR003's numbers.
  const swopish = await add(host, pressProfileBytes({ desc: 'SWOP2006_Coated3v2.icc' }), 'SWOP2006_Coated3v2.icc');
  const r = (await resolveEmbeddedProfile(host, `own:${swopish.digest}`, 'CMYK'))!;
  assert.ok(r, 'it is still embedded - this is not a refusal');
  assert.equal(r.identifier, 'Custom');
  assert.equal(r.registry, null);
  assert.equal(r.pairedCondition, null);
  assert.equal(r.evidence, null);
  assert.equal(r.info, 'SWOP2006_Coated3v2.icc', 'the file declares the profile’s own name');
});

test('targ pairs a profile with the condition it states', async () => {
  reset();
  const host = fakeHost();
  const e = await add(host, pressProfileBytes({ desc: 'PSO Coated v3', charData: 'FOGRA51' }), 'PSOcoated_v3.icc');
  const r = (await resolveEmbeddedProfile(host, `own:${e.digest}`, 'CMYK'))!;
  assert.equal(r.pairedCondition, 'fogra51');
  assert.equal(r.evidence, 'targ');
  assert.equal(r.identifier, 'FOGRA51');
  assert.equal(r.registry, 'http://www.color.org');
  assert.match(r.info, /FOGRA51/);
  assert.equal(r.components, 4);

  // Spacing and case in a registry name are the vendor's business.
  const g = await add(host, pressProfileBytes({ desc: 'GRACoL', charData: 'CGATS TR006' }), 'gracol.icc');
  const gr = (await resolveEmbeddedProfile(host, `own:${g.digest}`, 'CMYK'))!;
  assert.equal(gr.pairedCondition, 'gracol');
  assert.equal(gr.identifier, 'CGATS TR 006');

  // A characterization nothing declares pairs with nothing.
  const x = await add(host, pressProfileBytes({ desc: 'House Press', charData: 'CGATS TR003' }), 'house.icc');
  const xr = (await resolveEmbeddedProfile(host, `own:${x.digest}`, 'CMYK'))!;
  assert.equal(xr.pairedCondition, null);
  assert.equal(xr.identifier, 'Custom');
});

test('registry provenance outranks targ, and the SWOP source still pairs with nothing', async () => {
  reset();
  const host = fakeHost();
  const fogra51 = PRESS_CONDITIONS.find(c => c.id === 'fogra51')!;
  const swop = PRESS_CONDITIONS.find(c => c.id === 'swop')!;
  assert.equal(sourceIsExact(fogra51), true);
  assert.equal(sourceIsExact(swop), false, 'load-bearing for pairing, not just for a UI label');

  // Origin wins: no string matching is involved, so it is the strongest evidence.
  const a = await add(host, pressProfileBytes({ desc: 'PSO Coated v3', charData: 'FOGRA51' }), 'PSOcoated_v3.icc',
    { kind: 'registry', url: 'https://registry.color.org/x.icc', conditionId: 'fogra51', charData: 'FOGRA51' });
  const ar = (await resolveEmbeddedProfile(host, `own:${a.digest}`, 'CMYK'))!;
  assert.equal(ar.evidence, 'registry');
  assert.equal(ar.pairedCondition, 'fogra51');

  // Fetched FOR the swop row, and still Custom: that source is TR003 and the
  // condition declares TR 001, so the pairing declines it.
  const b = await add(host, pressProfileBytes({ desc: 'SWOP2006_Coated3v2' }), 'SWOP2006_Coated3v2.icc',
    { kind: 'registry', url: 'https://registry.color.org/y.icc', conditionId: 'swop', charData: 'CGATS TR003' });
  const br = (await resolveEmbeddedProfile(host, `own:${b.digest}`, 'CMYK'))!;
  assert.equal(br.pairedCondition, null);
  assert.equal(br.identifier, 'Custom');
  assert.equal(br.registry, null);
});

test('an ineligible or absent profile resolves to null rather than to something wrong', async () => {
  reset();
  const host = fakeHost();
  // Deleted since the session was saved.
  assert.equal(await resolveEmbeddedProfile(host, 'own:0123456789abcdef', 'CMYK'), null);

  // A display profile named by a hand-edited URL: embedding RGB bytes as a CMYK
  // DestOutputProfile would be bytes that merely RENDER the condition.
  const disp = await add(host, pressProfileBytes({ desc: 'Display', deviceClass: 'mntr', space: 'RGB ' }), 'display.icc');
  assert.equal(await resolveEmbeddedProfile(host, `own:${disp.digest}`, 'CMYK'), null);

  // Stored bytes that will not parse (the row's meta outlived its file).
  const press = await add(host, pressProfileBytes({}), 'press.icc');
  host.store.get(`${USER_PROFILE_PREFIX}${press.digest}`)!.blob =
    new Blob([Uint8Array.from([1, 2, 3]) as unknown as BlobPart]);
  _resetEmbedCache();
  assert.equal(await resolveEmbeddedProfile(host, `own:${press.digest}`, 'CMYK'), null);
});

test('bare own resolves only when there is exactly one answer', async () => {
  reset();
  const host = fakeHost();
  // Zero: nothing to embed, so nothing is declared.
  assert.equal(await resolveEmbeddedProfile(host, 'own', 'CMYK'), null);

  const one = await add(host, pressProfileBytes({ desc: 'Only Press' }), 'one.icc');
  const r = (await resolveEmbeddedProfile(host, 'own', 'CMYK'))!;
  assert.equal(r.desc, 'Only Press');
  assert.equal(r.name, 'one.icc');

  // Two: guessing would let storage order decide what a file DECLARES.
  await add(host, pressProfileBytes({ desc: 'Second Press' }), 'two.icc');
  assert.equal(await resolveEmbeddedProfile(host, 'own', 'CMYK'), null);
  // The explicit digest still resolves - ambiguity is only about the bare form.
  assert.ok(await resolveEmbeddedProfile(host, `own:${one.digest}`, 'CMYK'));
});

test('the byte cache serves a second export without a second blob read', async () => {
  reset();
  const host = fakeHost();
  const e = await add(host, pressProfileBytes({ desc: 'Batch Press' }), 'batch.icc');
  const id = `${USER_PROFILE_PREFIX}${e.digest}`;
  host.blobReads.length = 0;
  _resetEmbedCache();

  const first = (await resolveEmbeddedProfile(host, `own:${e.digest}`, 'CMYK'))!;
  const second = (await resolveEmbeddedProfile(host, `own:${e.digest}`, 'CMYK'))!;
  assert.deepEqual(host.blobReads.filter(x => x === id).length, 1,
    'a 50-row batch must not read 8 MB fifty times');
  assert.equal(first.bytes, second.bytes, 'the same buffer, not a copy per row');

  // A different profile evicts it - never two press profiles in memory at once.
  const other = await add(host, pressProfileBytes({ desc: 'Other Press' }), 'other.icc');
  await resolveEmbeddedProfile(host, `own:${other.digest}`, 'CMYK');
  await resolveEmbeddedProfile(host, `own:${e.digest}`, 'CMYK');
  assert.equal(host.blobReads.filter(x => x === id).length, 2);
});

test('provenance contradicted by the profile’s own targ declares Custom', async () => {
  reset();
  const host = fakeHost();
  // The registry re-points a filename, or a SOURCES row is wrong: the row that was
  // pressed says FOGRA39, the bytes that arrived say FOGRA51. Declaring either would
  // be a coin toss written into an OutputConditionIdentifier.
  const bad = await add(host, pressProfileBytes({ desc: 'Some Coated', charData: 'FOGRA51' }), 'fetched.icc',
    { kind: 'registry', url: 'https://registry.color.org/Coated_Fogra39L.icc', conditionId: 'fogra39', charData: 'FOGRA39' });
  const r = (await resolveEmbeddedProfile(host, `own:${bad.digest}`, 'CMYK'))!;
  assert.ok(r, 'still embedded - a contradiction is not a refusal');
  assert.equal(r.identifier, 'Custom');
  assert.equal(r.registry, null);
  assert.equal(r.pairedCondition, null);
  assert.equal(r.evidence, null);
  assert.equal(r.info, 'Some Coated');
  assert.equal(originContradicted(pressProfileBytes({ charData: 'FOGRA51' }), 'fogra39'), true);

  // Only a RESOLVED disagreement demotes. A profile whose targ names nothing any
  // condition claims (VIGC's Coated_Fogra39L spells its own data set) keeps its
  // registry pairing, and so does one with no targ at all.
  reset();
  const own = fakeHost();
  const vigc = await add(own, pressProfileBytes({ desc: 'Coated Fogra39L VIGC', charData: 'Coated_Fogra39L_VIGC_300' }), 'vigc.icc',
    { kind: 'registry', url: 'https://registry.color.org/v.icc', conditionId: 'fogra39', charData: 'FOGRA39' });
  const vr = (await resolveEmbeddedProfile(own, `own:${vigc.digest}`, 'CMYK'))!;
  assert.equal(vr.pairedCondition, 'fogra39');
  assert.equal(vr.evidence, 'registry');
  assert.equal(originContradicted(pressProfileBytes({ charData: 'Coated_Fogra39L_VIGC_300' }), 'fogra39'), false);
  assert.equal(originContradicted(pressProfileBytes({}), 'fogra39'), false, 'no targ is no contradiction');
});

test('one asset listing per export, not one per lookup', async () => {
  reset();
  const host = fakeHost();
  const e = await add(host, pressProfileBytes({ desc: 'Batch Press' }), 'batch.icc');
  host.listCalls.length = 0;
  await resolveEmbeddedProfile(host, `own:${e.digest}`, 'CMYK');
  assert.equal(host.listCalls.length, 1,
    'provenance rides the row that was already listed - a 50-row batch must not scan the store 100 times');
});
