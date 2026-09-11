// SPDX-License-Identifier: MPL-2.0
/**
 * Notes to narration (plans/180 sections 2 and 3), tested where it can be tested:
 * the pure half. Marker stripping, the build offsets read back off the word
 * timings, the two idempotent group writes, the dwell floors the sequence solver
 * takes, and the stale check that decides whether a slide is spoken again at all.
 *
 * The job driver gets one end-to-end pass over a hand-settled voice, because the
 * claims that matter about it are not about audio: which slides it chose, what it
 * committed, and that a second run over unchanged notes speaks nothing.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/narration.test.ts
 */
import { test, beforeEach } from 'node:test';
import { ttsRecipeFromMeta } from './tts-provenance.ts';
import assert from 'node:assert/strict';

import {
  applyBuildStarts, applyNarrationCaptions, applyNarrationClip, BUILD_MARKER,
  DESIGN_NARRATION_FIELDS, duckBedForNarration, framesToNarrate, isEnglishLang,
  isNarrationGroup, narratedFrameId, narrateDeckAsJob, narrationBuildOffsets,
  narrationDwellFloors, narrationFrames, narrationGroup, narrationNote, narrationNoteOf,
  narrationSlices, narrationSlicesFromModel, narrationState, narrationStatusFor,
  NARRATION_BED_DUCK, notesHash, parseNarrationNotes, reanchorNarration,
  type NarrationHost,
} from './narration.ts';
import { CAPTION_BOX_CLASS, captionGroup, isCaptionGroup } from '../views/timeline-captions.ts';
import { __resetJobsForTest } from './jobs.ts';
import type { SpeechSynthesizeOpts, SpeechWordTiming } from '@lolly-tools/core/host-v1';
import { sequenceFramesInOrder, type Box } from '../views/free-canvas-math.ts';

const F = DESIGN_NARRATION_FIELDS;

beforeEach(() => { __resetJobsForTest(); });

/* ── notes to spoken words (T5) ─────────────────────────────────────────────── */

test('parseNarrationNotes strips the build markers and never speaks them', () => {
  const { spoken, marks } = parseNarrationNotes('Welcome along.\n> First we look at cost.\n> Then at time.');
  assert.equal(spoken, 'Welcome along.\nFirst we look at cost.\nThen at time.');
  assert.ok(!spoken.includes(BUILD_MARKER), 'the marker never reaches the voice');
  assert.deepEqual(marks.map((m) => [m.step, m.wordIndex, m.token]), [
    [1, 2, 'First'],
    [2, 7, 'Then'],
  ]);
});

test('parseNarrationNotes: no notes, no markers, and a bare marker line', () => {
  assert.deepEqual(parseNarrationNotes(''), { spoken: '', marks: [] });
  assert.deepEqual(parseNarrationNotes('   \n  '), { spoken: '', marks: [] });
  assert.deepEqual(parseNarrationNotes(null), { spoken: '', marks: [] });
  assert.deepEqual(parseNarrationNotes('Just words.').marks, [], 'no markers, no steps');
  // A bare '>' has no first spoken word, so it is not a step that could ever be placed.
  assert.deepEqual(parseNarrationNotes('One.\n>\nTwo.').marks, []);
  assert.equal(parseNarrationNotes('One.\n>\nTwo.').spoken, 'One.\n\nTwo.');
});

test('parseNarrationNotes tolerates CRLF and indented markers', () => {
  const { spoken, marks } = parseNarrationNotes('A line.\r\n\t>  Indented step.');
  assert.equal(spoken, 'A line.\nIndented step.');
  assert.deepEqual(marks.map((m) => m.token), ['Indented']);
});

/* ── build offsets (T5) ─────────────────────────────────────────────────────── */

const words = (...spec: Array<[string, number]>): SpeechWordTiming[] =>
  spec.map(([text, start]) => ({ text, start, end: start + 0.3 }));

test('narrationBuildOffsets reads each step off its own first word', () => {
  const { marks } = parseNarrationNotes('Welcome along.\n> First we look at cost.\n> Then at time.');
  const w = words(
    ['Welcome', 0], ['along.', 0.5],
    ['First', 1.2], ['we', 1.5], ['look', 1.8], ['at', 2.1], ['cost.', 2.4],
    ['Then', 3.1], ['at', 3.4], ['time.', 3.7],
  );
  assert.deepEqual(narrationBuildOffsets(w, marks), [1200, 3100]);
});

test('narrationBuildOffsets re-finds a step the normalizer shifted', () => {
  // The shell's normalizer split '2,024' into two words, so every counted index
  // after it is one too low. The step is re-found by its own word instead.
  const { marks } = parseNarrationNotes('In 2,024 we shipped.\n> Then we doubled.');
  assert.equal(marks[0]!.wordIndex, 4, 'the notes counted four words before the marker');
  const w = words(['In', 0], ['twenty', 0.3], ['twenty', 0.6], ['four', 0.9], ['we', 1.2], ['shipped.', 1.5], ['Then', 2.2], ['we', 2.5], ['doubled.', 2.8]);
  assert.deepEqual(narrationBuildOffsets(w, marks), [2200], 'found at "Then", not at index 4');
});

