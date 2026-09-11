// SPDX-License-Identifier: MPL-2.0
/**
 * The timeline's "Generate subtitles" as a background job (plans/124 section 9,
 * WP-F) - the panel half of lib/stt-job.ts.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/timeline-subtitles-job.test.ts
 *
 * What is pinned here is the behaviour a user only notices when they stop
 * watching a run that costs a ~77 MB one-time download and minutes of wasm
 * inference:
 *  - the consent sheet still consents, and Go ENQUEUES a heavy, cancellable job
 *    and CLOSES the sheet, instead of holding the user hostage to a modal;
 *  - closing the sheet no longer aborts anything. The old sheet aborted on every
 *    exit path, so a stray Escape destroyed the download and the inference
 *    behind it; now the ✕ in the global toast is the only cancel, and it is real;
 *  - the caption boxes still land on the timeline when the panel is there;
 *  - and when the panel is GONE at completion the transcript is written onto the
 *    clip's own record instead of being discarded, so the next run is instant -
 *    which the last test proves by taking that rung with no sheet and no model.
 *
 * The real panel, the real job registry and the real lib/stt-job.ts, driven
 * through real DOM events; only the speech bridge and the asset store are fakes,
 * and both are settled by hand.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './timeline-math.ts';
import type { SpeechProgress, SpeechTranscript, SpeechWordTiming } from '@lolly-tools/core/host-v1';

// timeline-panel.ts imports its own stylesheet; node has no idea what a .css
// module is, so stub it in-thread for the duration of this file.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLVideoElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
// jsdom 25 ships no showModal/close on <dialog> - the minimum mountModal needs.
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLElement) { this.removeAttribute('open'); };

const { initTimelinePanel } = await import('./timeline-panel.ts');
const { cancelJob, jobsSnapshot, __resetJobsForTest } = await import('../lib/jobs.ts');
const { __resetTranscriptStashForTest } = await import('../lib/stt-job.ts');
const { TRANSCRIPT_META_KEY } = await import('./timeline-captions.ts');

/** The phase-1 field mapping plus the two fields subtitles need: a group field to
 *  own the caption set with, and (through opts) a text field to write cues into. */
const cfg = {
  idField: 'id', startField: 'start', durField: 'dur', clipInField: 'clipIn',
  speedField: 'speed', enterField: 'enter', exitField: 'exit',
  enterMsField: 'enterMs', exitMsField: 'exitMs', muteField: 'mute', laneField: 'lane',
  groupField: 'group',
};

const ADD_KINDS = [{ id: 'audio', label: 'Sound' }, { id: 'text', label: 'Text', seed: { kind: 'text' } }];

const WORDS: SpeechWordTiming[] = [
  { text: 'hello', start: 0, end: 0.4 },
  { text: 'there', start: 0.5, end: 0.9 },
];
const transcript = (words = WORDS): SpeechTranscript => ({
  text: words.map(w => w.text).join(' '), words, lang: 'en', granularity: 'word',
});

/** An audio clip carrying its persisted asset ref, as an ingested take does. */
const audioClip = (id: string): Box => ({
  id, start: 0, dur: 4, lane: 'seq',
  image: { id: 'user/recording/1', source: 'user', url: 'blob:take', type: 'audio' },
} as unknown as Box);

interface Harness {
  boxes: Box[];
  commits: number;
  root: HTMLElement;
  canvasEl: HTMLElement;
  bar(id: string): HTMLElement;
  destroy(): void;
  teardown(): void;
}

