// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-captions tests - the cue→box transform behind Generate subtitles.
 *
 * The one invariant that matters: a cue is authored in MEDIA seconds and a box
 * lives in TIMELINE seconds, and the mapping between them must be the inverse
 * of timeline-math's trim arithmetic (trim-in moves clipIn by d × speed). If
 * these drift, captions land beside the words instead of on them the moment a
 * clip is trimmed or retimed.
 *
 * Run directly:  node --test shells/web/src/views/timeline-captions.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTION_BOX_CLASS, CAPTION_GROUP_PREFIX, MIN_CUE_KEEP_S, TRANSCRIPT_META_KEY, captionGroup, captionPreset,
  cueSpansOnTimeline, isCaptionGroup, transcriptWordsOf, ttsWordsOf, withCaptionPreset, wordTimingsOf,
} from './timeline-captions.ts';
import { MIN_DUR } from './timeline-math.ts';

const cue = (start: number, end: number, text = 'hello world') => ({ start, end, text });

test('captionGroup mints the prefixed id and isCaptionGroup recognises exactly that', () => {
  assert.equal(captionGroup('b7'), `${CAPTION_GROUP_PREFIX}b7`);
  assert.ok(isCaptionGroup('captions:b7'));
  assert.ok(!isCaptionGroup('b7'));
  assert.ok(!isCaptionGroup(''));
  assert.ok(!isCaptionGroup(null));
  assert.ok(!isCaptionGroup(42));
});

test('an untrimmed clip at 1x is a pure offset by the box start', () => {
  const out = cueSpansOnTimeline([cue(0.5, 2), cue(3, 4.5)], { start: 10, dur: 6, clipIn: 0, speed: 1 });
  assert.deepEqual(out, [
    { start: 10.5, end: 12, text: 'hello world' },
    { start: 13, end: 14.5, text: 'hello world' },
  ]);
});

test('clipIn shifts cues earlier: a trim-in of 2s moves every cue 2 media-seconds left', () => {
  const out = cueSpansOnTimeline([cue(3, 4)], { start: 10, dur: 6, clipIn: 2, speed: 1 });
  assert.deepEqual(out, [{ start: 11, end: 12, text: 'hello world' }]);
});

test('speed divides: at 2x a media second is half a timeline second (the trimClip inverse)', () => {
  const out = cueSpansOnTimeline([cue(2, 4)], { start: 10, dur: 5, clipIn: 0, speed: 2 });
  assert.deepEqual(out, [{ start: 11, end: 12, text: 'hello world' }]);
});

test('clipIn and speed compose exactly as trim arithmetic says: t = start + (m - clipIn) / speed', () => {
  // Media 5..7 through a window trimmed to clipIn=1 at 0.5x (slow motion).
  const out = cueSpansOnTimeline([cue(5, 7)], { start: 3, dur: 20, clipIn: 1, speed: 0.5 });
  assert.deepEqual(out, [{ start: 11, end: 15, text: 'hello world' }]);
});

test('cues wholly outside the visible window are dropped, straddlers are clamped to it', () => {
  const src = { start: 10, dur: 4, clipIn: 2, speed: 1 };   // shows media 2..6
  const out = cueSpansOnTimeline([
    cue(0, 1.5),      // entirely before the trim-in - gone
    cue(1, 3),        // straddles the in edge - clamped to the box start
    cue(5, 8),        // straddles the out edge - clamped to the box end
    cue(7, 9),        // entirely past the end - gone
  ], src);
  assert.deepEqual(out, [
    { start: 10, end: 11, text: 'hello world' },
    { start: 13, end: 14, text: 'hello world' },
  ]);
});

test('a clamped sliver below the keep floor is dropped; a survivor is floored to MIN_DUR', () => {
  const src = { start: 0, dur: 4, clipIn: 0, speed: 1 };
  // 20ms of visible overlap: under MIN_CUE_KEEP_S, dropped rather than flashed.
  assert.deepEqual(cueSpansOnTimeline([cue(3.98, 5)], src), []);
  assert.ok(MIN_CUE_KEEP_S < MIN_DUR, 'the keep floor sits under the model minimum by design');
  // 60ms survives the keep floor and is floored UP to an editable MIN_DUR box.
  const out = cueSpansOnTimeline([cue(0.5, 0.56)], src);
  assert.equal(out.length, 1);
  assert.ok(Math.abs((out[0]!.end - out[0]!.start) - MIN_DUR) < 1e-9, 'floored to MIN_DUR');
});

