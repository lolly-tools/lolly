// SPDX-License-Identifier: MPL-2.0
/**
 * Design - a timed single-artboard model stamps the [data-sequence] stage marker
 * + per-box data-t-* attrs (M1-a: Design exports video from its timeline).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * Loads the REAL tool from disk (public community pack, always present in a
 * public checkout - brands/suse is a private, CI-skipped submodule) and drives it through the
 * engine with a stub host, mirroring design-frames.test.ts.
 *
 * The contract this guards:
 *   - TIMED → the single .artboard carries `data-sequence` + `data-seq-ms` (the stage marker
 *     the web shell's isSequenceStage() detects to route mp4/webm/gif/apng to the compositor),
 *     and each timed box carries data-t-start / data-t-dur / data-t-lane etc.
 *   - STILL → a doc with NO timed boxes stays a plain still artboard: ZERO data-sequence, ZERO
 *     data-t-*. Adding the video formats must not force motion onto a still doc.
 *   - The shipped "video" template is all-timed on a single artboard (NO kind:'frame' box) so it
 *     lands on the {{else}} branch and gets the marker.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

const TOOL_JSON = join(PACK_DIR, 'design', 'tool.json');
assert.ok(existsSync(TOOL_JSON),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);

async function mount(boxes: unknown[]) {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

// ── TIMED → sequence stage marker ──────────────────────────────────────────────────

test('timed boxes (lane:"seq" + start/dur) → the artboard carries data-sequence + data-seq-ms', async () => {
  const html = await mount([
    { id: 'bg', kind: 'box', x: 0, y: 0, w: 1080, h: 1080, shape: 'rect', bg: '#0b1220' },
    { id: 'hook', kind: 'text', x: 100, y: 420, w: 880, h: 240, text: 'Hi', fontSize: 104, lane: 'seq', start: 0, dur: 2, exit: 'fade', exitMs: 500 },
    { id: 'cta', kind: 'text', x: 100, y: 440, w: 880, h: 200, text: 'Bye', fontSize: 96, lane: 'seq', start: 4.4, dur: 2.6, enter: 'fade', enterMs: 500 },
  ]);
  // Single artboard branch (no frames), stamped as a sequence stage.
  assert.match(html, /class="artboard"[^>]*data-sequence/, 'the single artboard carries data-sequence');
  // Derived length = last clip end (4.4 + 2.6 = 7s) → 7000ms.
  assert.match(html, /data-seq-ms="7000"/, 'data-seq-ms is the derived length (7000ms)');
  // Per-box timing attrs on the timed clips.
  assert.match(html, /data-box-id="hook"[^>]*data-t-start="0"[^>]*data-t-dur="2000"/, 'hook clip has start/dur');
  assert.match(html, /data-box-id="hook"[^>]*data-t-lane="seq"/, 'hook clip is on the seq lane');
  assert.match(html, /data-box-id="cta"[^>]*data-t-start="4400"[^>]*data-t-dur="2600"/, 'cta clip has start/dur');
});

// ── STILL → no motion forced ────────────────────────────────────────────────────────

test('no timed boxes → still artboard: ZERO data-sequence, ZERO data-t-*', async () => {
  const html = await mount([
    { id: 'a', kind: 'box', x: 120, y: 80, w: 300, h: 200, shape: 'rect', bg: '#30BA78' },
    { id: 'b', kind: 'text', x: 500, y: 400, w: 400, h: 200, text: 'Hi', fontSize: 48 },
  ]);
  assert.equal(html.includes('class="artboard"'), true, 'still doc still renders the single artboard');
  assert.ok(!/data-sequence/.test(html), 'no data-sequence marker on a still doc');
  assert.ok(!/data-t-start/.test(html), 'no per-box timing attrs on a still doc');
  assert.ok(!/data-seq-ms/.test(html), 'no derived sequence length on a still doc');
});

// ── The shipped "video" template is all-timed on a single artboard ──────────────────

test('the shipped "video" template seeds a single-artboard, all-timed sequence', async () => {
  // Templates are per-file now (tools/<id>/templates/<tid>.json, not inline in tool.json).
  const video = JSON.parse(await fetchFile('design/templates/video.json'));
  assert.equal(video.id, 'video', 'the video template file exists and is self-identifying');
  const boxes = video.values?.boxes ?? [];
  assert.ok(Array.isArray(boxes) && boxes.length >= 2, 'the video template has multiple boxes');
  // No kind:'frame' box - keeps frameGroups undefined so the {{else}} artboard carries the marker.
  assert.ok(!boxes.some((b: any) => b.kind === 'frame'), 'no frame box (all-timed single artboard, not a paged doc)');
  // At least one timed clip on the seq lane with a real positive duration.
  assert.ok(
    boxes.some((b: any) => b.lane === 'seq' && Number(b.dur) > 0),
    'at least one seq-lane clip with dur > 0',
  );
  // The seeded template actually produces the stage marker when mounted.
  const html = await mount(boxes);
  assert.match(html, /class="artboard"[^>]*data-sequence/, 'the seeded video template stamps data-sequence');
});