function mount(initial: Box[], host: unknown): Harness {
  const doc = dom.window.document;
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  doc.body.appendChild(stageEl);
  stageEl.getBoundingClientRect = (() => ({ left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })) as never;

  let boxes = initial.map((b) => ({ ...b }));
  let commits = 0;
  let selected: string[] = [];
  const selListeners = new Set<() => void>();
  const subs = new Set<() => void>();

  const panel = initTimelinePanel({
    stageEl, canvasEl,
    runtime: { subscribe: (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); } },
    host,
    blockId: 'boxes',
    cfg,
    getBoxes: () => boxes,
    commit: (next: Box[]) => { commits++; boxes = next.map((b) => ({ ...b })); },
    selection: {
      get: () => selected,
      set: (ids: string[]) => { selected = ids; for (const f of selListeners) f(); },
      onChange: (cb: () => void) => { selListeners.add(cb); return () => { selListeners.delete(cb); }; },
    },
    reserve: () => {},
    addKinds: ADD_KINDS,
    assetField: 'image',
    textField: 'text',
  } as never);

  const root = stageEl.querySelector('.tl-panel') as HTMLElement;
  const tracks = root.querySelector('.tl-tracks') as HTMLElement;
  tracks.getBoundingClientRect = (() => ({ left: 0, top: 0, width: 224, height: 120, right: 224, bottom: 120, x: 0, y: 0, toJSON: () => ({}) })) as never;
  Object.defineProperty(tracks, 'clientWidth', { value: 24 + 5 * 40, configurable: true });
  panel.setOpen(true);

  const bar = (id: string): HTMLElement => {
    const el = root.querySelector(`.tl-clip[data-id="${id}"]`) as HTMLElement;
    assert.ok(el, `bar for ${id} exists`);
    return el;
  };

  return {
    get boxes() { return boxes; },
    get commits() { return commits; },
    root, canvasEl, bar,
    destroy() { try { panel.destroy(); } catch { /* already gone */ } },
    teardown() {
      try { panel.destroy(); } catch { /* already gone */ }
      stageEl.remove();
      doc.querySelectorAll('dialog').forEach(d => d.remove());
      doc.querySelectorAll('.tl-ctx-menu').forEach(m => m.remove());
    },
  } as Harness;
}

/** Paint a live canvas where `id` is an audio box (what mediaOf reads). */
function paintAudio(h: Harness, id: string): void {
  h.canvasEl.setAttribute('data-seq-ms', '10000');
  for (const b of h.boxes) {
    const el = dom.window.document.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String(b.id));
    if (String(b.id) === id) {
      el.innerHTML = '<div class="lolly-box-audio" data-audio-src="blob:take" data-audio-dur="4200"></div>';
    }
    h.canvasEl.appendChild(el);
  }
}

/** The speech bridge, settled by hand - what bridge/speech.ts really does. */
function fakeSpeech(): {
  api: unknown;
  calls: { src: unknown; opts: { signal?: AbortSignal; onProgress?: (p: SpeechProgress) => void } }[];
  resolve: (t: SpeechTranscript) => void;
} {
  const calls: { src: unknown; opts: { signal?: AbortSignal; onProgress?: (p: SpeechProgress) => void } }[] = [];
  let settle: { resolve: (t: SpeechTranscript) => void; reject: (e: unknown) => void } | null = null;
  return {
    calls,
    resolve: (t) => settle?.resolve(t),
    api: {
      transcribeAvailable: () => true,
      transcribeCached: async () => true,
      transcribeModelBytes: () => 77_000_000,
      transcribe(src: unknown, opts: { signal?: AbortSignal } = {}) {
        calls.push({ src, opts });
        return new Promise<SpeechTranscript>((resolve, reject) => {
          settle = { resolve, reject };
          opts.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('speech transcription aborted'), { name: 'AbortError' }));
          }, { once: true });
        });
      },
    },
  };
}

function makeHost(sp: { api: unknown }, meta: Record<string, unknown> = { name: 'take.wav' }): {
  host: unknown;
  gets: string[];
  writes: { id: string; meta: Record<string, unknown> }[];
} {
  const gets: string[] = [];
  const writes: { id: string; meta: Record<string, unknown> }[] = [];
  const record = { source: 'user', id: 'user/recording/1', type: 'audio', format: 'wav', url: 'blob:live-take', meta };
  return {
    gets, writes,
    host: {
      log() {},
      speech: sp.api,
      assets: {
        async get(id: string) { gets.push(id); return id === record.id ? record : null; },
        async _updateUserAssetMeta(id: string, next: Record<string, unknown>) {
          writes.push({ id, meta: next });
          record.meta = next;
        },
      },
    },
  };
}

const rightClick = (el: Element): void => {
  el.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 300 }));
};
const click = (el: Element): void => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); };
const menuItem = (label: string): Element | undefined =>
  Array.from(dom.window.document.querySelectorAll('.tl-ctx-menu .folder-menu-item'))
    .find(n => n.textContent?.trim().startsWith(label));
const sheet = (): HTMLElement | null => dom.window.document.querySelector('dialog.tl-junction-modal');
const captionBoxes = (h: Harness): Box[] => h.boxes.filter(b => String(b.group ?? '').startsWith('captions:'));
const announced = (): string =>
  Array.from(dom.window.document.querySelectorAll('[data-a11y-live]')).map(el => el.textContent ?? '').filter(Boolean).join(' | ');

