// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure half of Whisper transcription
 * (lib/speech-whisper.ts): chunk planning, timestamp repair, stitching. No
 * transformers.js, no wasm - synthetic PCM and hand-built word arrays, so the
 * maths the worker leans on is pinned in Node. The model I/O itself is
 * exercised by the round-trip smoke (synthesize with Kokoro, transcribe with
 * Whisper), not here.
 *
 * Run directly:  node --test shells/web/src/lib/speech-whisper.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHUNK_MAX_S, CHUNK_TARGET_S, SILENCE_PEAK, SILENCE_RMS, WHISPER_MODEL_BYTES,
  planChunks, cleanWordTimings, stitchChunks, joinChunkTexts, isSilentPcm, whisperLang,
} from './speech-whisper.ts';
import type { RawWord } from './speech-whisper.ts';

// A low "sample rate" keeps the synthetic clips tiny; every function under
// test takes the rate as data, so nothing about 16 kHz matters here.
const SR = 1000;

/** Noise everywhere except zeroed [start, end) second spans. */
function clipWithSilence(seconds: number, silences: Array<[number, number]>): Float32Array {
  const pcm = new Float32Array(seconds * SR);
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin(i * 0.7) * 0.5;
  for (const [s0, s1] of silences) pcm.fill(0, s0 * SR, s1 * SR);
  return pcm;
}

describe('planChunks', () => {
  test('a clip inside the window is one chunk, untouched', () => {
    const pcm = clipWithSilence(20, []);
    assert.deepEqual(planChunks(pcm, SR), [{ start: 0, end: pcm.length }]);
  });

  test('exactly the window length stays one chunk', () => {
    const pcm = clipWithSilence(CHUNK_MAX_S, []);
    assert.deepEqual(planChunks(pcm, SR), [{ start: 0, end: pcm.length }]);
  });

  test('cuts land inside genuine silence near the target boundary', () => {
    // 70 s with a second of silence at 24-25 s and another at 49-50 s: the
    // search window around each 25 s boundary contains them, so both cuts
    // must land inside (speech is never split when silence is available).
    const pcm = clipWithSilence(70, [[24, 25], [49, 50]]);
    const chunks = planChunks(pcm, SR);
    assert.equal(chunks.length, 3);
    assert.ok(chunks[0]!.end >= 24 * SR && chunks[0]!.end <= 25 * SR,
      `first cut at ${chunks[0]!.end / SR}s, expected inside 24-25s`);
    assert.ok(chunks[1]!.end >= 49 * SR && chunks[1]!.end <= 50 * SR,
      `second cut at ${chunks[1]!.end / SR}s, expected inside 49-50s`);
  });

  test('chunks are contiguous, cover the clip and respect the hard window', () => {
    for (const silences of [[], [[24, 25]], [[22, 22.2], [51, 52]]] as Array<Array<[number, number]>>) {
      const pcm = clipWithSilence(95, silences);
      const chunks = planChunks(pcm, SR);
      assert.equal(chunks[0]!.start, 0);
      assert.equal(chunks[chunks.length - 1]!.end, pcm.length);
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]!;
        assert.ok(c.end > c.start, 'chunks are non-empty');
        assert.ok(c.end - c.start <= CHUNK_MAX_S * SR, `chunk ${i} exceeds the ${CHUNK_MAX_S}s window`);
        if (i > 0) assert.equal(c.start, chunks[i - 1]!.end, 'chunks are contiguous');
      }
    }
  });

  test('no silence at all still cuts near the target, never past the window', () => {
    const pcm = clipWithSilence(60, []);
    const [first] = planChunks(pcm, SR);
    assert.ok(first!.end >= (CHUNK_TARGET_S - 5) * SR, 'cut not before the search window');
    assert.ok(first!.end <= CHUNK_MAX_S * SR, 'cut not past the hard window');
  });

  test('deterministic: the same clip plans the same cuts', () => {
    const pcm = clipWithSilence(80, [[26, 26.5]]);
    assert.deepEqual(planChunks(pcm, SR), planChunks(pcm, SR));
  });
});

