// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/icc.ts against eight REAL profiles, none of them ours.
 *
 * ASCII-first console output, per tests/README.md.
 *
 * `tests/icc.test.ts` already pins the reader against macOS's stock ColorSync
 * tree plus synthesised bytes. This suite is the other kind of evidence: files
 * downloaded from the ICC, the W3C and Elle Stone, which is to say bytes written
 * by four different producers to four different readings of the same spec. They
 * live in `~/Desktop/profiles` on Andy's machine (override with
 * `ICC_PROFILE_DIR`); every test here SKIPS with the missing path named when the
 * directory is absent, so CI stays green without them.
 *
 * The files are read-only fixtures - nothing here writes to them.
 *
 * Two of the eight are worth more than the other six:
 *
 *   - `sRGB-v4-ICC_preference.icc` is device class `spac` with a Lab PCS. It is a
 *     colour-space CONVERSION profile, not a display: "sRGB" in its description
 *     names the space it converts for, not a gamut it can be compared against.
 *     What the reader does with it today is pinned below, including the part that
 *     is wrong (see the FINDING note on `iccGamutIntent`).
 *   - `swapped-v2.icc` is `green-red-swapped sRGB`, built by the W3C to be
 *     confidently WRONG: its `desc` says sRGB, its matrix does not. It is the
 *     fixture for the rule that we report what a profile DOES, never what it
 *     claims - and it also shows why gamut membership alone cannot catch it.
 *
 * Licence picture for these files (read out of their own `cprt` tags, recorded in
 * plans/60-color-spaces.md 11.8): the ICC's own two are shippable, the Elle Stone
 * four are CC-BY-SA, Apple's P3 is not redistributable, and the W3C's swapped
 * profile belongs in tests and nowhere else. Hence: fixtures by path, none
 * committed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  parseIccProfile,
  iccGamutSource,
  iccGamutIntent,
  iccRoundTripDecides,
  iccRoundTripDeltaE,
  iccCharacterization,
  ICC_GAMUT_DELTA_E,
  type IccProfile,
} from '../engine/src/icc.ts';
import type { RenderingIntent } from '../engine/src/gamut-source.ts';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const DIR = process.env.ICC_PROFILE_DIR || join(homedir(), 'Desktop', 'profiles');

const SRGB_V2 = 'sRGB-v2-2014.icc';
const SRGB_V4_PREF = 'sRGB-v4-ICC_preference.icc';
const SWAPPED = 'swapped-v2.icc';
const P3 = 'Display P3.icc';
const CIE_V2 = 'CIERGB-elle-V2-labl.icc';
const CIE_V4 = 'CIERGB-elle-V4-labl.icc';
const LARGE_V2 = 'LargeRGB-elle-V2-g18.icc';
const LARGE_V4 = 'LargeRGB-elle-V4-g18.icc';

const ALL = [SRGB_V2, SRGB_V4_PREF, SWAPPED, P3, CIE_V2, CIE_V4, LARGE_V2, LARGE_V4] as const;

const INTENTS: readonly RenderingIntent[] = ['perceptual', 'relative', 'saturation', 'absolute'];

const have = (name: string): boolean => existsSync(join(DIR, name));
const bytesOf = (name: string): Uint8Array => new Uint8Array(readFileSync(join(DIR, name)));

/**
 * Run `body` with the named fixture parsed, or skip naming the file.
 *
 * A missing file skips; a file that is PRESENT and does not parse fails. The
 * reader accepting real bytes is the whole point of the suite, so "absent" and
 * "broken" must not collapse into the same green tick.
 */
function withReal(name: string, t: { skip(msg: string): void }, body: (p: IccProfile, b: Uint8Array) => void): void {
  if (!have(name)) {
    t.skip(`real-profile fixture not on this machine: ${join(DIR, name)}`);
    return;
  }
  const b = bytesOf(name);
  const p = parseIccProfile(b);
  assert.ok(p, `${name}: a real ICC profile must parse`);
  body(p, b);
}