/** Drain the microtask/timer queues, then one real animation frame - announce()
 *  paints its live region through rAF, which jsdom only ticks on a frame. */
async function settle(n = 8): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise<void>(r => setTimeout(r, 0));
  await new Promise<void>(r => { dom.window.requestAnimationFrame(() => r()); });
}

/** Right-click the clip and choose Generate subtitles. */
async function chooseSubtitles(h: Harness, id = 'a1'): Promise<void> {
  rightClick(h.bar(id));
  const item = menuItem('Generate subtitles');
  assert.ok(item, 'Generate subtitles is offered for an audio clip that can be transcribed');
  click(item);
  await settle();
}

beforeEach(() => {
  __resetJobsForTest();
  __resetTranscriptStashForTest();
  for (const el of Array.from(dom.window.document.querySelectorAll('[data-a11y-live]'))) el.textContent = '';
});

// ── the sheet consents, then gets out of the way ─────────────────────────────

test('the consent sheet opens, states the one-time download, and starts NO work by itself', async () => {
  const sp = fakeSpeech();
  const { host } = makeHost(sp);
  const h = mount([audioClip('a1')], host);
  try {
    paintAudio(h, 'a1');
    await chooseSubtitles(h);
    const dlg = sheet();
    assert.ok(dlg, 'the consent sheet is up');
    assert.match(dlg!.textContent ?? '', /Nothing is uploaded/);
    assert.match(dlg!.textContent ?? '', /runs in the background/);
    assert.equal(sp.calls.length, 0, 'consent first: no model, no inference, until Go');
    assert.equal(jobsSnapshot().length, 0, 'and no job either');
  } finally { h.teardown(); }
});

test('closing the sheet before Go starts nothing, and leaves the action repeatable', async () => {
  const sp = fakeSpeech();
  const { host } = makeHost(sp);
  const h = mount([audioClip('a1')], host);
  try {
    paintAudio(h, 'a1');
    await chooseSubtitles(h);
    // Escape, the path that used to kill a run in flight.
    sheet()!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
    await settle();
    assert.equal(sheet(), null, 'the sheet closed');
    assert.equal(jobsSnapshot().length, 0, 'nothing was started');

    // The per-clip guard was released, so the user can ask again.
    await chooseSubtitles(h);
    assert.ok(sheet(), 'the sheet opens a second time');
  } finally { h.teardown(); }
});

test('Go enqueues a heavy, cancellable job and CLOSES the sheet', async () => {
  const sp = fakeSpeech();
  const { host, gets } = makeHost(sp);
  const h = mount([audioClip('a1')], host);
  try {
    paintAudio(h, 'a1');
    await chooseSubtitles(h);
    click(sheet()!.querySelector('[data-act="go"]')!);
    await settle();

    assert.equal(sheet(), null, 'the sheet is gone: the toast owns the run from here');
    const jobs = jobsSnapshot();
    assert.equal(jobs.length, 1, 'exactly one job');
    assert.equal(jobs[0]!.title, 'Generating subtitles');
    assert.equal(jobs[0]!.heavy, true);
    assert.equal(jobs[0]!.cancellable, true);

    // The transcription reads the LIVE ref resolved from the box's persisted id.
    assert.deepEqual(gets, ['user/recording/1']);
    assert.equal(sp.calls.length, 1);
    assert.equal((sp.calls[0]!.src as { url: string }).url, 'blob:live-take');
    assert.equal(sp.calls[0]!.opts.signal?.aborted, false, 'closing the sheet aborted nothing');
    assert.match(announced(), /background/);
  } finally { h.teardown(); }
});

test('the sheet is closed while the run continues: progress keeps flowing to the toast', async () => {
  const sp = fakeSpeech();
  const { host } = makeHost(sp);
  const h = mount([audioClip('a1')], host);
  try {
    paintAudio(h, 'a1');
    await chooseSubtitles(h);
    click(sheet()!.querySelector('[data-act="go"]')!);
    await settle();
    sp.calls[0]!.opts.onProgress?.({ phase: 'download', loaded: 77_000_00, total: 77_000_000 });
    const job = jobsSnapshot()[0]!;
    assert.equal(job.progress!.total, 100);
    assert.equal(job.progress!.note, 'Downloading the speech model…');
    assert.equal(job.status, 'running', 'with no sheet on screen at all');
    assert.equal(sheet(), null);
  } finally { h.teardown(); }
});