test('narrationBuildOffsets stays in order and never runs off the end', () => {
  const { marks } = parseNarrationNotes('> One.\n> Two.\n> Three.');
  // Only two words came back, so the third step clamps to the last one rather than
  // reading undefined.
  assert.deepEqual(narrationBuildOffsets(words(['One.', 0], ['Two.', 1]), marks), [0, 1000, 1000]);
  assert.deepEqual(narrationBuildOffsets([], marks), [], 'no timings, no offsets to place');
  assert.deepEqual(narrationBuildOffsets(words(['One.', 0]), []), []);
});

/* ── stale detection ────────────────────────────────────────────────────────── */

test('notesHash is stable, and reads the words plus the marker positions', () => {
  assert.equal(notesHash('one two'), notesHash('one two'));
  assert.notEqual(notesHash('one two'), notesHash('one three'));
  assert.match(notesHash('one two'), /^[0-9a-f]{8}$/);
  // Moving a marker changes WHEN a build appears even though every spoken word is
  // identical, so it counts as an edit - a build must not be silently left behind.
  assert.notEqual(narrationNote('f1', 'One.\n> Two.').notesHash,
    narrationNote('f1', '> One.\nTwo.').notesHash);
  // Reformatting neither the words nor the markers is not an edit.
  assert.equal(narrationNote('f1', 'One.\n>  Two.').notesHash,
    narrationNote('f1', 'One.\n> Two.').notesHash);
});

test('narrationState: none, pending, current, stale', () => {
  const meta = { narration: narrationNote('f1', 'Hello there.') };
  assert.equal(narrationState('', meta), 'none');
  assert.equal(narrationState('Hello there.', null), 'pending');
  assert.equal(narrationState('Hello there.', meta), 'current');
  assert.equal(narrationState('Hello again.', meta), 'stale');
  assert.equal(narrationNoteOf({ narration: { frameId: 'f1' } }), null, 'a note with no hash is no note');
});

/* ── the group contract ─────────────────────────────────────────────────────── */

test('the narration group names its frame and nothing else', () => {
  assert.equal(narrationGroup('f2'), 'narration:f2');
  assert.equal(isNarrationGroup('narration:f2'), true);
  assert.equal(isNarrationGroup(captionGroup('b3')), false);
  assert.equal(narratedFrameId('narration:f2'), 'f2');
  assert.equal(narratedFrameId('captions:b3'), '');
});

/* ── the deck ───────────────────────────────────────────────────────────────── */

// Exactly what "Place in order" writes: a transition KIND on each frame and no length
// field at all. The length is the one every player defaults to (400 ms), which is the
// whole point - reading the absent field as 0 sized a narrated slide short of its own
// fade and started the exit under the last words.
const deck = (): Box[] => [
  { id: 'f1', kind: 'frame', order: 0, x: 0, y: 0, w: 1920, h: 1080, notes: 'Slide one.', start: 0, dur: 3, enter: 'fade', exit: 'fade' },
  { id: 'f2', kind: 'frame', order: 1, x: 2000, y: 0, w: 1920, h: 1080, notes: '', start: 3, dur: 3, enter: 'fade', exit: 'fade' },
  { id: 't1', kind: 'text', frame: 'f1', text: 'Hello', build: 1 },
];

test('narrationFrames reads notes, timing and play order', () => {
  const frames = narrationFrames(deck(), F);
  assert.deepEqual(frames.map((fr) => fr.id), ['f1', 'f2']);
  assert.equal(frames[0]!.spoken, 'Slide one.');
  assert.equal(frames[0]!.startMs, 0);
  assert.equal(frames[0]!.durMs, 3000);
  assert.deepEqual(frames[0]!.rect, { x: 0, y: 0, w: 1920, h: 1080 });
  assert.equal(frames[1]!.spoken, '', 'a slide with no notes has nothing to say');
  assert.equal(frames[0]!.clip, null);
});

