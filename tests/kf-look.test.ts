// SPDX-License-Identifier: MPL-2.0
/**
 * The appearance channels (plans/328): fill and stroke colour in OKLab, stroke width,
 * corner radius and trim - the wire, the colour round trip, the interpolation space and
 * the paint each pose is written as.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KF_LOOK_CHANNELS, KF_LOOK_VARS, isKfLookChannel, kfColourCss, kfColourKey, kfLookPose, kfLookUsed,
  kfLookVars, kfOklabFromSrgb8, kfOklabOf, kfOklabToSrgb8, kfOutlinePath, kfTrimSpan,
} from '../engine/src/kf-look.ts';
import { KF_CHANNELS, evaluateKf, parseKf, serialiseKf } from '../engine/src/keyframes.ts';
import { linearSrgbToOklab, oklabToLinearSrgb, srgbToLinear, linearToSrgb } from '../engine/src/brand-derive.ts';

test('the appearance channels are the tail of the wire vocabulary, in order', () => {
  assert.deepEqual([...KF_CHANNELS.slice(-10)], [...KF_LOOK_CHANNELS]);
  for (const ch of KF_LOOK_CHANNELS) assert.ok(isKfLookChannel(ch), ch);
  for (const ch of ['x', 'o', 'w', 'v', 'e', '']) assert.equal(isKfLookChannel(ch), false, ch);
});

test('every 8-bit sRGB colour round-trips through a quantised OKLab key', () => {
  // A stride through the whole cube, every red value: 1.1 million colours, and every
  // one comes back as itself. At a quantum of 0.0001 about 0.25 % of them drifted by one
  // step in a dark channel, which is why the colour quantum is 0.00001.
  let bad = 0;
  for (let r = 0; r < 256; r++) for (let g = 0; g < 256; g += 3) for (let b = 0; b < 256; b += 5) {
    const k = kfOklabFromSrgb8(r, g, b);
    const [R, G, B] = kfOklabToSrgb8(k.l, k.a, k.b);
    if (R !== r || G !== g || B !== b) bad++;
  }
  assert.equal(bad, 0);
});

test('a colour key survives the wire: parse(serialise(key)) is the same colour', () => {
  for (const css of ['#ff0000', '#0000ff', '#00b10f', '#010203', '#fefefe', 'rgb(12 200 99)', 'oklch(0.7 0.15 30)']) {
    const key = kfColourKey(css, 'fill');
    assert.ok(key, css);
    const track = parseKf(serialiseKf([{ t: 0, v: key }]));
    const back = kfColourCss(evaluateKf(track, 0), 'fill');
    const want = kfColourCss(key, 'fill');
    assert.equal(back, want, css);
  }
  assert.equal(kfColourCss(kfColourKey('#3366ff', 'stroke')!, 'stroke'), '#3366ff');
});

test('the documented wire example is red to blue', () => {
  const wire = serialiseKf([
    { t: 0, v: kfColourKey('#ff0000', 'fill')! },
    { t: 1200, ease: 'eo', v: kfColourKey('#0000ff', 'fill')! },
  ]);
  assert.equal(wire, 't0_cl0.62796_ca0.22486_cb0.12585*t1200_eo_cl0.45201_ca-0.03246_cb-0.31153');
});

test('colour interpolates in OKLab, not in sRGB', () => {
  const track = parseKf(serialiseKf([
    { t: 0, ease: 'el', v: kfColourKey('#ff0000', 'fill')! },
    { t: 1000, v: kfColourKey('#0000ff', 'fill')! },
  ]));
  const mid = evaluateKf(track, 500);
  // The halfway point is the OKLab average of the two ends...
  const red = linearSrgbToOklab(1, 0, 0), blue = linearSrgbToOklab(0, 0, 1);
  assert.ok(Math.abs(mid.cl! - (red[0] + blue[0]) / 2) < 1e-4);
  assert.ok(Math.abs(mid.ca! - (red[1] + blue[1]) / 2) < 1e-4);
  // ...which is a lighter purple than the sRGB average (#800080).
  assert.notEqual(kfColourCss(mid, 'fill'), '#800080');
  const lin = oklabToLinearSrgb(mid.cl!, mid.ca!, mid.cb!);
  const enc = lin.map((v) => linearToSrgb(Math.min(1, Math.max(0, v))));
  assert.ok(enc[0]! > 0.5 && enc[2]! > 0.5, 'both ends stay bright through the middle');
  // An overshoot curve leaves the gamut for a moment; the paint is clipped, never NaN.
  const over = parseKf(serialiseKf([
    { t: 0, ease: 'ev', v: kfColourKey('#ff0000', 'fill')! },
    { t: 1000, v: kfColourKey('#ffff00', 'fill')! },
  ]));
  for (let t = 0; t <= 1000; t += 50) assert.match(kfColourCss(evaluateKf(over, t), 'fill')!, /^#[0-9a-f]{6}$/);
});

test('a translucent base keeps its alpha, which the key does not carry', () => {
  const c = kfOklabOf('#ff000080');
  assert.ok(c);
  assert.ok(Math.abs(c.alpha - 128 / 255) < 1e-3);
  assert.equal(kfColourCss(kfColourKey('#ff0000', 'fill')!, 'fill', 0.5), 'rgb(255 0 0 / 0.5)');
  assert.equal(kfOklabOf('transparent'), null);
  assert.equal(kfOklabOf('var(--brand-primary)'), null);
  assert.equal(kfOklabOf(''), null);
  assert.equal(kfColourKey('linear-gradient(red, blue)', 'fill'), null);
});

test('kfLookVars writes only what the pose keys, by the documented custom property names', () => {
  assert.deepEqual(kfLookVars({}), {});
  assert.deepEqual(kfLookVars({ x: 4, s: 2, o: 0.5 }), {});
  assert.deepEqual(kfLookVars({ lw: 3, cr: 12.5 }), { [KF_LOOK_VARS.width]: '3px', [KF_LOOK_VARS.radius]: '12.5px' });
  const v = kfLookVars({ ...kfColourKey('#336699', 'fill'), ...kfColourKey('#ffffff', 'stroke') });
  assert.equal(v[KF_LOOK_VARS.fill], '#336699');
  assert.equal(v[KF_LOOK_VARS.stroke], '#ffffff');
  assert.equal(KF_LOOK_VARS.fill, '--lolly-kf-fill');
});

test('trim: an ordered span, a whole stroke drawn solid, an empty one switched off', () => {
  assert.equal(kfTrimSpan({}), null);
  assert.deepEqual(kfTrimSpan({ te: 0.4 }), { from: 0, to: 0.4 });
  assert.deepEqual(kfTrimSpan({ ts: 0.7, te: 0.2 }), { from: 0.2, to: 0.7 }, 'reversed ends draw the same span');
  assert.deepEqual(kfLookVars({ ts: 0.25, te: 0.75 }), {
    [KF_LOOK_VARS.trim]: '0.5 2', [KF_LOOK_VARS.trimOffset]: '-0.25', [KF_LOOK_VARS.trimOn]: '1',
  });
  assert.deepEqual(kfLookVars({ ts: 0, te: 1 }), {
    [KF_LOOK_VARS.trim]: 'none', [KF_LOOK_VARS.trimOffset]: '0', [KF_LOOK_VARS.trimOn]: '1',
  });
  assert.equal(kfLookVars({ ts: 0.5, te: 0.5 })[KF_LOOK_VARS.trimOn], '0');
});

test('kfLookUsed and kfLookPose read only the appearance half of a track', () => {
  const track = parseKf('t0_x10_s1.2_lw2_ts0*t500_x40_lw8_te1*t1000_ts1');
  assert.deepEqual(kfLookUsed(track), ['lw', 'ts', 'te']);
  const pose = kfLookPose(track, 250);
  assert.deepEqual(Object.keys(pose).sort(), ['lw', 'te', 'ts']);
  assert.equal(kfLookUsed(parseKf('t0_x1*t10_x2')).length, 0);
});

test('an old reader skips the new tokens and keeps the rest of the keyframe', () => {
  // The pre-1.290 channel list, longest first: no new token can be read as one of these.
  const old = ['rx', 'ry', 'a', 'b', 'f', 'h', 'o', 'p', 'r', 's', 'v', 'w', 'x', 'y', 'z'];
  const num = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
  for (const tok of ['cl0.5', 'ca-0.1', 'cb0.2', 'll1', 'la0', 'lb-0.4', 'lw12.5', 'cr8', 'ts0.25', 'te1']) {
    const hit = old.find((ch) => tok.startsWith(ch) && num.test(tok.slice(ch.length)));
    assert.equal(hit, undefined, tok);
    assert.notEqual(tok[0], 'e', 'never mistaken for an ease token');
  }
});

test('kfOutlinePath: the frame inset by half a stroke, clockwise from the top-left corner', () => {
  assert.equal(kfOutlinePath('rect', 100, 60, 0, 2), 'M2 2H98V58H2Z');
  assert.equal(
    kfOutlinePath('rounded', 100, 60, 12, 1),
    'M12 1H88A11 11 0 0 1 99 12V48A11 11 0 0 1 88 59H12A11 11 0 0 1 1 48V12A11 11 0 0 1 12 1Z',
  );
  // A pill's radius is half its short side; an ellipse starts at its rightmost point.
  assert.match(kfOutlinePath('pill', 100, 40, 0, 0), /^M20 0H80A20 20/);
  assert.match(kfOutlinePath('ellipse', 100, 60, 0, 0), /^M100 30A50 30 0 0 1 50 60/);
  // A radius larger than the box is fitted, as CSS fits a border radius.
  assert.match(kfOutlinePath('rounded', 40, 20, 99, 0), /^M10 0H30A10 10/);
});

test('srgbToLinear and the OKLab matrices are the shared ones (no second copy here)', () => {
  const k = kfOklabFromSrgb8(255, 255, 255);
  const ref = linearSrgbToOklab(srgbToLinear(1), srgbToLinear(1), srgbToLinear(1));
  assert.ok(Math.abs(k.l - ref[0]) < 1e-5);
});
