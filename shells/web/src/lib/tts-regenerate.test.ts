// SPDX-License-Identifier: MPL-2.0
/**
 * Regenerate, end to end (plans/181 section 5.2): the join that takes an edited
 * script from the transcript panel, speaks only the lines that changed, splices
 * them into the stored clip and rewrites it under its own asset id.
 *
 * Until this module existed the panel had a Regenerate button with nothing
 * behind it - the pure splice, the per-line synthesis and the in-place rewrite
 * all shipped, and nothing joined them - so the assertions here are deliberately
 * about the joins: what was asked of the voice, what came back in the bytes, and
 * where it was written.
 *
 * The claim under all of it is still "untouched audio is untouched": the first
 * test decodes the rewritten clip and compares the sentences nobody edited,
 * sample for sample, against the ones that went in.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/tts-regenerate.test.ts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { regenerateTtsClip, regenerateTtsClipAsJob, type TtsRegenerateHost } from './tts-regenerate.ts';
import { decodeWavMono } from './tts-splice.ts';
import { concatClips, SENTENCE_GAP_S, type SentenceClip, type TtsSegment } from './speech-kokoro.ts';
import { pcmToWavBlob } from './pcm-wav.ts';
import { __resetJobsForTest, cancelJob, jobsSnapshot } from './jobs.ts';
import { TTS_MODEL } from './tts-provenance.ts';
import type { SpeechSynthesizeOpts, SpeechWordTiming } from '@lolly-tools/core/host-v1';

const RATE = 100;              // 1 sample = 10 ms, so the 0.35 s gap is 35 samples
const ID = 'user/tts/1-one-two';
const SCRIPT = 'One two.\nThree.\nFour five six.';

/** Samples that survive the 16-bit round trip exactly, and read back distinctly. */
function tone(seed: number, samples: number): Float32Array {
  const pcm = new Float32Array(samples);
  for (let i = 0; i < samples; i++) pcm[i] = ((seed * 1000 + i) % 4000) / 32768;
  return pcm;
}

function line(seed: number, samples: number, texts: string[]): SentenceClip {
  const each = samples / RATE / texts.length;
  return {
    pcm: tone(seed, samples),
    words: texts.map((text, i) => ({ text, start: i * each, end: (i + 1) * each })),
  };
}

/** The stored clip: three spoken lines, joined the way the worker joins them. */
function storedClip(): { pcm: Float32Array; words: SpeechWordTiming[]; segments: TtsSegment[] } {
  const out = concatClips([
    line(1, 60, ['One', 'two.']),
    line(2, 40, ['Three.']),
    line(3, 80, ['Four', 'five', 'six.']),
  ], SENTENCE_GAP_S, RATE);
  return { pcm: out.pcm, words: out.words, segments: out.segments };
}

interface Calls {
  lines: Array<{ lines: string[]; opts: SpeechSynthesizeOpts }>;
  whole: Array<{ text: string; opts: SpeechSynthesizeOpts }>;
  writes: Array<{ id: string; patch: { blob: Blob; meta?: Record<string, unknown> } }>;
  uploads: Array<{ id: string; blob?: Blob }>;
}

interface Stub { host: TtsRegenerateHost; calls: Calls }