/** Both fixtures, or a skip - for the tests that compare one profile against another. */
function withPair(
  a: string, c: string, t: { skip(msg: string): void }, body: (pa: IccProfile, pc: IccProfile) => void,
): void {
  if (!have(a) || !have(c)) {
    t.skip(`real-profile fixtures not on this machine: ${join(DIR, a)} + ${join(DIR, c)}`);
    return;
  }
  const pa = parseIccProfile(bytesOf(a));
  const pc = parseIccProfile(bytesOf(c));
  assert.ok(pa && pc, 'both real profiles must parse');
  body(pa, pc);
}

const usableIntents = (p: IccProfile): RenderingIntent[] => INTENTS.filter(i => iccGamutIntent(p, i));

const round = (v: readonly number[], dp = 2): number[] => v.map(n => +n.toFixed(dp));

// ─── the header, on every file ────────────────────────────────────────────────

/**
 * What each file IS, per its header. Numbers read with this parser and
 * cross-checked against the table in plans/60-color-spaces.md 11.8, which was
 * written from the same files.
 */
const HEADERS: Record<string, { cls: string; space: string; pcs: 'XYZ' | 'Lab'; version: string; desc: string; n: number }> = {
  [SRGB_V2]: { cls: 'mntr', space: 'RGB ', pcs: 'XYZ', version: '2.0.0', desc: 'sRGB2014', n: 3 },
  [SRGB_V4_PREF]: {
    cls: 'spac', space: 'RGB ', pcs: 'Lab', version: '4.2.0',
    desc: 'sRGB v4 ICC preference perceptual intent beta', n: 3,
  },
  [SWAPPED]: { cls: 'mntr', space: 'RGB ', pcs: 'XYZ', version: '2.0.0', desc: 'green-red-swapped sRGB', n: 3 },
  [P3]: { cls: 'mntr', space: 'RGB ', pcs: 'XYZ', version: '4.0.0', desc: 'Display P3', n: 3 },
  [CIE_V2]: { cls: 'mntr', space: 'RGB ', pcs: 'XYZ', version: '2.2.0', desc: 'CIERGB-elle-V2-labl.icc', n: 3 },
  [CIE_V4]: { cls: 'mntr', space: 'RGB ', pcs: 'XYZ', version: '4.3.0', desc: 'CIERGB-elle-V4-labl.icc', n: 3 },
  [LARGE_V2]: { cls: 'mntr', space: 'RGB ', pcs: 'XYZ', version: '2.2.0', desc: 'LargeRGB-elle-V2-g18.icc', n: 3 },
  [LARGE_V4]: { cls: 'mntr', space: 'RGB ', pcs: 'XYZ', version: '4.3.0', desc: 'LargeRGB-elle-V4-g18.icc', n: 3 },
};

for (const name of ALL) {
  const want = HEADERS[name]!;
  test(`icc real: ${name} parses and reports its header`, t => {
    withReal(name, t, p => {
      assert.equal(p.deviceClass, want.cls, `${name}: device class`);
      assert.equal(p.dataColourSpace, want.space, `${name}: data colour space (4 bytes, space-padded)`);
      assert.equal(p.pcs, want.pcs, `${name}: PCS`);
      assert.equal(p.version, want.version, `${name}: version`);
      assert.equal(p.description, want.desc, `${name}: desc tag`);
      // nChannels comes from the SPACE signature, never from a tag's own count - 
      // three for every RGB profile here whatever its element types.
      assert.equal(p.nChannels, want.n, `${name}: nChannels`);
    });
  });
}

test('icc real: none of these carry a characterization target', t => {
  if (!have(SRGB_V2)) { t.skip(`real-profile fixtures not on this machine: ${DIR}`); return; }
  // `targ` is a press thing. Asserted so a future change to iccCharacterization
  // that starts inventing names out of other tags is caught: display and
  // conversion profiles must keep answering null rather than guessing.
  for (const name of ALL) {
    if (!have(name)) continue;
    assert.equal(iccCharacterization(bytesOf(name)), null, `${name}: no targ tag`);
  }
});