test('applyNarrationClip writes one audio box and REPLACES it on a re-run', () => {
  const ref = { id: 'user/tts/1-slide-one', url: 'blob:one', type: 'audio' };
  const once = applyNarrationClip(deck(), F, { frameId: 'f1', asset: ref, startMs: 400, durMs: 5200, frameRect: { x: 0, y: 0, w: 1920, h: 1080 } });
  const clip = once.find((b) => isNarrationGroup(b!.group))!;
  assert.equal(clip.kind, 'audio');
  assert.equal(clip.frame, 'f1');
  assert.equal(clip.group, 'narration:f1');
  assert.equal(clip.lane, 'seq');
  assert.equal(clip.start, 0.4, 'slide start plus the lead-in, in seconds');
  assert.equal(clip.dur, 5.2);
  assert.equal(clip.presentAudio, true, 'so the presenter may unmute it');
  assert.equal(clip.image, ref);
  assert.equal(once.length, deck().length + 1);

  const twice = applyNarrationClip(once, F, { frameId: 'f1', asset: { id: 'user/tts/2', url: 'blob:two' }, startMs: 400, durMs: 4000 });
  assert.equal(twice.filter((b) => b!.group === 'narration:f1').length, 1, 'a second run replaces, never stacks');
  assert.equal(twice.length, once.length, 'and costs no extra rows');
  // Another slide's clip is untouched by this one's re-run.
  const both = applyNarrationClip(once, F, { frameId: 'f2', asset: { id: 'user/tts/3' }, startMs: 3400, durMs: 2000 });
  assert.deepEqual(both.filter((b) => isNarrationGroup(b!.group)).map((b) => b!.group), ['narration:f1', 'narration:f2']);
});

test('re-narrating a slide keeps ONE clip id and ONE caption set', () => {
  const first = applyNarrationClip(deck(), F, {
    frameId: 'f1', asset: { id: 'user/tts/1', url: 'blob:one' }, startMs: 400, durMs: 5200,
  });
  const clipId = String(first.find((b) => isNarrationGroup(b!.group))!.id);
  const captioned = applyNarrationCaptions(first, F, {
    sourceId: clipId, frameId: 'f1', cues: [{ start: 0.4, end: 2.4, text: 'This is slide one.' }],
  });
  assert.equal(captioned.filter((b) => isCaptionGroup(b!.group)).length, 1);

  // The defect this pins (browser pass, plans/180 step 3): the second run minted a NEW
  // clip id, so the caption writer cleared `captions:<new id>` while the first voice's
  // cues stayed under `captions:<old id>`. The slide then had two sets of words and the
  // exported sidecar said both of them.
  const again = applyNarrationClip(captioned, F, {
    frameId: 'f1', asset: { id: 'user/tts/2', url: 'blob:two' }, startMs: 400, durMs: 4800,
  });
  const clip = again.find((b) => isNarrationGroup(b!.group))!;
  assert.equal(String(clip.id), clipId, 'the slide keeps one clip identity across re-generation');
  assert.equal((clip.image as { id?: string }).id, 'user/tts/2', 'with the new voice on it');
  assert.equal(again.filter((b) => isCaptionGroup(b!.group)).length, 0,
    'the outgoing voice takes its cues with it, before any new ones are written');

  const revoiced = applyNarrationCaptions(again, F, {
    sourceId: String(clip.id), frameId: 'f1',
    cues: [{ start: 0.4, end: 2.4, text: 'This is slide one, now revised.' }],
  });
  assert.deepEqual(revoiced.filter((b) => isCaptionGroup(b!.group)).map((b) => b!.text),
    ['This is slide one, now revised.'], 'one sentence on the slide, not two');
});

test('a hand-edited second member of the group is retired with its captions too', () => {
  const rows: Box[] = [
    ...deck(),
    { id: 'b8', kind: 'audio', frame: 'f1', group: 'narration:f1', lane: 'seq' },
    { id: 'b9', kind: 'audio', frame: 'f1', group: 'narration:f1', lane: 'seq' },
    { id: 'c1', kind: 'text', frame: 'f1', group: captionGroup('b9'), text: 'Orphan.' },
  ];
  const next = applyNarrationClip(rows, F, { frameId: 'f1', asset: {}, startMs: 0, durMs: 1000 });
  assert.equal(next.filter((b) => isNarrationGroup(b!.group)).length, 1, 'one voice per slide');
  assert.equal(next.filter((b) => isCaptionGroup(b!.group)).length, 0,
    'the cues of a clip that is gone go with it');
});

test('applyNarrationClip mints an id that collides with nothing', () => {
  const rows: Box[] = [{ id: 'b1', kind: 'box' }, { id: 'b2', kind: 'box' }];
  const next = applyNarrationClip(rows, F, { frameId: 'f1', asset: {}, startMs: 0, durMs: 1000 });
  const ids = next.map((b) => String(b!.id));
  assert.equal(new Set(ids).size, ids.length, 'every id is still unique');
});

test('duckBedForNarration lowers the bed and leaves an authored level alone (T6)', () => {
  const rows: Box[] = [
    { id: 'bed', kind: 'audio' },
    { id: 'sfx', kind: 'audio', duck: 0.6 },
    { id: 'nar', kind: 'audio', group: 'narration:f1' },
    { id: 'box', kind: 'box' },
  ];
  const next = duckBedForNarration(rows, F);
  assert.equal(next[0]!.duck, NARRATION_BED_DUCK);
  assert.equal(next[1]!.duck, 0.6, 'the author already said what they wanted');
  assert.equal(next[2]!.duck, undefined, 'the narration does not duck against itself');
  assert.equal(next[3], rows[3], 'a non-audio box keeps its identity');
});