/** A host over one stored clip: the real bytes, a hand-settled voice. */
function stub(over: {
  meta?: Record<string, unknown>;
  blob?: Blob;
  noLines?: boolean;
  failWrite?: boolean;
  speak?: (lines: string[], opts: SpeechSynthesizeOpts) => Promise<unknown>;
} = {}): Stub {
  const clip = storedClip();
  const calls: Calls = { lines: [], whole: [], writes: [], uploads: [] };
  const blob = over.blob ?? pcmToWavBlob({ left: clip.pcm, right: clip.pcm, sampleRate: RATE });
  const record = {
    id: ID, source: 'user', type: 'audio', format: 'wav', url: 'blob:clip',
    meta: over.meta ?? {
      name: 'One two…',
      durationMs: Math.round((clip.pcm.length / RATE) * 1000),
      tts: {
        voice: 'bf_lily', speed: 1, model: TTS_MODEL, text: 'One two. Three. Four five six.',
        script: SCRIPT, words: clip.words, segments: clip.segments, granularity: 'word',
      },
    },
  };
  const speech = {
    async synthesize(text: string, opts: SpeechSynthesizeOpts = {}) {
      calls.whole.push({ text, opts });
      const spoken = line(9, 200, ['One', 'two.', 'Three.', 'Four', 'five', 'six.']);
      return {
        pcm: spoken.pcm, sampleRate: RATE, duration: 2, words: spoken.words,
        granularity: 'word' as const, script: text.split('\n'),
        segments: [{ words: [0, 6] as [number, number], samples: [0, 200] as [number, number], gapAfter: 0 }],
      };
    },
    ...(over.noLines ? {} : {
      async synthesizeLines(lines: string[], opts: SpeechSynthesizeOpts = {}) {
        calls.lines.push({ lines, opts });
        if (over.speak) return over.speak(lines, opts) as never;
        // Every re-spoken line comes back at 50 samples, whatever it says.
        // gapBefore is reported only for a line that carries a pause mark,
        // exactly as the worker does it - a line with no mark asks for nothing
        // and must leave the silence in front of it as the clip already had it.
        return lines.map((text) => {
          const mark = /\[\s*pause(?:\s+([0-9]*\.?[0-9]+))?\s*\]/i.exec(text);
          const spokenText = mark ? text.replace(mark[0], '').trim() : text;
          const c = line(7, 50, spokenText.split(/\s+/));
          return {
            pcm: c.pcm, words: c.words, granularity: 'word' as const,
            ...(mark ? { gapBefore: Math.max(0, Number(mark[1] ?? 1.2) - 0.6) } : {}),
          };
        });
      },
    }),
  };
  const host = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    speech,
    assets: {
      async get(id: string) { return id === record.id ? record : null; },
      async _getBlob(id: string) { return id === record.id ? blob : null; },
      async _replaceUserAssetBytes(id: string, patch: { blob: Blob; meta?: Record<string, unknown> }) {
        if (over.failWrite) throw new Error('storage full');
        calls.writes.push({ id, patch });
      },
      async _uploadUserAsset(rec: { id: string; blob?: Blob }) { calls.uploads.push(rec); },
    },
  } as unknown as TtsRegenerateHost;
  return { host, calls };
}

/** The mono samples of whatever was written back. */
async function writtenPcm(calls: Calls): Promise<Float32Array> {
  const bytes = new Uint8Array(await calls.writes[0]!.patch.blob.arrayBuffer());
  const decoded = decodeWavMono(bytes);
  assert.ok(decoded, 'the rewritten clip is readable 16-bit PCM');
  return decoded.pcm;
}

const ttsOf = (calls: Calls): Record<string, unknown> =>
  (calls.writes[0]!.patch.meta as { tts: Record<string, unknown> }).tts;

beforeEach(() => { __resetJobsForTest(); });

// ── the sentence path ────────────────────────────────────────────────────────

test('one edited line is spoken alone, and every untouched sample comes back unchanged', async () => {
  const { host, calls } = stub();
  const before = storedClip();
  const out = await regenerateTtsClip(host, {
    assetId: ID, baseScript: SCRIPT, script: 'One two.\nThree!\nFour five six.',
  });

  assert.ok(out, 'the regeneration produced a take');
  assert.deepEqual(calls.lines.map((c) => c.lines), [['Three!']], 'only the changed line reached the voice');
  assert.equal(calls.lines[0]!.opts.voice, 'bf_lily', 'spoken with the clip\'s own recipe');
  assert.equal(calls.lines[0]!.opts.prenormalized, true, 'a stored script is already normalized');

  const pcm = await writtenPcm(calls);
  // Line 0 owns samples [0, 60) and line 2 the last 80 - the middle moved, the
  // ends did not. That is the whole promise of rewriting in place.
  for (let i = 0; i < 60; i++) assert.equal(pcm[i], before.pcm[i], `sample ${i} of the first line`);
  const oldTail = before.pcm.subarray(before.pcm.length - 80);
  const newTail = pcm.subarray(pcm.length - 80);
  for (let i = 0; i < 80; i++) assert.equal(newTail[i], oldTail[i], `sample ${i} of the last line`);

  assert.equal(calls.writes.length, 1, 'one write');
  assert.equal(calls.writes[0]!.id, ID, 'at the clip\'s own id, so no box is re-pointed');
  const tts = ttsOf(calls);
  assert.equal(tts.script, 'One two.\nThree!\nFour five six.');
  assert.equal((tts.segments as TtsSegment[]).length, 3, 'one segment per script line');
  assert.equal((tts.words as SpeechWordTiming[])[2]!.text, 'Three!', 'the new word rides the timings');
  assert.equal(tts.voice, 'bf_lily', 'the rest of the recipe is untouched');

  // The old middle line ran 40 samples; the new one runs 50.
  assert.equal(out.edits.length, 1);
  assert.equal(Math.round(out.edits[0]!.delta * RATE), 10);
  assert.equal(out.script, 'One two.\nThree!\nFour five six.');
});

