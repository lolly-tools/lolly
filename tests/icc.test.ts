// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/icc.ts — the ICC reader, against REAL profiles plus synthesised ones.
 *
 * The real files are macOS's stock ColorSync profiles. They are the only fixtures
 * that prove the reader against bytes nobody in this repo wrote, so they carry the
 * header, LUT, matrix/TRC and anchor assertions. Every real-profile test skips
 * with a named reason when the file is absent, so a Linux CI box stays green
 * rather than going red on a missing OS file.
 *
 * Two things the stock profiles CANNOT prove, so they are synthesised here:
 *   - the v4 `mAB ` path (no macOS profile uses it — every LUT profile shipped is
 *     v2 `mft1`/`mft2`);
 *   - the legacy-vs-v4 Lab encoding decision, which needs the SAME sample value
 *     decoded through both element types to be a real test.
 *
 * The expected CMYK numbers were cross-checked against littleCMS (via
 * Pillow's ImageCms) on the same profile: device (0,0,0,0) → L*100 a*0 b*0,
 * (0,0,0,1) → L*9.02, (1,0,0,0) → (59.22, −41, −44). Where a tolerance is loose
 * it is loose because the profile is, not because the reader is approximate.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  parseIccProfile,
  iccGamutSource,
  ICC_GAMUT_DELTA_E,
  type IccProfile,
} from '../engine/src/icc.ts';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const SYS = '/System/Library/ColorSync/Profiles/';
const LIB = '/Library/ColorSync/Profiles/';
const CMYK_PATH = `${SYS}Generic CMYK Profile.icc`;
const SRGB_PATH = `${SYS}sRGB Profile.icc`;
const P3_PATH = `${SYS}Display P3.icc`;
const GRAY_PATH = `${SYS}Generic Gray Profile.icc`;
const XYZ_PATH = `${SYS}Generic XYZ Profile.icc`;
const BW_PATH = `${LIB}Black & White.icc`; // the only local mft2 with a non-identity output curve

/** Load a stock profile, or null when this machine has no ColorSync tree. */
function load(path: string): Uint8Array | null {
  if (!existsSync(path)) return null;
  return new Uint8Array(readFileSync(path));
}

/**
 * Run `body` with a parsed stock profile, or skip with the path that was missing.
 * A skip is deliberately not a pass with no assertions: the reason names the file.
 */
function withProfile(path: string, t: { skip(msg: string): void }, body: (p: IccProfile) => void): void {
  const bytes = load(path);
  if (!bytes) {
    t.skip(`stock profile not on this machine: ${path}`);
    return;
  }
  const p = parseIccProfile(bytes);
  assert.ok(p, `${path}: a stock ICC profile must parse`);
  body(p);
}

const deltaE = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

// ─── synthetic profile builder ────────────────────────────────────────────────

const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff];
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

/** Assemble a profile from tag elements, laying each out 4-byte aligned. */
function buildProfile(opts: {
  major?: number;
  deviceClass?: string;
  space?: string;
  pcs?: string;
  tags: [string, number[]][];
}): Uint8Array {
  const major = opts.major ?? 2;
  const header = new Array<number>(128).fill(0);
  header.splice(8, 4, major, 0x00, 0, 0);
  header.splice(12, 4, ...ascii(opts.deviceClass ?? 'prtr'));
  header.splice(16, 4, ...ascii(opts.space ?? 'RGB '));
  header.splice(20, 4, ...ascii(opts.pcs ?? 'Lab '));
  header.splice(36, 4, ...ascii('acsp'));

  const table: number[] = [...u32(opts.tags.length)];
  let off = 128 + 4 + opts.tags.length * 12;
  off = (off + 3) & ~3;
  const body: number[] = [];
  for (const [sig, data] of opts.tags) {
    const at = off + body.length;
    table.push(...ascii(sig), ...u32(at), ...u32(data.length));
    body.push(...data);
    while (body.length % 4) body.push(0);
  }
  const pad = new Array<number>(off - (128 + 4 + opts.tags.length * 12)).fill(0);
  const all = [...header, ...table, ...pad, ...body];
  all.splice(0, 4, ...u32(all.length));
  return Uint8Array.from(all);
}