test('applyNarrationCaptions replaces its group and offsets the band by the slide', () => {
  const cues = [{ start: 0.4, end: 1.4, text: 'Slide one.' }];
  const next = applyNarrationCaptions(deck(), F, {
    sourceId: 'b9', frameId: 'f2', cues, frameRect: { x: 2000, y: 0, w: 1920, h: 1080 },
  });
  const made = next.filter((b) => b!.group === captionGroup('b9'));
  assert.equal(made.length, 1);
  assert.equal(made[0]!.text, 'Slide one.');
  assert.equal(made[0]!.frame, 'f2');
  assert.equal(made[0]!.lane, '', 'a caption rides ABOVE the sequence');
  assert.equal(made[0]!.start, 0.4);
  assert.equal(made[0]!.dur, 1);
  assert.match(String(made[0]!.cls), new RegExp(`\\b${CAPTION_BOX_CLASS}\\b`), 'the export marker is on it');
  assert.ok(Number(made[0]!.x) >= 2000, 'the lower third sits on slide two, not slide one');
  // A re-run with new cues replaces the set rather than doubling it.
  const again = applyNarrationCaptions(next, F, {
    sourceId: 'b9', frameId: 'f2', cues: [{ start: 0.5, end: 1, text: 'Fixed.' }],
  });
  const after = again.filter((b) => b!.group === captionGroup('b9'));
  assert.equal(after.length, 1);
  assert.equal(after[0]!.text, 'Fixed.');
  // No cues at all leaves the document with no caption set for that clip.
  assert.equal(applyNarrationCaptions(next, F, { sourceId: 'b9', frameId: 'f2', cues: [] })
    .filter((b) => b!.group === captionGroup('b9')).length, 0);
});

test('applyBuildStarts puts each build on its own spoken word (T5)', () => {
  const rows: Box[] = [
    { id: 'f1', kind: 'frame', order: 0, notes: '> One.\n> Two.' },
    { id: 'a', kind: 'text', frame: 'f1', build: 1 },
    { id: 'b', kind: 'text', frame: 'f1', build: 2 },
    { id: 'c', kind: 'text', frame: 'f1' },
    { id: 'd', kind: 'text', frame: 'f2', build: 1 },
  ];
  const next = applyBuildStarts(rows, F, { frameId: 'f1', slideStartMs: 6000, leadInMs: 400, offsetsMs: [0, 1500] });
  assert.equal(next[1]!.start, 6.4, 'step 1 lands with the first word');
  assert.equal(next[2]!.start, 7.9, 'step 2 lands 1.5 s later');
  assert.equal(next[3]!.start, undefined, 'a box with no build step is untouched');
  assert.equal(next[4], rows[4], 'another slide is untouched, identity and all');
  // No markers means no offsets, which means nothing moves at all.
  assert.deepEqual(applyBuildStarts(rows, F, { frameId: 'f1', slideStartMs: 6000, leadInMs: 400, offsetsMs: [] }), rows);
});

/* ── the dwell floors (T1, T7, T8) ──────────────────────────────────────────── */

test('narrationDwellFloors: leadIn + narration + tail + exit, only for narrated slides', () => {
  const rows: Box[] = [
    ...deck(),
    { id: 'n1', kind: 'audio', frame: 'f1', group: 'narration:f1', lane: 'seq', start: 0.4, dur: 11 },
  ];
  const floors = narrationDwellFloors(rows, F);
  // 400 lead-in (its enterMs is also 400), 11 000 narration, 600 tail, 400 exit.
  assert.deepEqual(floors, { f1: 12400 });
  assert.equal('f2' in floors, false, 'a slide with no notes keeps its authored dwell (T8)');
  // A longer enter raises the lead-in rather than talking over the slide arriving (T2).
  const slower = rows.map((b) => (b!.id === 'f1' ? { ...b, enterMs: 900 } : b));
  assert.equal(narrationDwellFloors(slower, F).f1, 12900);
  // Document settings override both ends.
  assert.equal(narrationDwellFloors(rows, F, { leadInMs: 0, tailMs: 0 }).f1, 11800);
  // …but NOT below the frame's own enter: a 0 ms lead-in on a slide that still fades in
  // over 400 ms would put the first words under the entrance (T2).
  assert.equal(narrationDwellFloors(rows, F, { leadInMs: 0, tailMs: 0 }).f1! - 11000, 800);
  // A frame that declares NO transition genuinely takes neither phase - the players skip
  // it outright rather than running a 400 ms cut.
  const cut = rows.map((b) => (b!.id === 'f1' ? { ...b, enter: 'none', exit: '' } : b));
  assert.equal(narrationDwellFloors(cut, F).f1, 400 + 11000 + 600);
  // An authored length on a declared transition still wins over the 400 ms default.
  const slow = rows.map((b) => (b!.id === 'f1' ? { ...b, exitMs: 1200 } : b));
  assert.equal(narrationDwellFloors(slow, F).f1, 400 + 11000 + 600 + 1200);
});

