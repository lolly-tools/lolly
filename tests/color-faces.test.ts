/**
 * A brand colour's faces (engine/src/color-faces.ts) — the generalisation of
 * PrintLock to every colour space and press profile.
 *
 * Two invariants carry the most weight here, and both are about data the user
 * authored:
 *
 *  1. An override keyed to a profile that is NOT currently mounted survives.
 *     Unplugging a profile must not delete a brand's authored build for it, and
 *     the failure mode is silent — a save after an unmount would write the loss
 *     to disk with nothing on screen to say so.
 *  2. `set` stays distinguishable from `auto`. A re-derive is allowed to
 *     recompute everything computed and must not touch anything chosen; collapse
 *     that distinction and a re-derive quietly overwrites the brand.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFaces, writeFace, colorFaces, faceDrift, canonicalValue,
} from '../engine/src/color-faces.ts';
import { parseColor, convertColor, formatColor } from '../engine/src/css-color.ts';

/** A derive that answers for the CSS spaces and for one mounted press profile. */
const MOUNTED = 'icc:ab12cd:relative';
const derive = (canonical: string, target: string): string | [number, number, number, number] | null => {
  if (target === MOUNTED) return [10, 90, 80, 5];
  const c = parseColor(canonical);
  if (!c) return null;
  if (target === 'srgb' || target === 'display-p3' || target === 'oklch') {
    return formatColor(convertColor(c, target === 'srgb' ? 'srgb' : target === 'display-p3' ? 'display-p3' : 'oklch'));
  }
  return null;   // an unmounted profile, or a space we cannot answer for
};

const TARGETS = [
  { target: 'srgb', label: 'sRGB' },
  { target: 'display-p3', label: 'Display-P3' },
  { target: MOUNTED, label: 'Coated FOGRA39, relative' },
];

test('an override for an UNMOUNTED profile survives', () => {
  const absent = 'icc:deadbe:perceptual';
  const stored = new Map([
    [absent, { value: [0, 88, 100, 2] as [number, number, number, number], label: 'A shop profile' }],
  ]);
  const faces = colorFaces('oklch(62% 0.2 145)', TARGETS, stored, derive);
  const kept = faces.find(f => f.target === absent);
  assert.ok(kept, 'the face is still there');
  assert.equal(kept!.origin, 'set');
  assert.deepEqual(kept!.value, [0, 88, 100, 2]);
  assert.equal(kept!.label, 'A shop profile', 'and can still be NAMED, not shown as a hash');
  assert.equal(kept!.drift, undefined, 'with no drift, since there is nothing to compare against');
  // It comes last: it is not a choice the reader can act on this session, and
  // interleaving it among live targets would imply otherwise.
  assert.equal(faces[faces.length - 1]!.target, absent);
});

test('set and auto stay distinguishable, and an override wins', () => {
  const stored = new Map([['srgb', { value: '#00b050' }]]);
  const faces = colorFaces('oklch(62% 0.2 145)', TARGETS, stored, derive);
  const srgb = faces.find(f => f.target === 'srgb')!;
  const p3 = faces.find(f => f.target === 'display-p3')!;
  assert.equal(srgb.origin, 'set');
  assert.equal(srgb.value, '#00b050', 'the authored bake wins over the computed one');
  assert.equal(p3.origin, 'auto');
  assert.ok(typeof srgb.drift === 'number' && srgb.drift > 0,
    `an authored face reports its distance from the automatic answer (${srgb.drift})`);
  assert.equal(p3.drift, undefined, 'a derived face has no drift by construction');
});

test('a target that cannot be derived and was not authored is simply absent', () => {
  const faces = colorFaces('oklch(62% 0.2 145)', [{ target: 'rec2100-pq' }], new Map(), derive);
  assert.equal(faces.length, 0, 'nothing to show, and nothing invented');
});

test('drift is ΔE for colours and worst-ink for builds', () => {
  const near = faceDrift('#00b050', '#00b154');
  assert.ok(typeof near === 'number' && near > 0 && near < 0.05, `a close pair is a small ΔE (${near})`);
  // Ink builds are compared by the largest SINGLE-ink gap, in points — what a
  // printer would actually notice, rather than a perceptual number about a
  // colour neither of the two builds is yet.
  assert.equal(faceDrift([0, 90, 100, 0], [4, 86, 100, 0]), 4);
  // Uncomparable pairs report nothing rather than 0 — a zero reads as
  // "identical" and would hide the very drift this number exists to show.
  assert.equal(faceDrift('#00b050', [0, 0, 0, 0]), undefined);
  assert.equal(faceDrift('not a colour', '#000000'), undefined);
});

test('faces round-trip through the vendor extension, and clearing leaves no crumb', () => {
  const ns: Record<string, unknown> = {};
  writeFace(ns, 'srgb', { value: '#00b050' });
  writeFace(ns, MOUNTED, { value: [0, 90, 100, 0], label: 'Coated FOGRA39, relative' });
  const back = readFaces(ns);
  assert.equal(back.size, 2);
  assert.equal(back.get('srgb')!.value, '#00b050');
  assert.deepEqual(back.get(MOUNTED)!.value, [0, 90, 100, 0]);
  assert.equal(back.get(MOUNTED)!.label, 'Coated FOGRA39, relative');

  writeFace(ns, 'srgb', null);
  writeFace(ns, MOUNTED, null);
  // Byte-identical to a token that never carried an override: without the prune,
  // every brand pack anyone experimented in keeps a `"faces": {}` crumb and every
  // diff shows churn that means nothing.
  assert.deepEqual(ns, {});
});

test('a hand-edited or future file loses at most the bad entry', () => {
  const faces = readFaces({
    faces: {
      good: { value: '#112233' },
      noValue: { label: 'x' },
      wrongType: { value: 42 },
      shortArray: { value: [1, 2, 3] },
      notAnObject: '#ffffff',
      '': { value: '#000000' },
      overInked: { value: [120, -5, 50, 0] },
    },
  });
  assert.equal(faces.get('good')!.value, '#112233');
  // Clamped, not rejected: 120% cyan is a typo with an obvious intent, and
  // throwing out the whole override would discard the other three numbers too.
  assert.deepEqual(faces.get('overInked')!.value, [100, 0, 50, 0]);
  for (const bad of ['noValue', 'wrongType', 'shortArray', 'notAnObject', '']) {
    assert.equal(faces.has(bad), false, `${bad} skipped`);
  }
  // And nothing about a malformed file throws.
  for (const junk of [null, undefined, 42, 'x', [], { faces: null }, { faces: [] }]) {
    assert.equal(readFaces(junk).size, 0);
  }
});

test('the canonical value is Lab, so print and screen meet without a display hop', () => {
  const lab = canonicalValue('oklch(62% 0.2 145)');
  assert.ok(lab && lab.startsWith('lab('), `stored as Lab: ${lab}`);
  // And it is lossless for a colour outside sRGB — the whole reason it is not a
  // hex. A P3-only green must survive the round trip with its chroma intact.
  const wide = canonicalValue('oklch(70% 0.25 145)')!;
  const back = convertColor(parseColor(wide)!, 'oklch');
  assert.ok(Math.abs((back.components[1] as number) - 0.25) < 0.001,
    `chroma survives (${back.components[1]})`);
  assert.equal(canonicalValue('not a colour'), null);
});
