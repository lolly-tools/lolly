// SPDX-License-Identifier: MPL-2.0
/**
 * The narrated deck, END TO END: the REAL Design hook's markup driven through the REAL
 * presenter (plans/180 M-E and T9).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-present-narration.test.ts
 *
 * WHY THIS SUITE EXISTS. Both halves of narration conduct were tested, and both passed,
 * while the feature did not work at all. present-mode.ts plays an audio marker only when
 * the document says it may - `data-narration` or `data-present-audio` - and its own test
 * stamped those by hand on a fixture. community/design/hooks.js emitted neither: the audio
 * branch wrote a bare `<div data-audio-src>`, so a browser pass found nine markers and zero
 * <audio> elements, and a narrated deck advanced on the dwell timer in silence.
 *
 * Two green suites either side of a contract nobody drove across is why that went unseen,
 * so this suite owns the JOIN: the tool renders, the presenter opens on what the tool
 * actually wrote, and the claims are about sound coming out.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// The jsdom realm goes up BEFORE present-mode is imported: it pulls in i18n, icons and
// a11y-prefs, which read browser globals at module scope (the present-mode suite's own
// setup, kept identical so the two behave the same way).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof globalThis.requestAnimationFrame;
win.matchMedia = ((q: string) => ({
  matches: false, media: q, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  dispatchEvent() { return false; },
})) as unknown as typeof win.matchMedia;
// jsdom's HTMLMediaElement.play/pause throw "Not implemented"; record the state instead, so
// a test can read which clip is on the air. `ended` is dispatched by hand for the same
// reason - nothing here decodes audio.
type Playable = HTMLMediaElement & { __playing?: boolean };
win.HTMLMediaElement.prototype.play = function (this: Playable) { this.__playing = true; return Promise.resolve(); };
win.HTMLMediaElement.prototype.pause = function (this: Playable) { this.__playing = false; };

const { openPresentMode } = await import('../shells/web/src/views/present-mode.ts');

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');
assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);

/** Render a document through the real tool and mount it the way the shell mounts it. */
async function mountDeck(state: Record<string, unknown>): Promise<HTMLElement> {
  const rt = await createRuntime(tool, baseHost(), state as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const src = document.createElement('div');
  src.id = 'tool-content';
  src.innerHTML = rt.getHydrated() as string;
  document.body.appendChild(src);
  return src;
}

function cleanup(): void {
  for (const s of document.body.querySelectorAll('.pr-stage')) s.remove();
  for (const s of document.body.querySelectorAll('#tool-content')) s.remove();
}

/** The <audio> the presenter made for the narration marker on the clone at `i`. */
function narrationPlayer(i: number): Playable | null {
  return document.body.querySelector<Playable>(
    `.pr-stage .pr-page[data-pr-index="${i}"] [data-narration-audio]`,
  );
}
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Two slides. Slide one has speaker notes, the narration clip made from them, and a music
 *  bed that is NOT the narration - the bed is the control: it must stay silent. */
const NARRATED = [
  { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, order: 0, bg: '#ffffff', dur: 0.6, notes: 'This is slide one.' },
  { id: 'f2', kind: 'frame', x: 2200, y: 0, w: 1920, h: 1080, order: 1, bg: '#ffffff', dur: 3 },
  {
    id: 'n1', kind: 'audio', frame: 'f1', group: 'narration:f1', lane: 'seq',
    start: 0.05, dur: 0.4, presentAudio: true,
    image: { id: 'user/tts/1', type: 'audio', url: 'blob:narration', meta: { durationMs: 400 } },
  },
  {
    id: 'bed', kind: 'audio', frame: 'f1', lane: 'seq', start: 0, dur: 0.6,
    image: { id: 'user/bed', type: 'audio', url: 'blob:bed', meta: { durationMs: 600 } },
  },
];

test('the presenter speaks the clip the tool rendered, and leaves the bed alone', async () => {
  const src = await mountDeck({ boxes: NARRATED });
  const ctl = openPresentMode({ source: src })!;
  assert.ok(ctl, 'the deck opened');
  const voice = narrationPlayer(0);
  assert.ok(voice, 'the narration marker the hook wrote got a player');
  assert.notEqual(voice!.__playing, true, 'silent through its lead-in (T2)');
  await delay(90);
  assert.equal(voice!.__playing, true, 'then the slide speaks');

  const bed = document.body.querySelector<HTMLElement>('.pr-stage [data-audio-src$="user/bed"]')!;
  assert.ok(bed, 'the bed marker is on the stage');
  assert.equal(bed.querySelector('[data-narration-audio]'), null,
    'a bed opted into nothing, so the podium never gives it a player');
  ctl.close();
  assert.equal(voice!.__playing, false, 'closing takes the voice off the air');
  cleanup();
});

test('auto-advance waits for the WORDS, not just the dwell (T9)', async () => {
  // The dwell is 600 ms and the clip runs past it, which is exactly the case the timer
  // alone gets wrong: it would cut the sentence off. The advance is the clip's `ended`
  // plus the document's own tail.
  const src = await mountDeck({ boxes: NARRATED, autoAdvance: true, narrationTailMs: 30 });
  const ctl = openPresentMode({ source: src })!;
  const voice = narrationPlayer(0)!;
  await delay(90);
  assert.equal(voice.__playing, true);
  await delay(650);
  assert.equal(ctl.frameId, 'f1', 'the dwell ran out and the deck held, because it was still speaking');
  voice.dispatchEvent(new win.Event('ended'));
  await delay(80);
  assert.equal(ctl.frameId, 'f2', 'the last word plus the tail is what moved it on');
  ctl.close();
  cleanup();
});