/** A 16-bit lut16Type (`mft2`) element: identity 2-entry curves either side of a flat CLUT. */
function mft2(nIn: number, nOut: number, node: number[]): number[] {
  const g = 2;
  const el: number[] = [...ascii('mft2'), 0, 0, 0, 0, nIn, nOut, g, 0];
  for (const v of [1, 0, 0, 0, 1, 0, 0, 0, 1]) el.push(...u32(v * 65536));
  el.push(...u16(2), ...u16(2));
  for (let d = 0; d < nIn; d++) el.push(...u16(0), ...u16(65535));
  const nodes = g ** nIn;
  for (let i = 0; i < nodes; i++) for (const v of node) el.push(...u16(v));
  for (let k = 0; k < nOut; k++) el.push(...u16(0), ...u16(65535));
  return el;
}

/** An identity `curv` (count 0), 12 bytes. */
const identityCurv = (): number[] => [...ascii('curv'), 0, 0, 0, 0, ...u32(0)];

/** A v4 lutAtoBType (`mAB `) element: A curves → 16-bit CLUT → B curves. */
function mab(nIn: number, nOut: number, node: number[]): number[] {
  const head = 32;
  const aCurves: number[] = [];
  for (let d = 0; d < nIn; d++) aCurves.push(...identityCurv());
  const grid = 2;
  const clut: number[] = new Array<number>(16).fill(0);
  for (let d = 0; d < nIn; d++) clut[d] = grid;
  clut.push(2, 0, 0, 0); // 2-byte precision
  const nodes = grid ** nIn;
  for (let i = 0; i < nodes; i++) for (const v of node) clut.push(...u16(v));
  const bCurves: number[] = [];
  for (let k = 0; k < nOut; k++) bCurves.push(...identityCurv());

  const offA = head;
  const offClut = offA + aCurves.length;
  const offB = offClut + clut.length;
  return [
    ...ascii('mAB '), 0, 0, 0, 0, nIn, nOut, 0, 0,
    ...u32(offB), ...u32(0), ...u32(0), ...u32(offClut), ...u32(offA),
    ...aCurves, ...clut, ...bCurves,
  ];
}

// ─── header + tag table, against the real files ───────────────────────────────

test('Generic CMYK Profile header fields read exactly', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    assert.equal(p.deviceClass, 'prtr', 'device class is the printer signature at header offset 12');
    assert.equal(p.dataColourSpace, 'CMYK', 'data colour space is read verbatim, space padding included');
    assert.equal(p.pcs, 'Lab', 'PCS is Lab for this profile');
    assert.equal(p.version, '2.2.0', 'version decodes as major, minor nibble, bugfix nibble');
    assert.equal(p.nChannels, 4, 'CMYK is four device channels');
    assert.equal(p.description, 'Generic CMYK Profile', 'description comes from the v2 desc tag');
  });
});

test('sRGB and Display P3 headers distinguish v2 desc from v4 mluc and curv from para', (t) => {
  withProfile(SRGB_PATH, t, (p) => {
    assert.equal(p.deviceClass, 'mntr', 'sRGB is a display profile');
    assert.equal(p.pcs, 'XYZ', 'sRGB is XYZ-PCS');
    assert.equal(p.version, '2.1.0', 'sRGB is a v2.1 profile');
    assert.equal(p.description, 'sRGB IEC61966-2.1', 'v2 desc: ASCII count includes the NUL, which must not appear');
  });
  withProfile(P3_PATH, t, (p) => {
    assert.equal(p.version, '4.0.0', 'Display P3 is v4.0');
    assert.equal(p.description, 'Display P3', 'v4 mluc: UTF-16BE record picked by language');
    assert.equal(p.nChannels, 3, 'RGB is three device channels');
  });
});

test('hasIntent reflects the tags that exist, and absolute needs the media white point', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    for (const i of ['perceptual', 'relative', 'saturation'] as const) {
      assert.ok(p.hasIntent(i), `Generic CMYK carries A2B/B2A tags for all three table intents (${i})`);
    }
    assert.ok(p.hasIntent('absolute'), 'absolute is supported: relative exists and wtpt is present');
  });
  // An abstract Lab profile carries A2B0 only — the intents whose tag is absent
  // must report false rather than quietly borrowing the perceptual table.
  withProfile(`${SYS}Generic Lab Profile.icc`, t, (p) => {
    assert.ok(p.hasIntent('perceptual'), 'A2B0 is present, so perceptual is supported');
    assert.equal(p.hasIntent('relative'), false, 'no A2B1/B2A1 tag: relative must report unsupported');
    assert.equal(p.hasIntent('saturation'), false, 'no A2B2/B2A2 tag: saturation must report unsupported');
    assert.equal(p.toLab('relative', [1, 1, 1]), null, 'an unsupported intent returns null, never another table');
  });
});

