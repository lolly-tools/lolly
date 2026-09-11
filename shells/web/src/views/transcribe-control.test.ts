// SPDX-License-Identifier: MPL-2.0
/**
 * The `render.transcribe` control (plans/147 T1a) - one manifest declaration,
 * the whole speech-to-text affordance.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/transcribe-control.test.ts
 *
 * The real control, the real consent sheet, the real job registry and the real
 * lib/stt-job.ts, driven through real DOM events; only the speech bridge and the
 * asset store are fakes, and both are settled by hand. What is pinned:
 *  - the button is DEAD while the source input is empty, and says why;
 *  - a click asks for consent first, and Go enqueues a background job rather
 *    than holding the user in a modal;
 *  - the finished words reach the target input as ONE write, so one undo, in the
 *    format the manifest asked for;
 *  - segment-granular output is not regrouped on the way in;
 *  - `auto` runs on a NEW source value and only while its boolean input is on -
 *    a repaint with the same clip never re-runs the model;
 *  - a clip with no speech clears the target and says so, and a transcript an
 *    earlier run paid for never reaches the model at all.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { SpeechTranscript, SpeechWordTiming } from '@lolly-tools/core/host-v1';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
// jsdom 25 ships no showModal/close on <dialog> - the minimum mountModal needs.
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLElement) { this.removeAttribute('open'); };

const { setupTranscribeControl } = await import('./transcribe-control.ts');
type TranscribeSpec = import('./transcribe-control.ts').TranscribeSpec;
const { __resetJobsForTest } = await import('../lib/jobs.ts');
const { __resetTranscriptStashForTest } = await import('../lib/stt-job.ts');

const WORDS: SpeechWordTiming[] = [
  { text: 'Hello', start: 0, end: 0.4 },
  { text: 'there.', start: 0.45, end: 0.9 },
];
const transcript = (words = WORDS, granularity: 'word' | 'segment' = 'word'): SpeechTranscript =>
  ({ text: words.map(w => w.text).join(' '), words, lang: 'en', granularity });

const CLIP = { source: 'user', id: 'user/recording/1', type: 'audio', format: 'wav', url: 'blob:take' };

/** The speech bridge, settled by hand - the shape bridge/speech.ts really has. */
function fakeSpeech(cached = true): {
  api: Record<string, unknown>;
  calls: unknown[];
  resolve: (t: SpeechTranscript) => void;
} {
  const calls: unknown[] = [];
  let settle: ((t: SpeechTranscript) => void) | null = null;
  return {
    calls,
    resolve: (t) => settle?.(t),
    api: {
      transcribeAvailable: () => true,
      transcribeCached: async () => cached,
      transcribeModelBytes: () => 77_000_000,
      transcribe(src: unknown) {
        calls.push(src);
        return new Promise<SpeechTranscript>((resolve) => { settle = resolve; });
      },
    },
  };
}

interface Rig {
  btn: HTMLButtonElement;
  values: Record<string, unknown>;
  writes: Array<{ id: string; value: unknown }>;
  set(id: string, value: unknown): void;
  dirty: number;
}

/** A model + a button, wired to the real control. `values` is the input model. */
function mount(spec: TranscribeSpec, values: Record<string, unknown>, speech: { api: Record<string, unknown> }, assetMeta?: Record<string, unknown>): Rig {
  const btn = dom.window.document.createElement('button');
  dom.window.document.body.appendChild(btn);
  const writes: Array<{ id: string; value: unknown }> = [];
  const subs = new Set<() => void>();
  const rig: Rig = {
    btn, values, writes, dirty: 0,
    set(id, value) { values[id] = value; for (const f of subs) f(); },
  };
  setupTranscribeControl({
    btn,
    spec,
    markSessionDirty: () => { rig.dirty++; },
    runtime: {
      getModel: () => Object.entries(values).map(([id, value]) => ({ id, value })),
      setInput: (id: string, value: never) => { writes.push({ id, value }); values[id] = value; return Promise.resolve(); },
      subscribe: (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); },
    },
    host: {
      log() {},
      speech: speech.api as never,
      assets: {
        async get(id: string) { return id === CLIP.id ? { ...CLIP, ...(assetMeta ? { meta: assetMeta } : {}) } as never : null; },
        async _updateUserAssetMeta() { /* no record store in this rig */ },
      },
    },
  });
  return rig;
}

