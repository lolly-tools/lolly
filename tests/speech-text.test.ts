// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the PURE half of Kokoro speech synthesis
 * (engine/src/speech-text.ts): sentence/word splitting, char→token span
 * bookkeeping, durations→seconds conversion and clip concatenation. The model,
 * tokenizer and phonemizer wasm stay out - phonemizeChunk takes an injected
 * eSpeak stub - so this runs in plain Node like the other engine suites.
 * Moved from shells/web/src/lib/speech-kokoro.test.ts when the module moved
 * into the engine (roadmap section 4's one-synthesis-layer rule).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  KOKORO_SAMPLE_RATE, KOKORO_VOICES, KOKORO_MODEL_BYTES, MAX_INPUT_CHARS, MAX_PHONEME_CHARS,
  splitSentences, splitWords, phonemeTokenSpans, wordTimingsFromDurations,
  concatClips, normalizeText, splitPunctuation, postProcessPhonemes, phonemizeChunk,
  chunkByPhonemeLength,
  KOKORO_VOCAB, filterToVocab, normalizeForSpeech,
  PAUSE_DEFAULT_S, SLOW_SPEED, FAST_SPEED, CLIP_EDGE_PAD_S, SENTENCE_GAP_S, pauseGapS,
  parseScriptMarks, scriptLinesOf, parseVoiceBlend, accentOfBlend,
  MIN_SEAM_GAP_S, endsSentence, deriveSegmentsFromWords,
} from '../engine/src/speech-text.ts';
import type { SentenceClip } from '../engine/src/speech-text.ts';
import type { SpeechWordTiming } from '../engine/src/bridge/host-v1.ts';

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
  // The worker runs normalizeText over the WHOLE input before splitSentences - 
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
    // '$45' x70 is 279 raw chars - under the 400-char wrap - but normalizes and
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
    // The stub answers in vocab-safe IPA, the way eSpeak does; the lang is
    // echoed as a leading marker so both branches are visible.
    const espeak = async (text: string, lang: string): Promise<string[]> =>
      [`${lang === 'en-us' ? 'ᵻ' : 'ᵝ'}${text.trim().toLowerCase()}`];
    // Note the post-processing pass also runs (r → ɹ), as it does in kokoro.js.
    assert.equal(await phonemizeChunk(espeak, 'Hi, there!', 'a'), 'ᵻhi, ᵻtheɹe!');
    assert.equal(await phonemizeChunk(espeak, 'Hi', 'b'), 'ᵝhi');
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

// ─── plans/181: the vocab filter, script marks, blends and segments ───────────

/**
 * The tokenizer's Replace normalizer, applied the way transformers.js applies
 * it: every character outside the vocabulary is deleted before tokenizing, and
 * the sequence is then wrapped in BOS/EOS. So this returns the seqLen the
 * worker compares against `phonemes.length + 2`.
 */
function fakeSeqLen(phonemes: string): number {
  const keep = new Set([...KOKORO_VOCAB]);
  let kept = 0;
  for (const ch of phonemes) if (keep.has(ch)) kept++;
  return kept + 2;
}

describe('KOKORO_VOCAB', () => {
  const tokenizerPath = fileURLToPath(
    new URL('../shells/web/public/models/kokoro/tokenizer.json', import.meta.url),
  );

  test('mirrors the vendored tokenizer, both its keep-pattern and its vocab keys', () => {
    let raw: string;
    try {
      raw = readFileSync(tokenizerPath, 'utf8');
    } catch {
      // A clone without the staged model (scripts/fetch-kokoro-models.ts) has
      // nothing to compare against; the constant's own shape is checked below.
      return;
    }
    const tok = JSON.parse(raw) as {
      normalizer: { type: string; pattern: { Regex: string } };
      model: { vocab: Record<string, number> };
    };
    assert.equal(tok.normalizer.type, 'Replace', 'the delete-everything-else normalizer');
    const pattern = tok.normalizer.pattern.Regex;
    assert.ok(pattern.startsWith('[^') && pattern.endsWith(']'), pattern);
    assert.equal(pattern.slice(2, -1), KOKORO_VOCAB, 'keep-pattern drifted from KOKORO_VOCAB');
    assert.deepEqual(Object.keys(tok.model.vocab), [...KOKORO_VOCAB], 'vocab keys drifted');
  });

  test('is 115 unique symbols including the brackets and excluding the guillemets', () => {
    assert.equal([...KOKORO_VOCAB].length, 115);
    assert.equal(new Set([...KOKORO_VOCAB]).size, 115);
    for (const ch of ['(', ')', '!', '?', '…', '"', ' ']) {
      assert.ok(KOKORO_VOCAB.includes(ch), `${ch} must be in the vocabulary`);
    }
    for (const ch of ['«', '»', "'", '[', ']', '¡', '¿']) {
      assert.ok(!KOKORO_VOCAB.includes(ch), `${ch} must NOT be in the vocabulary`);
    }
  });
});

