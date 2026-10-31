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
 *  - step & repeat offsets brick rows by half a cell with every row's logos the
 *    same size, and clips at the padding edge;
 *  - tiers group logos in first-appearance order, each under its heading, with
 *    Step down sizing fitting one more logo across each lower tier;
 *  - a canvas of another shape (engine 1.293's ctx.canvasSize, 1080 x 1920 or an
 *    A4 page) lays the wall out in a frame of that shape at mount and again when
 *    the size changes, so the live preview is the wall the export writes;
 *  - an export at a shape other than the canvas's lays the wall out again in a
 *    frame of that shape and puts the canvas back afterwards, while an export at
 *    the canvas's own shape is the canvas as drawn;
 *  - with no canvas the wall still renders and says which steps it skipped;
 *  - text-typed block values ("false", "") read as the words they are, so a
 *    compact share link or a CSV import does not vectorise or hide a logo.
 *
 * Run with: node --test tests/logo-wall.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { JSDOM } from 'jsdom';
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

test('step & repeat offsets brick rows by half a cell and clips at the padding', { skip: SKIP }, async () => {
  const html = await mount({ logos: [{ logo: svgLogo('a.svg') }, { logo: svgLogo('b.svg') }], repeat: 'brick', repeatRows: 3, balance: false });
  assert.match(html, /<clipPath id="lw-clip"><rect x="48" y="48" width="1184" height="624"\/><\/clipPath>/);
  assert.match(html, /<g clip-path="url\(#lw-clip\)">/);
  const boxes = images(html);
  assert.equal(boxes.length, 4 + 5 + 4);
  // Row 2 is shifted left by half a cell plus half a gap, (272 + 32) / 2 = 152, and
  // carries one more cell so both cropped edges stay filled.
  near(boxes[4]!.x, 48 - 152, 'offset row x');
  near(boxes[8]!.x + boxes[8]!.w, 48 + 1184 + 152, 'offset row reaches past the right edge');
  // Every row draws its logos at the same size (an offset row used to be about 14%
  // larger), so each offset cell sits centred under the gap between the two cells above.
  for (const b of boxes) {
    near(b.w, 272, 'cell width');
    near(b.h, boxes[0]!.h, 'cell height');
  }
  for (let c = 0; c < 4; c++) {
    near(boxes[4 + c + 1]!.x + 136, boxes[c]!.x + 272 + 16, `offset cell ${c + 1} centred under the gap`);
  }
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

/**
 * Export the wall from a real DOM node, the way a shell does: hydrate into a node,
 * hand the node to runtime.export and keep the <svg> the shell would have written.
 * `after` is the node once the export is done, and `kept` says whether the logo
 * elements the canvas drew are the same elements afterwards.
 */
async function exportAt(values: Record<string, unknown>, opts: Record<string, unknown>, canvasSize?: { width: number; height: number }) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>');
  const node = dom.window.document.getElementById('c')!;
  let written = '';
  const host = baseHost({
    export: { render: async (n: Element) => { written = n.querySelector('svg')!.outerHTML; return new Blob([written]); } },
  });
  const rt = await createRuntime(tool, host, values as Record<string, InputValue>, canvasSize ? { canvasSize } : {});
  node.innerHTML = rt.getHydrated() as string;
  const before = node.innerHTML;
  const drawn = [...node.querySelectorAll('image')];
  await rt.export(node as unknown as Element, 'svg', { embedMeta: false, ...opts });
  const now = [...node.querySelectorAll('image')];
  return { written, before, after: node.innerHTML, kept: drawn.length === now.length && drawn.every((el, i) => el === now[i]) };
}

const viewBoxOf = (svg: string) => /viewBox="([^"]+)"/.exec(svg)![1]!.split(' ').map(Number);
// A restaged export puts its copies in without the template's line breaks; the
// markup between the tags is what has to match.
const tight = (svg: string) => svg.replace(/>\s+</g, '><');

test('an export at another shape lays the wall out again to fill it', { skip: SKIP }, async () => {
  const logos = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ logo: svgLogo(n + '.svg') }));
  const tall = await exportAt({ logos, balance: false }, { width: 1080, height: 1920 });
  // The frame keeps the canvas's area and takes the export's shape: 1080 x 1920 is
  // 720 x 1280, so padding, gaps and logos keep their size against the picture.
  assert.deepEqual(viewBoxOf(tall.written), [0, 0, 720, 1280]);
  const boxes = images(tall.written);
  assert.equal(boxes.length, 5);
  // Four columns on the wide canvas become two in the tall frame: 3 rows of 2.
  const cw = (720 - 96 - 32) / 2, ch = (1280 - 96 - 2 * 32) / 3;
  near(boxes[0]!.w, cw, 'cell w'); near(boxes[0]!.h, ch, 'cell h');
  near(boxes[1]!.x, 48 + cw + 32, 'second column');
  near(boxes[2]!.x, 48, 'third logo starts row 2'); near(boxes[2]!.y, 48 + ch + 32, 'row 2 y');
  near(boxes[4]!.y + boxes[4]!.h, 1280 - 48, 'the last row reaches the bottom padding');
  // The canvas is put back as it was drawn, the same elements and the same markup.
  assert.equal(tall.after, tall.before);
  assert.ok(tall.kept, 'the drawn logo elements are back in place');
});