test('junk cues and junk source timing never throw and never emit', () => {
  const src = { start: 0, dur: 5, clipIn: 0, speed: 1 };
  assert.deepEqual(cueSpansOnTimeline([
    cue(2, 1),                        // inverted
    cue(NaN, 3),                      // non-finite
    { start: 1, end: 2, text: '  ' }, // blank text
  ], src), []);
  // Zero/negative/NaN source duration means there is no window at all.
  assert.deepEqual(cueSpansOnTimeline([cue(0, 1)], { start: 0, dur: 0, clipIn: 0, speed: 1 }), []);
  assert.deepEqual(cueSpansOnTimeline([cue(0, 1)], { start: 0, dur: NaN, clipIn: 0, speed: 1 }), []);
  // A junk speed reads as 1x rather than dividing by zero.
  assert.deepEqual(
    cueSpansOnTimeline([cue(1, 2)], { start: 0, dur: 5, clipIn: 0, speed: 0 }),
    [{ start: 1, end: 2, text: 'hello world' }],
  );
});

test('ttsWordsOf validates the meta.tts.words shape and rejects everything else', () => {
  const good = { tts: { words: [{ text: 'Hi', start: 0, end: 0.4 }, { text: 'there', start: 0.5, end: 0.9 }] } };
  assert.deepEqual(ttsWordsOf(good), [
    { text: 'Hi', start: 0, end: 0.4 },
    { text: 'there', start: 0.5, end: 0.9 },
  ]);
  // Bad entries are skipped, not fatal; an all-bad list reads as no timings.
  const mixed = { tts: { words: [{ text: 'ok', start: 0, end: 1 }, { text: '', start: 1, end: 2 }, { text: 'x', start: 3, end: 2 }] } };
  assert.deepEqual(ttsWordsOf(mixed), [{ text: 'ok', start: 0, end: 1 }]);
  assert.equal(ttsWordsOf({ tts: { words: [{ text: 'x', start: -1, end: 2 }] } }), null);
  assert.equal(ttsWordsOf({ tts: { words: [] } }), null);
  assert.equal(ttsWordsOf({ tts: {} }), null);
  assert.equal(ttsWordsOf({}), null);
  assert.equal(ttsWordsOf(null), null);
  assert.equal(ttsWordsOf('nope'), null);
});

test('transcriptWordsOf reads the meta.transcript rung, and never the tts one', () => {
  const note = { at: 1, engine: 'whisper', words: [{ text: 'Hi', start: 0, end: 0.4 }] };
  assert.deepEqual(transcriptWordsOf({ [TRANSCRIPT_META_KEY]: note }), [{ text: 'Hi', start: 0, end: 0.4 }]);
  // The two rungs are separate FACTS: a Whisper transcript of somebody's
  // recording must never be read as proof Lolly synthesised the clip.
  assert.equal(transcriptWordsOf({ tts: { words: [{ text: 'Hi', start: 0, end: 0.4 }] } }), null);
  assert.equal(ttsWordsOf({ [TRANSCRIPT_META_KEY]: note }), null);
  assert.equal(transcriptWordsOf({ [TRANSCRIPT_META_KEY]: { words: [] } }), null);
  assert.equal(transcriptWordsOf({ [TRANSCRIPT_META_KEY]: 'yes' }), null);
  assert.equal(transcriptWordsOf(null), null);
});

test('wordTimingsOf is the one validator both rungs read through', () => {
  assert.deepEqual(wordTimingsOf([{ text: 'a', start: 0, end: 1 }]), [{ text: 'a', start: 0, end: 1 }]);
  assert.equal(wordTimingsOf([]), null);
  assert.equal(wordTimingsOf('words'), null);
  assert.equal(wordTimingsOf([{ text: 'a', start: 'x', end: 1 }]), null);
});

// ── the lower-third preset (plans/180 section 4, layer 1) ────────────────────