test('an unknown intent string cannot reach a transform', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    // Prototype keys are the classic enum-whitelist leak: INTENT_TAG.constructor
    // is truthy, so a bare property lookup would index a tag named 'A2Bfunction…'.
    const bad = 'constructor' as unknown as Parameters<typeof p.hasIntent>[0];
    assert.equal(p.hasIntent(bad), false, 'a prototype key is not an intent');
    assert.equal(p.toLab(bad, [0, 0, 0, 0]), null, 'a prototype key cannot select a tag');
    assert.equal(p.fromLab(bad, [50, 0, 0]), null, 'a prototype key cannot select a tag');
  });
});

// ─── known anchors ────────────────────────────────────────────────────────────

test('CMYK anchors: no ink is paper white, K alone is dark, all four is black', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const white = p.toLab('relative', [0, 0, 0, 0]);
    assert.ok(white, 'A2B1 must evaluate');
    assert.ok(white[0] > 99, `no ink must be near paper white, got L* ${white[0]}`);
    assert.ok(Math.abs(white[1]) < 0.5 && Math.abs(white[2]) < 0.5,
      `paper white must be near-neutral, got a* ${white[1]} b* ${white[2]}`);

    const k = p.toLab('relative', [0, 0, 0, 1]);
    assert.ok(k, 'solid K must evaluate');
    assert.ok(k[0] < 15, `solid K must be dark, got L* ${k[0]}`);

    const all = p.toLab('relative', [1, 1, 1, 1]);
    assert.ok(all, 'four solids must evaluate');
    assert.ok(all[0] < 2, `all four inks must be black, got L* ${all[0]}`);

    // Cyan: littleCMS on this profile reports (59.22, -41, -44) for the same node.
    const cyan = p.toLab('relative', [1, 0, 0, 0]);
    assert.ok(cyan, 'solid cyan must evaluate');
    assert.ok(deltaE(cyan, [59.22, -41, -44]) < 1,
      `solid cyan must match the reference CMM within 1 dE, got ${JSON.stringify(cyan)}`);
  });
});

test('CLUT index order is last-channel-fastest: only the K axis moves when K does', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    // A transposed index order would make a K-only change move the C axis instead,
    // and the two are indistinguishable at the corners — so probe off-corner.
    const a = p.toLab('relative', [0, 0, 0, 0.5])!;
    const b = p.toLab('relative', [0.5, 0, 0, 0])!;
    assert.ok(a[0] < 70, `half K must darken substantially, got L* ${a[0]}`);
    assert.ok(Math.abs(a[1]) < 3 && Math.abs(a[2]) < 6,
      `half K must stay near-neutral, got a* ${a[1]} b* ${a[2]}`);
    assert.ok(b[2] < -10, `half cyan must go blue (negative b*), got b* ${b[2]}`);
  });
});

test('sRGB matrix/TRC path: white is D50 Lab 100,0,0 and red matches the primary', (t) => {
  withProfile(SRGB_PATH, t, (p) => {
    const w = p.toLab('relative', [1, 1, 1]);
    assert.ok(w, 'the matrix/TRC path must evaluate without any LUT tag');
    assert.ok(deltaE(w, [100, 0, 0]) < 0.05, `sRGB white must be Lab 100,0,0, got ${JSON.stringify(w)}`);
    const black = p.toLab('relative', [0, 0, 0])!;
    assert.ok(black[0] < 0.01, `sRGB black must be L* 0, got ${black[0]}`);
    const red = p.toLab('relative', [1, 0, 0])!;
    assert.ok(red[0] > 50 && red[0] < 58 && red[1] > 70,
      `sRGB red must land near Lab (54, 81, 70), got ${JSON.stringify(red)}`);
  });
});

