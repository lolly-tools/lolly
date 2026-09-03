// SPDX-License-Identifier: MPL-2.0
/**
 * Design - the font keywords, and the third one (plans/179 M4).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-fonts.test.ts
 * (no framework - node:test). Drives the REAL tool through the engine.
 *
 * The brand system has had a HEADINGS face for as long as brand-vars.ts has had font
 * slots (`--font-display`, itself falling back to `--font-brand`), and every part of the
 * app chrome uses it - but the Design tool could only say "Brand sans" or "Mono", so a
 * headline on a user's own artboard was set in their BODY face while the same words in
 * the app's own UI were not. `display` is the third keyword, and the default document's
 * headline now asks for it.
 *
 * Two things are pinned. The keyword emits the var CHAIN, not a family name - a kit with
 * no separate headings face has to fall through to the brand face and then to a real
 * generic, so a headless/CLI render with no brand variables at all still resolves. And
 * `sans`/`mono` are asserted byte-identical, because adding a keyword must not disturb
 * the two that every existing document is written in.
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

/** The `font-family` the one text box in this document renders with. */
async function familyOf(font: unknown): Promise<string> {
  const html = await mount({ boxes: [{ id: 't', kind: 'text', x: 0, y: 0, w: 200, h: 80, text: 'Aa', font }] });
  const el = new JSDOM(html).window.document.querySelector('.lolly-box-text') as HTMLElement;
  assert.ok(el, 'the text box rendered');
  const m = /font-family:([^;]+);/.exec(el.getAttribute('style') || '');
  assert.ok(m, 'a font-family was emitted');
  return m![1]!.trim();
}

test('the manifest offers three font keywords, sans first', () => {
  const boxes = (tool.manifest.inputs as any[]).find((i) => i.id === 'boxes');
  const f = (boxes.fields as any[]).find((x) => x.id === 'font');
  assert.deepEqual((f.options as any[]).map((o) => o.value), ['sans', 'display', 'mono']);
  assert.equal((f.options as any[])[1].label, 'Display');
  assert.equal(f.default, 'sans', 'the FIELD default is unchanged - only the seeded headline moved');
});

test('display emits the var chain: headings face, then brand face, then a real generic', async () => {
  const fam = await familyOf('display');
  assert.equal(fam, 'var(--font-display, var(--font-brand, sans-serif))');
});

test('sans and mono are byte-identical to what they always were', async () => {
  assert.equal(await familyOf('sans'),
    "var(--font-brand, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif)");
  assert.equal(await familyOf('mono'),
    'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)');
  // An absent font is still the brand face, not the literal family "undefined".
  assert.equal(await familyOf(''), await familyOf('sans'));
  assert.equal(await familyOf(undefined), await familyOf('sans'));
});

test('display is a closed keyword, so it never reaches the deck as a typeface NAME', async () => {
  const html = await mount({
    boxes: [
      { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
      { id: 't', kind: 'text', frame: 'f1', x: 10, y: 10, w: 200, h: 80, text: 'Aa', font: 'display' },
    ],
  });
  const s = new JSDOM(html).window.document.querySelector('script[data-pptx-deck]')!;
  const deck = JSON.parse(s.textContent || 'null');
  const run = deck.slides[0].elements[0].paras[0].runs[0];
  assert.equal(run.font, undefined,
    'a CSS custom property is not a PowerPoint face - the deck theme font applies instead');
});

test('the default document sets its headline in the display face', () => {
  const boxes = (tool.manifest.inputs as any[]).find((i) => i.id === 'boxes');
  const headline = (boxes.default as any[]).find((b) => b.id === 'headline');
  assert.ok(headline, 'the seeded document still has a headline box');
  assert.equal(headline.font, 'display');
  // The sub-headline is BODY copy and stays on the brand sans - the contrast between the
  // two is the point of having a headings face at all.
  const sub = (boxes.default as any[]).find((b) => b.id === 'sub');
  assert.equal(sub.font, 'sans');
});
