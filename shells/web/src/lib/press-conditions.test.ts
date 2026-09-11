// SPDX-License-Identifier: MPL-2.0
/*
 * Press conditions - lib/press-conditions.ts.
 *
 * Run directly:  node --test shells/web/src/lib/press-conditions.test.ts
 *
 * The point of this module is honesty about a gap: a Print PDF can DECLARE FOGRA39
 * without any file, but the Lab can only COMPARE against it with the profile's
 * measurements. So the tests that matter are the ones that stop us quietly claiming a
 * source we have not probed, or equating two characterization data sets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESS_CONDITIONS, REFERENCE_PROFILES, matchesCondition, conditionFor,
  defaultCondition, locationHint, HINTS, fetchSourceFor, sourceIsExact,
} from './press-conditions.ts';
import { CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION } from '@lolly/engine';

test('every condition the export path offers is listed here, read across not retyped', () => {
  // The drift this guards: a condition added to the engine's export list silently
  // missing from the Lab, so a user could target something the Lab never mentions.
  const engineIds = Object.keys(CMYK_CONDITIONS).sort();
  assert.deepEqual(PRESS_CONDITIONS.map(c => c.id).sort(), engineIds);
  for (const c of PRESS_CONDITIONS) {
    const src = CMYK_CONDITIONS[c.id as keyof typeof CMYK_CONDITIONS];
    assert.equal(c.identifier, src.identifier, `${c.id} identifier comes from the engine`);
    assert.equal(c.info, src.info, `${c.id} name comes from the engine`);
  }
  assert.equal(defaultCondition().id, DEFAULT_CMYK_CONDITION);
});

test('a CMYK condition may only claim a source that was probed and licensed', () => {
  // This replaces a test that asserted every condition was `own`. It is not the absence
  // that mattered - it was the RULE: an entry may only be `fetch` once its URL has been
  // probed for CORS and the provider's licence has been read and quoted. Four now
  // qualify (the ICC profile registry, probed 2026-07-28), so the rule is what is
  // asserted, and it is still the thing that makes adding a fifth deliberate.
  //
  // The one host on the allowlist is the ICC's own registry: every profile there
  // corresponds to a registered printing condition and carries the provider's licence
  // text on its page. A new host means a new probe, which means editing this line.
  const PROBED = ['https://registry.color.org/profile-registry/profiles/'];
  for (const c of PRESS_CONDITIONS) {
    const src = fetchSourceFor(c);
    if (!src) {
      assert.match((c.source as { why: string }).why, /\w/, `${c.id} says why it has no source`);
      continue;
    }
    assert.ok(PROBED.some(p => src.url.startsWith(p)), `${c.id}: ${src.url} is on a probed host`);
    assert.ok(src.url.endsWith('.icc'), `${c.id} fetches a profile, not a page`);
    assert.ok(src.name.endsWith('.icc'), `${c.id} names the file it will get`);
    assert.ok(src.bytes > 132, `${c.id} states a plausible size`);
    // The licence is QUOTED, not summarised: a paraphrase is a claim that can rot.
    assert.match(src.licence, /[“"]/, `${c.id} quotes the provider's own words`);
    assert.match(src.charData!, /\w/, `${c.id} states the characterization data`);
  }
});

test('a profile built from other characterization data is not claimed as exact', () => {
  // FOGRA39/FOGRA51/GRACoL: the registry's profile is built from the very data set the
  // OutputIntent names. SWOP: an export declares CGATS TR 001 and the registered
  // profile is CGATS TR003 - the same press family, measurably different numbers. The
  // panel must not present those as one thing. This is now REQUIRED beyond a
  // label: press-profile-embed.ts pairs a fetched profile with a condition only when
  // sourceIsExact holds, so a false here is what keeps a registry-fetched SWOP profile
  // out of a `CGATS TR 001` OutputIntent declaration.
  const exact = Object.fromEntries(PRESS_CONDITIONS.map(c => [c.id, sourceIsExact(c)]));
  assert.equal(exact.fogra39, true, 'FOGRA39 profile is built from FOGRA39');
  assert.equal(exact.fogra51, true, 'FOGRA51 profile is built from FOGRA51');
  assert.equal(exact.gracol, true, 'CGATS TR 006 profile is built from CGATS TR006');
  assert.equal(exact.swop, false, 'CGATS TR 001 has no registered profile - TR003 is not it');
});

test('every condition names a filename to look for on the machine', () => {
  // The fallback when the fetch fails or the user is offline. A folder is a search; a
  // filename is two clicks.
  for (const c of PRESS_CONDITIONS) {
    assert.ok(c.files.length > 0, `${c.id} names at least one filename`);
    for (const f of c.files) assert.match(f, /\.icc$|\.icm$/i, `${f} looks like a profile file`);
  }
});

test('a fetchable source is https, CORS-probed, and states its licence', () => {
  for (const r of [...REFERENCE_PROFILES.map(x => x.source), ...PRESS_CONDITIONS.map(fetchSourceFor)]) {
    if (!r) continue;
    assert.equal(r.kind, 'fetch');
    assert.match(r.url, /^https:\/\//, 'https only');
    assert.ok(r.bytes > 132, 'a profile is bigger than its header');
    assert.match(r.licence, /\w/, 'the licence is stated, not assumed');
  }
});

test('a loaded profile is matched to its condition by what the vendor wrote in it', () => {
  // Several spellings are in circulation for one condition, which is why `match` is a
  // list - ISOcoated_v2 IS FOGRA39, and a profile that only says so obliquely still
  // counts.
  const cases: Array<[string, string | null]> = [
    ['Coated FOGRA39 (ISO 12647-2:2004)', 'fogra39'],
    ['ISOcoated_v2_eci', 'fogra39'],
    ['PSO Coated v3 (FOGRA51)', 'fogra51'],
    ['U.S. Web Coated (SWOP) v2', 'swop'],
    ['CGATS TR 006 GRACoL', 'gracol'],
    ['Generic CMYK Profile', null],
    ['Display P3', null],
    ['', null],
  ];
  for (const [desc, want] of cases) {
    assert.equal(conditionFor(desc)?.id ?? null, want, desc || '(empty)');
  }
  // Case-insensitive, since a desc string is whatever a vendor typed.
  const f39 = PRESS_CONDITIONS.find(c => c.id === 'fogra39')!;
  assert.equal(matchesCondition('coated FOGRA39', f39), true);
  assert.equal(matchesCondition('COATED FOGRA39', f39), true);
});

test('the location hint names a real place for each platform', () => {
  assert.match(locationHint('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), /ColorSync/);
  assert.match(locationHint('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), /spool\\drivers\\color/);
  assert.match(locationHint('Mozilla/5.0 (X11; Linux x86_64)'), /icc/);
  // Android is Linux-flavoured in its UA and must NOT get the desktop path.
  assert.equal(locationHint('Mozilla/5.0 (Linux; Android 14)'), HINTS.mac);
});