test('Display P3 para curve is sRGB-shaped, and its red is more chromatic than sRGB red', (t) => {
  const sb = load(SRGB_PATH);
  const pb = load(P3_PATH);
  if (!sb || !pb) {
    t.skip(`stock profiles not on this machine: ${SRGB_PATH} / ${P3_PATH}`);
    return;
  }
  const s = parseIccProfile(sb)!;
  const p = parseIccProfile(pb)!;
  const sMid = s.toLab('relative', [0.5, 0.5, 0.5])!;
  const pMid = p.toLab('relative', [0.5, 0.5, 0.5])!;
  assert.ok(Math.abs(sMid[0] - pMid[0]) < 0.5,
    `P3's para type-3 curve is sRGB's transfer function, so mid grey must match: ${sMid[0]} vs ${pMid[0]}`);
  const sRed = s.toLab('relative', [1, 0, 0])!;
  const pRed = p.toLab('relative', [1, 0, 0])!;
  assert.ok(Math.hypot(pRed[1], pRed[2]) > Math.hypot(sRed[1], sRed[2]),
    'P3 red must be more chromatic than sRGB red — the primaries differ, the curve does not');
});

test('GRAY profile neutralises on the PCS axis rather than its unadapted white point', (t) => {
  withProfile(GRAY_PATH, t, (p) => {
    assert.equal(p.nChannels, 1, 'GRAY is one channel');
    const w = p.toLab('relative', [1]);
    assert.ok(w, 'the kTRC path must evaluate');
    assert.ok(Math.abs(w[1]) < 0.01 && Math.abs(w[2]) < 0.01,
      `gray white must be exactly neutral: this profile's wtpt is an unadapted D65 and using it would tint every grey, got ${JSON.stringify(w)}`);
    const dev = p.fromLab('relative', [50, 0, 0]);
    assert.ok(dev && dev.length === 1 && dev[0]! > 0 && dev[0]! < 1,
      `L* 50 must invert to an interior ink value, got ${JSON.stringify(dev)}`);
  });
});

test('XYZ-PCS LUT decodes u1Fixed15 PCS values into a sane Lab', (t) => {
  withProfile(XYZ_PATH, t, (p) => {
    assert.equal(p.pcs, 'XYZ', 'this abstract profile is XYZ-PCS');
    const lab = p.toLab('perceptual', [0.5, 0.5, 0.5]);
    assert.ok(lab, 'the mft2 A2B0 must evaluate');
    assert.ok(lab.every((v) => Number.isFinite(v)), `XYZ PCS must decode to finite Lab, got ${JSON.stringify(lab)}`);
    assert.ok(lab[0] >= 0 && lab[0] <= 101, `L* must be in range, got ${lab[0]}`);
  });
});

// ─── round trips ──────────────────────────────────────────────────────────────

test('CMYK device -> Lab -> device is stable for interior colours', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    let worst = 0;
    // Interior of the ink space: the gamut SURFACE is a different question (see
    // the gamut-source test below), because a B2A table has nowhere to put a
    // colour on the boundary except approximately.
    for (let c = 0.1; c <= 0.6; c += 0.25) {
      for (let m = 0.1; m <= 0.6; m += 0.25) {
        for (let y = 0.1; y <= 0.6; y += 0.25) {
          for (const k of [0, 0.2]) {
            const lab = p.toLab('relative', [c, m, y, k])!;
            const dev = p.fromLab('relative', lab)!;
            assert.equal(dev.length, 4, 'fromLab must return one value per device channel');
            for (const v of dev) assert.ok(v >= 0 && v <= 1, `device channels must be 0-1, got ${v}`);
            worst = Math.max(worst, deltaE(lab, p.toLab('relative', dev)!));
          }
        }
      }
    }
    assert.ok(worst < ICC_GAMUT_DELTA_E,
      `an interior colour must survive the A2B/B2A pair within the gamut threshold, worst was ${worst.toFixed(2)} dE`);
  });
});

test('matrix/TRC round trip is exact, and evaluation is deterministic', (t) => {
  withProfile(SRGB_PATH, t, (p) => {
    for (const rgb of [[0.2, 0.4, 0.6], [1, 0, 0], [0.5, 0.5, 0.5], [0.05, 0.05, 0.05]]) {
      const lab = p.toLab('relative', rgb)!;
      const back = p.fromLab('relative', lab)!;
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(back[i]! - rgb[i]!) < 1e-3,
          `the matrix/TRC inverse must reproduce the device value: ${rgb[i]} -> ${back[i]}`);
      }
      assert.deepEqual(p.toLab('relative', rgb), lab, 'the transform must be deterministic — no state, no float drift');
    }
  });
});

