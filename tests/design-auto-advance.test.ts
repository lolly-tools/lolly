// SPDX-License-Identifier: MPL-2.0
/**
 * Design - auto-advance is an EXPLICIT document flag (plan 179 T3).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-auto-advance.test.ts
 * (no framework - node:test). Drives the REAL tool through the engine, loaded from
 * community/ like the other design suites, so this guards the actual render.
 *
 * The bug this pins shut: a frame's `dur` means "how long this slide lasts", and the
 * timeline's "Place in order" writes it on EVERY frame to lay a deck out as a video.
 * `dur > 0` also stamps data-frame-dur, which present mode read as a kiosk dwell - so
 * laying a deck out on the timeline silently converted it into a 3-second auto-advancing
 * kiosk deck with nothing in the UI saying so.
 *
 * The split: data-frame-dur keeps its meaning (the LENGTH of a slide) and its emission is
 * unchanged; whether the presenter ACTS on it is one document-level boolean, stamped on
 * the render root so a presenter clone carries it. Off by default, so every link already
 * shared still presents click-advanced.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);

async function mount(state: Record<string, unknown>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), state as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

/** A deck: two frames, each with a length, which is what makes data-frame-dur appear. */
const DECK = [
  { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff', dur: 3 },
  { id: 'f2', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff', dur: 3 },
];

/** The render root: .lolly-frames in frames mode, the single .artboard without frames. */
const rootOf = (html: string): HTMLElement => {
  const doc = new JSDOM(html).window.document;
  const el = doc.querySelector('.lolly-frames, .artboard') as HTMLElement | null;
  assert.ok(el, 'the render has a root element');
  return el!;
};

// ── the manifest ──────────────────────────────────────────────────────────────

test('the manifest declares autoAdvance: a boolean, defaulting to OFF, after `transition`', () => {
  const inputs = tool.manifest.inputs as Array<{ id: string; type: string; default?: unknown; label?: string }>;
  const i = inputs.findIndex(x => x.id === 'autoAdvance');
  assert.ok(i >= 0, 'the manifest declares an autoAdvance input');
  assert.equal(inputs[i]!.type, 'boolean');
  assert.equal(inputs[i]!.default, false, 'OFF by default - a deck advances on click');
  assert.equal(inputs[i]!.label, 'Auto-advance slides');
  // Top-level inputs are named in the URL, not positional (only `blocks` FIELDS are
  // positional), so this order is readability rather than a wire contract - but the flag
  // belongs beside the other presentation setting.
  assert.equal(inputs[i - 1]!.id, 'transition', 'it sits directly after the slide transition');
});

// ── the stamp ─────────────────────────────────────────────────────────────────

test('autoAdvance ON stamps data-auto-advance="1" on the frames root', async () => {
  const root = rootOf(await mount({ boxes: DECK, autoAdvance: true }));
  assert.equal(root.className, 'lolly-frames', 'a framed deck renders the frames root');
  assert.equal(root.getAttribute('data-auto-advance'), '1');
});

test('autoAdvance OFF, and absent, stamp NOTHING', async () => {
  for (const state of [{ boxes: DECK, autoAdvance: false }, { boxes: DECK }]) {
    const html = await mount(state);
    assert.ok(!html.includes('data-auto-advance'),
      `no attribute anywhere in the render (${JSON.stringify(state.autoAdvance ?? null)})`);
    assert.equal(rootOf(html).getAttribute('data-auto-advance'), null);
  }
});

test('the URL string forms are read as booleans, not as truthiness', async () => {
  // A shared link carries `autoAdvance=1` / `=false` as a STRING, and the string 'false'
  // is truthy in JS - the trap every boolean field in this hook reads through boolVal to
  // avoid. A deck whose link says false must not present as a kiosk.
  assert.equal(rootOf(await mount({ boxes: DECK, autoAdvance: '1' })).getAttribute('data-auto-advance'), '1');
  assert.equal(rootOf(await mount({ boxes: DECK, autoAdvance: 'true' })).getAttribute('data-auto-advance'), '1');
  assert.equal(rootOf(await mount({ boxes: DECK, autoAdvance: 'false' })).getAttribute('data-auto-advance'), null);
  assert.equal(rootOf(await mount({ boxes: DECK, autoAdvance: '0' })).getAttribute('data-auto-advance'), null);
});

test('a frame-less document stamps it on the single .artboard root', async () => {
  const root = rootOf(await mount({
    boxes: [{ id: 'a', kind: 'box', x: 0, y: 0, w: 100, h: 100, bg: '#30BA78' }],
    autoAdvance: true,
  }));
  assert.equal(root.className, 'artboard', 'no frames → the single-artboard branch');
  assert.equal(root.getAttribute('data-auto-advance'), '1');
});

// ── what did NOT change ───────────────────────────────────────────────────────

test('data-frame-dur is emitted exactly as before, with the flag on OR off', async () => {
  for (const state of [{ boxes: DECK }, { boxes: DECK, autoAdvance: true }]) {
    const doc = new JSDOM(await mount(state)).window.document;
    const durs = [...doc.querySelectorAll('[data-pdf-page]')]
      .map(p => (p as HTMLElement).getAttribute('data-frame-dur'));
    assert.deepEqual(durs, ['3000', '3000'],
      'a slide still declares its own length in ms - only who acts on it changed');
  }
});

test('turning the flag on changes ONE attribute and nothing else in the render', async () => {
  const off = await mount({ boxes: DECK });
  const on = await mount({ boxes: DECK, autoAdvance: true });
  assert.equal(on.replace(' data-auto-advance="1"', ''), off,
    'the flag is additive: removing the stamp gives back the byte-identical render');
});
