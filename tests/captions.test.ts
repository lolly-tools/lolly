// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupWordsToCues, cuesForSlide, cuesToVtt, cuesToSrt, cueAt } from '../engine/src/captions.ts';
import type { CaptionCue } from '../engine/src/captions.ts';

/** Evenly-spaced word timings from a sentence - 0.3s per word, no gaps. */
function words(text: string, per = 0.3, from = 0): { text: string; start: number; end: number }[] {
  return text.split(/\s+/).map((w, i) => ({
    text: w,
    start: from + i * per,
    end: from + (i + 1) * per,
  }));
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

test('empty input yields no cues', () => {
  assert.deepEqual(groupWordsToCues([]), []);
});

test('a single word is a single cue spanning exactly that word', () => {
  const cues = groupWordsToCues([{ text: 'Hello', start: 0.5, end: 0.9 }]);
  assert.deepEqual(cues, [{ start: 0.5, end: 0.9, text: 'Hello' }]);
});

test('sentence punctuation ends the cue after the word carrying it', () => {
  const cues = groupWordsToCues(words('One two. Three four'));
  assert.equal(cues.length, 2);
  assert.equal(cues[0]!.text, 'One two.');
  assert.equal(cues[1]!.text, 'Three four');
  // The break lands between word 2 and word 3, so the times follow the words.
  assert.equal(cues[0]!.end, cues[1]!.start);
});

test('? ! and … end sentences too, including through a closing quote', () => {
  const cues = groupWordsToCues(words('Really? Yes! Well… "Sure." done'));
  assert.deepEqual(
    cues.map((c) => c.text),
    ['Really?', 'Yes!', 'Well…', '"Sure."', 'done'],
  );
});

test('an inter-word silence >= gapS starts a new cue', () => {
  const cues = groupWordsToCues([
    { text: 'before', start: 0, end: 0.3 },
    { text: 'after', start: 0.9, end: 1.2 }, // 0.6s pause - exactly the default gap
  ]);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { start: 0, end: 0.3, text: 'before' });
  assert.deepEqual(cues[1], { start: 0.9, end: 1.2, text: 'after' });
});

test('a silence just under gapS does NOT split', () => {
  const cues = groupWordsToCues([
    { text: 'before', start: 0, end: 0.3 },
    { text: 'after', start: 0.89, end: 1.2 },
  ]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0]!.text, 'before after');
});

test('six short words fit one default-width cue', () => {
  const cues = groupWordsToCues(words('alpha bravo casio delta expat fanta'));
  assert.equal(cues.length, 1);
  assert.equal(cues[0]!.text, 'alpha bravo casio delta expat fanta');
});

test('character overflow breaks BEFORE the word that would not fit', () => {
  // Six 5-char words with joining spaces: two joined are 11 chars, three are 17,
  // so maxChars 11 packs exactly two per cue and never exceeds the ceiling.
  const cues = groupWordsToCues(words('alpha bravo casio delta expat fanta'), { maxChars: 11 });
  assert.deepEqual(
    cues.map((c) => c.text),
    ['alpha bravo', 'casio delta', 'expat fanta'],
  );
  assert.ok(cues.every((c) => c.text.length <= 11));
  // The cue times track the words either side of each break.
  assert.deepEqual(cues[0], { start: 0, end: 0.6, text: 'alpha bravo' });
  assert.deepEqual(cues[1], { start: 0.6, end: 1.2, text: 'casio delta' });
});

test('a single word longer than maxChars still becomes its own cue', () => {
  const cues = groupWordsToCues(
    [
      { text: 'short', start: 0, end: 0.3 },
      { text: 'extraordinarily', start: 0.3, end: 1 },
    ],
    { maxChars: 8 },
  );
  assert.deepEqual(
    cues.map((c) => c.text),
    ['short', 'extraordinarily'],
  );
});