/* ── which slides get spoken ────────────────────────────────────────────────── */

test('framesToNarrate skips the slides that are already current', () => {
  const rows: Box[] = [
    { id: 'f1', kind: 'frame', order: 0, notes: 'One.' },
    { id: 'f2', kind: 'frame', order: 1, notes: 'Two.' },
    { id: 'f3', kind: 'frame', order: 2, notes: '' },
  ];
  const metas: Record<string, unknown> = { f1: { narration: narrationNote('f1', 'One.') } };
  const frames = narrationFrames(rows, F);
  const metaOf = (fr: { id: string }): unknown => metas[fr.id];
  assert.deepEqual(framesToNarrate(frames, metaOf).map((fr) => fr.id), ['f2'], 'f1 is current, f3 has nothing to say');
  assert.deepEqual(framesToNarrate(frames, metaOf, { force: true }).map((fr) => fr.id), ['f1', 'f2']);
  assert.deepEqual(framesToNarrate(frames, metaOf, { frameIds: ['f1'], force: true }).map((fr) => fr.id), ['f1']);
  assert.deepEqual(framesToNarrate(frames, metaOf, { frameIds: ['f3'] }).map((fr) => fr.id), []);
});

test('narrationStatusFor reads the clip ref the runtime resolved onto the box', () => {
  const rows: Box[] = [
    ...deck(),
    {
      id: 'n1', kind: 'audio', frame: 'f1', group: 'narration:f1',
      image: { id: 'user/tts/1', meta: { narration: narrationNote('f1', 'Slide one.') } } as never,
    },
  ];
  assert.equal(narrationStatusFor(rows, F, 'f1'), 'current');
  assert.equal(narrationStatusFor(rows, F, 'f2'), 'none');
  assert.equal(narrationStatusFor(rows, F, 'nope'), 'none');
  const edited = rows.map((b) => (b!.id === 'f1' ? { ...b, notes: 'Slide one, revised.' } : b));
  assert.equal(narrationStatusFor(edited, F, 'f1'), 'stale');
});

test('isEnglishLang: the shipped voices only read English', () => {
  for (const ok of ['', 'en', 'en-GB', 'en_US', undefined]) assert.equal(isEnglishLang(ok), true, String(ok));
  for (const no of ['de', 'fr-CA', 'ja']) assert.equal(isEnglishLang(no), false, no);
});

/* ── the job ────────────────────────────────────────────────────────────────── */

interface JobCalls {
  spoken: Array<{ text: string; opts: SpeechSynthesizeOpts }>;
  uploads: Array<{ id: string; meta?: Record<string, unknown> }>;
  metaWrites: Array<{ id: string; meta: Record<string, unknown> }>;
  repacks: number;
}

/** A host whose voice takes exactly one second per word, so the timings are readable. */
function jobHost(): { host: NarrationHost; calls: JobCalls } {
  const calls: JobCalls = { spoken: [], uploads: [], metaWrites: [], repacks: 0 };
  const records = new Map<string, { id: string; source: string; type: string; meta: Record<string, unknown> }>();
  const host = {
    version: '1',
    log: () => {},
    speech: {
      isAvailable: () => true,
      cached: async () => true,
      modelBytes: () => 1,
      voices: async () => [],
      async synthesize(text: string, opts: SpeechSynthesizeOpts = {}) {
        calls.spoken.push({ text, opts });
        const tokens = text.split(/\s+/).filter(Boolean);
        return {
          pcm: new Float32Array(tokens.length * 100),
          sampleRate: 100,
          duration: tokens.length,
          words: tokens.map((w, i) => ({ text: w, start: i, end: i + 1 })),
          granularity: 'word' as const,
        };
      },
    },
    assets: {
      async get(id: string) { return records.get(id) ?? null; },
      async _uploadUserAsset(rec: { id: string; meta?: Record<string, unknown> }) {
        calls.uploads.push(rec);
        records.set(rec.id, { id: rec.id, source: 'user', type: 'audio', meta: { ...(rec.meta ?? {}) } });
      },
      async _updateUserAssetMeta(id: string, meta: Record<string, unknown>) {
        calls.metaWrites.push({ id, meta });
        const rec = records.get(id);
        if (rec) rec.meta = meta;
      },
    },
  } as unknown as NarrationHost;
  return { host, calls };
}

/** Run one narration to completion and hand back what the document became. */
async function runNarrate(
  host: NarrationHost, calls: JobCalls, rows: Box[], over: Record<string, unknown> = {},
): Promise<Box[]> {
  let model = rows;
  await new Promise<void>((resolve) => {
    narrateDeckAsJob(host, {
      fields: F,
      getBoxes: () => model,
      commit: (next: Box[]) => { model = next; },
      repack: () => { calls.repacks++; },
      ...over,
    } as never, { onSettled: resolve });
  });
  return model;
}

