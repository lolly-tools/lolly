// SPDX-License-Identifier: MPL-2.0
/**
 * Design - the two layer flags, `hidden` and `locked` (plans/179 M4).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-hidden-locked.test.ts
 * (no framework - node:test). Drives the REAL tool through the engine, loaded from
 * community/ like the other design suites.
 *
 * The two flags are deliberately NOT symmetrical, and that asymmetry is the whole reason
 * this suite exists:
 *
 *   • `hidden` is DOCUMENT truth. A hidden layer is not drawn and not exported, so it has
 *     to be gone from every surface this hook produces - the artboard, a frame's page, the
 *     pasteboard, the .pptx deck, the Penpot document, the timeline attributes and the
 *     connector layer. Missing one of those is the bug: a layer the author hid still
 *     turning up in the exported deck, or still holding the sequence clock open.
 *
 *   • `locked` is EDITOR-ONLY. It must change nothing that renders - one attribute for the
 *     canvas overlay to read, and not a single pixel of difference.
 *
 * Both are read through the manifest's boolean coercion, so the string "false" a URL
 * carries is FALSE - the trap that would hide a layer the moment a link was shared.
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

const docOf = (html: string): Document => new JSDOM(html).window.document;
const boxIds = (html: string): string[] =>
  Array.from(docOf(html).querySelectorAll('.lolly-box')).map((el) => el.getAttribute('data-box-id') || '');
const jsonOf = (html: string, sel: string): any => {
  const s = docOf(html).querySelector(sel);
  return s ? JSON.parse(s.textContent || 'null') : null;
};

// ── the manifest ──────────────────────────────────────────────────────────────

test('the canvas declares both flag fields, so the overlay can act on them', () => {
  const boxes = (tool.manifest.inputs as any[]).find((i) => i.id === 'boxes');
  assert.equal(boxes.canvas.hiddenField, 'hidden');
  assert.equal(boxes.canvas.lockedField, 'locked');
});

// ── hidden: gone from every surface ───────────────────────────────────────────

test('a hidden box is absent from the single-artboard render, and the indices still line up', async () => {
  const html = await mount({
    boxes: [
      { id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', kind: 'box', x: 20, y: 0, w: 10, h: 10, hidden: true },
      { id: 'c', kind: 'box', x: 40, y: 0, w: 10, h: 10 },
    ],
  });
  assert.deepEqual(boxIds(html), ['a', 'c']);
  // data-canvas-input carries the row's index back to the editor, so it must keep naming
  // the SAME row - the skip must not renumber the boxes that are still drawn.
  const inputs = Array.from(docOf(html).querySelectorAll('.lolly-box'))
    .map((el) => el.getAttribute('data-canvas-input'));
  assert.deepEqual(inputs, ['boxes:0', 'boxes:2']);
});

test('a hidden member is absent from its frame page, and from the .pptx deck', async () => {
  const html = await mount({
    boxes: [
      { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
      { id: 'shown', kind: 'text', frame: 'f1', x: 10, y: 10, w: 100, h: 40, text: 'here' },
      { id: 'gone', kind: 'text', frame: 'f1', x: 10, y: 60, w: 100, h: 40, text: 'hidden', hidden: true },
    ],
  });
  assert.deepEqual(boxIds(html), ['shown']);
  const deck = jsonOf(html, 'script[data-pptx-deck]');
  assert.equal(deck.slides.length, 1);
  assert.equal(deck.slides[0].elements.length, 1, 'the hidden text is not an editable pptx shape');
});

test('a hidden PASTEBOARD box (no frame) is absent too', async () => {
  const html = await mount({
    boxes: [
      { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
      { id: 'loose', kind: 'box', frame: '', x: 900, y: 10, w: 40, h: 40 },
      { id: 'loosehidden', kind: 'box', frame: '', x: 960, y: 10, w: 40, h: 40, hidden: true },
    ],
  });
  assert.deepEqual(boxIds(html), ['loose']);
});

test('a hidden FRAME takes its page with it - and its members go with the page', async () => {
  const html = await mount({
    boxes: [
      { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
      { id: 'f2', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff', hidden: true },
      { id: 'onf1', kind: 'box', frame: 'f1', x: 10, y: 10, w: 40, h: 40 },
      { id: 'onf2', kind: 'box', frame: 'f2', x: 1010, y: 10, w: 40, h: 40 },
    ],
  });
  const doc = docOf(html);
  const ids = Array.from(doc.querySelectorAll('[data-pdf-page]')).map((el) => el.getAttribute('data-frame-id'));
  assert.deepEqual(ids, ['f1'], 'the hidden board is not a page');
  // The member is NOT re-homed onto the pasteboard: hiding a board hides what is on it.
  assert.deepEqual(boxIds(html), ['onf1']);
  const deck = jsonOf(html, 'script[data-pptx-deck]');
  assert.equal(deck.slides.length, 1, 'and it is not a slide either');
});

test('EVERY frame hidden stays in frames mode - the members do not explode onto one page', async () => {
  const html = await mount({
    boxes: [
      { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff', hidden: true },
      { id: 'onf1', kind: 'box', frame: 'f1', x: 10, y: 10, w: 40, h: 40 },
    ],
  });
  const doc = docOf(html);
  assert.ok(doc.querySelector('.lolly-frames'), 'still the frames branch');
  assert.equal(doc.querySelector('.artboard'), null, 'never the single-artboard branch');
  assert.equal(boxIds(html).length, 0);
});

test('a hidden box carries NO timeline attributes and does not lengthen the sequence', async () => {
  const timed = (extra: Record<string, unknown>) => ([
    { id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10, lane: 'seq', start: 0, dur: 2 },
    { id: 'b', kind: 'box', x: 20, y: 0, w: 10, h: 10, lane: 'seq', start: 2, dur: 8, ...extra },
  ]);
  const shown = docOf(await mount({ boxes: timed({}) }));
  assert.equal(shown.querySelector('[data-sequence]')!.getAttribute('data-seq-ms'), '10000');

  const hidden = docOf(await mount({ boxes: timed({ hidden: true }) }));
  assert.equal(hidden.querySelector('[data-sequence]')!.getAttribute('data-seq-ms'), '2000',
    'the hidden clip is not on the stage, so it cannot hold the clock open');
  assert.equal(hidden.querySelectorAll('.lolly-box[data-t-start]').length, 1);
});

test('a hidden box is absent from the Penpot document model', async () => {
  const html = await mount({
    boxes: [
      { id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', kind: 'box', x: 20, y: 0, w: 10, h: 10, hidden: true },
    ],
  });
  const ids = jsonOf(html, 'script[data-penpot-doc]').boxes.map((b: any) => b.id);
  assert.deepEqual(ids, ['a'], 'a design file must not carry a layer the author hid');
});

test('hidden reads through the boolean coercion - the STRING "false" is false', async () => {
  for (const v of ['false', '0', 'off', '', 0, false, null]) {
    const html = await mount({ boxes: [{ id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10, hidden: v }] });
    assert.deepEqual(boxIds(html), ['a'], `hidden=${JSON.stringify(v)} must still render`);
  }
  for (const v of ['true', '1', 'on', true]) {
    const html = await mount({ boxes: [{ id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10, hidden: v }] });
    assert.deepEqual(boxIds(html), [], `hidden=${JSON.stringify(v)} must be hidden`);
  }
});

// ── locked: one attribute and nothing else ────────────────────────────────────

test('a locked box renders as data-locked="1" - on the artboard, a page and the pasteboard', async () => {
  const flat = docOf(await mount({ boxes: [{ id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10, locked: true }] }));
  assert.equal(flat.querySelector('.lolly-box')!.getAttribute('data-locked'), '1');

  const framed = docOf(await mount({
    boxes: [
      { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
      { id: 'child', kind: 'box', frame: 'f1', x: 10, y: 10, w: 40, h: 40, locked: true },
      { id: 'loose', kind: 'box', frame: '', x: 900, y: 10, w: 40, h: 40, locked: true },
    ],
  }));
  assert.equal(framed.querySelector('[data-box-id="child"]')!.getAttribute('data-locked'), '1');
  assert.equal(framed.querySelector('[data-box-id="loose"]')!.getAttribute('data-locked'), '1');
});

test('locked changes NOTHING else - the same markup with the attribute removed', async () => {
  const boxes = (locked: boolean) => ([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { id: 'child', kind: 'text', frame: 'f1', x: 10, y: 10, w: 100, h: 40, text: 'copy', locked },
  ]);
  // The Penpot document model is a VERBATIM dump of the author's own rows, so it carries
  // the flag itself and legitimately differs; drop that one line and compare the render.
  const body = (html: string): string => html.replace(/^<script[^>]*data-penpot-doc[^>]*>.*?<\/script>\n/s, '');
  const plain = body(await mount({ boxes: boxes(false) }));
  const lockedHtml = body(await mount({ boxes: boxes(true) }));
  assert.notEqual(plain, lockedHtml, 'the attribute IS emitted');
  assert.equal(lockedHtml.replaceAll(' data-locked="1"', ''), plain,
    'a locked layer must render byte-identically once its one editor attribute is taken off');
});

test('an unlocked box emits no data-locked at all', async () => {
  for (const v of [undefined, false, '', 'false', '0']) {
    const html = await mount({ boxes: [{ id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10, locked: v }] });
    assert.equal(html.includes('data-locked'), false, `locked=${JSON.stringify(v)}`);
  }
});

test('locked and hidden are independent: a locked hidden box is simply gone', async () => {
  const html = await mount({
    boxes: [{ id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10, locked: true, hidden: true }],
  });
  assert.deepEqual(boxIds(html), []);
  assert.equal(html.includes('data-locked'), false, 'nothing to stamp it on');
});