describe('cleanWordTimings', () => {
  test('well-formed timings pass through (text trimmed)', () => {
    const raw: RawWord[] = [
      { text: ' Hello', start: 0.1, end: 0.4 },
      { text: ' world.', start: 0.5, end: 0.9 },
    ];
    assert.deepEqual(cleanWordTimings(raw, 2), [
      { text: 'Hello', start: 0.1, end: 0.4 },
      { text: 'world.', start: 0.5, end: 0.9 },
    ]);
  });

  test('empty and whitespace-only tokens are dropped', () => {
    const raw: RawWord[] = [
      { text: '  ', start: 0, end: 0.1 },
      { text: 'one', start: 0.2, end: 0.5 },
      { text: '', start: 0.5, end: 0.6 },
    ];
    assert.deepEqual(cleanWordTimings(raw, 1).map((w) => w.text), ['one']);
  });

  test('a null start fills from the previous end, a null end from the next start', () => {
    const raw: RawWord[] = [
      { text: 'a', start: 0.0, end: null },
      { text: 'b', start: null, end: 0.8 },
      { text: 'c', start: 1.0, end: null },
    ];
    const out = cleanWordTimings(raw, 1.5);
    // a's end fills from the next FINITE start - b has none, so c's 1.0; b's
    // start fills from a's (filled) end and its early 0.8 end clamps up to it.
    assert.deepEqual(out, [
      { text: 'a', start: 0, end: 1.0 },
      { text: 'b', start: 1.0, end: 1.0 },
      { text: 'c', start: 1.0, end: 1.5 },
    ]);
  });

  test('the last word with a null end closes at the chunk duration', () => {
    const out = cleanWordTimings([{ text: 'tail', start: 2.0, end: null }], 2.5);
    assert.deepEqual(out, [{ text: 'tail', start: 2.0, end: 2.5 }]);
  });

  test('negative and non-finite times count as missing', () => {
    const raw: RawWord[] = [
      { text: 'a', start: -1, end: Number.NaN },
      { text: 'b', start: 0.5, end: 0.9 },
    ];
    const out = cleanWordTimings(raw, 1);
    assert.deepEqual(out[0], { text: 'a', start: 0, end: 0.5 });
  });

  test('out-of-order spans are clamped monotonic and inside [0, duration]', () => {
    const raw: RawWord[] = [
      { text: 'a', start: 0.2, end: 0.6 },
      { text: 'b', start: 0.4, end: 0.3 }, // starts before a ends, ends before it starts
      { text: 'c', start: 5.0, end: 9.0 }, // past the chunk entirely
    ];
    const out = cleanWordTimings(raw, 2);
    let prevEnd = 0;
    for (const w of out) {
      assert.ok(w.start >= prevEnd, `${w.text}: start ${w.start} < previous end ${prevEnd}`);
      assert.ok(w.end >= w.start, `${w.text}: end before start`);
      assert.ok(w.end <= 2, `${w.text}: past the chunk duration`);
      prevEnd = w.end;
    }
  });
});

describe('stitchChunks', () => {
  test('offsets each chunk into the clip timeline', () => {
    const out = stitchChunks([
      [{ text: 'one', start: 0.1, end: 0.5 }],
      [{ text: 'two', start: 0.2, end: 0.6 }],
    ], [0, 25]);
    assert.deepEqual(out, [
      { text: 'one', start: 0.1, end: 0.5 },
      { text: 'two', start: 25.2, end: 25.6 },
    ]);
  });

  test('clamps across a seam when a chunk overshoots its own length', () => {
    // The first chunk's last word claims to end at 26.5 s inside a 25 s chunk;
    // the second chunk's first word starts at 0.1 s → 25.1 s absolute. Without
    // the seam clamp the merged array would go backwards.
    const out = stitchChunks([
      [{ text: 'over', start: 24.0, end: 26.5 }],
      [{ text: 'next', start: 0.1, end: 0.4 }],
    ], [0, 25]);
    assert.equal(out[1]!.start, 26.5, 'second word start clamps up to the previous end');
    assert.ok(out[1]!.end >= out[1]!.start);
  });

  test('empty chunks contribute nothing and break nothing', () => {
    const out = stitchChunks([[], [{ text: 'a', start: 0, end: 1 }], []], [0, 25, 50]);
    assert.deepEqual(out, [{ text: 'a', start: 25, end: 26 }]);
  });
});

