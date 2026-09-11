// SPDX-License-Identifier: MPL-2.0
/**
 * Regenerate, from the timeline panel that opens the transcript (plans/181
 * sections 5.2 and 5.4).
 *
 * This file exists because of what a browser pass found: the panel's Regenerate
 * button was permanently disabled, and every piece behind it worked. The panel
 * gates on the injected `regenerate` half, and the one call site that mounts it
 * never passed one - so the splice, the per-line synthesis and the in-place
 * rewrite were all unreachable from the app. A unit test of any one of them
 * would have stayed green through all of it. Only the join can be pinned, so it
 * is pinned here, through the real panel and the real transcript surface:
 *
 *  - opening the transcript on a clip Lolly spoke OFFERS Regenerate;
 *  - pressing it rewrites the clip at its own asset id and writes the timeline
 *    geometry ONCE, so ⌘Z takes the whole step back;
 *  - a shell that cannot rewrite bytes in place does not offer it at all.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/timeline-regenerate.test.ts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './timeline-math.ts';
import type { SpeechSynthesizeOpts, SpeechWordTiming } from '@lolly-tools/core/host-v1';

// timeline-panel.ts imports its own stylesheet; node has no idea what a .css
// module is, so stub it in-thread for the duration of this file.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.tools/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLVideoElement', 'Element', 'Node', 'Text', 'Range', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
  matches: !q.includes('max-width: 640px'), media: q, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
});
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLElement) { this.removeAttribute('open'); };

const { initTimelinePanel } = await import('./timeline-panel.ts');
const { __resetJobsForTest } = await import('../lib/jobs.ts');
const { concatClips, SENTENCE_GAP_S } = await import('../lib/speech-kokoro.ts');
const { pcmToWavBlob } = await import('../lib/pcm-wav.ts');
const { TTS_MODEL } = await import('../lib/tts-provenance.ts');

const RATE = 100;
const ASSET = 'user/tts/1-hello-there';
const SCRIPT = 'Hello there.\nThis is a test.';

const cfg = {
  idField: 'id', startField: 'start', durField: 'dur', clipInField: 'clipIn',
  speedField: 'speed', enterField: 'enter', exitField: 'exit',
  enterMsField: 'enterMs', exitMsField: 'exitMs', muteField: 'mute', laneField: 'lane',
  groupField: 'group', ignoredField: 'ignored',
};
const ADD_KINDS = [{ id: 'audio', label: 'Sound' }, { id: 'text', label: 'Text', seed: { kind: 'text' } }];

/** Samples that survive the 16-bit round trip exactly. */
function tone(seed: number, n: number): Float32Array {
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = ((seed * 1000 + i) % 4000) / 32768;
  return pcm;
}
const sentence = (seed: number, n: number, texts: string[]): { pcm: Float32Array; words: SpeechWordTiming[] } => {
  const each = n / RATE / texts.length;
  return { pcm: tone(seed, n), words: texts.map((text, i) => ({ text, start: i * each, end: (i + 1) * each })) };
};

/** The spoken clip on the timeline: two sentences with a real gap between them. */
const clip = concatClips([
  sentence(1, 60, ['Hello', 'there.']),
  sentence(2, 80, ['This', 'is', 'a', 'test.']),
], SENTENCE_GAP_S, RATE);

const ttsMeta = (): Record<string, unknown> => ({
  name: 'Hello there…',
  durationMs: Math.round((clip.pcm.length / RATE) * 1000),
  tts: {
    voice: 'bf_lily', speed: 1, model: TTS_MODEL, text: 'Hello there. This is a test.',
    script: SCRIPT, words: clip.words, segments: clip.segments, granularity: 'word',
  },
});

const audioClip = (): Box => ({
  id: 'a1', start: 0, dur: 1.75, lane: 'seq', clipIn: 0,
  image: { id: ASSET, source: 'user', url: 'blob:clip', type: 'audio', meta: ttsMeta() },
} as unknown as Box);

interface Calls {
  spoke: string[][];
  writes: Array<{ id: string; patch: { blob: Blob; meta?: Record<string, unknown> } }>;
}

function makeHost(over: { noReplace?: boolean } = {}): { host: unknown; calls: Calls } {
  const calls: Calls = { spoke: [], writes: [] };
  const record = {
    id: ASSET, source: 'user', type: 'audio', format: 'wav', url: 'blob:clip', meta: ttsMeta(),
  };
  const blob = pcmToWavBlob({ left: clip.pcm, right: clip.pcm, sampleRate: RATE });
  const assets: Record<string, unknown> = {
    async get(id: string) { return id === ASSET ? record : null; },
    async _getBlob(id: string) { return id === ASSET ? blob : null; },
    async _uploadUserAsset() {},
  };
  if (!over.noReplace) {
    assets._replaceUserAssetBytes = async (id: string, patch: { blob: Blob; meta?: Record<string, unknown> }) => {
      calls.writes.push({ id, patch });
    };
  }
  return {
    calls,
    host: {
      version: '1',
      profile: { get: async () => ({}) },
      log() {},
      assets,
      speech: {
        isAvailable: () => true,
        async synthesize() { throw new Error('the whole script should not be needed here'); },
        async synthesizeLines(lines: string[], _opts: SpeechSynthesizeOpts = {}) {
          calls.spoke.push(lines);
          return lines.map((text) => {
            const s = sentence(7, 70, text.split(/\s+/));
            return { pcm: s.pcm, words: s.words, granularity: 'word' as const, gapBefore: SENTENCE_GAP_S };
          });
        },
      },
    },
  };
}

