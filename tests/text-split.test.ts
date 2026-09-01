// SPDX-License-Identifier: MPL-2.0
/**
 * Design - split text animation (plans/175 WP-A) contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * Modeled on design-blur.test.ts: drives the REAL tool (manifest + hooks) through
 * the engine, so these guard the actual render rather than a paraphrase of it.
 *
 * Surfaces covered:
 *   1. The manifest: `split`/`stagger`/`splitOrder` are APPENDED at wire slots
 *      83/84/85 - compact block URLs encode fields positionally, so the slots are
 *      a permanent contract - and the canvas maps them.
 *   2. The hooks: a split box emits `data-t-split`/`data-t-stagger`/
 *      `data-t-split-order` (whitelisted values, clamped numbers only) and wraps
 *      its text in `.lly-u` unit spans with the SplitText a11y shape (wrapper
 *      aria-label, units aria-hidden). A box without a tier renders byte-identical
 *      markup to plain richText - no wrapper, no spans, no attributes.
 *   3. Segmentation: grapheme clusters stay whole (ZWJ emoji, combining marks),
 *      entities count as one displayed character, joining scripts degrade
 *      letter→word, and the unit cap stops wrapping rather than the render.
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK_DIR = join(ROOT, 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);

/** Mount the real community tool and return the hydrated markup. */
async function mount(boxes: unknown[]): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

/** A timed text box - `start: 0` is authored ("enters at the top"), not scenery. */
const TEXT_BOX = {
  id: 't1', kind: 'text', x: 40, y: 40, w: 600, h: 200, shape: 'rect',
  text: 'Hello brave world', fg: '#111111', fontSize: 48,
  start: 0, dur: 3,
};

const count = (html: string, needle: string): number => html.split(needle).length - 1;

// ── 1. the manifest ─────────────────────────────────────────────────────────

test('split fields sit at wire slots 83/84/85 - a permanent contract', async () => {
  const manifest = JSON.parse(await fetchFile('design/tool.json'));
  const input = manifest.inputs.find((i: any) => i.id === 'boxes');
  const fields = input.fields;
  assert.equal(fields[83].id, 'split');
  assert.equal(fields[84].id, 'stagger');
  assert.equal(fields[85].id, 'splitOrder');
  for (const slot of [83, 84, 85]) {
    assert.deepEqual(fields[slot].showFor, [],
      `slot ${slot} is machine-only - it must never render as a sidebar control`);
  }
  assert.deepEqual(
    fields[83].options.map((o: any) => o.value), ['', 'word', 'line', 'letter'],
    'the tier vocabulary is append-only wire contract');
  assert.deepEqual(
    fields[85].options.map((o: any) => o.value), ['', 'reverse', 'center', 'random']);
  assert.equal(fields[84].max, 2000, 'stagger wire ceiling matches MAX_SPLIT_STAGGER_MS');
  assert.equal(input.canvas.splitField, 'split');
  assert.equal(input.canvas.staggerField, 'stagger');
  assert.equal(input.canvas.splitOrderField, 'splitOrder');
});

// ── 2. no tier → no trace ───────────────────────────────────────────────────

test('a box without a tier renders with no split markup or attributes at all', async () => {
  const html = await mount([TEXT_BOX]);
  assert.equal(count(html, 'data-t-split'), 0);
  assert.equal(count(html, 'lly-u'), 0);
  assert.equal(count(html, 'lly-split'), 0);
  assert.ok(html.includes('Hello brave world'), 'the text itself still renders');
});

test('an UNTIMED box ignores an authored tier - scenery never splits', async () => {
  const html = await mount([{ ...TEXT_BOX, start: '', dur: '', split: 'word' }]);
  assert.equal(count(html, 'data-t-split'), 0);
  assert.equal(count(html, 'lly-u'), 0);
});

test('a frame never splits', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, text: 'a b', split: 'word', start: 0, dur: 2 },
  ]);
  assert.equal(count(html, 'data-t-split'), 0);
});

// ── 3. word tier ────────────────────────────────────────────────────────────