describe('filterToVocab', () => {
  test('drops exactly what the tokenizer would delete', () => {
    assert.equal(filterToVocab('hˈɛloʊ'), 'hˈɛloʊ');
    assert.equal(filterToVocab('«aside»'), 'aside');
    assert.equal(filterToVocab('a[b]c'), 'abc');
    assert.equal(filterToVocab("don't"), 'dont');
    assert.equal(filterToVocab(''), '');
  });

  test('leaves a filtered string alone on a second pass', () => {
    const once = filterToVocab('«qu(i)et»  ¿sí?');
    assert.equal(filterToVocab(once), once);
  });
});

describe('normalizeForSpeech (the parenthesis fix, plans/181 section 11)', () => {
  test('keeps brackets instead of the guillemets the port produces', () => {
    assert.equal(normalizeText('a (quiet) word'), 'a «quiet» word');
    assert.equal(normalizeForSpeech('a (quiet) word'), 'a (quiet) word');
  });

  test('an input guillemet still folds to a straight quote, so the reversal is exact', () => {
    assert.equal(normalizeForSpeech('«quoted»'), '"quoted"');
  });

  test('everything else the port does is untouched', () => {
    assert.equal(normalizeForSpeech('Dr. Smith paid $5.50'), 'Doctor Smith paid 5 dollars and 50 cents');
  });
});

describe('the vocab-safe pipeline keeps word granularity (plans/181 section 7)', () => {
  // eSpeak stand-in: one vocab-safe phoneme per letter, so a word's phoneme
  // length is predictable and any stray symbol in the output came from the
  // punctuation path rather than from here.
  const espeak = async (text: string): Promise<string[]> =>
    [text.trim().toLowerCase().replace(/[^a-z]/g, '')];

  test('"a (quiet) word" tokenizes to exactly phonemes.length + 2', async () => {
    const sentences = splitSentences(normalizeForSpeech('a (quiet) word'));
    assert.deepEqual(sentences, ['a (quiet) word']);
    for (const sentence of sentences) {
      const words = splitWords(sentence);
      const wordPhonemes: string[] = [];
      for (const w of words) wordPhonemes.push(await phonemizeChunk(espeak, w, 'a'));
      for (const chunk of chunkByPhonemeLength(words, wordPhonemes)) {
        const phonemes = chunk.phonemes.join(' ');
        assert.equal(fakeSeqLen(phonemes), phonemes.length + 2, phonemes);
      }
    }
  });

  test('the same text through the unfixed normalizer is what used to break', async () => {
    // Two guillemets, two deleted tokens: the exact "seqLen short by 2" the
    // Phase 0 matrix measured in 48 of 48 parenthesis cells. This is the
    // regression the fix above prevents, so it stays pinned.
    const raw = normalizeText('a (quiet) word');
    const words = splitWords(raw);
    const parts: string[] = [];
    for (const w of words) parts.push(filterToVocab(await phonemizeChunk(espeak, w, 'a')));
    const phonemes = parts.join(' ');
    assert.equal(raw.includes('«') && raw.includes('»'), true);
    // The filter is what closes the gap: unfiltered, the guillemets would be
    // counted here and deleted by the tokenizer.
    assert.equal(fakeSeqLen(phonemes), phonemes.length + 2);
  });

  test('stray brackets and inverted marks no longer cost tokens either', async () => {
    const phonemes = await phonemizeChunk(espeak, '¿[really]?', 'a');
    assert.equal(fakeSeqLen(phonemes), phonemes.length + 2);
    assert.equal(phonemes, 'ɹeally?', 'and the r fixup still ran');
  });
});