test('deleting a full stop widens the work to both sentences', async () => {
  const { host, calls } = stub();
  const out = await regenerateTtsClip(host, {
    assetId: ID, baseScript: SCRIPT, script: 'One two, three.\nFour five six.',
  });
  assert.ok(out);
  assert.deepEqual(calls.lines.map((c) => c.lines), [['One two, three.']], 'the joined line, once');
  // The replaced span covers BOTH old lines, which is what tells the timeline
  // how much of its geometry has to be re-fitted.
  assert.equal(out.edits.length, 1);
  assert.equal(Math.round(out.edits[0]!.from * RATE), 0);
  // Each line's span is its own audio plus the silence that follows it, so two
  // 0.35 s gaps ride along with the 60 and 40 samples they separate.
  assert.equal(Math.round(out.edits[0]!.to * RATE), 60 + 35 + 40 + 35);
});

test('an unchanged script speaks nothing and writes nothing', async () => {
  const { host, calls } = stub();
  assert.equal(await regenerateTtsClip(host, { assetId: ID, baseScript: SCRIPT, script: SCRIPT }), null);
  assert.equal(calls.lines.length, 0);
  assert.equal(calls.writes.length, 0);
});

test('the take comes back with the clip as the store now holds it', async () => {
  const { host, calls } = stub();
  const out = await regenerateTtsClip(host, {
    assetId: ID, baseScript: SCRIPT, script: 'One two.\nThree!\nFour five six.',
  });
  assert.ok(out);
  // The rewrite bumped the record's version, so a ref a document already
  // stored carries the PREVIOUS bytes' object URL and the previous meta.tts.
  // The caller has to be handed the live one, or the timeline is re-fitted to
  // word timings whose audio it is not playing (plans/181 section 5.3 step 4).
  assert.ok(out.ref, 'the caller gets a ref to put in its boxes');
  assert.equal(out.ref!.id, ID, 'still the same id - nothing is re-pointed');
  assert.equal(calls.writes.length, 1, 'and it was read after the write, not before');
});

test('a [pause] typed onto an edited line lengthens the join before it', async () => {
  const { host, calls } = stub();
  const before = storedClip();
  const out = await regenerateTtsClip(host, {
    assetId: ID, baseScript: SCRIPT, script: 'One two.\n[pause 1.5] Three.\nFour five six.',
  });
  assert.ok(out);
  const pcm = await writtenPcm(calls);
  // 1.5 s asked for, less the 0.6 s of padding the two clips already carry:
  // 0.9 s of zeros where 0.35 s used to be.
  const want = Math.round(0.9 * RATE);
  const had = Math.round(SENTENCE_GAP_S * RATE);
  const segs = (calls.writes[0]!.patch.meta as { tts: { segments: TtsSegment[] } }).tts.segments;
  assert.equal(segs[0]!.gapAfter, want, 'the silence lives in the line before it');
  assert.equal(pcm.length, before.pcm.length - 40 + 50 + (want - had));
  for (let i = 60; i < 60 + want; i++) assert.equal(pcm[i], 0, `sample ${i} of the pause is not silent`);
  // The replaced range starts at that silence, so a cut sitting in it is
  // re-fitted rather than shifted past a length that changed under it.
  assert.equal(Math.round(out.edits[0]!.from * RATE), 60);
});

