// SPDX-License-Identifier: MPL-2.0
/**
 * Sentence splicing (plans/181 section 5.2): the line diff that decides what
 * gets re-synthesized, and the rebuild that drops new audio in while leaving
 * every untouched sample exactly where it was.
 *
 * The assertion that matters most is "every other sample equal". Everything else
 * about rewrite-in-place rests on it: if a splice quietly re-touched audio the
 * user did not edit, the promise that fixing a comma costs one sentence would
 * be a lie.
 *
 * Run: node --test shells/web/src/lib/tts-splice.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  diffScriptLines, spliceScriptAudio, decodeWavMono,
  type ScriptHunk, type SplicedLine,
} from './tts-splice.ts';
import { concatClips, SENTENCE_GAP_S } from './speech-kokoro.ts';
import type { SentenceClip } from './speech-kokoro.ts';
import { pcmToWavBlob } from './pcm-wav.ts';

const RATE = 100;   // small and round: 1 sample = 10 ms, gaps are 35 samples

/** A line's audio as a recognisable ramp, so a misplaced copy is obvious. */
function tone(seed: number, samples: number): Float32Array {
  const pcm = new Float32Array(samples);
  for (let i = 0; i < samples; i++) pcm[i] = seed + i / 1000;
  return pcm;
}

/** One line's clip: `words` evenly spread across its own samples. */
function line(seed: number, samples: number, texts: string[]): SentenceClip {
  const each = samples / RATE / texts.length;
  return {
    pcm: tone(seed, samples),
    words: texts.map((text, i) => ({ text, start: i * each, end: (i + 1) * each })),
  };
}

/** A three-line clip built the way the worker builds one. */
function clip(): ReturnType<typeof concatClips> {
  return concatClips([
    line(1, 60, ['One', 'two.']),
    line(2, 40, ['Three.']),
    line(3, 80, ['Four', 'five', 'six.']),
  ], SENTENCE_GAP_S, RATE);
}

const asLine = (seed: number, samples: number, texts: string[]): SplicedLine => {
  const c = line(seed, samples, texts);
  return { pcm: c.pcm, words: c.words, granularity: 'word' };
};

describe('diffScriptLines', () => {
  test('an unchanged script has no hunks', () => {
    assert.deepEqual(diffScriptLines(['a.', 'b.'], ['a.', 'b.']), []);
  });

  test('one edited line is a 1 to 1 hunk', () => {
    const hunks = diffScriptLines(['a.', 'b.', 'c.'], ['a.', 'b!', 'c.']);
    assert.deepEqual(hunks, [{ oldLines: [1, 2], newLines: [1, 2] }]);
  });

  test('deleting a full stop joins two lines into a 2 to 1 hunk', () => {
    const hunks = diffScriptLines(['a.', 'b.', 'c.'], ['a.', 'b and c.']);
    assert.deepEqual(hunks, [{ oldLines: [1, 3], newLines: [1, 2] }]);
  });

  test('pressing Enter splits one line into a 1 to 2 hunk', () => {
    const hunks = diffScriptLines(['a.', 'b and c.'], ['a.', 'b.', 'c.']);
    assert.deepEqual(hunks, [{ oldLines: [1, 2], newLines: [1, 3] }]);
  });

  test('a pure insertion and a pure deletion carry an empty range', () => {
    assert.deepEqual(diffScriptLines(['a.', 'b.'], ['a.', 'new.', 'b.']),
      [{ oldLines: [1, 1], newLines: [1, 2] }]);
    assert.deepEqual(diffScriptLines(['a.', 'gone.', 'b.'], ['a.', 'b.']),
      [{ oldLines: [1, 2], newLines: [1, 1] }]);
  });

  test('two separated edits are two hunks, in order', () => {
    const hunks = diffScriptLines(['a.', 'b.', 'c.', 'd.'], ['A.', 'b.', 'c.', 'D.']);
    assert.deepEqual(hunks, [
      { oldLines: [0, 1], newLines: [0, 1] },
      { oldLines: [3, 4], newLines: [3, 4] },
    ]);
  });

  test('a changed voice makes one hunk of the whole script', () => {
    // Not a special case in the diff: the caller passes one hunk covering
    // every line, and it splices exactly like any other.
    const old = ['a.', 'b.'];
    assert.deepEqual(diffScriptLines(old, []), [{ oldLines: [0, 2], newLines: [0, 0] }]);
  });
});

