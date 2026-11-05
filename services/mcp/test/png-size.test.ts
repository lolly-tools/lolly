// SPDX-License-Identifier: MPL-2.0
/**
 * The MCP server's browser-free PNG follows the requested width AND height, the
 * way its SVG and the CLI's and the TUI's PNG do, and a tool that lays itself out
 * for the canvas size (engine 1.293) draws the same wall into each.
 *
 *  - Logo Wall at 1080 x 1920: the SVG is the tall frame (720 x 1280), and the
 *    PNG is 1080 x 1920 with the logos reaching its lowest quarter, not a 16:9
 *    band across the middle;
 *  - a tool whose root <svg> has a viewBox (QR Code) is drawn at the requested
 *    width and height, its own viewBox placing the content, as the CLI draws it;
 *  - a request with one side keeps the scaling the PNG always had.
 *
 * Run with: node --test services/mcp/test/png-size.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { toolFile } from '@lolly-tools/node-shell/content-roots';
import { render } from '../src/render.ts';

const NO_WALL = !toolFile('logo-wall', 'tool.json') && 'logo-wall is not in this profile';
const NO_QR = !toolFile('qr-code', 'tool.json') && 'qr-code is not in this profile';

/** A PNG's pixel size, from its IHDR chunk. */
function pngSize(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

const logo = (w: number): string => 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect x="${200 - w / 2}" y="60" width="${w}" height="80" fill="#222222"/></svg>`,
).toString('base64');
const wall = 'logos=' + encodeURIComponent(JSON.stringify([320, 60, 200, 120, 260].map((w) => ({ logo: logo(w) })))) + '&balance=false&transparentBg=true';

test('a Logo Wall PNG at 1080 x 1920 is the tall wall, as its SVG is', { skip: NO_WALL }, async () => {
  const svg = await render('logo-wall', wall, { format: 'svg', width: 1080, height: 1920, noBrowser: true });
  const text = new TextDecoder().decode(svg.bytes);
  assert.match(text, /<svg[^>]*viewBox="0 0 720 1280"/, 'the SVG is laid out in the tall frame');

  const png = await render('logo-wall', wall, { format: 'png', width: 1080, height: 1920, noBrowser: true });
  assert.equal(png.tier, 'A(resvg)');
  assert.deepEqual(pngSize(png.bytes), [1080, 1920]);
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(Buffer.from(png.bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let lower = 0;
  for (let y = Math.round(info.height * 0.75); y < info.height; y++) {
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3]! > 0) lower++;
  }
  assert.ok(lower > 1000, `logos drawn in the lowest quarter (${lower} px)`);
});

test('a PNG follows the requested height for a tool with a viewBox, and one side keeps its scaling', { skip: NO_QR }, async () => {
  const query = 'url=https%3A%2F%2Flolly.tools';
  const both = await render('qr-code', query, { format: 'png', width: 600, height: 900, noBrowser: true });
  assert.deepEqual(pngSize(both.bytes), [600, 900]);
  const svg = await render('qr-code', query, { format: 'svg', width: 600, height: 900, noBrowser: true });
  assert.match(new TextDecoder().decode(svg.bytes), /<svg[^>]*\swidth="600(px)?"[^>]*\sheight="900(px)?"|<svg[^>]*\sheight="900(px)?"[^>]*\swidth="600(px)?"/, 'the SVG is the same size');
  const one = await render('qr-code', query, { format: 'png', width: 600, noBrowser: true });
  const [w, h] = pngSize(one.bytes);
  assert.equal(w, 600);
  const own = new TextDecoder().decode((await render('qr-code', query, { format: 'svg', noBrowser: true })).bytes);
  const [, , vw, vh] = /viewBox="([^"]+)"/.exec(own)![1]!.split(/[\s,]+/).map(Number);
  assert.equal(h, Math.round(600 * vh! / vw!), 'the height follows the tool\'s own shape');
});