interface Harness {
  boxes: Box[];
  commits: number;
  root: HTMLElement;
  teardown(): void;
}

function mount(host: unknown): Harness {
  const doc = dom.window.document;
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  doc.body.appendChild(stageEl);
  stageEl.getBoundingClientRect = (() => ({ left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })) as never;

  let boxes: Box[] = [audioClip()];
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
  panel.setOpen(true);
  // The canvas the panel reads media facts off: one audio box.
  canvasEl.setAttribute('data-seq-ms', '10000');
  const el = doc.createElement('div');
  el.className = 'lolly-box';
  el.setAttribute('data-box-id', 'a1');
  el.innerHTML = '<div class="lolly-box-audio" data-audio-src="blob:clip" data-audio-dur="1750"></div>';
  canvasEl.appendChild(el);
  selected = ['a1'];
  for (const f of selListeners) f();

  return {
    get boxes() { return boxes; },
    get commits() { return commits; },
    root,
    teardown() {
      try { panel.destroy(); } catch { /* already gone */ }
      doc.querySelector('.tr-panel')?.remove();
      stageEl.remove();
      for (const d of [...doc.querySelectorAll('dialog')]) d.remove();
    },
  } as Harness;
}

async function settle(n = 10): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((r) => { dom.window.requestAnimationFrame(() => r()); });
}

const trPanel = (): HTMLElement | null => dom.window.document.querySelector('.tr-panel');
const act = (label: string): HTMLButtonElement | undefined =>
  [...(trPanel()?.querySelectorAll<HTMLButtonElement>('.tr-act') ?? [])]
    .find((b) => (b.textContent ?? '').startsWith(label));

/** Open the transcript on the selected clip, the way the toolbar button does. */
async function openTranscript(h: Harness): Promise<void> {
  const btn = h.root.querySelector('.tl-transcript') as HTMLButtonElement;
  assert.ok(btn, 'the toolbar offers Edit transcript');
  btn.click();
  await settle();
}

beforeEach(() => { __resetJobsForTest(); });

test('a clip Lolly spoke opens the transcript with Regenerate wired to the voice', async () => {
  const { host, calls } = makeHost();
  const h = mount(host);
  try {
    await openTranscript(h);
    assert.ok(trPanel(), 'the transcript panel opened on the stored word timings');
    act('Edit script')!.click();
    const regen = act('Regenerate')!;
    assert.equal(regen.disabled, true, 'nothing typed yet');

    // Type an exclamation into the first sentence, exactly as a keystroke would.
    const sentences = [...trPanel()!.querySelectorAll<HTMLElement>('.tr-sentence')];
    assert.equal(sentences.length, 2, 'one editable run per script line');
    sentences[0]!.textContent = 'Hello there!';
    trPanel()!.querySelector('.tr-flow')!.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    assert.equal(regen.disabled, false, 'the button is live - the join exists');
    assert.match(regen.textContent ?? '', /1 sentence · 2 words/, 'and it counts in singular');

    const commitsBefore = h.commits;
    regen.click();
    await settle(20);

    assert.deepEqual(calls.spoke, [['Hello there!']], 'only the sentence that changed was spoken');
    assert.equal(calls.writes.length, 1, 'the clip was rewritten once');
    assert.equal(calls.writes[0]!.id, ASSET, 'under its own asset id');
    const tts = (calls.writes[0]!.patch.meta as { tts: Record<string, unknown> }).tts;
    assert.equal(tts.script, 'Hello there!\nThis is a test.');
    assert.equal(h.commits, commitsBefore + 1, 'one geometry write, so one undo step');
  } finally { h.teardown(); }
});

test('a shell with no in-place bytes swap edits the script but never offers Regenerate', async () => {
  const { host } = makeHost({ noReplace: true });
  const h = mount(host);
  try {
    await openTranscript(h);
    act('Edit script')!.click();
    const sentences = [...trPanel()!.querySelectorAll<HTMLElement>('.tr-sentence')];
    sentences[0]!.textContent = 'Hello there!';
    trPanel()!.querySelector('.tr-flow')!.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(act('Regenerate')!.disabled, true, 'a dead button is worse than an honest one');
  } finally { h.teardown(); }
});
