// SPDX-License-Identifier: MPL-2.0
/**
 * Logo Wall (community/logo-wall) - the <svg> wall, its tiers and its manners on a
 * host with no canvas.
 *
 * Loads the REAL tool from disk and drives it through the engine with the shared
 * base host, which has no host.raster: exactly the lean CLI or a hosted MCP server.
 * What is pinned here:
 *  - the template's root drawable is an <svg> at the canvas size (1280 x 720), which
 *    is what lets the CLI, the TUI and the MCP server export it with no browser;
 *  - an untiered wall places every logo where the pre-1.5.0 CSS grid did: equal
 *    columns and rows inside the padding, the logo box size% of its cell, centred;
 *  - step & repeat keeps the brick quirk of the old flex rows (offset rows are a
 *    share of the WIDER row), and clips at the padding edge;
 *  - tiers group logos in first-appearance order, each under its heading, with
 *    Step down sizing fitting one more logo across each lower tier;
 *  - with no canvas the wall still renders and says which steps it skipped;
 *  - text-typed block values ("false", "") read as the words they are, so a
 *    compact share link or a CSV import does not vectorise or hide a logo.
 *
 * Run with: node --test tests/logo-wall.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import type { InputValue } from '../engine/src/inputs.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');
const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'logo-wall', 'tool.json')),
    'community/logo-wall/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}
const tool: any = SKIP ? null : await loadTool('logo-wall', fetchFile);

/** A tiny SVG logo as a baked ref, the shape a web upload or the CLI produces. */
function svgLogo(name: string, w = 200, h = 100): Record<string, unknown> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#e2231a"/></svg>`;
  return { source: 'user', id: name, type: 'vector', format: 'svg', url: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), meta: { baked: true, name } };
}
/** A raster logo ref (the bytes are never decoded here: the host has no canvas). */
function pngLogo(name: string): Record<string, unknown> {
  return { source: 'user', id: name, type: 'raster', format: 'png', url: 'data:image/png;base64,iVBORw0KGgo=', meta: { baked: true, name } };
}

interface Box { x: number; y: number; w: number; h: number; index: number; label: string }

/** Every <image> the wall drew, in document order. */
function images(html: string): Box[] {
  return [...html.matchAll(/<image\b([^>]*)>/g)].map((m) => {
    const attr = (n: string) => new RegExp(`\\s${n}="([^"]*)"`).exec(m[1]!)?.[1] ?? '';
    return {
      x: Number(attr('x')), y: Number(attr('y')), w: Number(attr('width')), h: Number(attr('height')),
      index: Number(/logos:(\d+)/.exec(attr('data-canvas-input'))?.[1] ?? -1), label: attr('aria-label'),
    };
  });
}

/** The tier headings, in document order. */
function headings(html: string): string[] {
  return [...html.matchAll(/<text class="lw-heading"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);
}

async function mount(values: Record<string, unknown>, logs: string[] = []) {
  const rt = await createRuntime(tool, baseHost({ log: (_level: string, msg: string) => { logs.push(msg); } }), values as Record<string, InputValue>);
  return rt.getHydrated() as string;
}

const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 0.02, `${msg}: ${a} vs ${b}`);

test('the wall is one <svg> at the canvas size, so it exports with no browser', { skip: SKIP }, async () => {
  assert.equal(tool.manifest.render.width, 1280);
  assert.equal(tool.manifest.render.height, 720);
  const html = await mount({ logos: [{ logo: svgLogo('a.svg') }], balance: false });
  assert.match(html.trimStart(), /^<svg class="lw-svg"[^>]*viewBox="0 0 1280 720"[^>]*width="1280" height="720"/);
  // The empty-state invite never reaches a file: it is an HTML layer marked
  // data-export-hide, and it is absent once a logo is on the wall.
  assert.doesNotMatch(html, /lw-empty/);
  const empty = await mount({});
  assert.match(empty, /class="lw-empty-layer" data-export-hide/);
  assert.match(empty.trimStart(), /^<svg class="lw-svg"/);
});