test('an A4 export lays tiers and headings out on the page', { skip: SKIP }, async () => {
  const logos = [
    { logo: svgLogo('g1.svg'), tier: 'Gold' }, { logo: svgLogo('g2.svg'), tier: 'Gold' },
    { logo: svgLogo('s1.svg'), tier: 'Silver' }, { logo: svgLogo('s2.svg'), tier: 'Silver' }, { logo: svgLogo('s3.svg'), tier: 'Silver' },
  ];
  const page = await exportAt({ logos, balance: false }, { width: '210mm', height: '297mm' });
  const [, , w, h] = viewBoxOf(page.written);
  near(w! / h!, 210 / 297, 'the page shape');
  assert.ok(Math.abs(w! * h! / (1280 * 720) - 1) < 1e-4, 'the canvas area');
  const heads = [...page.written.matchAll(/<text class="lw-heading"[^>]*\sx="([^"]+)"[^>]*\sy="([^"]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(heads.length, 2);
  for (const [x] of heads) near(x!, w! / 2, 'heading centred on the page');
  const boxes = images(page.written);
  assert.equal(boxes.length, 5);
  for (const b of boxes) assert.ok(b.x >= 48 - 0.01 && b.x + b.w <= w! - 48 + 0.01, 'inside the side padding');
  assert.ok(heads[1]![1]! > boxes[1]!.y + boxes[1]!.h, 'the Silver heading sits below the Gold row');
  assert.equal(page.after, page.before);
});

test('an export at the canvas shape is the canvas as drawn', { skip: SKIP }, async () => {
  const logos = ['a', 'b', 'c'].map((n) => ({ logo: svgLogo(n + '.svg') }));
  for (const opts of [{}, { width: 1920, height: 1080 }, { width: 2560 }]) {
    const r = await exportAt({ logos, balance: false }, opts);
    assert.equal(r.written, /<svg[\s\S]*<\/svg>/.exec(r.before)![0], JSON.stringify(opts));
  }
});

test('a backdrop exported at another shape adapts its rows and its clip', { skip: SKIP }, async () => {
  const r = await exportAt({ logos: [{ logo: svgLogo('a.svg') }, { logo: svgLogo('b.svg') }], repeat: 'brick', repeatRows: 6, balance: false }, { width: 1080, height: 1920 });
  assert.ok(r.written.includes('<clipPath id="lw-clip"><rect x="48" y="48" width="624" height="1184">'), 'the clip follows the frame');
  const boxes = images(r.written);
  // 2 columns and 11 rows: brick rows alternate 2 and 3 logos.
  assert.equal(boxes.length, 6 * 2 + 5 * 3);
  for (const b of boxes) near(b.w, boxes[0]!.w, 'every row the same size');
  assert.equal(r.after, r.before);
});

test('a canvas of another shape draws the wall the export used to restage', { skip: SKIP }, async () => {
  assert.equal(tool.manifest.render.followsCanvasSize, true, 'the engine re-runs the wall when the size changes');
  const logos = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ logo: svgLogo(n + '.svg') }));
  // A 1.6.0-style export: a 16:9 canvas laid out again for 1080 x 1920 in beforeExport.
  const restaged = await exportAt({ logos, balance: false }, { width: 1080, height: 1920 });
  // The canvas told its size at mount draws that wall live, and its export moves nothing.
  const live = await exportAt({ logos, balance: false }, { width: 1080, height: 1920 }, { width: 1080, height: 1920 });
  assert.deepEqual(viewBoxOf(live.before), [0, 0, 720, 1280], 'the live canvas is the tall frame');
  assert.equal(tight(live.written), tight(restaged.written), 'the live wall is the wall the export wrote');
  assert.equal(live.written, /<svg[\s\S]*<\/svg>/.exec(live.before)![0], 'nothing restaged');
  assert.ok(live.kept);
  // A4: tiers and headings on the page, live.
  const tiered = [
    { logo: svgLogo('g1.svg'), tier: 'Gold' }, { logo: svgLogo('g2.svg'), tier: 'Gold' },
    { logo: svgLogo('s1.svg'), tier: 'Silver' }, { logo: svgLogo('s2.svg'), tier: 'Silver' }, { logo: svgLogo('s3.svg'), tier: 'Silver' },
  ];
  const a4 = { width: 210 * 96 / 25.4, height: 297 * 96 / 25.4 };
  const page = await exportAt({ logos: tiered, balance: false }, { width: '210mm', height: '297mm' }, a4);
  const pageOld = await exportAt({ logos: tiered, balance: false }, { width: '210mm', height: '297mm' });
  assert.equal(tight(page.written), tight(pageOld.written), 'the A4 page is the page 1.6.0 exported');
  assert.equal(page.written, /<svg[\s\S]*<\/svg>/.exec(page.before)![0]);
  assert.deepEqual(headings(page.before), ['Gold', 'Silver']);
});

