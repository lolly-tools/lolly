// SPDX-License-Identifier: MPL-2.0
/**
 * Layout Studio ("Design") — the audio subsystem mirror-ported from sequence-studio.
 *
 * Run with: node --test tests/layout-studio-audio.test.ts  (node:test, no framework).
 *
 * GAP this closes: a Design timeline had NO audio — no `kind:'audio'` box, no
 * `.lolly-box-audio` marker — so a dropped audio asset rendered as a broken <img> and a
 * timeline was silent. This mirror-ports the marker EMISSION only; the shell audio
 * compositor already keys off it (sequence-plan.ts `layerKind`).
 *
 * The contract this guards:
 *   - AN AUDIO BOX (kind:'audio', or an asset typed/named audio) emits ONLY the shell
 *     marker div: `<div class="lolly-box-audio" data-audio-src=… aria-hidden="true">`,
 *     with `data-audio-dur` when the source's length in ms is known — mirroring
 *     sequence-studio verbatim. It is INVISIBLE: the .lolly-box is `background:transparent`
 *     with no border, and it carries NO text run — no rectangle where the music bed sits.
 *   - `layerKind()` (the shell compositor's own classifier) returns "audio" for that box.
 *   - A NON-AUDIO box is byte-unchanged: its fill, text and markup are exactly as before.
 *   - The shipped "video" template now carries an optional music bed (a `kind:'audio'` box).
 *
 * Loads the REAL parent-owned brands/lolly-start pack (always present in a public checkout;
 * brands/suse is a private, CI-skipped submodule) and drives it through the engine with a
 * stub host, mirroring layout-studio-sequence.test.ts.
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
import { layerKind } from '../shells/web/src/bridge/sequence-plan.ts';

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'lolly-start', 'tools');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

const TOOL_JSON = join(PACK_DIR, 'layout-studio', 'tool.json');
assert.ok(existsSync(TOOL_JSON),
  'brands/lolly-start/tools/layout-studio/tool.json is missing — the tool was renamed or deleted');

const tool: any = await loadTool('layout-studio', fetchFile);

async function mount(boxes: unknown[]) {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

// The .lolly-box wrapper for a given data-box-id, so per-box assertions don't collide.
function boxEl(html: string, id: string): HTMLElement {
  const doc = new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
  const el = doc.querySelector(`.lolly-box[data-box-id="${id}"]`) as HTMLElement | null;
  assert.ok(el, `no .lolly-box with data-box-id="${id}"`);
  return el as HTMLElement;
}

// ── the marker: emitted, invisible, and classified "audio" ──────────────────────────

test('a kind:"audio" box emits the .lolly-box-audio marker and nothing visible', async () => {
  const html = await mount([
    { id: 'card', kind: 'box', x: 0, y: 0, w: 1080, h: 1080, shape: 'rect', bg: '#123456', text: 'Visible' },
    {
      id: 'bed', kind: 'audio', x: -47, y: 745, w: 320, h: 200, bg: 'transparent',
      image: { type: 'audio', url: 'blob:bed', meta: { durationMs: 12000 } },
      start: 0, mute: false,
    },
  ]);

  // The marker div, mirroring sequence-studio verbatim: class + data-audio-src (always) +
  // data-audio-dur (source length in ms, known here) + aria-hidden.
  assert.match(html, /<div class="lolly-box-audio" data-audio-src="blob:bed" data-audio-dur="12000" aria-hidden="true">/,
    'the audio box emits the exact shell marker div');

  const bed = boxEl(html, 'bed');
  // INVISIBLE: transparent fill, no border, no gradient/backdrop, no text child content.
  const bedStyle = bed.getAttribute('style') || '';
  assert.match(bedStyle, /background:transparent/, 'the audio box paints no fill');
  assert.ok(!/border:/.test(bedStyle), 'the audio box has no border rectangle');
  assert.ok(!/background-image:/.test(bedStyle), 'the audio box has no gradient');
  assert.equal((bed.querySelector('.lolly-box-text')?.textContent || '').trim(), '',
    'the audio box renders no text');
  // No <img>/<video>/lottie — the audio branch short-circuits BEFORE them.
  assert.equal(bed.querySelector('img,video,.lolly-box-lottie,.lolly-box-path'), null,
    'the audio box emits no picture element (never a broken <img>)');
  // The one trace is the marker.
  assert.ok(bed.querySelector('.lolly-box-audio[data-audio-src]'), 'the marker is the audio box\'s only child paint');

  // The shell compositor's own classifier agrees this box is audio.
  assert.equal(layerKind(bed), 'audio', 'layerKind() classifies the audio box as "audio"');
});

test('an audio asset dropped on an ordinary box (extension match) is still classified "audio"', async () => {
  const html = await mount([
    { id: 'drop', kind: 'image', x: 100, y: 100, w: 300, h: 300, shape: 'rounded',
      image: { url: 'blob:track.mp3' } },
  ]);
  assert.match(html, /<div class="lolly-box-audio" data-audio-src="blob:track.mp3" aria-hidden="true">/,
    'a .mp3 url on an image box emits the audio marker (no broken <img>), with NO data-audio-dur');
  assert.equal(layerKind(boxEl(html, 'drop')), 'audio', 'extension-detected audio classifies as "audio"');
});

// ── a non-audio box is byte-unchanged ───────────────────────────────────────────────

test('a non-audio box keeps its fill, text and markup (no audio path touches it)', async () => {
  const html = await mount([
    { id: 'card', kind: 'box', x: 0, y: 0, w: 400, h: 200, shape: 'rect', bg: '#123456', text: 'Hello' },
  ]);
  const card = boxEl(html, 'card');
  assert.match(card.getAttribute('style') || '', /background:#123456/, 'the box keeps its fill');
  assert.equal((card.querySelector('.lolly-box-text')?.textContent || '').trim(), 'Hello',
    'the box keeps its text');
  assert.equal(card.querySelector('.lolly-box-audio'), null, 'a non-audio box has no audio marker');
  assert.equal(layerKind(card), 'static', 'a plain box classifies as "static"');
});

// ── the shipped "video" template carries a music bed ────────────────────────────────

test('the "video" template seeds a kind:"audio" music bed spanning the timeline', async () => {
  const video = JSON.parse(await fetchFile('layout-studio/templates/video.json'));
  const boxes: any[] = video.values?.boxes ?? [];
  const bed = boxes.find((b) => b.kind === 'audio');
  assert.ok(bed, 'the video template has a kind:"audio" music bed');
  assert.equal(bed.start, 0, 'the bed starts at 0 (plays over the whole timeline)');
  assert.ok(bed.image && typeof bed.image.id === 'string' && /^zzfxm:\d{1,10}$/.test(bed.image.id),
    'the bed carries a procedural zzfxm ref (no external asset dependency)');
  // It does NOT sit on the seq clip lane — a bed is an overlay, not one clip in the row.
  assert.notEqual(bed.lane, 'seq', 'the bed is on the overlay lane, not the seq clip row');
});