test('an untiered wall places logos where the old CSS grid did', { skip: SKIP }, async () => {
  const logos = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ logo: svgLogo(n + '.svg') }));
  logos[4] = { ...logos[4], presence: 'hero' } as typeof logos[4];
  const html = await mount({ logos });
  const boxes = images(html);
  assert.equal(boxes.length, 5);
  // 4 columns of (1280 - 2x48 - 3x32) / 4 = 272; 2 rows of (720 - 2x48 - 32) / 2 = 296.
  near(boxes[0]!.x, 48, 'cell 1 x'); near(boxes[0]!.y, 48, 'cell 1 y');
  near(boxes[0]!.w, 272, 'cell 1 w'); near(boxes[0]!.h, 296, 'cell 1 h');
  near(boxes[3]!.x, 48 + 3 * (272 + 32), 'cell 4 x');
  // Hero is x1.6 on both axes, centred on its cell (row 2, column 1), spilling past the cell.
  near(boxes[4]!.w, 272 * 1.6, 'hero w'); near(boxes[4]!.h, 296 * 1.6, 'hero h');
  near(boxes[4]!.x, 48 + (272 - 272 * 1.6) / 2, 'hero x');
  near(boxes[4]!.y, 48 + 296 + 32 + (296 - 296 * 1.6) / 2, 'hero y');
  assert.deepEqual(boxes.map((b) => b.index), [0, 1, 2, 3, 4]);
  assert.match(html, /preserveAspectRatio="xMidYMid meet"/);
});

