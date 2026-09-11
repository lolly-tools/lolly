// SPDX-License-Identifier: MPL-2.0
/**
 * caption-format.ts - a transcript in, the exact text a `render.transcribe`
 * target input holds out (plans/147 T1a).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/caption-format.test.ts
 *
 * Byte-exact on purpose. An SRT written here is downloaded as a sidecar and read
 * by players that are strict about numbering, comma milliseconds and the blank
 * line between blocks, so "looks right" is not a test. What is pinned:
 *  - word-granular timings group through the ENGINE's grouper (sentence
 *    punctuation, the 42-char ceiling, the 0.6 s pause), never a second copy of
 *    that logic living in the shell;
 *  - segment-granular timings pass through as one cue each - regrouping them
 *    would either split a segment the model kept whole or glue two together;
 *  - timestamps round to milliseconds, and the hour field is real;
 *  - nothing in, nothing out: no bare `WEBVTT` header, no fabricated line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCaptions, transcriptToCues } from './caption-format.ts';
import type { SpeechWordTiming } from '@lolly-tools/core/host-v1';

const words = (...pairs: Array<[string, number, number]>): SpeechWordTiming[] =>
  pairs.map(([text, start, end]) => ({ text, start, end }));

// Two sentences: the full stop closes the first cue, so this is two cues without
// touching any ceiling.
const SPOKEN = words(
  ['Hello', 0, 0.4], ['there.', 0.42, 0.9],
  ['This', 1.6, 1.8], ['is', 1.85, 1.95], ['Lolly.', 2.0, 2.44],
);

test('word granularity: SRT is byte-exact', () => {
  assert.equal(
    formatCaptions({ words: SPOKEN, granularity: 'word' }, 'srt'),
    '1\n00:00:00,000 --> 00:00:00,900\nHello there.\n\n'
    + '2\n00:00:01,600 --> 00:00:02,440\nThis is Lolly.\n',
  );
});

test('word granularity: VTT is byte-exact, header and dot milliseconds', () => {
  assert.equal(
    formatCaptions({ words: SPOKEN, granularity: 'word' }, 'vtt'),
    'WEBVTT\n\n'
    + '00:00:00.000 --> 00:00:00.900\nHello there.\n\n'
    + '00:00:01.600 --> 00:00:02.440\nThis is Lolly.\n',
  );
});

test('words format is the plain spoken text, one cue per line, no timestamps', () => {
  assert.equal(formatCaptions({ words: SPOKEN, granularity: 'word' }, 'words'), 'Hello there.\nThis is Lolly.');
});

test('srt is the default format', () => {
  assert.equal(formatCaptions({ words: SPOKEN, granularity: 'word' }), formatCaptions({ words: SPOKEN, granularity: 'word' }, 'srt'));
});

test('segment granularity: one cue per entry, never regrouped', () => {
  // Each entry is a whole sentence the model already decided on. Grouping would
  // merge the two short ones (they are under every ceiling); it must not.
  const segs = words(
    ['Come in.', 0, 1.1],
    ['Sit down.', 1.2, 2.0],
  );
  assert.deepEqual(transcriptToCues({ words: segs, granularity: 'segment' }), [
    { start: 0, end: 1.1, text: 'Come in.' },
    { start: 1.2, end: 2.0, text: 'Sit down.' },
  ]);
  assert.equal(
    formatCaptions({ words: segs, granularity: 'segment' }, 'srt'),
    '1\n00:00:00,000 --> 00:00:01,100\nCome in.\n\n'
    + '2\n00:00:01,200 --> 00:00:02,000\nSit down.\n',
  );
  // The same spans read as WORDS would collapse into one cue - which is the
  // difference this test exists to hold.
  assert.equal(transcriptToCues({ words: segs, granularity: 'word' }).length, 2);
});

test('segment granularity drops entries no cue can be made of', () => {
  const junk: SpeechWordTiming[] = [
    { text: '   ', start: 0, end: 1 },                        // blank
    { text: 'kept', start: 1, end: 2 },
    { text: 'backwards', start: 5, end: 4 },                  // end before start
    { text: 'nan', start: Number.NaN, end: 1 },
  ];
  assert.deepEqual(transcriptToCues({ words: junk, granularity: 'segment' }), [
    { start: 1, end: 2, text: 'kept' },
  ]);
});

test('timestamps round to milliseconds and carry hours', () => {
  const late = words(['later.', 3661.0004, 3661.9996]);
  assert.equal(
    formatCaptions({ words: late, granularity: 'segment' }, 'srt'),
    '1\n01:01:01,000 --> 01:01:02,000\nlater.\n',
  );
});

test('an empty transcript writes an empty value, in every format', () => {
  for (const fmt of ['srt', 'vtt', 'words'] as const) {
    assert.equal(formatCaptions({ words: [], granularity: 'word' }, fmt), '');
    assert.equal(formatCaptions({ words: [] }, fmt), '');
  }
  assert.deepEqual(transcriptToCues({ words: [] }), []);
});

test('a transcript of nothing but blanks is empty, not a header', () => {
  const blanks = words(['', 0, 1], ['   ', 1, 2]);
  assert.equal(formatCaptions({ words: blanks, granularity: 'word' }, 'vtt'), '');
  assert.equal(formatCaptions({ words: blanks, granularity: 'segment' }, 'srt'), '');
});

test('granularity defaults to word when the transcript does not say', () => {
  const two = words(['one', 0, 0.3], ['two', 0.35, 0.6]);
  assert.equal(transcriptToCues({ words: two }).length, 1, 'grouped as words');
});

test('a line break inside a cue never splits the block', () => {
  // A blank line ends a cue in both grammars, so a payload holding one would
  // parse as a good cue plus a malformed fragment. CRLF counts.
  const t = { words: [{ text: 'Hello\r\n\r\nthere.', start: 0, end: 1 }], granularity: 'segment' as const };
  const srt = formatCaptions(t, 'srt');
  assert.equal(srt, '1\n00:00:00,000 --> 00:00:01,000\nHello there.\n');
  assert.equal(srt.split('\n\n').length, 1, 'exactly one SRT block');
  const vtt = formatCaptions(t, 'vtt');
  assert.equal(vtt, 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello there.\n');
  assert.equal(vtt.split('\n\n').length, 2, 'the header break and nothing else');
});

test('words keeps its one-line-per-cue promise', () => {
  const t = {
    words: [{ text: 'One\ntwo.', start: 0, end: 1 }, { text: 'Three.', start: 2, end: 3 }],
    granularity: 'segment' as const,
  };
  assert.deepEqual(formatCaptions(t, 'words').split('\n'), ['One two.', 'Three.']);
});