test('word tier: attrs + one unit span per word + the SplitText a11y shape', async () => {
  const html = await mount([{ ...TEXT_BOX, split: 'word', stagger: 80 }]);
  assert.ok(html.includes('data-t-split="word"'));
  assert.ok(html.includes('data-t-stagger="80"'));
  assert.equal(count(html, 'class="lly-u"'), 3, 'three words, three units');
  assert.equal(count(html, 'aria-hidden="true"'), 3, 'every unit is aria-hidden');
  assert.ok(html.includes('class="lly-split"'));
  assert.ok(html.includes('aria-label="Hello brave world"'),
    'the wrapper carries the whole string for assistive tech');
  assert.ok(html.includes('role="text"'));
});

test('stagger clamps to the wire ceiling; junk order values never reach the attribute', async () => {
  const html = await mount([{ ...TEXT_BOX, split: 'word', stagger: 99999, splitOrder: 'constructor' }]);
  assert.ok(html.includes('data-t-stagger="2000"'));
  assert.equal(count(html, 'data-t-split-order'), 0, 'prototype keys are not orders');
  const html2 = await mount([{ ...TEXT_BOX, split: 'word', splitOrder: 'reverse' }]);
  assert.ok(html2.includes('data-t-split-order="reverse"'));
});

test('bold spanning words keeps valid nesting - units wrap text runs inside tags', async () => {
  const html = await mount([{ ...TEXT_BOX, text: '**two words**', split: 'word' }]);
  assert.equal(count(html, 'class="lly-u"'), 2);
  assert.ok(/<strong><span class="lly-u"/.test(html),
    'the unit spans sit INSIDE the strong, never across its boundary');
});

// ── 4. letter tier ──────────────────────────────────────────────────────────

test('letter tier: graphemes stay whole - a ZWJ emoji is ONE unit, an entity is ONE unit', async () => {
  const html = await mount([{ ...TEXT_BOX, text: 'A&B \u{1F468}‍\u{1F469}‍\u{1F467}!', split: 'letter' }]);
  // 'A&B' → A, &amp;, B (3); '👨‍👩‍👧!' → the family emoji, ! (2).
  assert.equal(count(html, 'class="lly-u"'), 5);
  assert.equal(count(html, 'class="lly-w"'), 2, 'one nowrap word wrapper per word');
  assert.ok(html.includes('<span class="lly-u" aria-hidden="true">&amp;</span>'),
    'the entity travels whole - never split into its raw characters');
  assert.ok(html.includes('\u{1F468}‍\u{1F469}‍\u{1F467}</span>'),
    'the ZWJ sequence travels whole');
});

test('letter tier degrades to word for joining scripts - per-letter spans would break shaping', async () => {
  const html = await mount([{ ...TEXT_BOX, text: 'مرحبا بالعالم', split: 'letter' }]);
  assert.ok(html.includes('data-t-split="word"'), 'Arabic letter tier reads as word on the wire');
  assert.equal(count(html, 'class="lly-u"'), 2, 'two words, two units');
  assert.equal(count(html, 'class="lly-w"'), 0, 'no letter wrappers on the degraded path');
  // …but the intent survives for a shell that can shape (plans/175 WP-D): the glyph
  // enhancer reads this and gives per-letter animation on correctly joined glyphs.
  assert.ok(html.includes('data-t-split-want="letter"'), 'the degraded box still says it wanted letters');
  const latin = await mount([{ ...TEXT_BOX, split: 'letter' }]);
  assert.equal(count(latin, 'data-t-split-want'), 0, 'an undegraded letter box carries no want attribute');
});

// ── 5. line tier + the cap ──────────────────────────────────────────────────

test('line tier: one unit per AUTHORED line', async () => {
  const html = await mount([{ ...TEXT_BOX, text: 'first\nsecond\nthird', split: 'line' }]);
  assert.ok(html.includes('data-t-split="line"'));
  assert.equal(count(html, 'class="lly-u"'), 3);
});

test('the unit cap stops the WRAPPING, never the render - overflow text joins the tail', async () => {
  const words = Array.from({ length: 300 }, (_, i) => `w${i}`).join(' ');
  const html = await mount([{ ...TEXT_BOX, text: words, split: 'word' }]);
  assert.equal(count(html, 'class="lly-u"'), 240, 'MAX_SPLIT_UNITS - mirrored in lib/transitions.ts');
  assert.ok(html.includes('w299'), 'the 300th word still renders, just unwrapped');
});