test('a change of canvas size lays the wall out again, live', { skip: SKIP }, async () => {
  const logos = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ logo: svgLogo(n + '.svg') }));
  const rt = await createRuntime(tool, baseHost(), { logos, balance: false } as Record<string, InputValue>);
  const wide = rt.getHydrated() as string;
  assert.deepEqual(viewBoxOf(wide), [0, 0, 1280, 720]);
  await rt.setCanvasSize({ width: 1080, height: 1920 });
  const tall = rt.getHydrated() as string;
  assert.deepEqual(viewBoxOf(tall), [0, 0, 720, 1280]);
  // Four columns on the wide canvas become two in the tall frame: 3 rows of 2.
  const boxes = images(tall);
  const cw = (720 - 96 - 32) / 2;
  near(boxes[0]!.w, cw, 'cell w');
  near(boxes[2]!.x, 48, 'third logo starts row 2');
  // The same shape at another size is the manifest's frame, and back again.
  await rt.setCanvasSize({ width: 1920, height: 1080 });
  assert.equal(rt.getHydrated(), wide);
  await rt.setCanvasSize(null);
  assert.equal(rt.getHydrated(), wide);
  rt.destroy();
});

test('an export at another shape than the canvas still lays the wall out for it', { skip: SKIP }, async () => {
  const logos = ['a', 'b', 'c'].map((n) => ({ logo: svgLogo(n + '.svg') }));
  // A tall canvas exported at 16:9 (a batch row asking for a size of its own).
  const r = await exportAt({ logos, balance: false }, { width: 1920, height: 1080 }, { width: 1080, height: 1920 });
  assert.deepEqual(viewBoxOf(r.before), [0, 0, 720, 1280]);
  assert.deepEqual(viewBoxOf(r.written), [0, 0, 1280, 720]);
  const plain = await exportAt({ logos, balance: false }, {});
  assert.equal(tight(r.written), tight(/<svg[\s\S]*<\/svg>/.exec(plain.before)![0]), 'the 16:9 wall, as a 16:9 canvas draws it');
  assert.equal(r.after, r.before, 'the tall canvas is put back');
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

test('the example looks draw the tool\'s own placeholder files', { skip: SKIP }, async () => {
  // The gallery tile and its looks render from manifest.examples. Every picture in
  // them is one of community/logo-wall/assets/*.svg, named by its path (a tool
  // asset id, packages/node-shell/src/tool-asset-id.ts), and every file there is
  // used, so a renamed or orphaned file fails here.
  const dir = join(COMMUNITY, 'logo-wall', 'assets');
  const files = (await readdir(dir)).filter((n) => n.endsWith('.svg')).sort();
  assert.ok(files.length >= 8, 'a wall needs a pile of placeholder logos');
  const used = new Set<string>();
  const looks = tool.manifest.examples as { values: { logos: { logo: { id: string } }[] } }[];
  assert.ok(looks.length >= 1);
  for (const look of looks) {
    for (const row of look.values.logos) {
      const m = /^\/tools\/logo-wall\/assets\/([a-z0-9-]+\.svg)$/.exec(row.logo.id);
      assert.ok(m && files.includes(m[1]!), `${row.logo.id} is one of the tool's placeholder files`);
      used.add(m![1]!);
    }
  }
  assert.deepEqual([...used].sort(), files, 'every placeholder file is used');
  for (const name of files) {
    const svg = await readFile(join(dir, name), 'utf8');
    assert.match(svg, /<title>Placeholder logo<\/title>/, name);
    assert.doesNotMatch(svg, /<(text|image|use|style|script)\b|href=/, `${name} is outlines only`);
  }
  // The first look is a tiered wall: it renders with its headings, in this host too.
  const html = await mount(looks[0]!.values as Record<string, unknown>);
  assert.deepEqual(headings(html), ['Gold partners', 'Silver partners', 'Supporters']);
  assert.equal(images(html).length, looks[0]!.values.logos.length);
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
