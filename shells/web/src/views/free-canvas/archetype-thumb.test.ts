// SPDX-License-Identifier: MPL-2.0
/**
 * The layout wireframes (plan 275 sections 2.8 and 4, decision 30), over the real
 * masters: every layout a chooser lists draws a picture of its own, a box takes any
 * content so it draws as a neutral box, and only a title, a number and a quote draw a
 * role. The SUSE master is in a private submodule, so it is read when it is on disk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SlideMasterFileV1, SlideMasterV1 } from '@lolly-tools/core';
import { PLAIN_THUMB_MAX, layoutThumb, layoutTiles } from '../../lib/slide-structures-ui.ts';
import { THUMB_CLASS, archetypeThumbSvg } from './archetype-thumb.ts';

const REPO = new URL('../../../../../', import.meta.url);

function masterAt(rel: string): SlideMasterV1 | null {
  const file = fileURLToPath(new URL(rel, REPO));
  if (!existsSync(file)) return null;
  return (JSON.parse(readFileSync(file, 'utf8')) as SlideMasterFileV1).masters[0] ?? null;
}

const LOLLY = masterAt('brands/lolly-start/catalog/assets/lolly/slides/masters.json');
const SUSE = masterAt('brands/suse/catalog/assets/suse/slides/masters.json');
const MASTERS = [LOLLY, SUSE].filter((m): m is SlideMasterV1 => m !== null);

test('the starter master is on disk, so the checks below always run against one master', () => {
  assert.ok(LOLLY);
});

test('no two layouts a chooser lists draw byte-identical pictures, at either tile size', () => {
  for (const master of MASTERS) {
    // What a chooser shows: every tile and the mirror behind a flip. A picture layout
    // arranged like a box layout is folded into the box tile, so it is not shown apart.
    const shown = new Set(layoutTiles(master).flatMap((tile) => (tile.flip ? [tile.id, tile.flip] : [tile.id])));
    for (const width of [96, 128]) {
      const seen = new Map<string, string>();
      for (const archetype of master.archetypes.filter((a) => shown.has(a.id))) {
        const svg = archetypeThumbSvg(master, archetype.id, { width });
        assert.ok(svg, `${master.id} ${archetype.id} draws`);
        const twin = seen.get(svg);
        assert.equal(twin, undefined, `${master.id}: ${archetype.id} draws the same picture as ${twin} at ${width}px`);
        seen.set(svg, archetype.id);
      }
    }
  }
});

/** The marks drawn inside one placeholder box, as the markup between it and the next box. */
function marksAfterBox(svg: string, index: number): string {
  const parts = svg.split(`<rect class="${THUMB_CLASS.placeholder}"`);
  const after = parts[index + 1] ?? '';
  return after.slice(after.indexOf('/>') + 2);
}

test('a box takes any content, so a body box draws the neutral plus, never ruled words', () => {
  for (const master of MASTERS) {
    const svg = archetypeThumbSvg(master, 'columns-3', { width: 128 });
    const archetype = master.archetypes.find((a) => a.id === 'columns-3');
    assert.ok(archetype);
    archetype.placeholders.forEach((ph, i) => {
      const marks = marksAfterBox(svg, i);
      if (ph.role === 'body') {
        // Two crossing bars: a plus, the same in every body box.
        assert.equal((marks.match(/<rect class="arch-mark"/g) ?? []).length, 2, `${master.id} columns-3 body ${i} is a plus`);
      }
      if (ph.role === 'label') assert.equal(marks.includes('arch-mark'), false, 'a label strip is plain');
    });
  }
});