test('the job speaks each slide with notes, places the clip, and captions it', async () => {
  const { host, calls } = jobHost();
  const model = await runNarrate(host, calls, deck());
  assert.equal(calls.spoken.length, 1, 'only the slide with notes is spoken');
  assert.equal(calls.spoken[0]!.text, 'Slide one.');
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.uploads[0]!.meta?.tts != null, true, 'the clip carries its own recipe and word timings');
  assert.equal(calls.metaWrites[0]!.meta.narration != null, true, 'and the note that says which slide it belongs to');
  assert.equal(calls.repacks, 1, 'the deck is re-packed once the slide has a floor (T7)');

  const clip = model.find((b) => b!.group === 'narration:f1')!;
  assert.equal(clip.kind, 'audio');
  assert.equal(clip.start, 0.4, 'slide start (0) plus the 400 ms lead-in');
  assert.equal(clip.dur, 2, 'two words, one second each');
  const captions = model.filter((b) => String(b!.group ?? '').startsWith('captions:'));
  assert.equal(captions.length, 1, 'the cue comes from the words we spoke, not a second pass');
  assert.equal(captions[0]!.text, 'Slide one.');
  assert.equal(captions[0]!.group, captionGroup(String(clip.id)));
});

test('a second run over unchanged notes speaks nothing', async () => {
  const { host, calls } = jobHost();
  const first = await runNarrate(host, calls, deck());
  // What the runtime does on the next mount: re-resolve the clip's asset ref, so the
  // box carries the record the store now holds - narration note and all.
  const stored = await host.assets.get(String(calls.uploads[0]!.id));
  const rehydrated = first.map((b) => (b!.group === 'narration:f1' ? { ...b, image: stored as never } : b));
  const before = calls.spoken.length;
  await runNarrate(host, calls, rehydrated);
  assert.equal(calls.spoken.length, before, 'nothing was re-spoken');
  // Editing the notes makes exactly that slide stale, and it is spoken again.
  const edited = rehydrated.map((b) => (b!.id === 'f1' ? { ...b, notes: 'Slide one, revised.' } : b));
  await runNarrate(host, calls, edited);
  assert.equal(calls.spoken.length, before + 1);
  assert.equal(calls.spoken[before]!.text, 'Slide one, revised.');
});

test('the job carries the document voice and speed through to the model', async () => {
  const { host, calls } = jobHost();
  await runNarrate(host, calls, deck(), { voice: 'af_heart+bf_lily:0.3', speed: 1.15 });
  assert.equal(calls.spoken[0]!.opts.voice, 'af_heart+bf_lily:0.3');
  assert.equal(calls.spoken[0]!.opts.speed, 1.15);
  // An empty voice means "the shell's default", so nothing is sent.
  const second = jobHost();
  await runNarrate(second.host, second.calls, deck(), { voice: '' });
  assert.equal(second.calls.spoken[0]!.opts.voice, undefined);
});

test('the job gives each build step the moment its marker is spoken', async () => {
  const { host, calls } = jobHost();
  const rows: Box[] = [
    { id: 'f1', kind: 'frame', order: 0, x: 0, y: 0, w: 1920, h: 1080, start: 0, dur: 3, notes: 'Open.\n> Cost.\n> Time.' },
    { id: 'a', kind: 'text', frame: 'f1', build: 1 },
    { id: 'b', kind: 'text', frame: 'f1', build: 2 },
  ];
  const model = await runNarrate(host, calls, rows);
  // The voice runs one second per word: Open. Cost. Time. → steps at 1 s and 2 s,
  // both offset by the slide start (0) plus the 400 ms lead-in.
  assert.equal(model.find((b) => b!.id === 'a')!.start, 1.4);
  assert.equal(model.find((b) => b!.id === 'b')!.start, 2.4);
});

test('builds with no markers appear with the slide, and say so once', async () => {
  const { host, calls } = jobHost();
  const warnings: string[] = [];
  const rows: Box[] = [
    { id: 'f1', kind: 'frame', order: 0, start: 0, dur: 3, notes: 'No markers here.' },
    { id: 'a', kind: 'text', frame: 'f1', build: 1 },
  ];
  (host as unknown as { log: (level: string, msg: string) => void }).log = (_l, msg) => { warnings.push(msg); };
  const model = await runNarrate(host, calls, rows);
  assert.equal(model.find((b) => b!.id === 'a')!.start, undefined, 'the build appears with its slide');
  assert.equal(warnings.filter((w) => w.includes('build steps')).length, 1, 'said once for the run, not once per box');
});

test('a deck with nothing to narrate finishes without speaking', async () => {
  const { host, calls } = jobHost();
  const rows: Box[] = [{ id: 'f1', kind: 'frame', order: 0 }];
  const model = await runNarrate(host, calls, rows);
  assert.equal(calls.spoken.length, 0);
  assert.deepEqual(model, rows, 'and writes nothing');
});

/* ── re-anchoring after a re-pack (T7) ──────────────────────────────────────── */

