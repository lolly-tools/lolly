// SPDX-License-Identifier: MPL-2.0
/**
 * A local or self-hosted MCP server draws with the same 2D canvas the CLI installs
 * behind its jsdom (packages/node-shell/src/canvas.ts), so a tool hook that reads
 * pixels runs here instead of skipping the step. Logo Wall is the reference: with a
 * canvas, Balance sizes, Trim margins and Remove white backgrounds run and no
 * "needs pixel access" warning is written.
 *
 * The Vercel function is the exception, and that is pinned where it is decided:
 * scripts/build-mcp-fn.ts aliases the canvas import to a module that refuses to
 * load and fails the build on any other way in, so there the install answers false.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { isCanvasAvailable } from '@lolly-tools/node-shell/canvas';
import { toolFile } from '@lolly-tools/node-shell/content-roots';
import { loadTool } from '../../../engine/src/loader.ts';
import { createRuntime } from '../../../engine/src/runtime.ts';
import { withHost } from '../src/host.ts';

const NO_CANVAS = !isCanvasAvailable() && '@napi-rs/canvas is not installed here';
const NO_TOOL = !toolFile('logo-wall', 'tool.json') && 'logo-wall is not in this profile';

/** An SVG logo with wide margins, so trimming has something to measure away. */
function logo(w: number, fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect x="${200 - w / 2}" y="60" width="${w}" height="80" fill="${fill}"/></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

test('each render gets a working 2D canvas behind its jsdom', { skip: NO_CANVAS }, async () => {
  const drawn = await withHost({}, async (dom) => {
    const c = dom.window.document.createElement('canvas');
    c.width = 4; c.height = 4;
    const ctx = c.getContext('2d');
    assert.ok(ctx, 'getContext("2d") answers');
    ctx!.fillStyle = '#ff0000';
    ctx!.fillRect(0, 0, 4, 4);
    return Array.from(ctx!.getImageData(1, 1, 1, 1).data);
  });
  assert.deepEqual(drawn, [255, 0, 0, 255]);
});

test('Logo Wall balances and trims on the server, with no pixel warnings', { skip: NO_CANVAS || NO_TOOL }, async () => {
  const tool = await loadTool('logo-wall', (p: string) => {
    const [id, ...rest] = p.split('/');
    return readFile(toolFile(id!, rest.join('/'))!, 'utf8');
  });
  const logs: string[] = [];
  const html = await withHost({}, async (_dom, host) => {
    (host as { log: unknown }).log = (_level: string, msg: string) => { logs.push(msg); };
    const values = { logos: [{ logo: { source: 'remote', id: logo(320, '#111111'), _unresolved: true } }, { logo: { source: 'remote', id: logo(60, '#111111'), _unresolved: true } }] };
    const rt = await createRuntime(tool, host, values as never);
    return rt.getHydrated() as string;
  });
  assert.doesNotMatch(logs.join('\n'), /needs pixel access/);
  const widths = [...html.matchAll(/<image\b[^>]*\swidth="([^"]+)"/g)].map((m) => Number(m[1]));
  assert.equal(widths.length, 2);
  // Balance sizes: the wide bar covers less of its bounding square than the narrow
  // one, so it reads lighter and is drawn larger. Without a canvas both are equal.
  assert.ok(widths[0]! > widths[1]! * 1.2, `balanced widths ${widths.join(', ')}`);
  // Trim margins: each picture is its artwork, its viewBox cut down from the file's.
  const boxes = [...html.matchAll(/href="data:image\/svg\+xml;base64,([^"]+)"/g)]
    .map((m) => /viewBox="([^"]+)"/.exec(Buffer.from(m[1]!, 'base64').toString('utf8'))?.[1]);
  assert.equal(boxes.length, 2);
  for (const vb of boxes) assert.notEqual(vb, '0 0 400 200', 'trimmed to the artwork');
});