describe('parseScriptMarks (plans/181 sections 3 and 8)', () => {
  test('a pause attaches to the sentence that FOLLOWS it and never gets spoken', () => {
    const p = parseScriptMarks('Hello there. [pause 1] World!');
    assert.deepEqual(p.sentences.map((s) => s.text), ['Hello there.', 'World!']);
    assert.equal(p.sentences[0]!.gapBefore, undefined);
    assert.equal(p.sentences[1]!.gapBefore, 1);
    assert.equal(p.stripped, 'Hello there. World!');
    assert.ok(!p.sentences.some((s) => s.text.includes('[')), 'no mark reaches the spoken text');
  });

  test('a bare [pause] asks for MORE silence than typing nothing at all', () => {
    assert.equal(parseScriptMarks('One. [pause] Two.').sentences[1]!.gapBefore, PAUSE_DEFAULT_S);
    // The mark SETS the silence at a join. A plain join already sounds like the
    // clip padding plus concatClips' own gap, so a default under that sum made
    // the chip labelled "Silence before the next sentence" SHORTEN it.
    assert.ok(PAUSE_DEFAULT_S > CLIP_EDGE_PAD_S + SENTENCE_GAP_S,
      'a bare [pause] must be audibly longer than an unmarked sentence break');
    assert.ok(pauseGapS(PAUSE_DEFAULT_S) > SENTENCE_GAP_S,
      'and it must ask concatClips for more zeros than the default join does');
  });

  test('a pause on its own line still belongs to the next sentence', () => {
    const p = parseScriptMarks('One.\n[pause 1.5]\nTwo.');
    assert.deepEqual(p.sentences.map((s) => s.text), ['One.', 'Two.']);
    assert.equal(p.sentences[1]!.gapBefore, 1.5);
  });

  test('a trailing mark with no sentence after it has no effect', () => {
    const p = parseScriptMarks('Only this. [pause 2]');
    assert.equal(p.sentences.length, 1);
    assert.equal(p.sentences[0]!.gapBefore, undefined);
  });

  test('slow and fast are the rates Phase 0 rendered, and they are sentence scoped', () => {
    const p = parseScriptMarks('[slow] Gravity. [fast] Excitement. Plain.');
    assert.deepEqual(p.sentences.map((s) => s.speed), [SLOW_SPEED, FAST_SPEED, undefined]);
    assert.equal(SLOW_SPEED, 0.85);
    assert.equal(FAST_SPEED, 1.15);
  });

  test('[speed N] clamps to the half-to-double range the worker enforces', () => {
    assert.equal(parseScriptMarks('[speed 0.9] A.').sentences[0]!.speed, 0.9);
    assert.equal(parseScriptMarks('[speed 9] A.').sentences[0]!.speed, 2);
    assert.equal(parseScriptMarks('[speed 0.1] A.').sentences[0]!.speed, 0.5);
  });

  test('a pronunciation override is word scoped, keyed by word index, and vocab filtered', () => {
    const p = parseScriptMarks('The [SUSE](/ˈsuːsə/) team ships.');
    assert.equal(p.sentences.length, 1);
    assert.equal(p.sentences[0]!.text, 'The SUSE team ships.');
    assert.deepEqual(p.sentences[0]!.pronunciations, { 1: 'ˈsuːsə' });
    assert.equal(splitWords(p.sentences[0]!.text)[1], 'SUSE');
  });

  test('a pronunciation over several words covers the phrase, not just its last word', () => {
    const p = parseScriptMarks('We flew to [New York](/nˈuːjˈɔːk/) today.');
    const s = p.sentences[0]!;
    assert.equal(s.text, 'We flew to New York today.');
    assert.equal(p.stripped, 'We flew to New York today.', 'the reader sees the words, not the mark');
    // The phrase is ONE spoken token, so the IPA replaces the whole of it.
    // Re-splitting `text` on whitespace would key the override to "York" and
    // leave eSpeak to read "New" on its own, which is not what was asked for.
    assert.deepEqual(s.tokens, ['We', 'flew', 'to', 'New York', 'today.']);
    assert.deepEqual(s.pronunciations, { 3: 'nˈuːjˈɔːk' });
    assert.equal(s.line, 'We flew to [New York](/nˈuːjˈɔːk/) today.', 'and it re-serialises unchanged');
  });

  test('a single-word pronunciation reports no tokens, because splitting text is enough', () => {
    assert.equal(parseScriptMarks('The [SUSE](/ˈsuːsə/) team ships.').sentences[0]!.tokens, undefined);
    assert.equal(parseScriptMarks('Plain words only.').sentences[0]!.tokens, undefined);
  });

  test('a pronunciation IPA carrying an out-of-vocab symbol is filtered, not passed on', () => {
    const p = parseScriptMarks('Say [lolly](/lˈɒli«»/) now.');
    assert.deepEqual(p.sentences[0]!.pronunciations, { 1: 'lˈɒli' });
  });

  test('a pronunciation form wins over the pause keyword inside it', () => {
    const p = parseScriptMarks('A [pause](/pˈɔːz/) here.');
    assert.equal(p.sentences[0]!.gapBefore, undefined);
    assert.deepEqual(p.sentences[0]!.pronunciations, { 1: 'pˈɔːz' });
    assert.equal(p.sentences[0]!.text, 'A pause here.');
  });

  test('text that is not a mark stays text', () => {
    const p = parseScriptMarks('Item [1] and [speed] with no number.');
    assert.equal(p.stripped, 'Item [1] and [speed] with no number.');
    assert.equal(p.sentences[0]!.text, 'Item [1] and [speed] with no number.');
  });

  test('sentences come back normalized in kokoro.js order', () => {
    const p = parseScriptMarks('Dr. Smith paid $45. [slow] The score was 3.5 stars.');
    assert.deepEqual(p.sentences.map((s) => s.text), [
      'Doctor Smith paid 45 dollars.',
      'The score was 3 point 5 stars.',
    ]);
    assert.equal(p.sentences[1]!.speed, SLOW_SPEED);
  });

  test('a parenthetical survives the parse with its brackets', () => {
    assert.equal(parseScriptMarks('A (quiet) word.').sentences[0]!.text, 'A (quiet) word.');
  });

  test('stripped is the mark-free script with horizontal whitespace tidied', () => {
    assert.equal(parseScriptMarks('One.   [pause]   Two.').stripped, 'One. Two.');
    assert.equal(parseScriptMarks('Line one\n[slow]\nLine two').stripped, 'Line one\nLine two');
  });

  test('no marks at all means no speed, no gap, no pronunciations', () => {
    const p = parseScriptMarks('Plain text. Two sentences.');
    for (const s of p.sentences) {
      assert.equal(s.speed, undefined);
      assert.equal(s.gapBefore, undefined);
      assert.equal(s.pronunciations, undefined);
      assert.equal(s.line, s.text);
    }
  });
});

