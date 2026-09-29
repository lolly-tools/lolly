// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileMotionCues, parseMotionTiming, resolveCues, type MotionTiming } from '../engine/src/motion-cues.ts';

const timing: MotionTiming = { version: 1, tempo: { bpm: 123, offset: 0.17, beatsPerBar: 4 }, cues: [{ id: 'hit', beat: 4 }, { id: 'read', after: 'hit', offset: 0.5 }], bindings: [{ layerId: 'title', cueId: 'hit', target: 'start' }, { layerId: 'sound', cueId: 'hit', target: 'start' }, { layerId: 'title', cueId: 'read', target: 'enterEnd' }] };
test('a tempo edit moves visual and audio hits together without cumulative frame rounding', () => {
  const original = [{ id: 'title', start: 0, dur: 4 }, { id: 'sound', start: 0, dur: 1 }];
  const first = compileMotionCues(original, timing);
  assert.equal(first.boxes[0]!.start, 0.17 + 4 * 60 / 123);
  assert.equal(first.boxes[0]!.start, first.boxes[1]!.start);
  assert.ok(Math.abs(Number(first.boxes[0]!.enterMs) - 500) < 1e-9);
  assert.equal(original[0]!.start, 0);
  first.timing.tempo!.bpm = 90;
  const second = compileMotionCues(first.boxes, first.timing);
  assert.equal(second.boxes[0]!.start, 0.17 + 4 * 60 / 90);
  assert.equal(second.changes.filter(change => change.field === 'start').length, 2);
});
test('manual retiming detaches only the affected binding', () => {
  const first = compileMotionCues([{ id: 'title', start: 0, dur: 4 }, { id: 'sound', start: 0, dur: 1 }], timing);
  first.boxes[1]!.start = 7; first.timing.tempo!.bpm = 100;
  const next = compileMotionCues(first.boxes, first.timing);
  assert.equal(next.boxes[1]!.start, 7); assert.equal(next.detached.length, 1);
  assert.equal(next.detached[0]!.layerId, 'sound');
});
test('null BPM never invents a rhythm; duplicate, missing and cyclic cues fail', () => {
  assert.throws(() => parseMotionTiming({ ...timing, tempo: { ...timing.tempo, bpm: null } }), /known BPM/);
  for (const cues of [[{ id: 'a', at: 0 }, { id: 'a', at: 1 }], [{ id: 'a', after: 'missing' }], [{ id: 'a', after: 'b' }, { id: 'b', after: 'a' }]]) assert.throws(() => parseMotionTiming({ version: 1, cues, bindings: [] }));
  assert.deepEqual({ ...resolveCues(parseMotionTiming({ version: 1, cues: [{ id: 'silent', at: 2 }], bindings: [] })) }, { silent: 2 });
});

test('retiming neighboring keyframes validates their final combined order', () => {
  const result = compileMotionCues([{ id: 'a', start: 0, dur: 5, kf: 't0_x0*t1000_x10*t2000_x20' }], {
    version: 1, cues: [{ id: 'one', at: 2 }, { id: 'two', at: 3 }], bindings: [
      { layerId: 'a', cueId: 'one', target: 'keyframe', keyIndex: 1 },
      { layerId: 'a', cueId: 'two', target: 'keyframe', keyIndex: 2 },
    ],
  });
  assert.match(result.boxes[0]!.kf, /t2000.*t3000/);
  assert.equal(result.changes.length, 1);
});