describe('joinChunkTexts / whisperLang', () => {
  test('joins trimmed chunk texts single-spaced, dropping empties', () => {
    assert.equal(joinChunkTexts([' Hello there.', '', '  General Kenobi. ']), 'Hello there. General Kenobi.');
  });

  test('whisperLang reduces a BCP 47 tag to its primary subtag', () => {
    assert.equal(whisperLang('en-US'), 'en');
    assert.equal(whisperLang('pt-BR'), 'pt');
    assert.equal(whisperLang('DE'), 'de');
    assert.equal(whisperLang('en'), 'en');
  });
});

test('WHISPER_MODEL_BYTES mirrors the fetch-script pins (sanity: ~77 MB)', () => {
  assert.ok(WHISPER_MODEL_BYTES > 75_000_000 && WHISPER_MODEL_BYTES < 85_000_000,
    `WHISPER_MODEL_BYTES = ${WHISPER_MODEL_BYTES}`);
});

// ── The silence gate (plans/147 T1a) ──────────────────────────────────────────
// Whisper is a generative decoder: over silence it emits whatever its training
// data put there ("Thank you.", a subtitling credit), timestamped as if someone
// had spoken. The gate answers "nothing" before the model is ever asked, so this
// is the test that keeps fabricated captions out of a caption path.
describe('isSilentPcm', () => {
  const flat = (n: number, v: number): Float32Array => {
    const pcm = new Float32Array(n);
    // Alternate the sign so the clip has the peak amplitude `v`, not a DC offset.
    for (let i = 0; i < n; i++) pcm[i] = i % 2 ? v : -v;
    return pcm;
  };

  test('digital silence is silent', () => {
    assert.equal(isSilentPcm(new Float32Array(16_000)), true);
  });

  test('an empty buffer is silent (nothing to hear, nothing to invent)', () => {
    assert.equal(isSilentPcm(new Float32Array(0)), true);
  });

  test('a mic floor well under both floors is silent', () => {
    assert.equal(isSilentPcm(flat(16_000, SILENCE_RMS / 4)), true);
  });

  test('ordinary speech is not silent', () => {
    assert.equal(isSilentPcm(flat(16_000, 0.15)), false);
  });

  test('one spoken word inside a ten-minute quiet clip is not silent', () => {
    // The case a mean-only gate would throw away: 300 ms of speech in 600 s of
    // room tone. Either floor keeps it, which is the point of testing both.
    const pcm = new Float32Array(16_000 * 600);
    for (let i = 0; i < pcm.length; i++) pcm[i] = i % 2 ? 0.0002 : -0.0002;   // room tone
    for (let i = 0; i < 4_800; i++) pcm[i] = i % 2 ? 0.2 : -0.2;              // the word
    assert.equal(isSilentPcm(pcm), false);
  });

  test('both floors must be under-run', () => {
    // Loud enough to peak past the peak floor, quiet enough on average: kept.
    const pcm = flat(16_000, SILENCE_RMS / 4);
    pcm[10] = SILENCE_PEAK * 2;
    assert.equal(isSilentPcm(pcm), false);
  });

  test('the floors are callable, for a caller with a noisier source', () => {
    const pcm = flat(16_000, 0.02);
    assert.equal(isSilentPcm(pcm), false);
    assert.equal(isSilentPcm(pcm, 0.05, 0.5), true);
  });
});