const click = (el: Element): void => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); };
const sheet = (): HTMLElement | null => dom.window.document.querySelector('dialog.tl-junction-modal');
const sheetBtn = (act: string): HTMLElement => {
  const el = sheet()?.querySelector<HTMLElement>(`[data-act="${act}"]`);
  assert.ok(el, `the consent sheet has a ${act} button`);
  return el;
};
const announced = (): string =>
  Array.from(dom.window.document.querySelectorAll('[data-a11y-live]')).map(el => el.textContent ?? '').filter(Boolean).join(' | ');

async function settle(n = 8): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise<void>(r => setTimeout(r, 0));
  await new Promise<void>(r => { dom.window.requestAnimationFrame(() => r()); });
}

beforeEach(() => {
  __resetJobsForTest();
  __resetTranscriptStashForTest();
  // Clear the rigs, not the whole body: a11y.ts keeps a handle on its live
  // region, so wiping the body would leave every later announce() writing into
  // a detached node.
  for (const el of dom.window.document.querySelectorAll('dialog, button')) el.remove();
});

const SPEC: TranscribeSpec = { source: 'clip', target: 'captions', format: 'srt' };

test('no clip: the button is disabled and says why', () => {
  const rig = mount(SPEC, { clip: null, captions: '' }, fakeSpeech());
  assert.equal(rig.btn.disabled, true);
  assert.match(rig.btn.title, /Add a clip/i);
});

test('a clip enables the button on the next model change', () => {
  const rig = mount(SPEC, { clip: null, captions: '' }, fakeSpeech());
  rig.set('clip', CLIP);
  assert.equal(rig.btn.disabled, false);
  assert.doesNotMatch(rig.btn.title, /Add a clip/i);
});

test('click asks for consent, Go enqueues, and the cues arrive as ONE write', async () => {
  const sp = fakeSpeech();
  const rig = mount(SPEC, { clip: CLIP, captions: '' }, sp);
  click(rig.btn);
  await settle();
  assert.ok(sheet(), 'the consent sheet opened before any model bytes moved');
  assert.equal(sp.calls.length, 0, 'nothing was transcribed on the way to the sheet');

  click(sheetBtn('go'));
  await settle();
  assert.equal(sheet(), null, 'Go closes the sheet instead of holding the user in it');
  assert.equal(sp.calls.length, 1, 'the job started the transcription');

  sp.resolve(transcript());
  await settle();
  assert.deepEqual(rig.writes, [{
    id: 'captions',
    value: '1\n00:00:00,000 --> 00:00:00,900\nHello there.\n',
  }], 'one write into the declared target, in the declared format');
  assert.equal(rig.dirty, 1);
});

test('the manifest picks the format: vtt', async () => {
  const sp = fakeSpeech();
  const rig = mount({ ...SPEC, format: 'vtt' }, { clip: CLIP, captions: '' }, sp);
  click(rig.btn);
  await settle();
  click(sheetBtn('go'));
  await settle();
  sp.resolve(transcript());
  await settle();
  assert.equal(rig.writes.length, 1);
  assert.match(String(rig.writes[0]!.value), /^WEBVTT\n\n00:00:00\.000 --> 00:00:00\.900\nHello there\.\n$/);
});

test('segment-granular output is written one cue per segment', async () => {
  const sp = fakeSpeech();
  const rig = mount(SPEC, { clip: CLIP, captions: '' }, sp);
  click(rig.btn);
  await settle();
  click(sheetBtn('go'));
  await settle();
  sp.resolve(transcript([
    { text: 'Come in.', start: 0, end: 1.1 },
    { text: 'Sit down.', start: 1.2, end: 2 },
  ], 'segment'));
  await settle();
  assert.equal(String(rig.writes[0]!.value).split('\n\n').length, 2, 'two cue blocks, not one merged line');
});