describe('scriptLinesOf (tts.script, plans/181 section 5.1)', () => {
  test('one sentence per line, normalized, with the marks back in place', () => {
    assert.deepEqual(
      scriptLinesOf('Hello there. [pause 1] World! The [SUSE](/ˈsuːsə/) team ships $45.'),
      ['Hello there.', '[pause 1] World!', 'The [SUSE](/ˈsuːsə/) team ships 45 dollars.'],
    );
  });

  test('marks serialise canonically, so a re-saved script is stable', () => {
    assert.deepEqual(scriptLinesOf(`[pause ${PAUSE_DEFAULT_S}] A. [speed 0.85] B. [speed 1.15] C.`), [
      '[pause] A.', '[slow] B.', '[fast] C.',
    ]);
    // A pause that is not the default keeps its number, so nothing is rounded
    // away by the shorthand.
    assert.deepEqual(scriptLinesOf('[pause 0.6] A.'), ['[pause 0.6] A.']);
  });

  test('re-parsing the lines with prenormalized gives the same lines back', () => {
    // The regeneration loop reads a stored script back, so this round trip is
    // what keeps a re-synthesized sentence identical to the original.
    const corpus = [
      'Hello there. How are you? Fine!',
      'It costs $45 today.',
      'Dr. Smith arrived at 12:30.',
      'It’s “fine” (really).',
      'In 1984 we shipped 1,000 units.',
      'A total of 2,024 items.',
      '[slow] Gravity is slower. [pause 1.2] Then it lifts. Say [lolly](/lˈɒli/) once.',
      'Wow!! Really!? Hmm…',
      'Mrs. Jones and Mr. Lee, e.g. today.',
    ];
    for (const s of corpus) {
      const lines = scriptLinesOf(s);
      assert.deepEqual(scriptLinesOf(lines.join('\n'), { prenormalized: true }), lines, s);
    }
  });

  test('the normalizer is NOT idempotent, which is why prenormalized exists', () => {
    // Pinned, not aspirational: plans/181 section 5.1 asked the question and
    // this is the answer. The comma goes first, leaving a bare four-digit run
    // that a second pass reads as a year.
    assert.equal(normalizeForSpeech('A total of 2,024 items.'), 'A total of 2024 items.');
    assert.notEqual(
      normalizeForSpeech(normalizeForSpeech('A total of 2,024 items.')),
      normalizeForSpeech('A total of 2,024 items.'),
    );
    // Without the flag, the second parse changes the words.
    assert.deepEqual(scriptLinesOf('A total of 2,024 items.'), ['A total of 2024 items.']);
    assert.deepEqual(scriptLinesOf('A total of 2024 items.'), ['A total of 20 24 items.']);
  });
});