test('icc real: the gamut-source id is a content digest, not a behaviour one', t => {
  withPair(CIE_V2, CIE_V4, t, (v2, v4) => {
    const a = iccGamutSource(v2, 'relative');
    const b = iccGamutSource(v4, 'relative');
    assert.match(a.id, /^icc:[0-9a-f]{16}:relative$/);
    assert.match(b.id, /^icc:[0-9a-f]{16}:relative$/);
    // Elle Stone's V2 and V4 CIERGB files describe the SAME transform - they agree
    // on the red primary to two decimals - but they are different bytes, so they
    // must not collide: the id addresses the file, so re-dropping one file
    // overwrites and dropping the other adds.
    assert.deepEqual(round(v2.toLab('relative', [1, 0, 0])!), round(v4.toLab('relative', [1, 0, 0])!));
    assert.notEqual(a.id, b.id, 'distinct files must get distinct ids');
    // Same bytes, parsed twice: same id. (Content-addressed, so a shared
    // `&limit=icc:<digest>:<intent>` link matches by construction.)
    const again = parseIccProfile(bytesOf(CIE_V2));
    assert.ok(again);
    assert.equal(iccGamutSource(again, 'relative').id, a.id);
  });
});

test('icc real: every one of these is additive, so ink coverage is null', t => {
  if (!have(SRGB_V2)) { t.skip(`real-profile fixtures not on this machine: ${DIR}`); return; }
  for (const name of ALL) {
    if (!have(name)) continue;
    const p = parseIccProfile(bytesOf(name));
    assert.ok(p, name);
    // `inkCoverage` is optional on GamutSource; the ICC source always supplies it
    // and it must answer null for an additive space rather than a sum of RGB.
    const src = iccGamutSource(p, 'relative');
    assert.equal(typeof src.inkCoverage, 'function', `${name}: the ICC source implements inkCoverage`);
    assert.equal(src.inkCoverage?.(0.5, 0.1, 30) ?? null, null, `${name}: RGB has no ink`);
  }
});

// ─── matrix/TRC takes the DIRECT_LINEAR path, not the round trip ──────────────

test('icc real: matrix/TRC display profiles are decided by the cube, not the round trip', t => {
  if (!have(SRGB_V2)) { t.skip(`real-profile fixtures not on this machine: ${DIR}`); return; }
  const matrixTrc = [SRGB_V2, SWAPPED, P3, CIE_V2, CIE_V4, LARGE_V2, LARGE_V4];
  for (const name of matrixTrc) {
    if (!have(name)) continue;
    const p = parseIccProfile(bytesOf(name));
    assert.ok(p, name);
    // No B2A table anywhere in these files, so `fromLab` inverts the matrix and
    // clips - and `contains` must test the unclamped cube instead of the ΔE.
    assert.equal(iccRoundTripDecides(p), false, `${name}: matrix/TRC must not be decided by round-trip ΔE`);
    // All four intents answerable: the matrix is direction-agnostic, and absolute
    // rides on relative plus a media white point.
    assert.deepEqual(usableIntents(p), ['perceptual', 'relative', 'saturation', 'absolute'], `${name}: intents`);
  }
});

test('icc real: sRGB2014 refuses a colour whose round trip barely moves', t => {
  withReal(SRGB_V2, t, p => {
    // This is the case DIRECT_LINEAR exists for, on a real file rather than a
    // synthesised one: OKLCH(0.6, 0.25, 29) is outside sRGB, and the round trip
    // through the clipping inverse moves it only ~1.5 ΔE - comfortably under the
    // 3.0 threshold. If `contains` ever went back to reading the ΔE for these
    // profiles it would call this colour reproducible.
    const dE = iccRoundTripDeltaE(p, 'relative', 0.6, 0.25, 29);
    assert.ok(dE !== null, 'a display profile can be asked the round trip');
    assert.ok(dE < ICC_GAMUT_DELTA_E, `round trip must be under the threshold, got ${dE}`);
    assert.ok(dE > 0.5, `and must not be zero either, got ${dE}`);
    assert.equal(iccGamutSource(p, 'relative').contains(0.6, 0.25, 29), false, 'still out of gamut');
    // The neutral axis and a muted red are genuinely inside.
    assert.equal(iccGamutSource(p, 'relative').contains(0.5, 0, 0), true);
    assert.equal(iccGamutSource(p, 'relative').contains(0.5, 0.1, 30), true);
  });
});