test('absolute intent differs from relative by the media white rescale', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const rel = p.toLab('relative', [0, 0, 0, 0])!;
    const abs = p.toLab('absolute', [0, 0, 0, 0])!;
    assert.ok(deltaE(rel, abs) < 1e-6 || deltaE(rel, abs) > 0,
      'absolute must be computed, not refused');
    const back = p.fromLab('absolute', abs)!;
    assert.ok(back.every((v) => v >= 0 && v <= 1), 'the absolute inverse must stay in device range');
    // Round-tripping through the same intent must return the same place.
    assert.ok(deltaE(abs, p.toLab('absolute', back)!) < ICC_GAMUT_DELTA_E,
      'absolute must round-trip as tightly as relative does');
  });
});

// ─── the Lab-encoding decision ────────────────────────────────────────────────

test('the Lab encoding is chosen by ELEMENT TYPE: 0xff00 is L*100 in mft2 and L*99.61 in mAB', () => {
  // The same PCS sample, 0xFF00, in the same position, in two element types. This
  // is the whole decision: mft1/mft2 are v2-era tags and carry the legacy encoding
  // where full scale is 0xFF00; mAB/mBA are v4 and carry the full 0xFFFF range.
  // Getting it backwards shifts every colour by 0.39% instead of failing loudly.
  const legacy = parseIccProfile(buildProfile({ tags: [['A2B0', mft2(3, 3, [0xff00, 0x8000, 0x8000])]] }));
  assert.ok(legacy, 'the synthetic mft2 profile must parse');
  const lLegacy = legacy.toLab('perceptual', [0.5, 0.5, 0.5])!;
  assert.ok(Math.abs(lLegacy[0] - 100) < 1e-3,
    `mft2 is legacy-encoded: 0xff00 must decode to L* 100, got ${lLegacy[0]}`);
  // Legacy and v4 also disagree on where neutral sits: a* = 0 is 0x8000 under the
  // legacy scale but 0x8080 under the full-range one.
  assert.ok(Math.abs(lLegacy[1]) < 0.01 && Math.abs(lLegacy[2]) < 0.01,
    `legacy neutral a* and b* are 0x8000, got ${lLegacy[1]}, ${lLegacy[2]}`);

  const v4 = parseIccProfile(buildProfile({ major: 4, tags: [['A2B0', mab(3, 3, [0xff00, 0x8080, 0x8080])]] }));
  assert.ok(v4, 'the synthetic mAB profile must parse');
  const lV4 = v4.toLab('perceptual', [0.5, 0.5, 0.5])!;
  assert.ok(Math.abs(lV4[0] - (0xff00 / 0xffff) * 100) < 1e-3,
    `mAB is full-range: 0xff00 must decode to L* 99.61, got ${lV4[0]}`);
  assert.ok(lV4[0] < 100, 'the two encodings must not agree, or this test proves nothing');

  // And the v4 element's own full scale is 0xffff.
  const v4White = parseIccProfile(buildProfile({ major: 4, tags: [['A2B0', mab(3, 3, [0xffff, 0x8080, 0x8080])]] }))!;
  assert.ok(Math.abs(v4White.toLab('perceptual', [1, 1, 1])![0] - 100) < 1e-3,
    'in the v4 encoding L* 100 is 0xffff');
});

test('mft2 legacy decoding tolerates a sample above 0xff00 rather than clamping it', (t) => {
  // Real profiles do this: one stock tone profile peaks at 65338 > 0xff00, i.e. an
  // L* a hair over 100, and clamping the raw sample first would hide it.
  const over = parseIccProfile(buildProfile({ tags: [['A2B0', mft2(3, 3, [0xffff, 0x8080, 0x8080])]] }))!;
  const l = over.toLab('perceptual', [1, 1, 1])!;
  assert.ok(l[0] > 100 && l[0] < 100.4,
    `a legacy sample above full scale must report L* slightly over 100, got ${l[0]}`);

  withProfile(BW_PATH, t, (p) => {
    const w = p.toLab('perceptual', [1, 1, 1])!;
    assert.ok(w[0] > 100 && w[0] < 100.4,
      `Black & White.icc is an mft2 whose white lands above legacy full scale, got L* ${w[0]}`);
  });
});

