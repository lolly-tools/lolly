// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the PURE half of Kokoro speech synthesis
 * (engine/src/speech-text.ts): sentence/word splitting, char→token span
 * bookkeeping, durations→seconds conversion and clip concatenation. The model,
 * tokenizer and phonemizer wasm stay out — phonemizeChunk takes an injected
 * eSpeak stub — so this runs in plain Node like the other engine suites.
 * Moved from shells/web/src/lib/speech-kokoro.test.ts when the module moved
 * into the engine (roadmap §4's one-synthesis-layer rule).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  KOKORO_SAMPLE_RATE, KOKORO_VOICES, KOKORO_MODEL_BYTES, MAX_INPUT_CHARS, MAX_PHONEME_CHARS,
  splitSentences, splitWords, phonemeTokenSpans, wordTimingsFromDurations,
  concatClips, normalizeText, splitPunctuation, postProcessPhonemes, phonemizeChunk,
  chunkByPhonemeLength,
} from '../engine/src/speech-text.ts';

describe('splitSentences', () => {
  test('splits on terminal punctuation, keeping it attached', () => {
    assert.deepEqual(
      splitSentences('Hello there. How are you? Fine!'),
      ['Hello there.', 'How are you?', 'Fine!'],
    );
  });

  test('closing quotes ride the sentence they end', () => {
    assert.deepEqual(
      splitSentences('She said "go." Then left.'),
      ['She said "go."', 'Then left.'],
    );
  });

  test('newlines terminate a sentence even without a full stop', () => {
    assert.deepEqual(splitSentences('A heading\nBody text here.'), ['A heading', 'Body text here.']);
  });

  test('empty and whitespace-only input yield no sentences', () => {
    assert.deepEqual(splitSentences(''), []);
    assert.deepEqual(splitSentences('   \n  '), []);
  });

  test('a run-on sentence wraps on whitespace instead of truncating', () => {
    const long = Array(120).fill('word').join(' '); // 599 chars, no terminator
    const parts = splitSentences(long);
    assert.ok(parts.length > 1, 'must split');
    assert.ok(parts.every((p) => p.length <= 400));
    assert.equal(parts.join(' '), long, 'no words dropped');
  });

  test('a single word longer than the wrap limit is force-split, not truncated', () => {
    const monster = 'x'.repeat(1000);
    const parts = splitSentences(monster);
    assert.ok(parts.length > 1, 'must split');
    assert.ok(parts.every((p) => p.length <= 400));
    assert.equal(parts.join(''), monster, 'no chars dropped');
  });

  test('an oversized word amid normal words flushes cleanly on both sides', () => {
    const parts = splitSentences(`start ${'y'.repeat(900)} end`);
    assert.ok(parts.every((p) => p.length <= 400));
    assert.equal(parts[0], 'start');
    assert.equal(parts.join(' ').split('y').length - 1, 900, 'every y survives');
    assert.ok(parts.at(-1)!.endsWith(' end'));
  });
});

describe('normalize-then-split (kokoro.js order)', () => {
  // The worker runs normalizeText over the WHOLE input before splitSentences —
  // these pin the composed behaviour the old per-word order got wrong.
  test('a decimal does not shatter its sentence', () => {
    assert.deepEqual(
      splitSentences(normalizeText('The score was 3.5 stars.')),
      ['The score was 3 point 5 stars.'],
    );
  });

  test('Dr. expands to Doctor via the following capitalized word', () => {
    assert.deepEqual(
      splitSentences(normalizeText('Dr. Smith arrived.')),
      ['Doctor Smith arrived.'],
    );
  });

  test('currency expands before splitting', () => {
    assert.deepEqual(
      splitSentences(normalizeText('It costs $45 today.')),
      ['It costs 45 dollars today.'],
    );
  });

  test('e.g. does not end a sentence', () => {
    assert.equal(splitSentences(normalizeText('Bring a snack, e.g. an apple.')).length, 1);
  });
});

describe('splitWords', () => {
  test('splits on any whitespace run, punctuation attached', () => {
    assert.deepEqual(splitWords('Hello  from\tLolly,  ok.'), ['Hello', 'from', 'Lolly,', 'ok.']);
  });

  test('no empty words from surrounding whitespace', () => {
    assert.deepEqual(splitWords('  a b  '), ['a', 'b']);
  });
});

describe('phonemeTokenSpans', () => {
  test('spans are char ranges in the space-joined string, shifted +1 for BOS', () => {
    // join = 'ab cde' → tokens: [BOS] a b ␣ c d e [EOS]
    assert.deepEqual(phonemeTokenSpans(['ab', 'cde']), [
      { start: 1, end: 3 },
      { start: 4, end: 7 },
    ]);
  });

  test('a word that phonemized to nothing keeps a zero-width span', () => {
    assert.deepEqual(phonemeTokenSpans(['ab', '', 'c']), [
      { start: 1, end: 3 },
      { start: 4, end: 4 },
      { start: 5, end: 6 },
    ]);
  });
});