test('keeping the previous take is opt-in, and saves the OLD bytes beside the clip', async () => {
  const off = stub();
  await regenerateTtsClip(off.host, { assetId: ID, baseScript: SCRIPT, script: 'One two.\nThree!\nFour five six.' });
  assert.equal(off.calls.uploads.length, 0, 'nothing extra by default');

  const on = stub();
  await regenerateTtsClip(on.host, {
    assetId: ID, baseScript: SCRIPT, script: 'One two.\nThree!\nFour five six.', keepPrevious: true,
  });
  assert.equal(on.calls.uploads.length, 1);
  assert.notEqual(on.calls.uploads[0]!.id, ID, 'the kept take is its own clip');
  const kept = decodeWavMono(new Uint8Array(await on.calls.uploads[0]!.blob!.arrayBuffer()));
  assert.equal(kept!.pcm.length, storedClip().pcm.length, 'and it is the take that was there before');
});

// ── the whole-script fallbacks ───────────────────────────────────────────────

test('a shell that cannot speak single lines speaks the whole script, still in place', async () => {
  const { host, calls } = stub({ noLines: true });
  const out = await regenerateTtsClip(host, {
    assetId: ID, baseScript: SCRIPT, script: 'One two.\nThree!\nFour five six.',
  });
  assert.ok(out);
  assert.deepEqual(calls.whole.map((c) => c.text), ['One two.\nThree!\nFour five six.']);
  assert.equal(calls.writes[0]!.id, ID, 'the id still never moves');
  assert.equal(out.edits.length, 1, 'one edit, covering the clip end to end');
  assert.equal(out.edits[0]!.from, 0);
});

test('a clip with no trustworthy tiling falls back rather than guessing a seam', async () => {
  // No stored segments, and the words run on with no silence to cut in - which
  // is exactly when deriveSegmentsFromWords refuses to invent one.
  const words: SpeechWordTiming[] = [
    { text: 'One.', start: 0, end: 0.5 },
    { text: 'Two.', start: 0.51, end: 1 },
  ];
  const { host, calls } = stub({
    meta: {
      name: 'One…',
      tts: { voice: 'bf_lily', speed: 1, model: TTS_MODEL, text: 'One. Two.', script: 'One.\nTwo.', words },
    },
  });
  const out = await regenerateTtsClip(host, { assetId: ID, baseScript: 'One.\nTwo.', script: 'One!\nTwo.' });
  assert.ok(out);
  assert.equal(calls.lines.length, 0, 'no line was spliced');
  assert.deepEqual(calls.whole.map((c) => c.text), ['One!\nTwo.']);
});

// ── failure keeps the edit ───────────────────────────────────────────────────

test('a write that fails throws, so the panel can keep the words on screen', async () => {
  const { host } = stub({ failWrite: true });
  await assert.rejects(
    regenerateTtsClip(host, { assetId: ID, baseScript: SCRIPT, script: 'One two.\nThree!\nFour five six.' }),
    /could not be written/,
  );
});

test('a clip with no recipe refuses BEFORE it speaks anything', async () => {
  // No voice in the block, so ttsRecipeFromMeta cannot prove Lolly made it.
  const { host, calls } = stub({ meta: { name: 'Someone else\'s audio', tts: { text: 'One.' } } });
  await assert.rejects(
    regenerateTtsClip(host, { assetId: ID, baseScript: 'One.', script: 'One!' }),
    /no recipe/,
  );
  assert.equal(calls.lines.length + calls.whole.length, 0, 'nothing was spoken for nothing');
});

test('a clip that is no longer in the store says so', async () => {
  const { host } = stub();
  await assert.rejects(
    regenerateTtsClip(host, { assetId: 'user/tts/gone', baseScript: SCRIPT, script: 'A.' }),
    /no longer in your uploads/,
  );
});

// ── the job wrapper ──────────────────────────────────────────────────────────

test('the run is a cancellable heavy job, and cancelling it resolves nothing', async () => {
  let release = (): void => {};
  const gate = new Promise<void>((r) => { release = () => r(); });
  const { host, calls } = stub({
    speak: async (_lines, opts) => {
      await Promise.race([gate, new Promise((_r, reject) => {
        opts.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      })]);
      return [];
    },
  });
  const p = regenerateTtsClipAsJob(host, {
    assetId: ID, baseScript: SCRIPT, script: 'One two.\nThree!\nFour five six.',
  });
  await new Promise((r) => setTimeout(r, 0));
  const job = jobsSnapshot()[0]!;
  assert.equal(job.cancellable, true);
  assert.equal(job.heavy, true);
  cancelJob(job.id);
  assert.equal(await p, null, 'a cancelled run hands back nothing');
  assert.equal(calls.writes.length, 0, 'and writes nothing');
  release();
});