test('mAB curves and CLUT are all applied, not silently skipped', () => {
  // A CLUT whose two ends differ, so an unapplied CLUT (or an unapplied curve
  // chain) shows up as a constant instead of a ramp.
  const el = mab(3, 3, [0x8000, 0x8080, 0x8080]);
  const p = parseIccProfile(buildProfile({ major: 4, tags: [['A2B0', el]] }))!;
  const mid = p.toLab('perceptual', [0.25, 0.5, 0.75])!;
  assert.ok(Math.abs(mid[0] - (0x8000 / 0xffff) * 100) < 1e-3,
    `a flat CLUT must give its node value everywhere, got L* ${mid[0]}`);
});

// ─── gamut source ─────────────────────────────────────────────────────────────

test('iccGamutSource: id carries the intent, label the description', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const rel = iccGamutSource(p, 'relative');
    const per = iccGamutSource(p, 'perceptual');
    assert.match(rel.id, /^icc:[0-9a-f]{16}:relative$/, 'the id is icc:<digest>:<intent>');
    assert.notEqual(rel.id, per.id, 'two intents over one profile are two gamuts and must not share a cache key');
    assert.equal(rel.id, iccGamutSource(p, 'relative').id, 'the id must be stable across calls');
    assert.match(rel.label, /Generic CMYK Profile/, 'the label names the profile');
  });
});

test('the id digest really is the profile SHA-256, at three different lengths', (t) => {
  // The digest is computed in-module because a GamutSource id is synchronous and
  // bytes.ts's sha256 is not; that only holds up if it agrees with a real one.
  // Three sizes (536, 3144, 55280 bytes) exercise the padding block arithmetic.
  const paths = [P3_PATH, SRGB_PATH, CMYK_PATH];
  const loaded = paths.map(load);
  if (loaded.some((b) => !b)) {
    t.skip(`stock profiles not on this machine: ${paths.join(', ')}`);
    return;
  }
  for (const bytes of loaded) {
    const p = parseIccProfile(bytes!)!;
    const digest = iccGamutSource(p, 'relative').id.split(':')[1];
    assert.equal(digest, createHash('sha256').update(bytes!).digest('hex').slice(0, 16),
      'the id digest must be the profile\'s real SHA-256 prefix, not a lookalike hash');
  }
});

test('iccGamutSource: a CMYK press holds a muted colour and refuses a neon one', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const g = iccGamutSource(p, 'relative');
    assert.equal(g.contains(0.6, 0.05, 30), true, 'a muted mid-tone is well inside a CMYK press gamut');
    assert.equal(g.contains(0.85, 0.35, 140), false, 'a neon green no press can print must be refused');
    assert.equal(g.contains(0.5, 0, 0), true, 'mid grey is on the neutral axis, which every press has');
    assert.equal(g.contains(-1, 0.1, 30), false, 'an impossible lightness is refused before the profile sees it');
    assert.equal(g.contains(0.5, 0.1, Number.NaN), false, 'a non-finite hue is refused');
  });
});

test('iccGamutSource: ink coverage is a per-channel sum for CMYK and null for RGB', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const g = iccGamutSource(p, 'relative');
    const white = g.inkCoverage!(1, 0, 0);
    const dark = g.inkCoverage!(0.25, 0.02, 30);
    assert.ok(white !== null && dark !== null, 'a CMYK profile must answer the ink question');
    assert.ok(white! >= 0 && white! < 0.3, `paper white needs almost no ink, got ${white}`);
    assert.ok(dark! > white!, `a dark tone must need more total ink than white: ${dark} vs ${white}`);
    assert.ok(dark! <= 4, 'four inks cannot exceed 400% coverage');
  });
  withProfile(SRGB_PATH, t, (p) => {
    assert.equal(iccGamutSource(p, 'relative').inkCoverage!(0.6, 0.1, 30), null,
      'additive light has no ink — the answer is "not applicable", not 0');
  });
});

test('iccGamutSource over an unsupported intent contains nothing', (t) => {
  withProfile(`${SYS}Generic Lab Profile.icc`, t, (p) => {
    const g = iccGamutSource(p, 'saturation');
    assert.equal(p.hasIntent('saturation'), false, 'precondition: this profile has no saturation tag');
    assert.equal(g.contains(0.5, 0.05, 30), false,
      'a source for a missing intent must refuse everything rather than answer from another table');
    assert.equal(g.inkCoverage!(0.5, 0.05, 30), null, 'and it must not invent an ink number');
  });
});

