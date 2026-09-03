// SPDX-License-Identifier: MPL-2.0
/**
 * Design - a slide's OWN transition to the next one (plans/179 M4).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-slide-transition.test.ts
 * (no framework - node:test). Drives the REAL tool through the engine, loaded from
 * community/ like the other design suites, so this guards the actual render.
 *
 * Until now a deck had ONE transition for every slide, set at the document level, and the
 * presenter was the only thing that read it. `slideTransition` is the per-frame override:
 * empty follows the deck, a value wins, and 'custom' means the frame's own timeline
 * enter/exit are the truth and nothing may derive over them.
 *
 * Two properties are worth a test each. The attribute is a CLOSED WHITELIST, because the
 * field's value comes off a URL and is written into markup; and the value that reaches
 * the .pptx deck model is already RESOLVED against the document, so the export bridge
 * never has to re-implement the inheritance and drift from the presenter.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
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
const pages = (html: string): HTMLElement[] =>
  Array.from(docOf(html).querySelectorAll('[data-pdf-page]')) as HTMLElement[];
const deckOf = (html: string): any => {
  const s = docOf(html).querySelector('script[data-pptx-deck]');
  return s ? JSON.parse(s.textContent || 'null') : null;
};

/** Two frames, so there IS a "next slide" for a transition to run into. */
const deck = (t1: unknown, t2?: unknown): Record<string, unknown>[] => [
  { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff', slideTransition: t1 },
  { id: 'f2', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff', slideTransition: t2 },
];

// ── the manifest ──────────────────────────────────────────────────────────────

test('the manifest declares slideTransition, and the canvas names it', () => {
  const boxes = (tool.manifest.inputs as any[]).find((i) => i.id === 'boxes');
  const f = (boxes.fields as any[]).find((x) => x.id === 'slideTransition');
  assert.ok(f, 'boxes declares a slideTransition sub-field');
  assert.equal(f.type, 'select');
  assert.equal(f.default, '', 'the default is "follow the deck"');
  assert.equal(boxes.canvas.frameTransitionField, 'slideTransition',
    'the canvas declaration is what lights the feature up in the overlay');
});

test('the DOCUMENT transition offers the flight option too', () => {
  const tr = (tool.manifest.inputs as any[]).find((i) => i.id === 'transition');
  const values = (tr.options as any[]).map((o) => o.value);
  assert.deepEqual(values, ['slide', 'fade', 'morph', 'flight'],
    'a deck-wide flight is the same vocabulary as a per-slide one');
});

// ── the stamp ─────────────────────────────────────────────────────────────────

test('every legal value reaches the page as data-frame-transition', async () => {
  for (const v of ['slide', 'fade', 'morph', 'flight', 'none', 'custom']) {
    const html = await mount({ boxes: deck(v) });
    const p = pages(html)[0]!;
    assert.equal(p.getAttribute('data-frame-transition'), v, `value ${v}`);
  }
});

test('"" and junk stamp NOTHING - absent is how a slide says "follow the deck"', async () => {
  for (const v of ['', undefined, 'zoom-in', 'constructor', '<script>', 'SLIDE']) {
    const html = await mount({ boxes: deck(v) });
    const p = pages(html)[0]!;
    assert.equal(p.hasAttribute('data-frame-transition'), false,
      `value ${JSON.stringify(v)} must not reach the markup`);
  }
});

test('the stamp is per-frame: two slides can carry different transitions', async () => {
  const html = await mount({ boxes: deck('slide', 'none') });
  const [p1, p2] = pages(html);
  assert.equal(p1!.getAttribute('data-frame-transition'), 'slide');
  assert.equal(p2!.getAttribute('data-frame-transition'), 'none');
});

test('a no-frames document emits neither the attribute nor a deck', async () => {
  const html = await mount({ boxes: [{ id: 'b', kind: 'box', x: 0, y: 0, w: 10, h: 10 }] });
  assert.equal(pages(html).length, 0, 'no frames, no pages');
  assert.equal(html.includes('data-frame-transition'), false);
  assert.equal(deckOf(html), null, 'and no deck model to carry a transition');
});

// ── the resolved deck value ───────────────────────────────────────────────────

test('the deck model carries each slide transition RESOLVED against the document', async () => {
  const html = await mount({ boxes: deck('fade', ''), transition: 'slide' });
  const d = deckOf(html);
  assert.equal(d.slides[0].transition, 'fade', 'the slide own value wins');
  assert.equal(d.slides[1].transition, 'slide', 'an empty one inherits the document');
});

test('"custom" resolves to the DOCUMENT value in the deck - a .pptx has no timeline', async () => {
  const html = await mount({ boxes: deck('custom'), transition: 'fade' });
  assert.equal(deckOf(html).slides[0].transition, 'fade');
});

test('no resolvable transition leaves the key off entirely (a pre-M4 deck, byte for byte)', async () => {
  const html = await mount({ boxes: deck('', ''), transition: '' });
  const d = deckOf(html);
  for (const s of d.slides) {
    assert.equal('transition' in s, false, 'undefined is dropped by JSON.stringify, and must be');
  }
});

test('a flight deck resolves to flight - the writer decides what to do with it', async () => {
  const html = await mount({ boxes: deck(''), transition: 'flight' });
  assert.equal(deckOf(html).slides[0].transition, 'flight');
});

// ── the wiring the three players depend on ────────────────────────────────────
//
// Both of these are source contracts rather than behaviour, because the seam is a mount:
// the value is read in views/tool.ts and the field name is handed to the timeline in
// views/free-canvas.ts, and neither module can be stood up in jsdom without the whole
// editor. Each guards a defect that shipped: an option the sidebar offered and the
// presenter never saw, and a branch only a test's own cfg patch ever reached.

const webSrc = (rel: string): string => readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'shells', 'web', 'src', rel), 'utf8',
);

test('the doc-level transition reaches the presenter unflattened, `flight` included', () => {
  const src = webSrc('views/tool.ts');
  const call = /transition: transitionVal ===[\s\S]{0,300}?,\n/.exec(src)?.[0] ?? '';
  assert.ok(call, 'openPresentMode must still resolve the doc transition here');
  for (const kind of ['morph', 'fade', 'flight']) {
    assert.ok(call.includes(`'${kind}'`), `${kind} is offered by the manifest and must survive the whitelist`);
  }
  // Every value the manifest offers, so a new option cannot be silently downgraded again.
  const manifest = JSON.parse(readFileSync(join(PACK_DIR, 'design', 'tool.json'), 'utf8'));
  const offered: string[] = (manifest.inputs.find((i: any) => i.id === 'transition')?.options ?? [])
    .map((o: any) => String(o.value));
  for (const v of offered) {
    assert.ok(call.includes(`'${v}'`), `the sidebar offers "${v}" - the presenter must be told about it`);
  }
});

test('the frame transition FIELD NAME is handed to the timeline panel', () => {
  const src = webSrc('views/free-canvas.ts');
  assert.match(src, /frameTransitionField: frameCfg\?\.transitionField/,
    'without this the panel never stamps `custom`, so a hand-set slide transition is '
    + 'overwritten by the next "Place in order"');
  assert.match(webSrc('views/free-canvas.ts'), /transitionField: frameCfg\.transitionField/,
    'and the columns read it off the frame port rather than guessing the literal name');
});