describe('spliceScriptAudio', () => {
  test('one dirty line leaves every other sample equal', () => {
    const before = clip();
    const hunks: ScriptHunk[] = [{ oldLines: [1, 2], newLines: [1, 2] }];
    const fresh = asLine(9, 55, ['Three!']);
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks, lines: new Map([[1, fresh]]),
    });

    const seg = before.segments;
    // Everything before the dirty line's audio is byte for byte the same…
    const head = seg[1]!.samples[0];
    for (let i = 0; i < head; i++) {
      assert.equal(after.pcm[i], before.pcm[i], `sample ${i} before the edit moved`);
    }
    // …and everything after it is the same samples, shifted by the delta.
    const tail = seg[1]!.samples[1];
    const delta = after.pcm.length - before.pcm.length;
    assert.equal(delta, 55 - 40, 'the clip grew by exactly the new line\'s extra samples');
    for (let i = tail; i < before.pcm.length; i++) {
      assert.equal(after.pcm[i + delta], before.pcm[i], `sample ${i} after the edit changed`);
    }
    // The new audio sits where the old line's did.
    for (let i = 0; i < fresh.pcm.length; i++) {
      assert.equal(after.pcm[head + i], fresh.pcm[i], `new sample ${i} landed wrong`);
    }
  });

  test('the rebuilt words, segments and edits describe the new clip', () => {
    const before = clip();
    const fresh = asLine(9, 55, ['Three!']);
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 2], newLines: [1, 2] }],
      lines: new Map([[1, fresh]]),
    });

    assert.equal(after.segments.length, 3, 'still one segment per line');
    assert.deepEqual(after.segments[0], before.segments[0], 'the first line is untouched');
    // The ranges still tile: no gap and no overlap anywhere.
    for (let i = 1; i < after.segments.length; i++) {
      assert.equal(after.segments[i]!.samples[0], after.segments[i - 1]!.samples[1], `segment ${i} does not tile`);
    }
    assert.equal(after.segments.at(-1)!.samples[1], after.pcm.length);
    assert.equal(after.duration, after.pcm.length / RATE);
    assert.equal(after.granularity, 'word');

    // Word text: the edited line's word replaced, the rest carried over.
    assert.deepEqual(after.words.map(w => w.text), ['One', 'two.', 'Three!', 'Four', 'five', 'six.']);
    // A word after the edit moved by the delta, not by anything else.
    const shift = (after.pcm.length - before.pcm.length) / RATE;
    assert.ok(Math.abs(after.words[3]!.start - (before.words[3]!.start + shift)) < 1e-9);

    assert.equal(after.edits.length, 1);
    assert.equal(after.edits[0]!.from, before.segments[1]!.samples[0] / RATE);
    assert.equal(after.edits[0]!.to, before.segments[1]!.samples[1] / RATE);
    assert.ok(Math.abs(after.edits[0]!.delta - shift) < 1e-9);
  });

  test('a 2 to 1 hunk (a deleted full stop) collapses two lines into one', () => {
    const before = clip();
    const merged = asLine(9, 90, ['Three', 'four', 'five', 'six.']);
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 3], newLines: [1, 2] }],
      lines: new Map([[1, merged]]),
    });

    assert.equal(after.segments.length, 2, 'two old lines became one');
    // The untouched first line is still the same samples in the same place.
    for (let i = 0; i < before.segments[1]!.samples[0]; i++) {
      assert.equal(after.pcm[i], before.pcm[i], `sample ${i} of the kept line moved`);
    }
    assert.deepEqual(after.words.map(w => w.text), ['One', 'two.', 'Three', 'four', 'five', 'six.']);
    // The hunk ended the clip, so nothing follows and no trailing gap is kept.
    assert.equal(after.segments.at(-1)!.gapAfter, 0);
    assert.equal(after.pcm.length, before.segments[1]!.samples[0] + 90);
  });

  test('a 1 to 2 hunk (a typed full stop) splits one line into two, joined by a gap', () => {
    const before = clip();
    const first = asLine(9, 30, ['Three.']);
    const second: SplicedLine = { ...asLine(8, 30, ['And', 'four.']), gapBefore: SENTENCE_GAP_S };
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 2], newLines: [1, 3] }],
      lines: new Map([[1, first], [2, second]]),
    });

    assert.equal(after.segments.length, 4, 'one line became two');
    const gap = Math.round(SENTENCE_GAP_S * RATE);
    // The gap between the two new lines belongs to the FIRST of them.
    assert.equal(after.segments[1]!.gapAfter, gap);
    assert.equal(after.segments[2]!.samples[0] - after.segments[1]!.samples[1], 0, 'the ranges still tile');
    // The silence between the halves really is silence.
    const between = after.segments[1]!.samples[1] - gap;
    for (let i = between; i < between + gap; i++) assert.equal(after.pcm[i], 0, `sample ${i} is not silent`);
    // The line that followed the hunk kept its own lead-in silence.
    assert.equal(after.segments[2]!.gapAfter, before.segments[1]!.gapAfter);
    // …and its audio is byte for byte what it was.
    const oldTail = before.segments[2]!.samples[0];
    const newTail = after.segments[3]!.samples[0];
    for (let i = 0; i < before.pcm.length - oldTail; i++) {
      assert.equal(after.pcm[newTail + i], before.pcm[oldTail + i], `sample ${i} of the untouched last line changed`);
    }
  });

  test('a deleted line drops its audio and keeps one gap between the neighbours', () => {
    const before = clip();
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 2], newLines: [1, 1] }], lines: new Map(),
    });
    assert.equal(after.segments.length, 2);
    assert.deepEqual(after.words.map(w => w.text), ['One', 'two.', 'Four', 'five', 'six.']);
    assert.equal(after.pcm.length, before.pcm.length - 40 - Math.round(SENTENCE_GAP_S * RATE));
  });

  test('two hunks accumulate their deltas in order', () => {
    const before = clip();
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word',
      hunks: [{ oldLines: [0, 1], newLines: [0, 1] }, { oldLines: [2, 3], newLines: [2, 3] }],
      lines: new Map([[0, asLine(9, 70, ['One', 'two!'])], [2, asLine(8, 100, ['Four', 'five', 'six!'])]]),
    });
    assert.equal(after.edits.length, 2);
    assert.equal(after.edits[0]!.delta, 10 / RATE);
    assert.equal(after.edits[1]!.delta, 20 / RATE);
    // The middle line rode the first delta only.
    const shift = 10 / RATE;
    assert.ok(Math.abs(after.words[2]!.start - (before.words[2]!.start + shift)) < 1e-9);
    assert.equal(after.pcm.length, before.pcm.length + 30);
  });

  // ---- the silence in front of a hunk ---------------------------------------

  test('a [pause] typed onto an edited line rewrites the silence before it', () => {
    const before = clip();
    // What the worker hands back for '[pause 1.5] Three.': the line's own
    // samples, plus the concatClips gap its mark works out to.
    const paused: SplicedLine = { ...asLine(9, 40, ['Three.']), gapBefore: 0.9 };
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 2], newLines: [1, 2] }],
      lines: new Map([[1, paused]]),
    });

    const want = Math.round(0.9 * RATE);
    const had = Math.round(SENTENCE_GAP_S * RATE);
    assert.equal(after.segments[0]!.gapAfter, want, 'the silence lives in the line BEFORE the hunk');
    assert.equal(after.pcm.length, before.pcm.length + (want - had), 'and the clip grew by exactly it');
    // The first line's own audio is untouched; only the zeros after it moved.
    const spoken = before.segments[0]!.samples[1] - had;
    for (let i = 0; i < spoken; i++) assert.equal(after.pcm[i], before.pcm[i], `sample ${i} of the kept line moved`);
    for (let i = spoken; i < spoken + want; i++) assert.equal(after.pcm[i], 0, `sample ${i} is not silent`);
    // The replaced source range starts at that silence, not at the line - a cut
    // sitting in it has to be re-fitted, not shifted past a length that changed.
    assert.equal(after.edits[0]!.from, spoken / RATE);
    assert.equal(after.edits[0]!.to, before.segments[1]!.samples[1] / RATE);
  });

  test('a pause can also shorten the join, and the copy shrinks with it', () => {
    const before = clip();
    const tight: SplicedLine = { ...asLine(9, 40, ['Three.']), gapBefore: 0 };
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 2], newLines: [1, 2] }],
      lines: new Map([[1, tight]]),
    });
    const had = Math.round(SENTENCE_GAP_S * RATE);
    assert.equal(after.segments[0]!.gapAfter, 0);
    assert.equal(after.pcm.length, before.pcm.length - had);
    // The new line starts where the previous one's audio ended: no stray copy
    // of the silence that used to be there.
    assert.equal(after.pcm[after.segments[1]!.samples[0]], tight.pcm[0]);
  });

  test('an edit with no pause of its own leaves the silence in front of it alone', () => {
    // The line before carries a [pause] the user authored; fixing a typo in the
    // line after must not quietly shorten it back to the default.
    const before = concatClips([
      { ...line(1, 60, ['One', 'two.']) },
      { ...line(2, 40, ['Three.']), gapBefore: 0.9 },
    ], SENTENCE_GAP_S, RATE);
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 2], newLines: [1, 2] }],
      lines: new Map([[1, asLine(9, 40, ['Three!'])]]),
    });
    assert.equal(after.segments[0]!.gapAfter, Math.round(0.9 * RATE), 'the authored pause stands');
    assert.equal(after.pcm.length, before.pcm.length);
    assert.equal(after.edits[0]!.from, before.segments[1]!.samples[0] / RATE, 'and nothing before it was replaced');
  });

  test('a sentence appended at the end is joined by a gap, not glued on', () => {
    const before = clip();
    const added = asLine(9, 50, ['One', 'more', 'thing.']);
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [3, 3], newLines: [3, 4] }],
      lines: new Map([[3, added]]),
    });
    const gap = Math.round(SENTENCE_GAP_S * RATE);
    assert.equal(after.segments.length, 4);
    assert.equal(after.segments[2]!.gapAfter, gap, 'the last old line gained the join it never had');
    assert.equal(after.pcm.length, before.pcm.length + gap + 50);
    // …and every sentence boundary in the clip is now the same width.
    assert.deepEqual(
      after.segments.slice(0, 3).map((s) => s.gapAfter),
      [gap, gap, gap],
    );
    // The whole join is silence, so a listener hears a sentence break.
    for (let i = before.pcm.length; i < before.pcm.length + gap; i++) {
      assert.equal(after.pcm[i], 0, `sample ${i} of the new join is not silent`);
    }
    assert.equal(after.edits[0]!.from, after.edits[0]!.to, 'a pure insert replaces no old audio');
    assert.equal(after.edits[0]!.delta, (gap + 50) / RATE);
  });

  test('a sentence inserted in the middle keeps the join it was dropped into', () => {
    const before = clip();
    const added = asLine(9, 50, ['Mid.']);
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 1], newLines: [1, 2] }],
      lines: new Map([[1, added]]),
    });
    const gap = Math.round(SENTENCE_GAP_S * RATE);
    assert.equal(after.segments.length, 4);
    // One join in front of it, one behind - the previous line's own silence is
    // not widened, because it was already a full sentence gap.
    assert.equal(after.segments[0]!.gapAfter, gap);
    assert.equal(after.segments[1]!.gapAfter, gap);
    assert.equal(after.pcm.length, before.pcm.length + 50 + gap);
    assert.deepEqual(after.words.map((w) => w.text), ['One', 'two.', 'Mid.', 'Three.', 'Four', 'five', 'six.']);
  });

  test('a sentence-granular new line degrades the whole clip, and a missing line is refused', () => {
    const before = clip();
    const coarse: SplicedLine = { ...asLine(9, 55, ['Three!']), granularity: 'sentence' };
    const after = spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      granularity: 'word', hunks: [{ oldLines: [1, 2], newLines: [1, 2] }],
      lines: new Map([[1, coarse]]),
    });
    assert.equal(after.granularity, 'sentence');

    assert.throws(() => spliceScriptAudio({
      pcm: before.pcm, words: before.words, segments: before.segments, sampleRate: RATE,
      hunks: [{ oldLines: [1, 2], newLines: [1, 2] }], lines: new Map(),
    }), /no audio for new line 1/);
  });
});