describe('pauseGapS (plans/181 section 11 item 5)', () => {
  test('subtracts the padding the two clips already contribute', () => {
    assert.equal(CLIP_EDGE_PAD_S, 0.6);
    assert.ok(Math.abs(pauseGapS(1) - 0.4) < 1e-9);
    assert.ok(Math.abs(pauseGapS(2) - 1.4) < 1e-9);
  });

  test('a request the padding already covers asks for no extra silence', () => {
    assert.equal(pauseGapS(0.6), 0);
    assert.equal(pauseGapS(0.3), 0);
    assert.equal(pauseGapS(0), 0);
    assert.equal(pauseGapS(Number.NaN), 0);
  });
});

describe('concatClips per-clip gap and segments', () => {
  const sr = KOKORO_SAMPLE_RATE;
  const clip = (n: number, v: number, gapBefore?: number): SentenceClip => ({
    pcm: new Float32Array(n).fill(v),
    words: [{ text: 'w', start: 0, end: n / sr }],
    ...(gapBefore === undefined ? {} : { gapBefore }),
  });

  test('a clip gapBefore replaces the default at that one join', () => {
    const out = concatClips([clip(sr, 0.5), clip(sr, 0.25, 1), clip(sr, 0.125)], 0.35, sr);
    const wide = Math.round(1 * sr);
    const narrow = Math.round(0.35 * sr);
    assert.equal(out.pcm.length, sr * 3 + wide + narrow);
    assert.equal(out.pcm[sr + Math.floor(wide / 2)], 0, 'the wide gap is silence');
    assert.equal(out.pcm[sr + wide], 0.25);
  });

  test('gapBefore on the first clip is inert', () => {
    const out = concatClips([clip(sr, 0.5, 5)], 0.35, sr);
    assert.equal(out.pcm.length, sr);
  });

  test('segments tile the clip, each span covering its audio plus the silence after it', () => {
    const out = concatClips([clip(sr, 0.5), clip(2 * sr, 0.25, 1)], 0.35, sr);
    const wide = Math.round(1 * sr);
    assert.deepEqual(out.segments, [
      { words: [0, 1], samples: [0, sr + wide], gapAfter: wide },
      { words: [1, 2], samples: [sr + wide, out.pcm.length], gapAfter: 0 },
    ]);
    for (let i = 1; i < out.segments.length; i++) {
      assert.equal(out.segments[i - 1]!.samples[1], out.segments[i]!.samples[0], 'no hole, no overlap');
    }
    assert.equal(out.segments.at(-1)!.samples[1], out.pcm.length);
  });

  test('an empty clip list has no segments', () => {
    assert.deepEqual(concatClips([], 0.35, sr).segments, []);
  });
});