test('greyscale and opacity travel as SVG, and a block without an image leaves no gap', { skip: SKIP }, async () => {
  const html = await mount({ logos: [{ logo: svgLogo('a.svg'), filter: 'grayscale', opacity: 0.5 }, { logo: null }, { logo: svgLogo('b.svg') }] });
  assert.match(html, /<filter id="lw-grey" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"\/><\/filter>/);
  const tags = [...html.matchAll(/<image\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(tags.length, 2);
  assert.match(tags[0]!, /opacity="0.5"/);
  assert.match(tags[0]!, /filter="url\(#lw-grey\)"/);
  assert.doesNotMatch(tags[1]!, /filter=/);
  assert.deepEqual(images(html).map((b) => b.index), [0, 2]);
});

test('step & repeat keeps the brick offset rows and clips at the padding', { skip: SKIP }, async () => {
  const html = await mount({ logos: [{ logo: svgLogo('a.svg') }, { logo: svgLogo('b.svg') }], repeat: 'brick', repeatRows: 2, balance: false });
  assert.match(html, /<clipPath id="lw-clip"><rect x="48" y="48" width="1184" height="624"\/><\/clipPath>/);
  assert.match(html, /<g clip-path="url\(#lw-clip\)">/);
  const boxes = images(html);
  assert.equal(boxes.length, 4 + 5);
  // Row 2 is shifted left by half a cell plus half a gap, (272 + 32) / 2 = 152, and its
  // cells are a quarter of the widened row: (1184 + 152 - 96) / 4 = 310.
  near(boxes[4]!.x, 48 - 152, 'offset row x');
  near(boxes[4]!.w, 310, 'offset row cell w');
  near(boxes[0]!.w, 272, 'plain row cell w');
});

test('tiers group the wall in first-appearance order, under headings', { skip: SKIP }, async () => {
  const logos = [
    { logo: svgLogo('g1.svg'), tier: 'Gold partners' },
    { logo: svgLogo('s1.svg'), tier: 'Silver' },
    { logo: svgLogo('g2.svg'), tier: '  gold   PARTNERS ' },   // same tier: case and spacing ignored
    { logo: svgLogo('s2.svg'), tier: 'Silver' },
    { logo: svgLogo('n1.svg'), tier: '' },                     // a blank tier is its own group, with no heading
  ];
  const html = await mount({ logos, balance: false });
  assert.deepEqual(headings(html), ['Gold partners', 'Silver']);
  const boxes = images(html);
  assert.deepEqual(boxes.map((b) => b.label), ['g1.svg', 'g2.svg', 's1.svg', 's2.svg', 'n1.svg']);
  // Click-to-focus still finds each logo's own block.
  assert.deepEqual(boxes.map((b) => b.index), [0, 2, 1, 3, 4]);
  // Step down: Gold fits 4 across, Silver 5, the blank group 6, so each lower tier's
  // cells are narrower; rows are centred.
  const goldW = boxes[0]!.w, silverW = boxes[2]!.w, restW = boxes[4]!.w;
  near(goldW, (1184 - 3 * 32) / 4, 'gold cell');
  near(silverW, (1184 - 4 * 32) / 5, 'silver cell');
  near(restW, (1184 - 5 * 32) / 6, 'last cell');
  near(boxes[0]!.x, 48 + (1184 - (2 * goldW + 32)) / 2, 'gold row centred');
  assert.ok(boxes[0]!.y < boxes[2]!.y && boxes[2]!.y < boxes[4]!.y, 'tiers stack top to bottom');
  // The heading takes the brand's text colour input, as a fill the paint binding can follow.
  assert.match(html, /<text class="lw-heading"[^>]*text-anchor="middle"[^>]*fill="[^"]+"/);
});

test('tier headings and tier sizes follow their inputs', { skip: SKIP }, async () => {
  const logos = [{ logo: svgLogo('a.svg'), tier: 'Gold' }, { logo: svgLogo('b.svg'), tier: 'Silver' }];
  const off = await mount({ logos, tierHeadings: false, balance: false });
  assert.deepEqual(headings(off), []);
  const even = images(await mount({ logos, tierSizing: 'even', balance: false }));
  near(even[0]!.w, even[1]!.w, 'same size across tiers');
  // Step & repeat ignores tiers: a backdrop cycles the set in its own order.
  const repeat = await mount({ logos, repeat: 'grid', balance: false });
  assert.deepEqual(headings(repeat), []);
});

test('an untiered wall is unchanged by the tier inputs', { skip: SKIP }, async () => {
  const logos = ['a', 'b', 'c'].map((n) => ({ logo: svgLogo(n + '.svg') }));
  const plain = images(await mount({ logos, balance: false }));
  const toggled = images(await mount({ logos, balance: false, tierHeadings: false, tierSizing: 'even' }));
  assert.deepEqual(toggled, plain);
});

test('with no canvas the wall renders and names the steps it skipped', { skip: SKIP }, async () => {
  const logs: string[] = [];
  const html = await mount({ logos: [{ logo: svgLogo('a.svg') }, { logo: pngLogo('b.png'), vectorize: true }] }, logs);
  assert.equal(images(html).length, 2, 'both logos drawn as pictures');
  const all = logs.join('\n');
  assert.match(all, /Trim margins needs pixel access/);
  assert.match(all, /Remove white backgrounds needs pixel access/);
  assert.match(all, /Balance sizes needs pixel access/);
  assert.match(all, /Render as vector needs pixel access to trace an image logo[^\n]*1 image logo stays a picture/);
});

test('block values typed as text read as words', { skip: SKIP }, async () => {
  // The compact link form and a CSV import carry every field as a string.
  const html = await mount({ logos: [{ logo: svgLogo('a.svg'), vectorize: 'false', opacity: '', scale: '', presence: '' }], balance: false });
  const [box] = images(html);
  assert.ok(box, 'a "false" vectorize keeps the picture');
  near(box!.w, 272, 'an empty Size % is the default 100');
  assert.doesNotMatch(html, /opacity=/, 'an empty opacity is the default 1');
});

test('a catalog or remote logo is carried as its own bytes', { skip: SKIP }, async () => {
  const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>');
  const host = baseHost({
    assets: {
      get: async (id: string) => ({ id, url: '/catalog/assets/' + id + '.svg', type: 'vector', format: 'svg' }),
      bytes: async () => bytes,
    },
  });
  const rt = await createRuntime(tool, host, { logos: [{ logo: { source: 'library', id: 'acme/logo', _unresolved: true } }], balance: false });
  const html = rt.getHydrated() as string;
  assert.match(html, /href="data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(html, /\/catalog\/assets\//);
});
