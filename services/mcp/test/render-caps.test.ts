// SPDX-License-Identifier: MPL-2.0
/**
 * What one lolly_render call may cost on a hosted server: the PNG area cap, and
 * the SVG answer's preview, which is drawn from the SVG already made at a small
 * fixed size instead of repeating the render at the requested size.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOSTED_MAX_RASTER_PIXELS, PREVIEW_MAX_PIXELS, maxRasterPixelsFor, previewPng } from '../src/render.ts';
import { callTool } from '../src/tools.ts';

function pngSize(bytes: Uint8Array): { w: number; h: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: view.getUint32(16), h: view.getUint32(20) };
}

test('area cap: hosted default, none locally, env override, 0 turns it off', () => {
  assert.equal(maxRasterPixelsFor({}, true), HOSTED_MAX_RASTER_PIXELS);
  assert.equal(maxRasterPixelsFor({}, false), undefined);
  assert.equal(maxRasterPixelsFor({ LOLLY_MCP_MAX_RASTER_PIXELS: '1000000' }, true), 1_000_000);
  assert.equal(maxRasterPixelsFor({ LOLLY_MCP_MAX_RASTER_PIXELS: '0' }, true), undefined);
});

test('the preview never exceeds its own small area, whatever the SVG size', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="4000"><rect width="8000" height="4000" fill="#0c5"/></svg>';
  const { w, h } = pngSize(await previewPng(svg));
  assert.ok(w * h <= PREVIEW_MAX_PIXELS, `${w} x ${h}`);
  assert.equal(Math.round(w / h), 2, 'aspect kept');
});

test('the preview draws in a child process: a picture it cannot draw fails alone (plans/289 D6)', async () => {
  const { RasterCrash } = await import('@lolly-tools/node-shell/raster-child');
  await assert.rejects(previewPng('<svg this is not an SVG'), (e: unknown) => e instanceof RasterCrash);
  // The server process is still here and still draws.
  const { w } = pngSize(await previewPng('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20"/></svg>'));
  assert.equal(w, 40, 'a small SVG is never scaled up');
});

test('a hosted lolly_render PNG is held to the area cap and says so', async () => {
  process.env.LOLLY_MCP_HOSTED = '1';
  try {
    const res = await callTool('lolly_render', { toolId: 'qr-code', inputs: { url: 'https://lolly.tools/cap' }, format: 'png', width: 6000, link: false });
    assert.ok(!res.isError, JSON.stringify(res.content[0]));
    const header = (res.content[0] as { text: string }).text;
    assert.match(header, /reduced to \d+ x \d+ px/);
    const image = res.content.find(c => c.type === 'image') as { data: string };
    const { w, h } = pngSize(Buffer.from(image.data, 'base64'));
    assert.ok(w * h <= HOSTED_MAX_RASTER_PIXELS, `${w} x ${h}`);
  } finally {
    delete process.env.LOLLY_MCP_HOSTED;
  }
});

test('an SVG answer at a large requested size carries a small preview', async () => {
  const res = await callTool('lolly_render', { toolId: 'qr-code', inputs: { url: 'https://lolly.tools/preview' }, format: 'svg', width: 9000, link: false });
  assert.ok(!res.isError);
  const image = res.content.find(c => c.type === 'image') as { data: string } | undefined;
  assert.ok(image, 'a PNG preview is attached');
  const { w, h } = pngSize(Buffer.from(image.data, 'base64'));
  assert.ok(w * h <= PREVIEW_MAX_PIXELS, `${w} x ${h}`);
  assert.ok(res.content.some(c => c.type === 'resource'), 'the SVG itself is attached');
});
