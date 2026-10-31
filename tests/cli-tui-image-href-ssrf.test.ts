// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI and the terminal app draw an `<image>` into EMF, EPS, DXF and WMF only
 * from inline bytes: an href that points somewhere is skipped, never fetched.
 *
 * Run with: node --test tests/cli-tui-image-href-ssrf.test.ts
 *
 * Both shells install a real 2D canvas behind their jsdom (installNodeCanvas), and
 * with it the vector walk (packages/node-shell/src/svg-ir.ts) used to call the bare
 * global fetch for every `<image href>`. The same walk runs on the MCP server, where
 * that was a request to any address a caller typed (services/mcp/test/
 * render-image-ssrf.test.ts). Here a local listener stands in for that address:
 *
 *  - the CLI bridge's and the TUI bridge's EMF/EPS/DXF/WMF exports of an `<svg>`
 *    whose `<image>` points at the listener make no request;
 *  - a full `lolly logo-wall` run with a logo URL the CLI cannot read as a picture
 *    makes no more requests for EMF or EPS than for SVG: the only requests are the
 *    asset read the person asked for, never a second one from the vector walk.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'shells', 'cli', 'bin', 'lolly.ts');
const root = await mkdtemp(join(tmpdir(), 'lolly-image-href-'));
after(() => rm(root, { recursive: true, force: true }));
process.env.LOLLY_STATE_DIR = join(root, 'state');

const { isCanvasAvailable, installNodeCanvas } = await import('@lolly-tools/node-shell/canvas');
const SKIP = !isCanvasAvailable() && '@napi-rs/canvas is not installed here';
const NO_WALL = !existsSync(join(ROOT, 'community', 'logo-wall', 'tool.json')) && 'community pack not mounted';

const hits: string[] = [];
const server = createServer((req, res) => {
  hits.push(req.url ?? '');
  // Not a picture, so Logo Wall cannot inline it and keeps the URL in its <image>.
  res.writeHead(404, { 'content-type': 'text/plain' }).end('no');
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;
after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const VECTOR = ['emf', 'eps', 'dxf', 'wmf'];

function svgCanvas(dom: JSDOM, href: string): Element {
  const canvas = dom.window.document.getElementById('canvas')!;
  canvas.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect width="100" height="50" fill="#123456"/><image href="${href}" x="10" y="10" width="40" height="30"/></svg>`;
  return canvas as unknown as Element;
}

async function exportAll(host: HostV1, node: Element): Promise<void> {
  for (const format of VECTOR) {
    const blob = await (host.export as unknown as { render(n: Element, f: string, o?: object): Promise<Blob> }).render(node, format, {});
    assert.ok(blob.size > 0, `${format} written`);
  }
}

test('the CLI bridge draws EMF/EPS/DXF/WMF without fetching an image href', { skip: SKIP }, async () => {
  const { createCliBridge } = await import('../shells/cli/src/bridge.ts');
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>');
  const g = globalThis as unknown as { window?: unknown; document?: unknown; Element?: unknown };
  g.window = dom.window; g.document = dom.window.document; g.Element = dom.window.Element;
  await installNodeCanvas(dom.window as unknown as { HTMLCanvasElement?: { prototype: Record<string, unknown> } });
  const host = await createCliBridge({ dom: dom as never, profile: {} });
  const lines: string[] = [];
  (host as { log: HostV1['log'] }).log = (_level, msg) => { lines.push(msg); };
  hits.length = 0;
  await exportAll(host, svgCanvas(dom, `http://127.0.0.1:${port}/cli/latest/meta-data/`));
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(hits, [], 'the listener heard nothing');
  assert.ok(lines.some((l) => /links to its picture instead of carrying it/.test(l)), 'the skip is reported');
});

test('the TUI bridge draws EMF/EPS/DXF/WMF without fetching an image href', { skip: SKIP }, async () => {
  const { createTuiBridge } = await import('../shells/tui/src/bridge.ts');
  const { host, dom, logs } = await createTuiBridge({});
  hits.length = 0;
  await exportAll(host, svgCanvas(dom, `http://127.0.0.1:${port}/tui/latest/meta-data/`));
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(hits, [], 'the listener heard nothing');
  assert.ok(logs.some((l) => /links to its picture instead of carrying it/.test(l)), 'the skip is reported');
});

function cli(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: root,
      env: { ...process.env, NO_COLOR: '1', LOLLY_WEB_DIST: join(root, 'no-web-shell') },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('close', (code) => resolve({ code: code ?? -1, stderr }));
  });
}

test('a lolly logo-wall run asks for a logo URL no more often for EMF or EPS than for SVG', { skip: SKIP || NO_WALL }, async () => {
  const logos = JSON.stringify([{ logo: { url: `http://127.0.0.1:${port}/run/logo.png`, type: 'raster' } }]);
  const asked = async (format: string): Promise<number> => {
    hits.length = 0;
    const r = await cli(['run', 'logo-wall', `--logos=${logos}`, `--output=wall.${format}`, '--no-provenance']);
    assert.equal(r.code, 0, r.stderr);
    await new Promise((res) => setTimeout(res, 100));
    return hits.length;
  };
  const svg = await asked('svg'), emf = await asked('emf'), eps = await asked('eps');
  assert.equal(emf, svg, `EMF asked ${emf} times, SVG ${svg}`);
  assert.equal(eps, svg, `EPS asked ${eps} times, SVG ${svg}`);
});