test('icc real: the wider Elle Stone RGB spaces contain colours sRGB cannot', t => {
  withPair(SRGB_V2, LARGE_V2, t, (srgb, large) => {
    // A gamut source has to be able to tell two real display spaces apart, or the
    // Colour Lab's comparison targets are decoration. Green at chroma 0.25 is
    // outside sRGB and inside LargeRGB.
    assert.equal(iccGamutSource(srgb, 'relative').contains(0.6, 0.25, 140), false);
    assert.equal(iccGamutSource(large, 'relative').contains(0.6, 0.25, 140), true);
  });
});

// ─── the `spac` conversion profile ────────────────────────────────────────────

test('icc real: the v4 preference profile is a spac/Lab conversion profile, LUT-backed', t => {
  withReal(SRGB_V4_PREF, t, p => {
    assert.equal(p.deviceClass, 'spac', 'not mntr: this is a colour-space conversion profile');
    assert.equal(p.pcs, 'Lab', 'Lab PCS, so the LUT path is exercised end to end');
    // A2B/B2A tables in both directions, so the round trip IS the membership test
    // here - the opposite of the matrix profiles above.
    assert.equal(iccRoundTripDecides(p), true);
    const inside = iccRoundTripDeltaE(p, 'relative', 0.55, 0.16, 30);
    const outside = iccRoundTripDeltaE(p, 'relative', 0.6, 0.25, 29);
    assert.ok(inside !== null && outside !== null, 'both answerable');
    assert.ok(inside < 0.5, `a reachable colour barely moves, got ${inside}`);
    assert.ok(outside > ICC_GAMUT_DELTA_E * 2, `an unreachable one is projected far, got ${outside}`);
    assert.equal(iccGamutSource(p, 'relative').contains(0.55, 0.16, 30), true);
    assert.equal(iccGamutSource(p, 'relative').contains(0.6, 0.25, 29), false);
    // Its tables cover three intents; saturation has no B2A2, so the source must
    // not silently answer that one with another intent's table.
    assert.deepEqual(usableIntents(p), ['perceptual', 'relative', 'absolute']);
    assert.equal(iccGamutIntent(p, 'saturation'), false);
    assert.equal(iccGamutSource(p, 'saturation').contains(0.5, 0, 0), false, 'an unsupported intent contains nothing');
  });
});

/**
 * FINDING (2026-07-28) - `iccGamutIntent` accepts a `spac` profile.
 *
 * It refuses `abst` and `link` outright, on the reasoning that an abstract effect
 * and a device link have no device gamut to ask about. A `spac` colour-space
 * conversion profile is the same category of thing: `sRGB v4 ICC preference` is a
 * perceptual re-rendering of sRGB, not a device whose gamut you can compare a
 * brand colour against. Today it is accepted, so
 * `shells/web/src/lib/color-profiles.ts`'s `ingestProfile` will store it (its
 * `usableIntents` is non-empty, so the `no-gamut` refusal never fires) and
 * `activateProfile` will mount it as a `&limit=` target under a label that reads
 * "sRGB v4 ICC preference perceptual intent beta" - a display-gamut claim the
 * file does not make about itself.
 *
 * `icc.ts` and `color-profiles.ts` both belong to other runs today, so this pins
 * the CURRENT behaviour rather than the wanted one. When the one-line fix lands
 * (add `spac` beside `abst`/`link` in `iccGamutIntent`, and give
 * `color-profiles.ts` a distinct failure so the panel can say why), flip the two
 * assertions marked WRONG-TODAY below to `false` / `[]`.
 */
