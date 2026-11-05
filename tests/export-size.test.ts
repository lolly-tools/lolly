// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for exportSizeDriver (shells/web/src/views/export-size.ts) - the
 * manifest→export-dimensions mapping that lets a "size" select set the printed
 * page size (so choosing "A6 landscape" actually exports A6 landscape).
 *
 * Also runs the REAL event-name-badge manifest through it, so the badge's size
 * options stay wired to export dims.
 *
 * Run with: node --test tests/export-size.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { exportSizeDriver, aspectWarning, linkExportSize } from '../shells/web/src/views/export-size.ts';
import type { LinkExportSizeSources } from '../shells/web/src/views/export-size.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The real-manifest tests read tools that ship in the (private) SUSE brand pack; under a
// checkout without it (public CI) they can't run. Gate on the SOURCE pack, not through the
// content resolver: with the pack mounted, a missing tool means it was renamed or deleted -
// FAIL, don't skip.
const SUSE_TOOLS = join(ROOT, 'brands', 'suse', 'tools');
const PACK_MOUNTED = existsSync(SUSE_TOOLS);
const SKIP_SUSE = !PACK_MOUNTED && 'SUSE brand pack not mounted (see profiles.json)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(SUSE_TOOLS, 'event-name-badge', 'tool.json')),
    'brands/suse/tools/event-name-badge/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}
// multi-page-pdf moved to the public community pack (2026-08-16), present in every checkout.
assert.ok(existsSync(join(ROOT, 'community', 'multi-page-pdf', 'tool.json')),
  'community/multi-page-pdf/tool.json is missing - the tool was renamed or deleted');

test('detects a select whose options carry width/height and maps each value to dims', () => {
  const d = exportSizeDriver({
    inputs: [
      { id: 'name', type: 'text' },
      {
        id: 'size', type: 'select', options: [
          { value: 'a6', label: 'A6', width: 105, height: 148, unit: 'mm' },
          { value: 'a6land', label: 'A6 landscape', width: 148, height: 105, unit: 'mm' },
        ],
      },
    ],
  } as any)!;
  assert.equal(d.id, 'size');
  assert.deepEqual(d.dims.a6, { width: 105, height: 148, unit: 'mm' });
  assert.deepEqual(d.dims.a6land, { width: 148, height: 105, unit: 'mm' });
});

test("defaults a dimensioned option's unit to mm when omitted", () => {
  const d = exportSizeDriver({
    inputs: [{ id: 'size', type: 'select', options: [{ value: 'x', width: 100, height: 200 }] }],
  } as any)!;
  assert.equal(d.dims.x!.unit, 'mm');
});

test('only includes options that carry both width and height', () => {
  const d = exportSizeDriver({
    inputs: [{
      id: 'size', type: 'select', options: [
        { value: 'sized', width: 50, height: 60, unit: 'mm' },
        { value: 'plain', label: 'No dims' },
        { value: 'partial', width: 50 },
      ],
    }],
  } as any)!;
  assert.deepEqual(Object.keys(d.dims), ['sized']);
});

test('returns null when no select carries dimensions', () => {
  assert.equal(exportSizeDriver({ inputs: [{ id: 'status', type: 'select', options: [{ value: 'a' }] }] } as any), null);
  assert.equal(exportSizeDriver({ inputs: [] }), null);
  assert.equal(exportSizeDriver({}), null);
});

test('picks the first qualifying select (one size driver per tool)', () => {
  const d = exportSizeDriver({
    inputs: [
      { id: 'first', type: 'select', options: [{ value: 'a', width: 1, height: 2 }] },
      { id: 'second', type: 'select', options: [{ value: 'b', width: 3, height: 4 }] },
    ],
  } as any)!;
  assert.equal(d.id, 'first');
});

// ── aspectWarning ────────────────────────────────────────────────────────────

const GUARD = { render: { aspectWarning: { max: 1, message: 'portrait only' } } };

test('aspectWarning fires when the aspect ratio exceeds max (landscape)', () => {
  assert.equal(aspectWarning(GUARD, 297, 210), 'portrait only'); // A4 landscape, aspect 1.41
});