describe('parseVoiceBlend (plans/181 section 4)', () => {
  test('a plain id is one component of weight 1, so every existing caller is unchanged', () => {
    assert.deepEqual(parseVoiceBlend('bf_lily'), [{ id: 'bf_lily', w: 1 }]);
  });

  test('a named weight leaves the remainder to the unweighted component', () => {
    assert.deepEqual(parseVoiceBlend('af_heart+bf_lily:0.3'), [
      { id: 'af_heart', w: 0.7 }, { id: 'bf_lily', w: 0.3 },
    ]);
  });

  test('several unweighted components share the remainder equally', () => {
    assert.deepEqual(parseVoiceBlend('af_heart+bf_lily+am_puck:0.4'), [
      { id: 'af_heart', w: 0.3 }, { id: 'bf_lily', w: 0.3 }, { id: 'am_puck', w: 0.4 },
    ]);
  });

  test('weights normalise to 1 however they were written', () => {
    for (const s of ['af_heart:2+bf_lily:2', 'af_heart:1+bf_lily:1', 'af_heart+bf_lily']) {
      assert.deepEqual(parseVoiceBlend(s), [{ id: 'af_heart', w: 0.5 }, { id: 'bf_lily', w: 0.5 }], s);
    }
    const sum = parseVoiceBlend('af_heart:0.2+bf_lily:0.5+am_puck:0.9')
      .reduce((a, c) => a + c.w, 0);
    assert.ok(Math.abs(sum - 1) < 1e-12);
  });

  test('all-zero weights fall back to an even split rather than dividing by zero', () => {
    assert.deepEqual(parseVoiceBlend('af_heart:0+bf_lily:0'), [
      { id: 'af_heart', w: 0.5 }, { id: 'bf_lily', w: 0.5 },
    ]);
  });

  test('a weight that is not a number is read as absent', () => {
    assert.deepEqual(parseVoiceBlend('af_heart+bf_lily:oops'), [
      { id: 'af_heart', w: 0.5 }, { id: 'bf_lily', w: 0.5 },
    ]);
  });

  test('whitespace around components is tolerated', () => {
    assert.deepEqual(parseVoiceBlend(' af_heart + bf_lily : 0.25 '), [
      { id: 'af_heart', w: 0.75 }, { id: 'bf_lily', w: 0.25 },
    ]);
  });

  test('an unknown id or an empty setting throws the worker\'s own message', () => {
    assert.throws(() => parseVoiceBlend('af_nope'), /unknown voice "af_nope" - one of: af_heart, /);
    assert.throws(() => parseVoiceBlend('af_heart+af_nope'), /unknown voice "af_nope"/);
    assert.throws(() => parseVoiceBlend(''), /unknown voice ""/);
    assert.throws(() => parseVoiceBlend('  +  '), /unknown voice/);
  });
});

describe('accentOfBlend', () => {
  test('the heaviest component decides, with no refusal of a cross-accent blend', () => {
    assert.equal(accentOfBlend(parseVoiceBlend('af_heart+bf_lily:0.3')), 'a');
    assert.equal(accentOfBlend(parseVoiceBlend('af_heart:0.3+bf_lily')), 'b');
    assert.equal(accentOfBlend(parseVoiceBlend('bf_lily')), 'b');
    assert.equal(accentOfBlend(parseVoiceBlend('am_michael')), 'a');
  });

  test('a tie goes to the first listed', () => {
    assert.equal(accentOfBlend(parseVoiceBlend('bf_lily+af_heart')), 'b');
    assert.equal(accentOfBlend(parseVoiceBlend('af_heart+bf_lily')), 'a');
  });

  test('an empty blend reads as en-US, like an id with no b prefix', () => {
    assert.equal(accentOfBlend([]), 'a');
  });
});

describe('endsSentence', () => {
  test('terminal punctuation, closers included', () => {
    for (const w of ['end.', 'now!', 'really?', 'trailing…', 'said."', 'aside.)', "quote.'"]) {
      assert.ok(endsSentence(w), w);
    }
    for (const w of ['mid,', 'word', 'dash-', 'colon:', 'open("']) {
      assert.ok(!endsSentence(w), w);
    }
  });
});