/** Three narrated slides, laid out end to end, each with its voice on its own slide. */
const narratedTrio = (): Box[] => [
  { id: 'a', kind: 'frame', order: 0, x: 0, y: 0, w: 1920, h: 1080, start: 0, dur: 8, enter: 'fade', exit: 'fade', notes: 'One two three four five six seven eight nine' },
  { id: 'b', kind: 'frame', order: 1, x: 2000, y: 0, w: 1920, h: 1080, start: 8, dur: 8, enter: 'fade', exit: 'fade', notes: 'Slide two.' },
  { id: 'c', kind: 'frame', order: 2, x: 4000, y: 0, w: 1920, h: 1080, start: 16, dur: 8, enter: 'fade', exit: 'fade', notes: 'Slide three.' },
  { id: 'nb', kind: 'audio', frame: 'b', group: 'narration:b', lane: 'seq', start: 8.4, dur: 5 },
  { id: 'nc', kind: 'audio', frame: 'c', group: 'narration:c', lane: 'seq', start: 16.4, dur: 5 },
  { id: 'capb', kind: 'text', frame: 'b', group: captionGroup('nb'), start: 8.4, dur: 2, text: 'Slide two.' },
  { id: 'stepc', kind: 'text', frame: 'c', build: 1, start: 17.4 },
];

test('reanchorNarration puts every clip back on its slide after a re-pack', () => {
  // Slide a is now 12 s long, so b starts at 12 and c at 20 - but every clip, caption
  // and build fragment still holds the absolute time it had before the re-pack.
  const packed = narratedTrio().map((b) => {
    if (b!.id === 'a') return { ...b, dur: 12 };
    if (b!.id === 'b') return { ...b, start: 12 };
    if (b!.id === 'c') return { ...b, start: 20 };
    return b;
  });
  const fixed = reanchorNarration(packed, F);
  const at = (id: string): unknown => fixed.find((b) => b!.id === id)!.start;
  assert.equal(at('nb'), 12.4, "slide b's voice follows slide b (start + 400 ms lead-in)");
  assert.equal(at('nc'), 20.4);
  assert.equal(at('capb'), 12.4, 'its captions go with it, or the slide clamp is applied to the wrong window');
  assert.equal(at('stepc'), 21.4, 'and the build fragment keeps its offset into the slide');
  // Idempotent: nothing moves twice, and every row keeps its identity.
  const again = reanchorNarration(fixed, F);
  for (let i = 0; i < fixed.length; i++) assert.equal(again[i], fixed[i], `row ${i} untouched`);
});

test('reanchorNarration leaves a build fragment with no start alone', () => {
  const rows: Box[] = [
    ...narratedTrio().map((b) => (b!.id === 'b' ? { ...b, start: 12 } : b)),
    { id: 'stepb', kind: 'text', frame: 'b', build: 1 },
  ];
  const fixed = reanchorNarration(rows, F);
  assert.equal(fixed.find((b) => b!.id === 'stepb')!.start, undefined,
    'a fragment with no authored moment has no moment to move');
});

test('re-narrating ONE slide does not strand the later slides (T7)', async () => {
  const { host, calls } = jobHost();
  let model = narratedTrio();
  const repack = (floors: Record<string, number>): void => {
    calls.repacks++;
    model = sequenceFramesInOrder(model, {
      defaultDurMs: 3000, lane: 'seq', minDurMs: floors, idField: 'id',
      defaultEnter: 'fade', defaultExit: 'fade',
      startField: 'start', durField: 'dur', laneField: 'lane',
      enterField: 'enter', exitField: 'exit', orderField: 'order',
      kindField: 'kind', frameKind: 'frame',
    });
  };
  await new Promise<void>((resolve) => {
    narrateDeckAsJob(host, {
      fields: F,
      getBoxes: () => model,
      commit: (next: Box[]) => { model = next; },
      repack,
      // The inspector's "Narrate this slide again" - one frame, always re-spoken.
      frameIds: ['a'], force: true,
    } as never, { onSettled: resolve });
  });
  const row = (id: string): Box => model.find((b) => b!.id === id)!;
  // Nine words, one second each: 400 lead-in + 9000 + 600 tail + 400 exit = 10.4 s.
  assert.equal(row('a').dur, 10.4);
  assert.equal(row('b').start, 10.4);
  assert.equal(row('c').start, 18.4);
  assert.equal(row('nb').start, 10.8, "slide b's voice starts when slide b does, not 4.4 s early");
  assert.equal(row('nc').start, 18.8);
  assert.equal(row('capb').start, 10.8, 'and its captions sit inside the window they are clamped to');
  assert.equal(row('stepc').start, 19.8);
});