describe('decodeWavMono', () => {
  test('reads back what pcmToWavBlob wrote, to within half a 16-bit step', async () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 0.25, -1, 0.999]);
    const bytes = new Uint8Array(await pcmToWavBlob({ left: pcm, right: pcm, sampleRate: 24000 }).arrayBuffer());
    const back = decodeWavMono(bytes);
    assert.ok(back, 'a 16-bit stereo wav decodes');
    assert.equal(back.sampleRate, 24000);
    assert.equal(back.pcm.length, pcm.length);
    for (const [i, want] of [...pcm].entries()) {
      assert.ok(Math.abs(back.pcm[i]! - want) <= 0.5 / 32768, `sample ${i}: ${back.pcm[i]} vs ${want}`);
    }
  });

  test('a decoded clip re-encodes and decodes to itself, so repeated rewrites do not drift', async () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 0.25, -1, 0.999]);
    const once = decodeWavMono(new Uint8Array(
      await pcmToWavBlob({ left: pcm, right: pcm, sampleRate: 24000 }).arrayBuffer(),
    ))!;
    const twice = decodeWavMono(new Uint8Array(
      await pcmToWavBlob({ left: once.pcm, right: once.pcm, sampleRate: 24000 }).arrayBuffer(),
    ))!;
    assert.deepEqual([...twice.pcm], [...once.pcm]);
  });

  test('extra RIFF chunks are walked past, and anything else reads as no clip', async () => {
    const pcm = new Float32Array([0.25, -0.25]);
    const plain = new Uint8Array(await pcmToWavBlob({ left: pcm, right: pcm, sampleRate: 24000 }).arrayBuffer());
    // Splice a foreign chunk (what the C2PA embed and the INFO tags do) in
    // between the header and `fmt `, and the decode must still find both.
    const extra = new Uint8Array(plain.length + 12);
    extra.set(plain.subarray(0, 12), 0);
    extra.set(new TextEncoder().encode('JUNK'), 12);
    new DataView(extra.buffer).setUint32(16, 4, true);
    extra.set(plain.subarray(12), 24);
    new DataView(extra.buffer).setUint32(4, extra.length - 8, true);
    const back = decodeWavMono(extra);
    assert.ok(back, 'a wav with an unknown chunk still decodes');
    assert.equal(back.pcm.length, 2);

    assert.equal(decodeWavMono(new Uint8Array([1, 2, 3])), null);
    assert.equal(decodeWavMono(new TextEncoder().encode('RIFF....NOTWAVE.....')), null);
  });
});