describe('deriveSegmentsFromWords (legacy clips, plans/181 ruling 10)', () => {
  const sr = KOKORO_SAMPLE_RATE;
  const w = (text: string, start: number, end: number): SpeechWordTiming => ({ text, start, end });

  test('a sentence ends at terminal punctuation and the seam sits at the gap midpoint', () => {
    const words = [
      w('Hello', 0, 0.4), w('there.', 0.4, 0.9),
      w('World', 1.4, 1.8), w('again.', 1.8, 2.3),
    ];
    const segs = deriveSegmentsFromWords(words, sr);
    assert.ok(segs);
    const seam = Math.round(((0.9 + 1.4) / 2) * sr);
    assert.deepEqual(segs, [
      { words: [0, 2], samples: [0, seam], gapAfter: 0 },
      { words: [2, 4], samples: [seam, Math.round(2.3 * sr)], gapAfter: 0 },
    ]);
  });

  test('the derived segments tile with no hole and no overlap', () => {
    const words = [w('A.', 0, 0.3), w('B.', 0.9, 1.2), w('C.', 1.8, 2.1)];
    const segs = deriveSegmentsFromWords(words, sr, MIN_SEAM_GAP_S, Math.round(2.5 * sr));
    assert.ok(segs);
    assert.equal(segs.length, 3);
    assert.equal(segs[0]!.samples[0], 0);
    for (let i = 1; i < segs.length; i++) {
      assert.equal(segs[i - 1]!.samples[1], segs[i]!.samples[0]);
    }
    assert.equal(segs.at(-1)!.samples[1], Math.round(2.5 * sr), 'totalSamples extends the last');
  });

  test('null when a boundary has less than the minimum silence to cut in', () => {
    const words = [w('A.', 0, 0.3), w('B.', 0.4, 0.7)];
    assert.equal(deriveSegmentsFromWords(words, sr), null);
    // The same boundary passes once the caller accepts a narrower seam.
    assert.ok(deriveSegmentsFromWords(words, sr, 0.05));
    assert.equal(MIN_SEAM_GAP_S, 0.2);
  });

  test('text with no terminal punctuation is one segment, not a failure', () => {
    const segs = deriveSegmentsFromWords([w('one', 0, 0.3), w('two', 0.4, 0.7)], sr);
    assert.deepEqual(segs, [{ words: [0, 2], samples: [0, Math.round(0.7 * sr)], gapAfter: 0 }]);
  });

  test('null on an empty word list or a nonsense sample rate', () => {
    assert.equal(deriveSegmentsFromWords([], sr), null);
    assert.equal(deriveSegmentsFromWords([w('A.', 0, 1)], 0), null);
  });

  test('a clip concatClips just built derives back to the same word ranges', () => {
    const clips: SentenceClip[] = [
      { pcm: new Float32Array(sr).fill(0.5), words: [{ text: 'Hello.', start: 0.1, end: 0.6 }] },
      { pcm: new Float32Array(sr).fill(0.25), words: [{ text: 'World.', start: 0.1, end: 0.6 }] },
    ];
    const out = concatClips(clips, 0.35, sr);
    const derived = deriveSegmentsFromWords(out.words, sr, MIN_SEAM_GAP_S, out.pcm.length);
    assert.ok(derived);
    assert.deepEqual(derived.map((s) => s.words), out.segments.map((s) => s.words));
    // The derived seam sits inside the silence concatClips inserted, which is
    // the property that makes a splice at it safe.
    const seam = derived[0]!.samples[1];
    assert.ok(seam > Math.round(0.6 * sr) && seam < sr + Math.round(0.35 * sr) + Math.round(0.1 * sr));
    assert.equal(out.pcm[seam], 0);
  });
});

describe('the marks-to-audio composition the worker performs', () => {
  const sr = KOKORO_SAMPLE_RATE;

  test('a parsed [pause 1] becomes a concatClips gap that sounds like one second', () => {
    const parsed = parseScriptMarks('One. [pause 1] Two.');
    const clips: SentenceClip[] = parsed.sentences.map((s, i) => ({
      pcm: new Float32Array(sr).fill(0.5),
      words: [{ text: `w${i}`, start: 0, end: 1 }],
      ...(s.gapBefore === undefined ? {} : { gapBefore: pauseGapS(s.gapBefore) }),
    }));
    const out = concatClips(clips, 0.35, sr);
    const gap = Math.round(pauseGapS(1) * sr);
    assert.equal(out.pcm.length, 2 * sr + gap);
    // What the listener hears is that gap plus the padding both clips carry,
    // which is the second the mark asked for.
    assert.ok(Math.abs(gap / sr + CLIP_EDGE_PAD_S - 1) < 1e-9);
  });

  test('a private-use character already in the script is dropped, not read as a mark', () => {
    const p = parseScriptMarks('Odd \uE005 text here.');
    assert.equal(p.sentences.length, 1);
    assert.equal(p.sentences[0]!.text, 'Odd text here.');
    assert.equal(p.sentences[0]!.pronunciations, undefined);
    assert.equal(p.sentences[0]!.speed, undefined);
  });
});