test('aspectWarning stays silent for an in-band (portrait) size', () => {
  assert.equal(aspectWarning(GUARD, 210, 297), null); // A4 portrait, aspect 0.71
});

test('aspectWarning tolerates an exactly-on-the-bound size (1:1 at max 1)', () => {
  assert.equal(aspectWarning(GUARD, 500, 500), null); // epsilon keeps a square from tripping max:1
});

test('aspectWarning honours a min bound (too tall)', () => {
  const g = { render: { aspectWarning: { min: 0.5, message: 'too tall' } } };
  assert.equal(aspectWarning(g, 100, 300), 'too tall'); // aspect 0.33 < 0.5
  assert.equal(aspectWarning(g, 100, 150), null);        // aspect 0.67 ok
});

test('aspectWarning returns null with no config or invalid dimensions', () => {
  assert.equal(aspectWarning({ render: {} }, 297, 210), null);
  assert.equal(aspectWarning(GUARD, 0, 210), null);
  assert.equal(aspectWarning(GUARD, 297, 0), null);
  assert.equal(aspectWarning(GUARD, undefined as any, undefined as any), null);
});

test('the real multi-page-pdf manifest warns on landscape but not portrait', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'community', 'multi-page-pdf/tool.json'), 'utf8'));
  assert.ok(manifest.render.aspectWarning, 'manifest declares an aspect guard');
  // The removed A4-landscape size (297 × 210) is exactly what the guard should catch.
  assert.ok(aspectWarning(manifest, 297, 210));
  // Every remaining page-size preset is portrait, so none should trip the guard.
  const pageSize = manifest.inputs.find((i: any) => i.id === 'pageSize');
  assert.equal(pageSize.options.some((o: any) => o.value === 'a4l'), false, 'A4 landscape preset is gone');
  for (const o of pageSize.options) {
    assert.equal(aspectWarning(manifest, o.width, o.height), null, `${o.value} should not warn`);
  }
});

test('the real event-name-badge manifest wires its size select to export dims', { skip: SKIP_SUSE }, () => {
  const manifest = JSON.parse(readFileSync(join(SUSE_TOOLS, 'event-name-badge/tool.json'), 'utf8'));
  const d = exportSizeDriver(manifest)!;
  assert.equal(d.id, 'size');
  // A6 landscape must export 148 × 105 mm - the exact case the user flagged.
  assert.deepEqual(d.dims.a6land, { width: 148, height: 105, unit: 'mm' });
  // The default (4×6 in) maps to its mm trim size.
  assert.deepEqual(d.dims['4x6in'], { width: 101.6, height: 152.4, unit: 'mm' });
  // Every option carries dims.
  assert.equal(manifest.inputs.find((i: any) => i.id === 'size').options.every((o: any) => d.dims[o.value]), true);
});

// ── Link exports (`?format=png&export`) ────────────────────────────────────────
// A link export used to write the tool's render box whatever the size select held:
// `#/tool/certificate?pageSize=story&format=png&export` came out 1123 x 794, the story
// layout cropped to the A4 box. linkExportSize reads the size the way the export bar
// does, and these pin its precedence.

const RENDER = { width: 1123, height: 794 };
const sources = (over: Partial<LinkExportSizeSources> = {}): LinkExportSizeSources => ({
  link: {}, session: {}, option: null, optionMoved: false, render: RENDER, ...over,
});

test('a link export takes the size select option the tool holds (Certificate story)', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'community/certificate/tool.json'), 'utf8'));
  const driver = exportSizeDriver(manifest)!;
  assert.equal(driver.id, 'pageSize');
  const story = linkExportSize(sources({ option: driver.dims.story! }));
  assert.deepEqual(story, { width: 1080, height: 1920, canvas: { width: 1080, height: 1920 } });
  // A4 landscape is a print size: millimetres at 300 DPI, laid out at its CSS px size.
  const a4 = linkExportSize(sources({ option: driver.dims['a4-landscape']! }));
  assert.equal(a4.width, '297mm');
  assert.equal(a4.height, '210mm');
  assert.equal(a4.dpi, 300);
  assert.ok(Math.abs(a4.canvas!.width - 1122.52) < 0.01 && Math.abs(a4.canvas!.height - 793.7) < 0.01, JSON.stringify(a4.canvas));
});