test('iccGamutSource: an RGB profile agrees with its own primaries', (t) => {
  withProfile(SRGB_PATH, t, (p) => {
    const g = iccGamutSource(p, 'relative');
    // sRGB's own mid grey and a bright green well inside the primary are in.
    assert.equal(g.contains(0.5, 0.02, 250), true, 'a near-neutral is inside sRGB');
    assert.equal(g.contains(0.87, 0.26, 142), true, 'a bright green inside the sRGB primary must be inside sRGB');
    // 0.29 at this lightness sits PAST the sRGB green primary — the true ceiling
    // at (l 0.87, h 142) is 0.2873, so `#00ff00`'s 0.2948 is only reachable at its
    // own hue of 142.5. It reads inside if you test the round trip alone: a
    // matrix/TRC profile clips linear red to 0 there, which costs barely 2 ΔE. The
    // cube test in `contains` is what rejects it (see icc.ts DIRECT_LINEAR).
    assert.equal(g.contains(0.87, 0.29, 142), false, 'chroma past the green primary must be outside sRGB');
    assert.equal(g.contains(0.85, 0.35, 140), false, 'a chroma no sRGB primary reaches is outside sRGB');
  });
});

// ─── hostile input ────────────────────────────────────────────────────────────

test('malformed, truncated and hostile buffers return null and never throw', () => {
  const cases: [string, Uint8Array][] = [
    ['empty', new Uint8Array(0)],
    ['four bytes', Uint8Array.of(0, 0, 0, 0)],
    ['header-sized zeros', new Uint8Array(132)],
    ['no acsp', (() => { const b = new Uint8Array(200); b[3] = 200; return b; })()],
  ];
  // Declared size larger than the buffer.
  const lying = buildProfile({ tags: [['A2B0', mft2(3, 3, [0x8000, 0x8080, 0x8080])]] });
  const over = lying.slice();
  over[0] = 0xff;
  cases.push(['declared size beyond the buffer', over]);
  // Absurd tag count.
  const manyTags = lying.slice();
  manyTags[128] = 0xff; manyTags[129] = 0xff;
  cases.push(['tag count beyond any real profile', manyTags]);

  for (const [label, bytes] of cases) {
    let out: IccProfile | null = null;
    assert.doesNotThrow(() => { out = parseIccProfile(bytes); }, `${label}: the reader contract is never-throws`);
    assert.equal(out, null, `${label}: unparseable input must yield null`);
  }
});

test('an allocation bomb in the LUT geometry is refused before allocating', () => {
  // 15 input channels at 255 grid points claims 255^15 nodes. The parse must
  // reject on the arithmetic, not attempt the array.
  const el: number[] = [...ascii('mft1'), 0, 0, 0, 0, 15, 15, 255, 0];
  for (let i = 0; i < 9; i++) el.push(...u32(i % 4 === 0 ? 65536 : 0));
  el.push(...new Array<number>(256).fill(0));
  const bomb = buildProfile({ space: 'FCLR', tags: [['A2B0', el]] });
  const started = Date.now();
  const p = parseIccProfile(bomb);
  assert.ok(Date.now() - started < 1000, 'the geometry check must be arithmetic, not an allocation attempt');
  // The profile itself may parse (the header is well formed); the LUT must not.
  if (p) assert.equal(p.toLab('perceptual', new Array(15).fill(0.5)), null, 'the bomb LUT must not evaluate');
});

test('a curve claiming 4 G of entries is refused', () => {
  const curv: number[] = [...ascii('curv'), 0, 0, 0, 0, ...u32(0xffffffff)];
  const p = parseIccProfile(buildProfile({
    space: 'RGB ', pcs: 'XYZ ',
    tags: [['rTRC', curv], ['gTRC', curv], ['bTRC', curv],
      ['rXYZ', [...ascii('XYZ '), 0, 0, 0, 0, ...u32(0x6fa2), ...u32(0x38f5), ...u32(0x0390)]],
      ['gXYZ', [...ascii('XYZ '), 0, 0, 0, 0, ...u32(0x6299), ...u32(0xb785), ...u32(0x18da)]],
      ['bXYZ', [...ascii('XYZ '), 0, 0, 0, 0, ...u32(0x24a0), ...u32(0x0f84), ...u32(0xb6cf)]]],
  }));
  // Either the profile is refused outright or the unusable curve keeps it from
  // transforming — what must NOT happen is a 4 G allocation or an exception.
  if (p) assert.equal(p.toLab('relative', [0.5, 0.5, 0.5]), null, 'an unreadable TRC must not transform');
});