// ── completion, with and without a panel to land in ──────────────────────────

test('the caption boxes land on the timeline when the panel is still there', async () => {
  const sp = fakeSpeech();
  const { host } = makeHost(sp);
  const h = mount([audioClip('a1')], host);
  try {
    paintAudio(h, 'a1');
    await chooseSubtitles(h);
    click(sheet()!.querySelector('[data-act="go"]')!);
    await settle();
    sp.resolve(transcript());
    await settle();

    const cues = captionBoxes(h);
    assert.equal(cues.length, 1, 'the two words group into one cue');
    assert.equal(cues[0]!.text, 'hello there');
    assert.equal(cues[0]!.group, 'captions:a1');
    assert.equal(cues[0]!.lane, '', 'a caption is an overlay, above the sequence');
    assert.equal(jobsSnapshot()[0]!.status, 'done');
    assert.match(announced(), /caption boxes added/);
  } finally { h.teardown(); }
});

test('a run that finishes with the panel GONE keeps the transcript instead of discarding it', async () => {
  const sp = fakeSpeech();
  const { host, writes } = makeHost(sp);
  const h = mount([audioClip('a1')], host);
  try {
    paintAudio(h, 'a1');
    await chooseSubtitles(h);
    click(sheet()!.querySelector('[data-act="go"]')!);
    await settle();

    // The user navigates away: the panel is destroyed mid-inference.
    h.destroy();
    const commitsBefore = h.commits;
    sp.resolve(transcript());
    await settle();

    assert.equal(h.commits, commitsBefore, 'a destroyed panel writes no boxes');
    assert.equal(captionBoxes(h).length, 0);
    // …but the work is kept: written onto the clip's OWN record, in the shape the
    // ladder reads back, and the completion says where it went.
    assert.equal(writes.length, 1, 'the transcript was filed');
    assert.equal(writes[0]!.id, 'user/recording/1');
    assert.equal(writes[0]!.meta.name, 'take.wav', 'merged into the meta already there');
    assert.deepEqual((writes[0]!.meta[TRANSCRIPT_META_KEY] as { words: SpeechWordTiming[] }).words, WORDS);
    assert.equal(jobsSnapshot()[0]!.status, 'done', 'the job succeeded - the captions just had nowhere to land');
    assert.match(announced(), /transcript is ready and saved with the clip/);
  } finally { h.teardown(); }
});

test('a transcript already on the clip is taken instantly: no sheet, no model, no second wait', async () => {
  const sp = fakeSpeech();
  // The record carries the note a previous background run filed.
  const { host } = makeHost(sp, {
    name: 'take.wav',
    [TRANSCRIPT_META_KEY]: { words: WORDS, at: 1, engine: 'whisper' },
  });
  const h = mount([audioClip('a1')], host);
  try {
    paintAudio(h, 'a1');
    await chooseSubtitles(h);

    assert.equal(sheet(), null, 'nothing to consent to: the words are already here');
    assert.equal(jobsSnapshot().length, 0, 'and no inference to pay for');
    assert.equal(sp.calls.length, 0);
    const cues = captionBoxes(h);
    assert.equal(cues.length, 1);
    assert.equal(cues[0]!.text, 'hello there');
  } finally { h.teardown(); }
});

// ── cancel ───────────────────────────────────────────────────────────────────

test('cancelling from the toast aborts the run and writes nothing', async () => {
  const sp = fakeSpeech();
  const { host, writes } = makeHost(sp);
  const h = mount([audioClip('a1')], host);
  try {
    paintAudio(h, 'a1');
    await chooseSubtitles(h);
    click(sheet()!.querySelector('[data-act="go"]')!);
    await settle();

    cancelJob(jobsSnapshot()[0]!.id);
    await settle();

    assert.equal(sp.calls[0]!.opts.signal?.aborted, true, 'the ✕ reaches the speech bridge');
    assert.equal(jobsSnapshot()[0]!.status, 'cancelled');
    assert.equal(captionBoxes(h).length, 0);
    assert.equal(writes.length, 0, 'a cancelled run files nothing');

    // The guard is released, so the clip can be asked again.
    await chooseSubtitles(h);
    assert.ok(sheet(), 'the sheet opens again after a cancel');
  } finally { h.teardown(); }
});