test('a deck nobody sequenced still gets its clip on the right slide', async () => {
  const { host, calls } = jobHost();
  // Every frame reads start 0 until the solver runs, so the pre-pack read put slide
  // two's voice at 0.4 s - under slide one.
  let model: Box[] = [
    { id: 'a', kind: 'frame', order: 0, x: 0, y: 0, w: 1920, h: 1080, notes: 'One.' },
    { id: 'b', kind: 'frame', order: 1, x: 2000, y: 0, w: 1920, h: 1080, notes: 'Two.' },
  ];
  const repack = (floors: Record<string, number>): void => {
    calls.repacks++;
    model = sequenceFramesInOrder(model, {
      defaultDurMs: 3000, lane: 'seq', minDurMs: floors, idField: 'id',
      defaultEnter: 'fade', defaultExit: 'fade',
      startField: 'start', durField: 'dur', laneField: 'lane',
      enterField: 'enter', exitField: 'exit', orderField: 'order',
      kindField: 'kind', frameKind: 'frame',
    });
  };
  await new Promise<void>((resolve) => {
    narrateDeckAsJob(host, {
      fields: F, getBoxes: () => model, commit: (next: Box[]) => { model = next; }, repack,
    } as never, { onSettled: resolve });
  });
  const slideB = model.find((b) => b!.id === 'b')!;
  const clipB = model.find((b) => b!.group === 'narration:b')!;
  assert.equal(Number(clipB.start), Number(slideB.start) + 0.4,
    "slide two's voice waits for slide two");
});

/* ── ducking is scoped to the voice's own window (T6) ───────────────────────── */

test('duckBedForNarration only ducks what plays UNDER the narration', () => {
  const rows: Box[] = [
    { id: 'bed', kind: 'audio', frame: '', start: 0 },                      // open-ended: always under
    { id: 'near', kind: 'audio', frame: 'a', lane: 'seq', start: 5, dur: 4 },
    { id: 'far', kind: 'audio', frame: 'i', lane: 'seq', start: 60, dur: 2 },
    { id: 'voice', kind: 'audio', group: 'narration:a', lane: 'seq', start: 6, dur: 9 },
  ];
  const out = duckBedForNarration(rows, F, NARRATION_BED_DUCK, { startMs: 6000, endMs: 15000 });
  const duck = (id: string): unknown => out.find((b) => b!.id === id)!.duck;
  assert.equal(duck('bed'), NARRATION_BED_DUCK, 'a bed with no end is under every voice');
  assert.equal(duck('near'), NARRATION_BED_DUCK);
  assert.equal(duck('far'), undefined, 'a sound effect five slides away never overlaps the voice');
  assert.equal(duck('voice'), undefined, 'and the narration never ducks against itself');
  // With no window it still ducks the whole document, which is the old behaviour.
  assert.equal(duckBedForNarration(rows, F).find((b) => b!.id === 'far')!.duck, NARRATION_BED_DUCK);
});

/* ── the caption slices a SCORM package is cut from (T4) ────────────────────── */

test('narrationSlices reads each clip own word timings, clamped to its slide', () => {
  const words = [{ text: 'One', start: 0, end: 0.5 }, { text: 'two', start: 0.6, end: 1 }];
  const rows: Box[] = [
    { id: 'a', kind: 'frame', order: 0, start: 0, dur: 6 },
    { id: 'b', kind: 'frame', order: 1, start: 6, dur: 6 },
    {
      id: 'na', kind: 'audio', frame: 'a', group: 'narration:a', lane: 'seq', start: 0.4, dur: 1,
      image: { id: 'user/tts/1', type: 'audio', url: 'blob:x', meta: { tts: { words } } },
    },
    // Slide b's clip carries no timings at all, so it is absent rather than guessed at.
    { id: 'nb', kind: 'audio', frame: 'b', group: 'narration:b', lane: 'seq', start: 6.4, dur: 1 },
  ];
  const slices = narrationSlices(rows, F);
  assert.equal(slices.length, 1);
  assert.deepEqual(slices[0], { frameId: 'a', words, startMs: 0, endMs: 6000, offsetMs: 400 });
  // And the same read off a runtime model, wherever the blocks input is called.
  assert.deepEqual(narrationSlicesFromModel([{ id: 'background', value: '#fff' }, { id: 'bx', value: rows }]), slices);
  assert.deepEqual(narrationSlicesFromModel([{ id: 'bx', value: [] }]), []);
});

test('a clip narrated with the document voice left at "" records the voice that actually spoke it', async () => {
  // The document's narration voice defaults to "" (use the shell's default). The clip
  // the worker speaks with bf_lily must SAY bf_lily in its recipe, or Regenerate reads
  // the empty voice as "not generated by Lolly" and refuses the clip with "this clip
  // has no recipe" (Andy, 2026-09-03).
  const { host, calls } = jobHost();
  await runNarrate(host, calls, deck());
  const tts = calls.uploads[0]!.meta?.tts as { voice?: string } | undefined;
  assert.equal(tts?.voice, 'bf_lily', 'the effective voice, never ""');
  assert.ok(ttsRecipeFromMeta(calls.uploads[0]!.meta), 'so the clip has a recipe to be spoken again from');
});