test('icc real: spac is accepted as a gamut today (documented finding, see note above)', t => {
  withReal(SRGB_V4_PREF, t, p => {
    assert.equal(iccGamutIntent(p, 'relative'), true, 'WRONG-TODAY: a spac profile should have no device gamut');
    assert.notDeepEqual(usableIntents(p), [], 'WRONG-TODAY: ingest reads this as mountable');
    // The classes that ARE refused, so the fix has a stated shape to match.
    assert.equal(p.deviceClass === 'abst' || p.deviceClass === 'link', false);
  });
});

// ─── the deliberately wrong profile ───────────────────────────────────────────

test('icc real: swapped-v2 reports the transform it HAS, not the one it claims', t => {
  withPair(SRGB_V2, SWAPPED, t, (srgb, swapped) => {
    // Its own description says sRGB. That is testimony, and this suite's whole
    // point is that we never read testimony as measurement.
    assert.match(swapped.description, /sRGB/);
    assert.equal(swapped.deviceClass, 'mntr');
    assert.equal(swapped.nChannels, 3);

    const R = [1, 0, 0], G = [0, 1, 0], B = [0, 0, 1];
    const s = (d: number[]) => srgb.toLab('relative', d)!;
    const w = (d: number[]) => swapped.toLab('relative', d)!;

    // Full red drives this device to sRGB's GREEN, and full green to sRGB's red.
    // Same numbers, exchanged - the W3C built the file by swapping the two
    // colorant tags, so equality here is exact to the s15Fixed16 they share.
    assert.deepEqual(round(w(R), 6), round(s(G), 6), 'device red reports green');
    assert.deepEqual(round(w(G), 6), round(s(R), 6), 'device green reports red');
    assert.deepEqual(round(w(B), 6), round(s(B), 6), 'blue is untouched');
    // Concretely: a caller asking "what does full red look like" is told L*87.8
    // a*-79.3 (green), never L*54.3 a*80.8 (red).
    assert.ok(w(R)[1] < -70, `red must report a negative a*, got ${w(R)[1]}`);

    // The reverse direction has to agree with itself: ask for sRGB red's Lab and
    // the profile answers with the GREEN channel. Reporting [1,0,0] here would be
    // reporting the claim.
    const redLab = s(R);
    assert.deepEqual(round(srgb.fromLab('relative', redLab)!, 4), [1, 0, 0]);
    assert.deepEqual(round(swapped.fromLab('relative', redLab)!, 4), [0, 1, 0]);

    // The neutral axis is NOT swapped - the two primaries sum the same - so white
    // and grey are identical in both. A check that only looked at the grey ramp
    // would call this profile sRGB.
    assert.deepEqual(round(w([1, 1, 1]), 4), round(s([1, 1, 1]), 4));
    assert.deepEqual(round(w([0.5, 0.5, 0.5]), 4), round(s([0.5, 0.5, 0.5]), 4));
  });
});

test('icc real: gamut membership cannot detect the swap, which is why we ask the transform', t => {
  withPair(SRGB_V2, SWAPPED, t, (srgb, swapped) => {
    // Swapping two colorants permutes the cube's corners without moving its
    // volume, so `contains` agrees on every sample. This is a real limit of a
    // gamut-shaped question, pinned so nobody later "verifies" a profile by
    // comparing its gamut to a known space and believes the answer.
    const a = iccGamutSource(srgb, 'relative');
    const b = iccGamutSource(swapped, 'relative');
    let checked = 0;
    for (let l = 0.1; l < 1; l += 0.1) {
      for (let c = 0; c < 0.35; c += 0.025) {
        for (let h = 0; h < 360; h += 15) {
          assert.equal(b.contains(l, c, h), a.contains(l, c, h), `membership differs at ${l}/${c}/${h}`);
          checked++;
        }
      }
    }
    assert.ok(checked > 3000, `swept enough of the space, got ${checked}`);
    // And they are still different profiles to every caller that has to name one.
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.label, b.label);
  });
});
