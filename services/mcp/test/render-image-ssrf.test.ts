// SPDX-License-Identifier: MPL-2.0
/**
 * A hosted render never fetches a picture the caller named, outside the guarded
 * public reader, and never decodes one bigger than the server's pixel limits.
 *
 * Run with: node --test services/mcp/test/render-image-ssrf.test.ts
 *
 *  - Logo Wall keeps a URL it could not read in its `<image href>`. With the realm
 *    canvas installed, the EMF/EPS/DXF walk used to fetch that href with the
 *    bare global fetch, so `logos=[{logo:{url:"http://169.254.169.254/..."}}]`
 *    made the server request its own network. A local listener stands in for the
 *    metadata address and must hear nothing, for each of those the server draws.
 *  - A ~150-byte SVG logo that declares 20000 x 20000 pixels is refused before a
 *    canvas is made (it was a 1.6 GB allocation), the render still succeeds, and
 *    the answer gives which picture was left out and why.
 *  - Several refused logos are counted in the answer, each once however often the
 *    tool asked for it, rather than folded into one sentence that hides how many.
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isCanvasAvailable, HOSTED_DECODE_MAX_PIXELS } from '@lolly-tools/node-shell/canvas';
import { toolFile } from '@lolly-tools/node-shell/content-roots';
import { render } from '../src/render.ts';

const NO_CANVAS = !isCanvasAvailable() && '@napi-rs/canvas is not installed here';
const NO_WALL = !toolFile('logo-wall', 'tool.json') && 'logo-wall is not in this profile';

const hits: string[] = [];
const server = createServer((req, res) => {
  hits.push(`${req.method} ${req.url}`);
  res.writeHead(200, { 'content-type': 'image/png' }).end();
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;
after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const query = (logos: unknown[]): string => 'logos=' + encodeURIComponent(JSON.stringify(logos));

test('a logo URL to a local listener makes no request, in any vector format', { skip: NO_CANVAS || NO_WALL }, async () => {
  const logos = [{ logo: { url: `http://127.0.0.1:${port}/latest/meta-data/`, type: 'raster' } }];
  for (const format of ['svg', 'emf', 'eps', 'dxf']) {
    const out = await render('logo-wall', query(logos), { format, noBrowser: true });
    assert.ok(out.bytes.length > 0, `${format} rendered`);
  }
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(hits, [], 'the listener heard nothing');
});

test('a logo that declares a huge canvas is refused before it is decoded', { skip: NO_CANVAS || NO_WALL }, async () => {
  const prev = process.env.LOLLY_MCP_HOSTED;
  process.env.LOLLY_MCP_HOSTED = '1';
  try {
    const huge = 'data:image/svg+xml;base64,' + Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20000" height="20000"><rect width="20000" height="20000" fill="#222"/></svg>',
    ).toString('base64');
    const small = 'data:image/svg+xml;base64,' + Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200"><rect x="100" y="60" width="200" height="80" fill="#222"/></svg>',
    ).toString('base64');
    const before = process.memoryUsage().rss;
    const out = await render('logo-wall', query([{ logo: huge }, { logo: small }]), { format: 'svg', noBrowser: true });
    const grew = process.memoryUsage().rss - before;
    assert.ok(out.bytes.length > 0, 'the wall still renders');
    const said = out.warnings.join('\n');
    assert.match(said, /A 20000 x 20000 picture was not decoded: this server decodes pictures of up to 16,777,216 pixels\./);
    assert.ok(grew < 20000 * 20000 * 4 / 2, `no 20000 x 20000 canvas was allocated (rss grew ${Math.round(grew / 1e6)} MB)`);
    assert.equal(HOSTED_DECODE_MAX_PIXELS, 4096 * 4096);
  } finally {
    if (prev === undefined) delete process.env.LOLLY_MCP_HOSTED; else process.env.LOLLY_MCP_HOSTED = prev;
  }
});

test('the answer counts every logo the limits left out, each once', { skip: NO_CANVAS || NO_WALL }, async () => {
  const prev = process.env.LOLLY_MCP_HOSTED;
  process.env.LOLLY_MCP_HOSTED = '1';
  try {
    const declared = (w: number, h: number): string => 'data:image/svg+xml;base64,' + Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#222"/></svg>`,
    ).toString('base64');
    const sizes: Array<[number, number]> = [[20000, 20000], [30000, 10000], [9000, 9000]];
    const out = await render('logo-wall', query(sizes.map(([w, h]) => ({ logo: declared(w, h) }))), { format: 'svg', noBrowser: true });
    assert.ok(out.bytes.length > 0, 'the wall still renders');
    const said = out.warnings.filter((w) => /not decoded/.test(w));
    assert.equal(said.length, 1, `one sentence for the one limit: ${said.join(' | ')}`);
    assert.match(said[0]!, /^3 pictures were not decoded: this server decodes pictures of up to 16,777,216 pixels, and these are larger \(/);
    for (const [w, h] of sizes) assert.ok(said[0]!.includes(`${w} x ${h}`), `${w} x ${h} is listed`);
  } finally {
    if (prev === undefined) delete process.env.LOLLY_MCP_HOSTED; else process.env.LOLLY_MCP_HOSTED = prev;
  }
});
