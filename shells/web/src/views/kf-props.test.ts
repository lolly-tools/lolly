// SPDX-License-Identifier: MPL-2.0
/**
 * Per-property keyframing (plans/328): the track edits behind a field's diamond and the
 * timeline's property filter, the rules for which box can key which appearance property,
 * and the writer rule that keeps a keyframe holding one property from growing the rest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKf, serialiseKf } from '../../../../engine/src/keyframes.ts';
import {
  KF_GROUP_CHANNELS, KF_PROP_CHANNELS, isKfFilter, kfColourBase, kfFilterChannels, kfKeysMentioning, kfLookBase,
  kfLookRefusal, kfPropState, kfTrackDropChannels, kfTrackMoveChannels, kfTrackPutChannels,
} from './kf-props.ts';
import { writeKfPose, type TimeCfg } from './timeline-math.ts';

const cfg = {
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed', enterField: 'enter', exitField: 'exit',
  enterMsField: 'enterMs', exitMsField: 'exitMs', muteField: 'mute', laneField: 'lane', idField: 'id', kfField: 'kf',
} as TimeCfg;

test('a diamond reads none, animated or key for its own channels only', () => {
  const track = parseKf('t0_x0_s1*t500_cl0.5_ca0_cb0*t1000_x10_s2');
  assert.equal(kfPropState(track, null, KF_PROP_CHANNELS.fill), 'animated');
  assert.equal(kfPropState(track, 500, KF_PROP_CHANNELS.fill), 'key');
  assert.equal(kfPropState(track, 500, KF_PROP_CHANNELS.s), 'animated', 'a keyframe that does not hold scale is not a scale key');
  assert.equal(kfPropState(track, 1000, KF_PROP_CHANNELS.s), 'key');
  assert.equal(kfPropState(track, 0, KF_PROP_CHANNELS.cr), 'none');
});

test('putting and dropping one property leaves every other channel and keyframe alone', () => {
  const track = parseKf('t0_x0_s1*t1000_x10_s2');
  const put = serialiseKf(kfTrackPutChannels(track, 400, { lw: 6 }));
  assert.equal(put, 't0_x0_s1*t400_lw6*t1000_x10_s2', 'a new keyframe holding only the property');
  const merged = serialiseKf(kfTrackPutChannels(parseKf(put), 1000, { lw: 2 }));
  assert.equal(merged, 't0_x0_s1*t400_lw6*t1000_x10_s2_lw2', 'merged into an existing keyframe');
  assert.equal(serialiseKf(kfTrackDropChannels(parseKf(merged), 1000, ['lw'])), put);
  assert.equal(serialiseKf(kfTrackDropChannels(parseKf(put), 400, ['lw'])), 't0_x0_s1*t1000_x10_s2',
    'a keyframe left holding nothing goes');
  // A new keyframe takes the curve of the segment it is inserted into.
  const eased = parseKf('t0_eo_x0*t1000_x10');
  assert.equal(kfTrackPutChannels(eased, 500, { s: 2 }).find((k) => k.t === 500)?.ease, 'eo');
});

test('moving a group splits it out of a shared keyframe and keeps its curve', () => {
  const track = parseKf('t0_x0_cl0.5_ca0_cb0*t1000_ev_x10_cl0.6_ca0_cb0');
  const moved = serialiseKf(kfTrackMoveChannels(track, 1000, 1500, KF_GROUP_CHANNELS.fill));
  assert.equal(moved, 't0_x0_cl0.5_ca0_cb0*t1000_ev_x10*t1500_ev_cl0.6_ca0_cb0');
  const copied = serialiseKf(kfTrackMoveChannels(track, 0, 600, KF_GROUP_CHANNELS.fill, true));
  assert.equal(copied, 't0_x0_cl0.5_ca0_cb0*t600_cl0.5_ca0_cb0*t1000_ev_x10_cl0.6_ca0_cb0');
  // Landing on another keyframe merges into it and keeps that keyframe's curve.
  const landed = kfTrackMoveChannels(parseKf('t0_x0*t500_ek_s2*t1000_x10_lw4'), 1000, 500, ['lw']);
  assert.equal(serialiseKf(landed), 't0_x0*t500_ek_s2_lw4*t1000_x10');
  assert.equal(serialiseKf(kfTrackMoveChannels(track, 250, 600, ['lw'])), serialiseKf(track), 'no source keyframe: no change');
});

test('the filter shows a group\'s keyframes, or all of them', () => {
  const track = parseKf('t0_x0*t300_ts0*t900_x5_te1');
  assert.deepEqual(kfKeysMentioning(track, kfFilterChannels('trim')).map((k) => k.t), [300, 900]);
  assert.deepEqual(kfKeysMentioning(track, kfFilterChannels('position')).map((k) => k.t), [0, 900]);
  assert.equal(kfKeysMentioning(track, kfFilterChannels('all')).length, 3);
  assert.ok(isKfFilter('fill') && isKfFilter('all'));
  assert.equal(isKfFilter('__proto__'), false);
});

const F = { kind: 'kind', fill: 'bg', stroke: 'stroke', strokeW: 'strokeW', radius: 'radius', shape: 'shape' };

test('which box can key which appearance property, and why not', () => {
  const box = { kind: 'box', shape: 'rounded', radius: 8, bg: '#fff', stroke: '#000', strokeW: 2 };
  for (const p of ['fill', 'stroke', 'lw', 'cr', 'ts', 'te'] as const) assert.equal(kfLookRefusal(p, box, F), null, p);
  assert.equal(kfLookRefusal('s', { kind: 'audio' }, F), null, 'pose properties are not this rule\'s business');
  assert.equal(kfLookRefusal('fill', { ...box, bg: 'transparent' }, F), 'no-fill');
  assert.equal(kfLookRefusal('stroke', { ...box, stroke: '' }, F), 'no-stroke');
  assert.equal(kfLookRefusal('cr', { ...box, shape: 'ellipse' }, F), 'shape');
  assert.equal(kfLookRefusal('lw', { ...box, strokeAlign: 'outside' }, F), 'placement');
  assert.equal(kfLookRefusal('ts', { ...box, strokeTop: 5 }, F), 'sides');
  assert.equal(kfLookRefusal('ts', { ...box, strokeTop: 2 }, F), null, 'a side equal to the width is not a difference');
  assert.equal(kfLookRefusal('te', { ...box, image: 'lolly/logo/primary' }, F), 'picture');
  const path = { kind: 'path', stroke: '#000', strokeW: 3, headEnd: 'triangle' };
  assert.equal(kfLookRefusal('ts', path, F), 'arrowheads');
  assert.equal(kfLookRefusal('lw', path, F), null);
  assert.equal(kfLookRefusal('cr', path, F), 'no-field');
  assert.equal(kfLookRefusal('fill', { kind: 'frame', bg: '#fff' }, F), 'no-field');
});

test('a first key takes the box\'s own value, so keying changes nothing on screen', () => {
  const box = { kind: 'box', shape: 'rounded', radius: 8, bg: 'var(--brand-primary, #1e293b)', stroke: '#ff0000', strokeW: 3 };
  assert.deepEqual(kfLookBase('lw', box, F), { lw: 3 });
  assert.deepEqual(kfLookBase('cr', box, F), { cr: 8 });
  assert.deepEqual(kfLookBase('cr', { ...box, shape: 'rect' }, F), { cr: 0 }, 'a rectangle draws no radius');
  assert.deepEqual(kfLookBase('te', box, F), { te: 1 });
  assert.equal(kfColourBase('var(--brand-primary, #1e293b)'), '#1e293b', 'a brand colour keys its fallback');
  assert.equal(kfColourBase('var(--brand-primary)', () => 'rgb(10, 20, 30)'), 'rgb(10, 20, 30)', 'or the live colour');
  assert.equal(kfColourBase('transparent'), null);
  assert.ok(kfLookBase('fill', box, F)?.cl);
});

test('an edit on a keyframe writes only what it touches (the full pose is for a NEW keyframe)', () => {
  const rows = [{ id: 'a', start: 0, dur: 2, kf: 't0_x0_y0_s1_r0_o1*t500_cl0.5_ca0_cb0*t1000_x10_y0_s1_r0_o1' }];
  // Parked on the fill-only keyframe, a drag writes position into it and pins nothing else.
  const next = writeKfPose(rows, cfg, 'a', 0.5, { x: 5 }, 'add');
  const wire = String(next[0]!.kf);
  assert.match(wire, /\*t500_x10_cl0\.5_ca0_cb0\*/, 'x joins the keyframe; s, r and o do not');
  // On a full-pose keyframe the result is the one the full-pose rule wrote.
  const full = [{ id: 'a', start: 0, dur: 2, kf: 't0_x0_y0_s1_r0_o1*t1000_x10_y0_s1_r0_o1' }];
  assert.equal(String(writeKfPose(full, cfg, 'a', 1, { s: 2 }, 'set')[0]!.kf), 't0_x0_y0_s1_r0_o1*t1000_x10_y0_s2_r0_o1');
  // "+Keyframe" (an empty edit) on a new instant still writes the full active set.
  assert.equal(String(writeKfPose(full, cfg, 'a', 0.5, {}, 'set')[0]!.kf).split('*')[1]!.split('_').length, 6, 't500 and the five pose channels');
  // A track that keys only its appearance gets a pose seeded by "+Keyframe".
  const look = [{ id: 'a', start: 0, dur: 2, kf: 't0_cl0.5_ca0_cb0' }];
  assert.match(String(writeKfPose(look, cfg, 'a', 1, {}, 'set')[0]!.kf), /t1000_x0_y0_s1_r0_o1_cl0\.5_ca0_cb0/);
});
