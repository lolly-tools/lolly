// SPDX-License-Identifier: MPL-2.0
/**
 * Deck Studio - the layout-gallery deck model (engine 1.135 layouts).
 *
 * Run with: npm test (node --test over the tests/ globs). No framework - node:test.
 *
 * Every export carries `layouts` - the 20-entry branded gallery (10 Google-canonical
 * archetypes × light/dark) whose furniture geometry comes from the SUSE brand
 * template - plus per-slide `layout` bindings and `ph`-bound title/body text, so the
 * .pptx opens in PowerPoint as a working template (New Slide gallery, outline view).
 * The whole thing is headlessly verifiable: the hook emits the model DOM-free, and
 * the lowering + engine (pptx-deck.ts / pptx.ts) are covered by their own suites.
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

assert.ok(existsSync(join(PACK_DIR, 'deck-studio', 'tool.json')),
  'community/deck-studio/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('deck-studio', fetchFile);

async function mount(values: Record<string, unknown>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), values as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

function deckOf(html: string): any {
  const doc = new JSDOM(html).window.document;
  const el = doc.querySelector('[data-pptx-deck]');
  assert.ok(el, 'deck model present');
  return JSON.parse(el!.textContent ?? '');
}

const GALLERY = ['TITLE', 'SECTION_HEADER', 'TITLE_AND_BODY', 'TITLE_AND_TWO_COLUMNS', 'TITLE_ONLY',
  'ONE_COLUMN_TEXT', 'MAIN_POINT', 'SECTION_TITLE_AND_DESCRIPTION', 'CAPTION_ONLY', 'BIG_NUMBER'];

test('every deck carries the 20-layout branded gallery (light + dark twins, template geometry)', async () => {
  const deck = deckOf(await mount({ deck: [{ layout: 'content', heading: 'Hi', body: 'a\nb' }] }));
  assert.equal(deck.layouts.length, 20);
  GALLERY.forEach((name, i) => {
    assert.equal(deck.layouts[i * 2].name, name);
    assert.equal(deck.layouts[i * 2 + 1].name, `${name}_DARK`);
  });
  // Dark twins carry a dark bg; light twins the light one.
  assert.notEqual(deck.layouts[0].bg, deck.layouts[1].bg);
  // TITLE_AND_BODY placeholders: title strip + body at the template's safe area.
  const tab = deck.layouts.find((l: any) => l.name === 'TITLE_AND_BODY');
  const title = tab.placeholders.find((p: any) => p.type === 'title');
  const body = tab.placeholders.find((p: any) => p.type === 'body');
  assert.ok(title && body);
  assert.equal(title.x, Math.round(1280 * 0.034));
  assert.equal(body.y, Math.round(720 * 0.146));
  assert.equal(body.idx, 1);
  assert.ok(body.prompt, 'body carries a prompt');
  // Slide numbers ride as a sldNum placeholder (idx 12, template convention).
  assert.ok(tab.placeholders.some((p: any) => p.type === 'sldNum' && p.idx === 12));
});

test('slides bind to their archetype (light/dark aware) and ph-bind title/body', async () => {
  const deck = deckOf(await mount({ deck: [
    { layout: 'title', heading: 'T' },                       // dark (primary bg) → TITLE_DARK
    { layout: 'content', heading: 'C', body: '- a\n- b' },   // light → TITLE_AND_BODY
    { layout: 'two-col', heading: 'Two', body: 'a\nb\nc\nd' },
    { layout: 'big-number', heading: '87%', subtitle: 'of decks' },
  ] }));
  const idx = (name: string) => deck.layouts.findIndex((l: any) => l.name === name);
  assert.equal(deck.slides[0].layout, idx('TITLE_DARK'));
  assert.equal(deck.slides[1].layout, idx('TITLE_AND_BODY'));
  assert.equal(deck.slides[2].layout, idx('TITLE_AND_TWO_COLUMNS'));
  assert.equal(deck.slides[3].layout, idx('BIG_NUMBER'));
  // ph bindings: title slide's heading is the ctrTitle; content title/body bind too.
  const phsOf = (s: any) => s.elements.filter((e: any) => e.ph).map((e: any) => e.ph.type + (e.ph.idx ?? ''));
  assert.ok(phsOf(deck.slides[0]).includes('ctrTitle'));
  assert.deepEqual(phsOf(deck.slides[1]).sort(), ['body1', 'title']);
  assert.deepEqual(phsOf(deck.slides[2]).sort(), ['body1', 'body2', 'title']);
  assert.deepEqual(phsOf(deck.slides[3]).sort(), ['body1', 'title']);
});

test('the new archetypes render elements; footer + brand bar land on CONTENT slides + layouts', async () => {
  const deck = deckOf(await mount({
    footerText: '© 2026 Example · Confidential',
    deck: [
      { layout: 'main-point', heading: 'One big statement' },
      { layout: 'one-column', heading: 'Narrow', body: 'Readable measure.' },
    ],
  }));
  const texts = (s: any) => s.elements.filter((e: any) => e.t === 'text')
    .flatMap((e: any) => e.paras.flatMap((p: any) => p.runs.map((r: any) => r.text)));
  // main-point is a HERO design: statement present, but no footer/bar (template heroes are clean).
  assert.ok(texts(deck.slides[0]).includes('One big statement'));
  assert.ok(!texts(deck.slides[0]).includes('© 2026 Example · Confidential'), 'hero carries no footer');
  // one-column (a content slide): narrow centred measure + footer + the 4-segment brand bar.
  const col = deck.slides[1].elements.find((e: any) => e.ph?.type === 'body');
  assert.equal(col.x, Math.round(1280 * 0.22));
  assert.ok(texts(deck.slides[1]).includes('© 2026 Example · Confidential'));
  const barRects = deck.slides[1].elements.filter((e: any) => e.t === 'rect' && e.y === Math.round(720 * 0.9325));
  assert.equal(barRects.length, 4, 'segmented brand bar');
  // A content-family layout (TITLE_AND_BODY) carries the bar + footer for new slides;
  // the cover (TITLE) stays clean.
  const tab = deck.layouts.find((l: any) => l.name === 'TITLE_AND_BODY');
  assert.equal(tab.elements.filter((e: any) => e.t === 'rect' && e.y === Math.round(720 * 0.9325)).length, 4);
  assert.ok(tab.elements.some((e: any) => e.t === 'text' &&
    e.paras.some((p: any) => p.runs.some((r: any) => r.text === '© 2026 Example · Confidential'))));
  assert.equal(deck.layouts.find((l: any) => l.name === 'TITLE').elements.filter((e: any) => e.t === 'rect').length, 0);
});

test('starter-template mode replaces content with one sample slide per archetype', async () => {
  const deck = deckOf(await mount({ mode: 'template', deck: [{ layout: 'content', heading: 'ignored' }] }));
  assert.ok(deck.slides.length >= 10, `sample deck has ${deck.slides.length} slides`);
  const bound = new Set(deck.slides.map((s: any) => deck.layouts[s.layout].name.replace(/_DARK$/, '')));
  for (const name of ['TITLE', 'SECTION_HEADER', 'TITLE_AND_BODY', 'TITLE_AND_TWO_COLUMNS', 'ONE_COLUMN_TEXT', 'MAIN_POINT', 'BIG_NUMBER']) {
    assert.ok(bound.has(name), `sample for ${name}`);
  }
  // The user's own content is NOT in the template.
  const all = JSON.stringify(deck.slides);
  assert.ok(!all.includes('ignored'));
});
