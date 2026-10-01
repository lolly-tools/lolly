// SPDX-License-Identifier: MPL-2.0
/**
 * The looking tools (look.ts, plans/289 section 6): lolly_look, lolly_sample_color
 * and lolly_trace_edges, driven through dispatch() like mcp.test.ts. Browser-free:
 * the tool renders use qr-code's own SVG, and the rest use supplied images.
 *
 * Run with: node --test services/mcp/test/look.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { dispatch } from '../src/server.ts';
import { withHost } from '../src/host.ts';
import { cleanImageRefs } from '../src/look.ts';
import { contentImageRoots } from '../src/paths.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';

let nextId = 5000;
interface ToolResult { content: { type: string; text?: string; mimeType?: string; data?: string }[]; isError?: boolean }
async function call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } })) as JsonRpcResponse;
  assert.ok(!res.error, `${name} errored: ${JSON.stringify(res.error)}`);
  return res.result as unknown as ToolResult;
}
const ok = (r: ToolResult, what: string) => assert.ok(!r.isError, `${what}: ${JSON.stringify(r.content).slice(0, 400)}`);
const json = (r: ToolResult) => JSON.parse(r.content[1]!.text!);
const b64 = (s: string | Uint8Array) => Buffer.from(s).toString('base64');
function decodePng(data: string) {
  const img = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${data}"/></svg>`).render();
  return img;
}
function pngSize(data: string): [number, number] {
  const b = Buffer.from(data, 'base64');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

// A 400 x 200 document: red left, blue right, a green 40 x 40 square at 300,80.
const DOC = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">'
  + '<rect width="200" height="200" fill="#ff0000"/><rect x="200" width="200" height="200" fill="#0000ff"/>'
  + '<rect x="300" y="80" width="40" height="40" fill="#00ff00"/></svg>';
const docFile = { base64: b64(DOC), name: 'doc.svg', mime: 'image/svg+xml' };

test('tools/list carries the three looking tools with their schemas', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: { name: string; inputSchema: { properties: Record<string, unknown> } }[] }).tools;
  for (const name of ['lolly_look', 'lolly_sample_color', 'lolly_trace_edges']) {
    const t = tools.find(x => x.name === name);
    assert.ok(t, `missing ${name}`);
    for (const p of ['toolId', 'inputs', 'file', 'layerOperations']) assert.ok(p in t!.inputSchema.properties, `${name}.${p}`);
  }
});

test('look: a tool render with a grid, at the document\'s own size, in document units', async () => {
  const r = await call('lolly_look', { toolId: 'qr-code', inputs: { url: 'https://lolly.tools' } });
  ok(r, 'look qr');
  assert.match(r.content[0]!.text!, /Looking at qr-code \(svg\): document x 0, y 0, \d+ x \d+\./);
  assert.match(r.content[0]!.text!, /Grid every \d+ units/);
  assert.match(r.content[0]!.text!, /document units/);
  assert.equal(r.content[1]!.type, 'image');
  assert.equal(r.content[1]!.mimeType, 'image/png');
});

test('look: a region is enlarged to fill maxSide and shows only what is in it', async () => {
  const r = await call('lolly_look', { file: docFile, region: { x: 290, y: 70, w: 60, h: 60 }, maxSide: 300, grid: false });
  ok(r, 'look region');
  assert.match(r.content[0]!.text!, /region x 290, y 70, 60 x 60 at 300 x 300 px \(5 px per unit\)/);
  assert.match(r.content[0]!.text!, /No grid\./);
  const img = decodePng(r.content[1]!.data!);
  const px = (x: number, y: number) => [...img.pixels.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];
  assert.deepEqual(px(150, 150), [0, 255, 0], 'the green square fills the middle');
  assert.deepEqual(px(10, 10), [0, 0, 255], 'blue around it');
});

test('look: a raster file is measured in its own pixels', async () => {
  const png = new Resvg(DOC).render().asPng();
  const r = await call('lolly_look', { file: { base64: b64(png), name: 'doc.png' }, grid: 100 });
  ok(r, 'look png');
  assert.match(r.content[0]!.text!, /document x 0, y 0, 400 x 200/);
  assert.match(r.content[0]!.text!, /Coordinates are the pixels of this image/);
  assert.match(r.content[0]!.text!, /Grid every 100 units/);
  assert.deepEqual(pngSize(r.content[1]!.data!), [400, 200]);
});

test('sample: colours at points, transparent and outside said plainly', async () => {
  const r = await call('lolly_sample_color', { file: docFile, points: [[50, 50], [320, 100], [250, 20], [900, 900]], radius: 3 });
  ok(r, 'sample');
  const out = json(r);
  assert.deepEqual(out.samples.map((s: { hex: string | null }) => s.hex), ['#ff0000', '#00ff00', '#0000ff', null]);
  assert.equal(out.samples[3].note, 'outside the document');
  assert.match(r.content[0]!.text!, /\(320, 100\): #00ff00/);
});

test('sample: a design-system colour is named as a match', async () => {
  const swatches = await withHost({}, async (_dom, host) => (await host.tokens?.colors?.()) ?? []) as { value: string; name?: string }[];
  const swatch = swatches.find(s => /^#[0-9a-f]{6}$/i.test(s.value));
  assert.ok(swatch, 'both shipped catalogs carry colour tokens');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${swatch.value}"/></svg>`;
  const r = await call('lolly_sample_color', { file: { base64: b64(svg) }, points: [[5, 5]] });
  ok(r, 'sample swatch');
  const near = json(r).samples[0].nearest;
  assert.equal(near.verdict, 'match');
  assert.equal(near.deltaE, 0);
  assert.equal(near.value.toLowerCase(), swatch.value.toLowerCase());
  assert.match(r.content[0]!.text!, /matches/);
});

test('trace: the square comes back as one closed outline in document units, and as a Design layer', async () => {
  const r = await call('lolly_trace_edges', { file: docFile, region: { x: 260, y: 40, w: 120, h: 120 }, asDesignLayers: true, maxSide: 480 });
  ok(r, 'trace');
  const out = json(r);
  const square = out.lines.find((l: { closed: boolean }) => l.closed);
  assert.ok(square, `a closed outline among ${out.lines.length} lines`);
  for (const [x, y] of square.points as [number, number][]) {
    const nearSide = Math.min(Math.abs(x - 300), Math.abs(x - 340), Math.abs(y - 80), Math.abs(y - 120));
    assert.ok(nearSide < 2, `point ${x},${y} lies on the square's edge`);
  }
  assert.ok(Math.abs(square.length - 160) < 16, `perimeter about 160 units (${square.length})`);
  assert.equal(square.layer.kind, 'path');
  assert.ok(Math.abs(square.layer.x - 300) < 2 && Math.abs(square.layer.w - 40) < 3);
  // The layer is accepted by Design as it stands, once it has an id.
  const v = await call('lolly_validate', { toolId: 'design', layerOperations: [{ op: 'add', layer: { id: 'traced', ...square.layer } }] });
  ok(v, 'validate traced layer');
  assert.equal(JSON.parse(v.content[0]!.text!).ok, true);
});

test('a supplied SVG cannot make the server draw a file from its disk', async () => {
  // A real image inside the repo, referenced by absolute path and by file URL.
  const onDisk = join(contentImageRoots()[0]!, '..', '..', '..', 'community', 'darkroom', 'icon.svg');
  for (const href of [onDisk, `file://${onDisk}`]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="${href}" width="64" height="64"/></svg>`;
    const r = await call('lolly_sample_color', { file: { base64: b64(svg) }, points: [[32, 32]], radius: 20 });
    ok(r, 'sample local ref');
    assert.equal(json(r).samples[0].hex, null, `nothing drawn for ${href}`);
  }
  // The same reference hidden inside a nested data: SVG.
  const inner = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="${onDisk}" width="64" height="64"/></svg>`;
  const outer = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="data:image/svg+xml;base64,${b64(inner)}" width="64" height="64"/></svg>`;
  const r = await call('lolly_sample_color', { file: { base64: b64(outer) }, points: [[32, 32]], radius: 20 });
  assert.equal(json(r).samples[0].hex, null, 'nothing drawn through a nested SVG');
});

test('cleaning: fragments and data images stay; a local file is inlined only from inside the content roots', async () => {
  const roots = contentImageRoots();
  const inside = join(roots[0]!, 'previews', 'qr-code.svg');
  const cleaned = await cleanImageRefs(
    `<svg><use href="#a"/><image href="data:image/png;base64,iVBORw0KGgo="/><image xlink:href='${inside}'/>`
    + `<image href="/etc/hosts"/><image href="https://example.com/x.png"/><image href="&#47;etc&#47;x.png"/></svg>`,
    roots,
  );
  assert.match(cleaned, /<use href="#a"\/>/);
  assert.match(cleaned, /href="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(cleaned, /xlink:href="data:image\/svg\+xml;base64,/, 'a catalog preview is inlined');
  assert.equal((cleaned.match(/href=""/g) ?? []).length, 3, 'outside paths, remote URLs and encoded paths are dropped');
  assert.doesNotMatch(await cleanImageRefs(`<svg><image href="${inside}"/></svg>`, []), /data:/, 'a supplied file gets no local inlining at all');
});

test('errors: no source, both sources, bad points', async () => {
  assert.match((await call('lolly_look', {})).content[0]!.text!, /Give a toolId with its inputs/);
  assert.ok((await call('lolly_look', { toolId: 'qr-code', file: docFile })).isError);
  assert.ok((await call('lolly_sample_color', { file: docFile, points: [['a', 1]] })).isError);
  assert.ok((await call('lolly_look', { file: { base64: b64('not an image') } })).isError);
});