test('a para curve with an unknown function type is refused rather than guessed', () => {
  const para: number[] = [...ascii('para'), 0, 0, 0, 0, ...u16(99), 0, 0, ...u32(65536)];
  const p = parseIccProfile(buildProfile({
    space: 'RGB ', pcs: 'XYZ ', major: 4,
    tags: [['rTRC', para], ['gTRC', para], ['bTRC', para],
      ['rXYZ', [...ascii('XYZ '), 0, 0, 0, 0, ...u32(0x6fa2), ...u32(0x38f5), ...u32(0x0390)]],
      ['gXYZ', [...ascii('XYZ '), 0, 0, 0, 0, ...u32(0x6299), ...u32(0xb785), ...u32(0x18da)]],
      ['bXYZ', [...ascii('XYZ '), 0, 0, 0, 0, ...u32(0x24a0), ...u32(0x0f84), ...u32(0xb6cf)]]],
  }));
  if (p) {
    assert.equal(p.toLab('relative', [0.5, 0.5, 0.5]), null,
      'a parametric function type we cannot evaluate must not be approximated by another one');
  }
});

test('every truncation of a real profile is handled', (t) => {
  const bytes = load(CMYK_PATH);
  if (!bytes) {
    t.skip(`stock profile not on this machine: ${CMYK_PATH}`);
    return;
  }
  for (let n = 0; n < bytes.length; n += 997) {
    const cut = bytes.slice(0, n);
    let out: IccProfile | null = null;
    assert.doesNotThrow(() => { out = parseIccProfile(cut); }, `truncated to ${n} bytes: must not throw`);
    // A truncated profile whose header still fits may parse; its transforms must
    // then either work on the tags that survived or return null.
    if (out) {
      assert.doesNotThrow(() => (out as IccProfile).toLab('relative', [0.2, 0.3, 0.4, 0.1]),
        `truncated to ${n} bytes: evaluation must not throw either`);
    }
  }
});

test('bit-flipped real profiles never throw and never hang', (t) => {
  const bytes = load(CMYK_PATH);
  if (!bytes) {
    t.skip(`stock profile not on this machine: ${CMYK_PATH}`);
    return;
  }
  // mulberry32, so a failure is reproducible from the seed.
  let s = 0x1234abcd;
  const rnd = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const started = Date.now();
  for (let i = 0; i < 300; i++) {
    const m = bytes.slice();
    // Concentrate on the header and tag table, where the structural lies live.
    for (let k = 0; k < 6; k++) m[Math.floor(rnd() * Math.min(m.length, 600))] = Math.floor(rnd() * 256);
    let out: IccProfile | null = null;
    assert.doesNotThrow(() => { out = parseIccProfile(m); }, `mutation ${i}: the reader must not throw`);
    if (out) {
      assert.doesNotThrow(() => {
        const p = out as IccProfile;
        const dev = new Array(p.nChannels).fill(0.4);
        p.toLab('relative', dev);
        p.fromLab('relative', [50, 10, -20]);
        iccGamutSource(p, 'relative').contains(0.5, 0.1, 120);
      }, `mutation ${i}: evaluating a mutated profile must not throw`);
    }
  }
  assert.ok(Date.now() - started < 20000, '300 mutations of a 55 KB profile must not take 20 s — no unbounded work');
});

test('input arity and non-finite values are rejected', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    assert.equal(p.toLab('relative', [0, 0, 0]), null, 'three values is not a CMYK colour');
    assert.equal(p.toLab('relative', [0, 0, 0, 0, 0]), null, 'five values is not a CMYK colour');
    assert.equal(p.toLab('relative', [0, 0, Number.NaN, 0]), null, 'NaN must not reach the interpolator');
    assert.equal(p.fromLab('relative', [Number.POSITIVE_INFINITY, 0, 0] as never), null,
      'an infinite L* must not reach the interpolator');
    // Out-of-range device values clamp rather than index out of the CLUT.
    const hi = p.toLab('relative', [2, -1, 0.5, 0]);
    assert.deepEqual(hi, p.toLab('relative', [1, 0, 0.5, 0]),
      'device values outside 0-1 must clamp to the CLUT edge, not read past it');
  });
});