test('duration overflow starts a new cue', () => {
  // Slow words: 2s each, contiguous. Default maxDurationS=5 → at most 2 per cue
  // (the third word would end 6s after the cue start).
  const cues = groupWordsToCues(words('one two three four', 2));
  assert.equal(cues.length, 2);
  assert.equal(cues[0]!.text, 'one two');
  assert.equal(cues[1]!.text, 'three four');
  assert.ok(cues.every((c) => c.end - c.start <= 5));
});

test('whitespace-only "words" are skipped', () => {
  const cues = groupWordsToCues([
    { text: 'real', start: 0, end: 0.3 },
    { text: '  ', start: 0.3, end: 0.4 },
    { text: 'words', start: 0.4, end: 0.7 },
  ]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0]!.text, 'real words');
});

test('sentence-granular input passes through one cue per sentence', () => {
  // What host.speech returns when granularity is 'sentence'.
  const cues = groupWordsToCues([
    { text: 'First sentence here.', start: 0, end: 2.1 },
    { text: 'And a second one.', start: 2.1, end: 4.0 },
  ]);
  assert.equal(cues.length, 2);
  assert.equal(cues[0]!.text, 'First sentence here.');
  assert.equal(cues[1]!.text, 'And a second one.');
});

// ─── VTT ──────────────────────────────────────────────────────────────────────

test('cuesToVtt: header, dot-millis, blank-line separated', () => {
  const cues: CaptionCue[] = [
    { start: 0, end: 1.5, text: 'Hello there' },
    { start: 2, end: 3.25, text: 'Second cue' },
  ];
  assert.equal(
    cuesToVtt(cues),
    'WEBVTT\n\n' +
      '00:00:00.000 --> 00:00:01.500\nHello there\n\n' +
      '00:00:02.000 --> 00:00:03.250\nSecond cue\n',
  );
});

test('cuesToVtt: an hour-plus timestamp carries real hours and minutes', () => {
  const vtt = cuesToVtt([{ start: 3661.007, end: 3723.5, text: 'Late' }]);
  assert.ok(vtt.includes('01:01:01.007 --> 01:02:03.500'), vtt);
});

test('cuesToVtt of no cues is just the header', () => {
  assert.equal(cuesToVtt([]), 'WEBVTT\n\n\n');
});

// ─── SRT ──────────────────────────────────────────────────────────────────────

test('cuesToSrt: 1-based numbering, comma-millis, blank-line separated, no header', () => {
  const cues: CaptionCue[] = [
    { start: 0, end: 1.5, text: 'Hello there' },
    { start: 2, end: 3.25, text: 'Second cue' },
  ];
  assert.equal(
    cuesToSrt(cues),
    '1\n00:00:00,000 --> 00:00:01,500\nHello there\n\n' +
      '2\n00:00:02,000 --> 00:00:03,250\nSecond cue\n',
  );
});

test('cuesToSrt: an hour-plus timestamp carries real hours and minutes', () => {
  const srt = cuesToSrt([{ start: 7322.042, end: 7325, text: 'Very late' }]);
  assert.ok(srt.includes('02:02:02,042 --> 02:02:05,000'), srt);
});

// ─── cueAt ────────────────────────────────────────────────────────────────────

const TIMELINE: CaptionCue[] = [
  { start: 0, end: 1, text: 'a' },
  { start: 1.5, end: 3, text: 'b' },
  { start: 4, end: 5, text: 'c' },
];

test('cueAt finds the cue covering t', () => {
  assert.equal(cueAt(TIMELINE, 0.5)?.text, 'a');
  assert.equal(cueAt(TIMELINE, 2)?.text, 'b');
  assert.equal(cueAt(TIMELINE, 4.999)?.text, 'c');
});

test('cueAt returns null in gaps and outside the timeline', () => {
  assert.equal(cueAt(TIMELINE, 1.2), null); // between a and b
  assert.equal(cueAt(TIMELINE, -1), null); // before the first
  assert.equal(cueAt(TIMELINE, 9), null); // after the last
  assert.equal(cueAt([], 0), null); // no cues at all
});