describe('chunkByPhonemeLength', () => {
  test('short input stays a single chunk', () => {
    assert.deepEqual(chunkByPhonemeLength(['hi', 'there'], ['haɪ', 'ðɛɹ']), [
      { words: ['hi', 'there'], phonemes: ['haɪ', 'ðɛɹ'] },
    ]);
  });

  test('a pathological expansion splits into budget-sized chunks with no word lost', () => {
    // '$45' x70 is 279 raw chars — under the 400-char wrap — but normalizes and
    // phonemizes to far more than 510 tokens. Every word must land in a chunk
    // whose joined phonemes fit, instead of the tokenizer truncating silently.
    const words = Array(70).fill('$45') as string[];
    const phonemes = words.map(() => 'fˈɔːɹɾi fˈaɪv dˈɑːlɚz');
    const chunks = chunkByPhonemeLength(words, phonemes);
    assert.ok(chunks.length > 1, 'must split');
    assert.deepEqual(chunks.flatMap((c) => c.words), words, 'every word in some chunk, in order');
    for (const c of chunks) {
      assert.ok(c.phonemes.join(' ').length <= MAX_PHONEME_CHARS, 'each chunk fits the token budget');
      assert.equal(c.words.length, c.phonemes.length, 'words and phonemes stay parallel');
    }
  });

  test('a single word whose phonemes alone bust the budget gets its own chunk', () => {
    const chunks = chunkByPhonemeLength(['a', 'big', 'c'], ['aa', 'x'.repeat(600), 'cc']);
    assert.deepEqual(chunks.map((c) => c.words), [['a'], ['big'], ['c']]);
  });

  test('empty input yields no chunks', () => {
    assert.deepEqual(chunkByPhonemeLength([], []), []);
  });
});

describe('wordTimingsFromDurations', () => {
  test('derives the frame rate from the clip and lands words inside it', () => {
    // 'ab cd' → 8 tokens [BOS a b ␣ c d EOS]=7… make it consistent: 2+5=7 tokens.
    const spans = phonemeTokenSpans(['ab', 'cd']); // last end 6, expected len 7
    // frames: BOS=2, a=10, b=10, space=4, c=10, d=10, EOS=2 → 48 frames
    const durations = [2, 10, 10, 4, 10, 10, 2];
    // Pretend 48 frames produced 0.6 s of audio → 80 frames/s (the community divisor).
    const waveformLength = 0.6 * KOKORO_SAMPLE_RATE;
    const times = wordTimingsFromDurations(durations, spans, waveformLength, KOKORO_SAMPLE_RATE);
    assert.ok(times);
    assert.equal(times.length, 2);
    // word 1 spans frames [2, 22) → 0.025..0.275 s at 80 f/s
    assert.ok(Math.abs(times[0]!.start - 2 / 80) < 1e-9);
    assert.ok(Math.abs(times[0]!.end - 22 / 80) < 1e-9);
    // word 2 spans frames [26, 46)
    assert.ok(Math.abs(times[1]!.start - 26 / 80) < 1e-9);
    assert.ok(Math.abs(times[1]!.end - 46 / 80) < 1e-9);
    // everything inside the clip
    assert.ok(times[1]!.end <= waveformLength / KOKORO_SAMPLE_RATE + 1e-9);
  });

  test('bigint durations (int64 tensors) are accepted', () => {
    const spans = phonemeTokenSpans(['a']);
    const times = wordTimingsFromDurations([2n, 8n, 2n], spans, 1200, KOKORO_SAMPLE_RATE);
    assert.ok(times);
    assert.ok(times[0]!.end > times[0]!.start);
  });

  test('returns null when durations are not one-per-token', () => {
    const spans = phonemeTokenSpans(['ab', 'cd']);
    assert.equal(wordTimingsFromDurations([1, 2, 3], spans, 1000, KOKORO_SAMPLE_RATE), null);
  });

  test('returns null on an empty waveform', () => {
    const spans = phonemeTokenSpans(['a']);
    assert.equal(wordTimingsFromDurations([1, 1, 1], spans, 0, KOKORO_SAMPLE_RATE), null);
  });
});