test('the preset is a bottom-anchored lower third of the artboard it is given', () => {
  const p = captionPreset({ stageW: 1920, stageH: 1080 });
  assert.equal(p.fontSize, 49, '4.5% of 1080 - the broadcast band');
  assert.equal(p.w, 1536, '80% of the artboard width');
  assert.equal(p.x, (1920 - 1536) / 2, 'centred horizontally');
  assert.ok(p.y + p.h <= 1080 - 1080 * 0.08 + 1, 'the band clears the bottom edge');
  assert.ok(p.y > 1080 / 2, 'and it sits in the lower half - a lower third, not a title');
  assert.equal(p.align, 'center');
  assert.equal(p.valign, 'middle');
});

test('the preset is legible by construction: dark panel, light type, padding, soft corners', () => {
  const p = captionPreset({ stageW: 1920, stageH: 1080 });
  assert.equal(p.bg, '#000000cc', 'a translucent black panel, not bare text over a photograph');
  assert.equal(p.fg, '#ffffff');
  assert.equal(p.shape, 'rounded');
  assert.ok(p.radius > 0, 'rounded needs a radius to mean anything');
  assert.ok(p.pad > 0, 'type never touches the panel edge');
  assert.equal(p.cls, CAPTION_BOX_CLASS, 'and it carries the marker the export reads');
});

test('the preset scales with the artboard, and stays readable at both extremes', () => {
  const small = captionPreset({ stageW: 200, stageH: 120 });
  const huge = captionPreset({ stageW: 8000, stageH: 6000 });
  assert.equal(small.fontSize, 14, 'clamped up: 4.5% of 120px would be unreadable');
  assert.equal(huge.fontSize, 72, 'clamped down: a billboard does not get 270px captions');
  assert.ok(small.x >= 0 && small.x + small.w <= 200, 'a small artboard still lays the band out inside itself');
  assert.ok(huge.x + huge.w <= 8000 && huge.y + huge.h <= 6000, 'and so does a huge one');
  // No sizes at all is the 1920x1080 frame, so a caller with no artboard to hand
  // still gets a usable caption rather than a zero-sized box.
  assert.deepEqual(captionPreset(), captionPreset({ stageW: 1920, stageH: 1080 }));
  assert.deepEqual(captionPreset({ stageW: 0, stageH: -5 }), captionPreset());
});

test('withCaptionPreset fills the created boxes and never touches what the caller set', () => {
  const made = withCaptionPreset<Record<string, unknown>>(
    { id: 'b3', text: 'Slide one, spoken.', start: 2, dur: 1.4, group: captionGroup('b1') },
    { stageW: 1920, stageH: 1080 });
  // What the caller minted survives untouched...
  assert.equal(made.id, 'b3');
  assert.equal(made.text, 'Slide one, spoken.');
  assert.equal(made.start, 2);
  assert.equal(made.dur, 1.4);
  assert.equal(made.group, 'captions:b1');
  // ...and the look is filled in around it.
  const p = captionPreset({ stageW: 1920, stageH: 1080 });
  for (const k of ['bg', 'fg', 'pad', 'radius', 'shape', 'align', 'valign', 'fontSize', 'x', 'y', 'w', 'h'] as const) {
    assert.equal(made[k], p[k], `preset field ${k}`);
  }
  assert.equal(made.cls, CAPTION_BOX_CLASS);
});

test('withCaptionPreset FILLS, so a restyled caption keeps its own look - but never loses the marker', () => {
  const styled = withCaptionPreset<Record<string, unknown>>({ id: 'b4', text: 'x', bg: '#123456', fontSize: 30, cls: 'callout' });
  assert.equal(styled.bg, '#123456', 'an authored fill is not overwritten');
  assert.equal(styled.fontSize, 30);
  assert.equal(styled.cls, `callout ${CAPTION_BOX_CLASS}`, 'the caption class joins the authored classes');
  // Empty strings are unset, which is what a blank colour field holds.
  assert.equal(withCaptionPreset<Record<string, unknown>>({ bg: '' }).bg, '#000000cc');
  // Running it twice is the same box - re-generating a caption set is idempotent.
  assert.deepEqual(withCaptionPreset(styled), styled);
});