test('no speech: the target is cleared and the user is told, never invented text', async () => {
  const sp = fakeSpeech();
  const rig = mount(SPEC, { clip: CLIP, captions: 'stale cues' }, sp);
  click(rig.btn);
  await settle();
  click(sheetBtn('go'));
  await settle();
  sp.resolve(transcript([]));
  await settle();
  assert.deepEqual(rig.writes, [{ id: 'captions', value: '' }]);
  assert.match(announced(), /No speech/i);
});

test('dismissing the sheet transcribes nothing and re-arms the button', async () => {
  const sp = fakeSpeech();
  const rig = mount(SPEC, { clip: CLIP, captions: '' }, sp);
  click(rig.btn);
  await settle();
  click(sheetBtn('cancel'));
  await settle();
  assert.equal(sp.calls.length, 0);
  assert.equal(rig.btn.disabled, false, 'the guard was released, so a second try is possible');
  assert.deepEqual(rig.writes, []);
});

test('a transcript already on the clip skips the model and the sheet', async () => {
  const sp = fakeSpeech();
  const withNote = { ...CLIP, meta: { transcript: { words: WORDS, at: 1, engine: 'whisper' } } };
  const rig = mount(SPEC, { clip: withNote, captions: '' }, sp);
  click(rig.btn);
  await settle();
  assert.equal(sheet(), null, 'nothing to consent to - the words were already paid for');
  assert.equal(sp.calls.length, 0);
  assert.equal(rig.writes.length, 1);
  assert.match(String(rig.writes[0]!.value), /Hello there\./);
});

test('auto: a NEW clip transcribes with no click, while its toggle is on', async () => {
  const sp = fakeSpeech();
  const rig = mount({ ...SPEC, auto: 'autoCaption' }, { clip: null, captions: '', autoCaption: true }, sp);
  rig.set('clip', CLIP);
  await settle();
  click(sheetBtn('go'));            // consent still gates the model, exactly once
  await settle();
  sp.resolve(transcript());
  await settle();
  assert.equal(rig.writes.length, 1);

  // A repaint carrying the SAME clip is not a new take.
  rig.set('other', 1);
  await settle();
  assert.equal(sp.calls.length, 1, 'the model was not asked again for the same clip');
});

test('auto: off means off - the same new clip does nothing until clicked', async () => {
  const sp = fakeSpeech();
  const rig = mount({ ...SPEC, auto: 'autoCaption' }, { clip: null, captions: '', autoCaption: false }, sp);
  rig.set('clip', CLIP);
  await settle();
  assert.equal(sheet(), null);
  assert.equal(sp.calls.length, 0);
  assert.equal(rig.writes.length, 0);
});

test('no auto declared: a new clip never self-starts', async () => {
  const sp = fakeSpeech();
  const rig = mount(SPEC, { clip: null, captions: '' }, sp);
  rig.set('clip', CLIP);
  await settle();
  assert.equal(sheet(), null);
  assert.equal(sp.calls.length, 0);
});

test('auto: a clip swapped WHILE a run is in flight is still transcribed after it', async () => {
  const sp = fakeSpeech();
  const rig = mount({ ...SPEC, auto: 'autoCaption' }, { clip: null, captions: '', autoCaption: true }, sp);
  rig.set('clip', CLIP);
  await settle();
  click(sheetBtn('go'));
  await settle();
  // The first job is running in the background (its toast owns it), so the user
  // can pick another clip. The change must survive the in-flight guard rather
  // than being consumed by it.
  const SECOND = { ...CLIP, id: 'user/recording/2', url: 'blob:take-2' };
  rig.set('clip', SECOND);
  await settle();
  assert.equal(sp.calls.length, 1, 'the second clip does not jump the queue');

  sp.resolve(transcript());
  await settle();
  click(sheetBtn('go'));            // the second clip's own consent sheet
  await settle();
  assert.equal(sp.calls.length, 2, 'the second clip was never transcribed');
  sp.resolve(transcript([{ text: 'Second.', start: 0, end: 1 }]));
  await settle();
  assert.match(String(rig.values.captions), /Second\./);
});