test('a link export takes Stationery\'s piece, not the card-sized render box', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'community/stationery/tool.json'), 'utf8'));
  const driver = exportSizeDriver(manifest)!;
  assert.equal(driver.id, 'piece');
  const letterhead = linkExportSize(sources({ option: driver.dims.letterhead!, render: { width: 850, height: 550 } }));
  assert.deepEqual([letterhead.width, letterhead.height, letterhead.dpi], ['210mm', '297mm', 300]);
});

test('explicit link width and height win over the size select, side by side as before', () => {
  const option = { width: 1080, height: 1920, unit: 'px' };
  assert.deepEqual(linkExportSize(sources({ link: { width: 800, height: 600 }, option })),
    { width: 800, height: 600, canvas: { width: 800, height: 600 } });
  // A side the link leaves out keeps the render box, as the old path did.
  const half = linkExportSize(sources({ link: { width: 800 }, option }));
  assert.equal(half.width, 800);
  assert.equal(half.height, RENDER.height);
  // A physical unit qualifies the link's sides and takes the link's DPI.
  const mm = linkExportSize(sources({ link: { width: 100, height: 50, unit: 'mm', dpi: 600 }, option }));
  assert.deepEqual([mm.width, mm.height, mm.dpi], ['100mm', '50mm', 600]);
});

test('a link unit alone re-expresses the size it would have written', () => {
  const a4 = { width: 297, height: 210, unit: 'mm' };
  const px = linkExportSize(sources({ link: { unit: 'px' }, option: a4 }));
  assert.equal(px.dpi, undefined, 'px carries no DPI');
  assert.ok(Math.abs(Number(px.width) - 1122.5197) < 1e-3 && Math.abs(Number(px.height) - 793.7008) < 1e-3, `${px.width} x ${px.height}`);
  const inch = linkExportSize(sources({ link: { unit: 'in', dpi: 150 }, option: a4 }));
  assert.deepEqual([inch.width, inch.height, inch.dpi], ['11.6929in', '8.2677in', 150]);
});

test('a reopened session keeps its saved size until the size select moves', () => {
  const session = { width: 148, height: 105, unit: 'mm', dpi: 600 };
  const option = { width: 1080, height: 1920, unit: 'px' };
  const kept = linkExportSize(sources({ session, option }));
  assert.deepEqual([kept.width, kept.height, kept.dpi], ['148mm', '105mm', 600]);
  const moved = linkExportSize(sources({ session, option, optionMoved: true }));
  assert.deepEqual([moved.width, moved.height, moved.dpi], [1080, 1920, undefined]);
  // Moved to an option with no dimensions (calendar-ics' list view): the render box,
  // which is what the export bar falls back to as well.
  const bare = linkExportSize(sources({ session, optionMoved: true }));
  assert.deepEqual([bare.width, bare.height], [RENDER.width, RENDER.height]);
});

test('with nothing to go on a link export writes the render box at screen pixels', () => {
  assert.deepEqual(linkExportSize(sources()), { width: 1123, height: 794, canvas: { width: 1123, height: 794 } });
});

// A size option with no unit is read as millimetres (exportSizeDriver), which is right
// for the print badges written that way and wrong for pixel sizes: Battlecards' 1200 x 900
// landscape showed in the export bar as 1200 x 900 mm and a link export wrote a 14,173 px
// PNG. Every community size option says its unit, so the default never has to guess.
test('every community size option declares its unit', async () => {
  const { readdirSync } = await import('node:fs');
  const missing: string[] = [];
  for (const id of readdirSync(join(ROOT, 'community'))) {
    const file = join(ROOT, 'community', id, 'tool.json');
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    const driver = exportSizeDriver(manifest);
    if (!driver) continue;
    const input = manifest.inputs.find((i: { id: string }) => i.id === driver.id);
    for (const o of input.options) if (o.width > 0 && o.height > 0 && !o.unit) missing.push(`${id}.${driver.id}=${o.value}`);
  }
  assert.deepEqual(missing, []);
});