test('cueAt boundaries: start is inclusive, end is exclusive', () => {
  assert.equal(cueAt(TIMELINE, 1.5)?.text, 'b'); // exactly at a start
  assert.equal(cueAt(TIMELINE, 1), null); // exactly at an end - the cue has left
  assert.equal(cueAt(TIMELINE, 3), null);
});

// ─── cuesForSlide (plans/180 T4) ──────────────────────────────────────────────
//
// A narrated slide's cues have to land on the words AND stay inside the slide. T1 and T3
// already size a slide to hold its narration, so under normal timing nothing is cut -
// but a slide shortened by hand must not push its last caption over the next slide's
// first words, which is the one failure a viewer notices immediately.

test('cuesForSlide places the clip at the lead-in and returns film-clock seconds', () => {
  // Three words at 0.3 s each, the slide starts at 5 s, narration 400 ms after that.
  const cues = cuesForSlide(words('One two three.'), 5000, 12_000, { offsetMs: 400 });
  assert.equal(cues.length, 1);
  assert.equal(cues[0]!.text, 'One two three.');
  assert.equal(cues[0]!.start, 5.4);
  assert.equal(cues[0]!.end, 6.3);
});

test('cuesForSlide with no offset starts the clip at the slide itself', () => {
  const cues = cuesForSlide(words('One two.'), 2000, 9000);
  assert.equal(cues[0]!.start, 2);
  assert.equal(cues[0]!.end, 2.6);
});

test('a cue running past the slide is clamped to the slide, never leaked onto the next', () => {
  // Two sentences; the second runs to 1.2 s of media, but the slide closes at 1.0 s.
  const cues = cuesForSlide(words('One two. Three four.'), 0, 1000);
  assert.equal(cues.length, 2);
  assert.equal(cues[1]!.start, 0.6);
  assert.equal(cues[1]!.end, 1, 'trimmed to the slide edge, not left hanging over the next slide');
  assert.ok(cues.every((c) => c.end <= 1 && c.start >= 0));
});

test('a cue entirely past the slide is dropped, and a sliver of one goes with it', () => {
  // 'Three four.' starts at 0.6 s; a slide ending at 0.6 s has no room for any of it.
  assert.deepEqual(
    cuesForSlide(words('One two. Three four.'), 0, 600).map((c) => c.text),
    ['One two.'],
  );
  // A slide ending 20 ms into the second cue leaves a flash, not a caption.
  assert.deepEqual(
    cuesForSlide(words('One two. Three four.'), 0, 620).map((c) => c.text),
    ['One two.'],
  );
  // …and 100 ms of it is worth keeping (the default floor is 50 ms).
  assert.deepEqual(
    cuesForSlide(words('One two. Three four.'), 0, 700).map((c) => c.text),
    ['One two.', 'Three four.'],
  );
});

test('cuesForSlide takes the grouping options through to groupWordsToCues', () => {
  const long = words('alpha bravo charlie delta echo foxtrot');
  assert.equal(cuesForSlide(long, 0, 30_000).length, 1, 'six short words fit one 42-char cue');
  assert.equal(cuesForSlide(long, 0, 30_000, { maxChars: 12 }).length, 4);
});

test('an empty or backwards window yields nothing, and never throws', () => {
  assert.deepEqual(cuesForSlide(words('One two.'), 5000, 5000), []);
  assert.deepEqual(cuesForSlide(words('One two.'), 5000, 1000), []);
  assert.deepEqual(cuesForSlide([], 0, 5000), []);
  assert.deepEqual(cuesForSlide(words('One.'), Number.NaN, Number.NaN), []);
  // A negative start is read as 0 rather than pulling cues before the film begins.
  assert.equal(cuesForSlide(words('One.'), -1000, 5000)[0]!.start, 0);
});
