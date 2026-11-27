// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for exportFormatDriver (shells/web/src/views/export-format.ts) - the
 * manifest→export-formats mapping that lets a "mode" select (e.g. a unified filter
 * tool's effect picker) narrow the download bar to the selected option's formats,
 * while render.formats stays the union.
 *
 * Run with: node --test tests/export-format.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { exportFormatDriver } from '../shells/web/src/views/export-format.ts';
import { formatsForValues } from '../shells/web/src/lib/export-format-driver.ts';
import { displayFormatOf } from '../shells/web/src/lib/preview-formats.ts';

test('detects a select whose options carry `formats` and maps each value to its list', () => {
  const d = exportFormatDriver({
    inputs: [
      { id: 'image', type: 'asset' },
      {
        id: 'effect', type: 'select', options: [
          { value: 'halftone', label: 'Halftone', badge: 'vector', formats: ['svg', 'pdf', 'png'] },
          { value: 'duotone', label: 'Duotone', badge: 'raster', formats: ['png', 'jpg', 'webp'] },
        ],
      },
    ],
  } as any)!;
  assert.equal(d.id, 'effect');
  assert.deepEqual(d.formats.halftone, ['svg', 'pdf', 'png']);
  assert.deepEqual(d.formats.duotone, ['png', 'jpg', 'webp']);
});

test('only includes options that carry a non-empty formats list', () => {
  const d = exportFormatDriver({
    inputs: [{
      id: 'effect', type: 'select', options: [
        { value: 'a', formats: ['svg'] },
        { value: 'b', label: 'no formats' },
        { value: 'c', formats: [] },
      ],
    }],
  } as any)!;
  assert.deepEqual(Object.keys(d.formats), ['a']);
});

test('returns null when no select carries formats', () => {
  assert.equal(exportFormatDriver({ inputs: [{ id: 'x', type: 'select', options: [{ value: 'a' }] }] } as any), null);
  assert.equal(exportFormatDriver({ inputs: [] }), null);
  assert.equal(exportFormatDriver({}), null);
});

test('picks the first qualifying select (one format driver per tool)', () => {
  const d = exportFormatDriver({
    inputs: [
      { id: 'first', type: 'select', options: [{ value: 'a', formats: ['png'] }] },
      { id: 'second', type: 'select', options: [{ value: 'b', formats: ['svg'] }] },
    ],
  } as any)!;
  assert.equal(d.id, 'first');
});

// ── formatsForValues: the list that applies to one look ───────────────────────
// A thumbnail of a look is drawn in the first displayable format of this list. Read
// from the tool's whole list, a raster-only look of a tool that also exports SVG was
// walked as SVG, which cannot see a canvas a shader draws into.

const MODES = {
  inputs: [
    { id: 'count', type: 'number', default: 5 },
    {
      id: 'mode', type: 'select', default: 'blend', options: [
        { value: 'blend', label: 'Blend', formats: ['svg', 'png', 'jpeg'] },
        { value: 'field', label: 'Field', formats: ['png', 'jpg', 'webm'] },
        { value: 'plain', label: 'Plain' },
      ],
    },
  ],
} as any;
const TOOL = ['svg', 'penpot', 'png', 'jpg', 'webm', 'pdf'];

test('formatsForValues narrows the tool list by the look\'s own option, in the tool\'s order', () => {
  assert.deepEqual(formatsForValues(MODES, { mode: 'field' }, TOOL), ['png', 'jpg', 'webm']);
  assert.deepEqual(formatsForValues(MODES, { mode: 'blend' }, TOOL), ['svg', 'png', 'jpg'], 'jpeg and jpg meet as one');
  assert.equal(displayFormatOf(formatsForValues(MODES, { mode: 'field' }, TOOL)), 'png', 'a raster-only look is previewed as a raster');
  assert.equal(displayFormatOf(formatsForValues(MODES, { mode: 'blend' }, TOOL)), 'svg', 'a vector look stays a vector');
});

test('formatsForValues: values that leave the select alone take its default', () => {
  assert.deepEqual(formatsForValues(MODES, { count: 3 }, TOOL), ['svg', 'png', 'jpg']);
  assert.deepEqual(formatsForValues(MODES, null, TOOL), ['svg', 'png', 'jpg']);
});

test('formatsForValues keeps the tool list when nothing narrows, and never returns an empty one', () => {
  assert.equal(formatsForValues(MODES, { mode: 'plain' }, TOOL), TOOL, 'an option with no list');
  assert.equal(formatsForValues(MODES, { mode: 'nonsense' }, TOOL), TOOL, 'a value that is no option');
  assert.equal(formatsForValues(MODES, { mode: 'constructor' }, TOOL), TOOL, 'a value that is an object key and no option');
  assert.equal(formatsForValues({ inputs: [{ id: 'a', type: 'text' }] } as any, { a: 1 }, TOOL), TOOL, 'a tool with no driving select');
  assert.deepEqual(formatsForValues(MODES, { mode: 'field' }, ['png']), ['png']);
  const cover = ['mp3'];
  assert.equal(formatsForValues(MODES, { mode: 'field' }, cover), cover, 'nothing in common: the list given stands');
  assert.equal(formatsForValues(MODES, { mode: 'field' }, undefined), undefined);
});

test('every Gradient Field starter is previewed as a raster, and the other starters as SVG', () => {
  const dir = new URL('../community/gradient/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('tool.json', dir), 'utf8'));
  const starter = (id: string) => JSON.parse(readFileSync(new URL(`templates/${id}.json`, dir), 'utf8')).values;
  for (const id of ['cathedral-rays', 'lava-lamp', 'liquid-silk', 'mercury-contours', 'neural-drift', 'prismatic-bloom', 'smoke-halo', 'velvet-warp']) {
    assert.equal(starter(id).mode, 'field');
    assert.equal(displayFormatOf(formatsForValues(manifest, starter(id), manifest.render.formats)), 'png', id);
  }
  assert.equal(displayFormatOf(formatsForValues(manifest, starter('sunrise'), manifest.render.formats)), 'svg');
  assert.equal(displayFormatOf(manifest.render.formats), 'svg', 'the tool\'s whole list alone would say SVG for every starter');
});