describe('concatClips', () => {
  const sr = KOKORO_SAMPLE_RATE;

  test('inserts the gap between clips but not after the last', () => {
    const a = { pcm: new Float32Array(sr).fill(0.5), words: [{ text: 'one', start: 0, end: 1 }] };
    const b = { pcm: new Float32Array(sr).fill(0.25), words: [{ text: 'two', start: 0, end: 1 }] };
    const out = concatClips([a, b], 0.35, sr);
    const gap = Math.round(0.35 * sr);
    assert.equal(out.pcm.length, sr + gap + sr);
    assert.equal(out.duration, out.pcm.length / sr);
    // The gap really is silence
    assert.equal(out.pcm[sr + Math.floor(gap / 2)], 0);
    // The second clip's samples landed after the gap
    assert.equal(out.pcm[sr + gap], 0.25);
  });

  test('offsets word timings by preceding clips plus gaps', () => {
    const a = { pcm: new Float32Array(sr), words: [{ text: 'one', start: 0.1, end: 0.9 }] };
    const b = { pcm: new Float32Array(sr), words: [{ text: 'two', start: 0.2, end: 0.8 }] };
    const out = concatClips([a, b], 0.35, sr);
    assert.equal(out.words.length, 2);
    assert.ok(Math.abs(out.words[0]!.start - 0.1) < 1e-9);
    assert.ok(Math.abs(out.words[1]!.start - (1 + 0.35 + 0.2)) < 1e-9);
    assert.ok(Math.abs(out.words[1]!.end - (1 + 0.35 + 0.8)) < 1e-9);
  });

  test('empty input yields an empty clip', () => {
    const out = concatClips([], 0.35, sr);
    assert.equal(out.pcm.length, 0);
    assert.equal(out.duration, 0);
    assert.deepEqual(out.words, []);
  });
});

describe('normalizeText (kokoro.js port)', () => {
  test('titles, currency and years expand the way the model was trained on', () => {
    assert.equal(normalizeText('Dr. Smith'), 'Doctor Smith');
    assert.equal(normalizeText('$5.50'), '5 dollars and 50 cents');
    assert.equal(normalizeText('in 1984'), 'in 19 84');
  });

  test('curly quotes straighten and parentheses become guillemets', () => {
    assert.equal(normalizeText('It’s “fine” (really)'), 'It\'s "fine" «really»');
  });
});

describe('phoneme pipeline', () => {
  test('splitPunctuation keeps punctuation runs verbatim', () => {
    assert.deepEqual(splitPunctuation('Hi, there!'), [
      { match: false, text: 'Hi' },
      { match: true, text: ', ' },
      { match: false, text: 'there' },
      { match: true, text: '!' },
    ]);
  });

  test('postProcessPhonemes applies the IPA fixups', () => {
    assert.equal(postProcessPhonemes('rʲx', 'a'), 'ɹjk');
    // en-US only: ninety → "nindi"
    assert.equal(postProcessPhonemes('nˈaɪnti', 'a'), 'nˈaɪndi');
    assert.equal(postProcessPhonemes('nˈaɪnti', 'b'), 'nˈaɪnti');
  });

  test('phonemizeChunk phonemizes text sections and passes punctuation through', async () => {
    const espeak = async (text: string, lang: string): Promise<string[]> => [`<${lang}:${text.trim()}>`];
    // Note the post-processing pass also runs (r → ɹ), as it does in kokoro.js.
    assert.equal(await phonemizeChunk(espeak, 'Hi, there!', 'a'), '<en-us:Hi>, <en-us:theɹe>!');
    assert.equal(await phonemizeChunk(espeak, 'Hi', 'b'), '<en:Hi>');
  });
});

describe('constants', () => {
  test('the voice list is the full 28-voice English set, ordered for a select', () => {
    assert.equal(KOKORO_VOICES.length, 28);
    assert.equal(KOKORO_VOICES.filter((v) => v.lang === 'en-US').length, 20);
    assert.equal(KOKORO_VOICES.filter((v) => v.lang === 'en-GB').length, 8);
    // Unique ids whose prefix agrees with the declared lang/gender.
    assert.equal(new Set(KOKORO_VOICES.map((v) => v.id)).size, 28);
    for (const v of KOKORO_VOICES) {
      assert.equal(v.lang, v.id.startsWith('b') ? 'en-GB' : 'en-US', v.id);
      assert.equal(v.gender, v.id[1] === 'f' ? 'female' : 'male', v.id);
      assert.ok(v.grade, v.id);
    }
    // Display order: en-US before en-GB, best grade first within each accent.
    const rank = (g: string): number =>
      'ABCDEF'.indexOf(g[0] as string) * 3 + (g.includes('+') ? -1 : g.includes('-') ? 1 : 0);
    const langs = KOKORO_VOICES.map((v) => v.lang);
    assert.equal(langs.lastIndexOf('en-US'), 19, 'en-US block precedes en-GB');
    for (const lang of ['en-US', 'en-GB'] as const) {
      const grades = KOKORO_VOICES.filter((v) => v.lang === lang).map((v) => rank(v.grade ?? ''));
      assert.deepEqual(grades, [...grades].sort((a, b) => a - b), `${lang} sorted by grade`);
    }
    assert.equal(KOKORO_VOICES[0]?.id, 'af_heart');
  });

  test('modelBytes covers the model plus one voice (a consent UI rounds it to ~93 MB)', () => {
    assert.ok(KOKORO_MODEL_BYTES > 92_000_000 && KOKORO_MODEL_BYTES < 94_000_000);
  });

  test('the hard input cap sits well above the UI soft nudge', () => {
    assert.equal(MAX_INPUT_CHARS, 100_000);
  });
});
