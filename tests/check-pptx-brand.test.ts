// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly check` on a delivered .pptx reads the colours its slides paint (plan 291 M4).
 *
 * The brand family used to skip a .pptx (it carries no Design layers), so a dark deck
 * whose grounds came out #1d1d1d, or a deck exported in the other theme, scored clean.
 * These cases build small decks with the engine's own writer and check them against the
 * public recreate tokens (tests/fixtures/recreate/tokens.json): navy and white in light,
 * the same brand colours swapped in dark.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/check-pptx-brand.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

import { buildPptxParts, EMU_PER_PX } from '../engine/src/pptx.ts';
import type { PptxShape, PptxSlide } from '../engine/src/pptx.ts';
import { checkFile } from '../packages/node-shell/src/check.ts';
import { readPptxBrand } from '../packages/node-shell/src/check-pptx-brand.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/recreate/tokens.json'), 'utf8')) as unknown;
const DS = { designSystem: { doc: TOKENS, origin: 'file' as const }, browser: 'off' as const };

const W = 1920 * EMU_PER_PX;
const H = 1080 * EMU_PER_PX;

/** A slide: a full-bleed ground, then a line of text in one colour. */
function slide(ground: string, ink: string, text = 'A headline on the slide'): PptxSlide {
  const shapes: PptxShape[] = [
    { kind: 'rect', x: 0, y: 0, cx: W, cy: H, fill: { solid: ground } },
    { kind: 'text', x: W / 10, y: H / 3, cx: (W * 8) / 10, cy: H / 5, paras: [{ runs: [{ text, sizePt: 40, color: ink }] }] } as PptxShape,
  ];
  return { shapes, media: [] };
}

function deck(slides: PptxSlide[]): Uint8Array {
  const parts = buildPptxParts(slides, { emuW: W, emuH: H, now: '2026-01-01T00:00:00Z' });
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(parts)) files[path] = typeof content === 'string' ? strToU8(content) : content as Uint8Array;
  return zipSync(files);
}

test('the reader sees each slide\'s ground and the colours painted on it', async () => {
  const read = await readPptxBrand(deck([slide('#13294b', '#ffffff')]));
  assert.deepEqual(read.grounds, [{ slide: 1, hex: '#13294b' }]);
  assert.ok(read.rows.some((r) => r.bg === '#13294b'), 'the ground shape is a fill row');
  assert.ok(read.rows.some((r) => r.fg === '#ffffff' && r.text === 'A headline on the slide'), 'the text run is an ink row');
});

test('a dark deck in the dark palette is clean, and its navy ground passes in light as the primary', async () => {
  const dark = deck([slide('#13294b', '#ffffff'), slide('#13294b', '#ffffff')]);
  const ok = await checkFile(dark, 'dark.pptx', { ...DS, theme: 'dark' });
  assert.equal(ok.families.brand.state, 'ran', ok.families.brand.reason ?? '');
  assert.deepEqual(ok.findings.filter((f) => f.family === 'brand'), [], 'every colour is the dark theme\'s');
  assert.ok(ok.designSystem, 'the report names the design system it used');

  // Navy is the light theme's primary, so a navy ground there reads as a title slide.
  const asLight = await checkFile(dark, 'dark.pptx', { ...DS, theme: 'light' });
  assert.equal(asLight.findings.filter((f) => f.code === 'brand.ground.theme').length, 0, 'a primary ground is allowed');
});

test('a deck exported in the wrong palette is held for review, slide by slide', async () => {
  // The renderer's fallback ink and ground (#1d1d1d) instead of the dark theme's navy.
  const wrong = deck([slide('#1d1d1d', '#1d1d1d'), slide('#13294b', '#ffffff')]);
  const report = await checkFile(wrong, 'wrong.pptx', { ...DS, theme: 'dark' });
  assert.notEqual(report.outcome, 'clean', 'a wrongly coloured deck does not score clean');
  const review = report.findings.filter((f) => f.code === 'brand.color.review');
  assert.ok(review.length > 0, 'the off-palette colour is named');
  assert.ok(review.every((f) => f.page === '1' && !f.path && !f.fix), 'on slide 1, with no document path or fix');
  const grounds = report.findings.filter((f) => f.code === 'brand.ground.theme');
  assert.deepEqual(grounds.map((f) => f.page), ['1'], 'only slide 1 is on the wrong ground');

  // A light deck delivered as the dark one: every colour is on the palette, but the white
  // grounds are not the dark theme's.
  const light = deck([slide('#ffffff', '#13294b')]);
  const swapped = await checkFile(light, 'dark.pptx', { ...DS, theme: 'dark' });
  assert.deepEqual(swapped.findings.filter((f) => f.code === 'brand.color.review'), []);
  assert.deepEqual(swapped.findings.filter((f) => f.code === 'brand.ground.theme').map((f) => f.page), ['1']);
  assert.equal(swapped.outcome, 'review');
});

test('a .pptx with no design system says the brand family could not run', async () => {
  const report = await checkFile(deck([slide('#13294b', '#ffffff')]), 'deck.pptx', { browser: 'off' });
  assert.equal(report.families.brand.state, 'unavailable');
  await assert.rejects(checkFile(deck([slide('#13294b', '#ffffff')]), 'deck.pptx', { ...DS, theme: 'sepia' }), /no theme "sepia"/);
});

test('the recreation eval reads a delivered .pptx\'s own grounds for its theme', async () => {
  const { pptxThemeGroundsOf } = await import('../scripts/recreate-eval.ts');
  const grounds = [{ slide: 1, hex: '#ffffff' }, { slide: 2, hex: '#13294b' }, { slide: 3, photo: true as const }];
  assert.deepEqual(pptxThemeGroundsOf(grounds, 'dark', TOKENS), { frames: 3, mismatched: ['slide-1'], exempt: [{ frame: 'slide-3', why: 'photo' }] });
  // In light, navy is the primary: a title slide's ground, not a theme slip.
  assert.deepEqual(pptxThemeGroundsOf(grounds, 'light', TOKENS), { frames: 3, mismatched: [], exempt: [{ frame: 'slide-2', why: 'archetype' }, { frame: 'slide-3', why: 'photo' }] });
});