test('only a title, a number and a quote draw a role', () => {
  const master = LOLLY;
  assert.ok(master);
  const bigNumber = archetypeThumbSvg(master, 'big-number', { width: 128 });
  assert.match(bigNumber, /<path class="arch-mark"[^>]*d="M[\d.]+ [\d.]+ L/, 'a numeral');
  const quote = archetypeThumbSvg(master, 'quote', { width: 128 });
  assert.equal((quote.match(/<circle class="arch-mark"/g) ?? []).length, 2, 'two quote marks');
  const content = archetypeThumbSvg(master, 'content', { width: 128 });
  assert.equal(content.includes('<circle'), false, 'no picture in a text layout');
});

test('a layout carries the marks that say what it is for', () => {
  const master = LOLLY;
  assert.ok(master);
  const draw = (id: string): string => archetypeThumbSvg(master, id, { width: 128 });
  // A picture slot takes any content too: the neutral plus, never a picture glyph.
  assert.equal(draw('full-image').includes('<path class="arch-mark"'), false, 'a picture slot draws no picture glyph');
  assert.equal(draw('full-image').includes('<circle'), false, 'no sun over a hill');
  assert.ok((draw('chart').match(/<rect class="arch-mark"/g) ?? []).length >= 5, 'a chart draws bars');
  assert.ok((draw('agenda').match(/<circle class="arch-mark"/g) ?? []).length >= 3, 'an agenda draws bullets');
  assert.equal((draw('columns-3').match(/class="arch-group"/g) ?? []).length, 3, 'three cells outlined');
  assert.ok(/<path class="arch-mark"[^>]*L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ Z/.test(draw('steps-3')), 'steps have chevrons');
  // The rule: a long hairline across the row, thinner than any title rule.
  const hairline = (svg: string): boolean => [...svg.matchAll(/<rect class="arch-mark"[^>]*width="([\d.]+)" height="([\d.]+)"/g)]
    .some((m) => Number(m[1]) > 100 && Number(m[2]) <= 1);
  assert.equal(hairline(draw('timeline')), true, 'the timeline draws its rule');
  assert.equal(hairline(draw('columns-4')), false, 'four boxes have none');
});

test('the tones are fixed, so the picture cannot be repainted by the theme it is shown in', () => {
  for (const master of MASTERS) {
    for (const archetype of master.archetypes) {
      assert.ok(!/var\(|currentColor/.test(archetypeThumbSvg(master, archetype.id, { width: 96 })), `${archetype.id}`);
    }
  }
});

test('a layout with several numbers counts them, and a lone number stays one numeral', () => {
  const master = LOLLY;
  assert.ok(master);
  const counted = master.archetypes.find((a) => a.placeholders.filter((ph) => ph.role === 'number').length > 2);
  assert.ok(counted, 'the starter master has a layout with several numbers');
  const svg = archetypeThumbSvg(master, counted.id, { width: 128 });
  const strokes = [...svg.matchAll(/<path class="arch-mark" fill="none"[^>]*d="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(strokes.length >= 3, `${counted.id} draws its numbers as counted digits`);
  assert.equal(new Set(strokes.map((d) => d?.replace(/[\d.]+/g, '#'))).size, strokes.length, 'each digit is a different shape');
  const lone = archetypeThumbSvg(master, 'big-number', { width: 128 });
  assert.equal(lone.includes('fill="none" stroke'), false, 'a lone big number keeps the one numeral');
});

test('a wireframe drawn with no marks keeps its page, its boxes and its cells, and draws no plus, glyph or rule', () => {
  for (const master of MASTERS) {
    for (const archetype of master.archetypes) {
      const plain = archetypeThumbSvg(master, archetype.id, { width: 32, marks: 'none' });
      assert.equal(plain.includes(`class="${THUMB_CLASS.mark}"`), false, `${master.id} ${archetype.id} draws no mark`);
      assert.ok(plain.includes(`class="${THUMB_CLASS.page}"`), `${archetype.id} keeps its page`);
      assert.equal(
        (plain.match(new RegExp(`class="${THUMB_CLASS.placeholder}"`, 'g')) ?? []).length,
        archetype.placeholders.length,
        `${archetype.id} keeps every box`,
      );
      const groups = new Set(archetype.placeholders.map((ph) => ph.group).filter(Boolean)).size;
      assert.equal((plain.match(new RegExp(`class="${THUMB_CLASS.cell}"`, 'g')) ?? []).length, groups, `${archetype.id} keeps its cell outlines`);
    }
  }
});

test('a tile 40 px wide or less draws no plus, so a small wireframe never reads as an add button', () => {
  const master = LOLLY;
  assert.ok(master);
  const draw = (_m: SlideMasterV1, id: string, opts: { width: number; structure: string; marks?: 'all' | 'none' }): string =>
    archetypeThumbSvg(master, id, opts);
  for (const width of [16, 32, PLAIN_THUMB_MAX]) {
    assert.equal(layoutThumb(master, 'columns-3', width, draw).includes(`class="${THUMB_CLASS.mark}"`), false, `no plus at ${width} px`);
  }
  assert.ok(layoutThumb(master, 'columns-3', 96, draw).includes(`class="${THUMB_CLASS.mark}"`), 'the chooser tile at 96 px keeps its marks');
  assert.notEqual(layoutThumb(master, 'columns-3', 32, draw), layoutThumb(master, 'columns-3', 48, draw), 'the two sizes are cached apart');
});
