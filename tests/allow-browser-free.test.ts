// SPDX-License-Identifier: MPL-2.0
/**
 * `--allow-browser-free` (plan 371): refusal stays the default on the browser-free raster
 * route, and the flag lets the user accept a picture that may differ from the app's,
 * never one that would be wrong. One table sorts every reason (resvg-admission.ts
 * `REFUSAL_EFFECT`), for the tool route and the Design page route alike.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { acceptRefusals, admitTierA, noBrowserAdvice, REFUSAL_EFFECT, type ResvgRefusalCode } from '../packages/node-shell/src/resvg-admission.ts';
import { acceptedRoute, BROWSER_FREE_ACCEPTED, nodeRouteEnvironment } from '../packages/node-shell/src/export-route.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';

const ROOT = join(import.meta.dirname, '..');

/** The CLI with no browser tier: no web build, no desktop app. */
function cli(dir: string, args: string[]) {
  const env: Record<string, string | undefined> = {
    ...process.env, LOLLY_PROFILE: 'lolly-demo', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1',
    LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_RENDERER: 'chromium',
  };
  delete env.LOLLY_WEB_BASE; delete env.LOLLY_DESIGN_RASTER; delete env.LOLLY_EXPORT_ROUTE;
  return spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, env });
}

test('every reason is sorted into may differ or would be wrong, and the flag accepts only the first', () => {
  for (const [code, effect] of Object.entries(REFUSAL_EFFECT) as [ResvgRefusalCode, string][]) {
    const one = [{ code, reason: code }];
    assert.ok('refused' in acceptRefusals(one, false), `${code}: refused without the flag`);
    assert.equal('accepted' in acceptRefusals(one, true), effect === 'may-differ', `${code}: ${effect}`);
  }
  // The reasons the maintainer named as wrong rather than different are never accepted, nor
  // what resvg was measured to leave blank or misplace: live text, an animation, a CSS transform.
  for (const code of ['picture-type', 'canvas-pixels', 'draft-mark', 'paged', 'live-text', 'css-animation', 'css-transform'] as const) assert.equal(REFUSAL_EFFECT[code], 'wrong', code);
  // One reason that would be wrong keeps the whole picture off the route.
  assert.ok('refused' in acceptRefusals([{ code: 'unmeasured', reason: 'a' }, { code: 'picture-type', reason: 'b' }], true));
  assert.deepEqual(acceptRefusals([], false), { accepted: [] }, 'nothing refused: the route draws, flag or not');
  // The way forward offers the flag only where the flag can help.
  assert.match(noBrowserAdvice([{ code: 'unmeasured', reason: 'a' }]), /`lolly install-browser`.*or pass --allow-browser-free to accept a browser-free render that may differ/);
  assert.doesNotMatch(noBrowserAdvice([{ code: 'paged', reason: 'a' }]), /--allow-browser-free/);
  assert.match(noBrowserAdvice([{ code: 'paged', reason: 'a' }]), /`lolly install-browser`.*would be wrong, not just different/);
});

test('with the flag, a WebP picture, the DRAFT mark, canvas pixels and a paged document are still refused', async () => {
  const dom = new JSDOM('<div id="canvas"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"></svg></div>');
  const root = dom.window.document.getElementById('canvas')!;
  const plain = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" width="40" height="20"><rect width="40" height="20" fill="#1c7ed6"/></svg>';
  const webp = plain.replace('</svg>', '<image href="data:image/webp;base64,UklGRhYAAABXRUJQVlA4TAoAAAAvAAAAAP8BAP8B" width="4" height="4"/></svg>');
  const unmeasured = { id: 'x-tool', browserFree: false, untrusted: false };
  const admit = (extra: Partial<Parameters<typeof admitTierA>[0]>, svg = plain, draft = false) => admitTierA({
    root, drawn: null, width: 40, height: 20, tool: unmeasured, accept: true,
    exportSvg: async ({ onDraftMark }) => { onDraftMark(draft); return svg; },
    ...extra,
  });
  const drawn = await admit({});
  assert.ok(drawn && 'svg' in drawn, 'an unmeasured tool only may differ: drawn with the flag');
  assert.deepEqual(drawn.accepted?.map((r) => r.code), ['unmeasured']);
  const cases: Array<[string, Awaited<ReturnType<typeof admit>>, ResvgRefusalCode]> = [
    ['a WebP picture', await admit({}, webp), 'picture-type'],
    ['the DRAFT mark', await admit({}, plain, true), 'draft-mark'],
    ['canvas pixels', await admit({ pixelWork: () => 1 }), 'canvas-pixels'],
    ['a paged document', await admit({ paged: true }), 'paged'],
  ];
  for (const [what, result, code] of cases) {
    assert.ok(result && 'refusals' in result, `${what}: refused with the flag`);
    assert.ok(result.refusals.some((r) => r.code === code), `${what}: ${result.refusals.map((r) => r.code).join(', ')}`);
  }
  const moved = plain.replace('<rect ', '<rect style="transform:translateX(30px)" ');
  const transformed = await admit({}, moved);
  assert.ok(transformed && 'refusals' in transformed && transformed.refusals.some((r) => r.code === 'css-transform'), 'a CSS transform resvg ignores is refused with the flag');
  const noFlag = await admitTierA({ root, drawn: null, width: 40, height: 20, tool: unmeasured, exportSvg: async () => plain });
  assert.ok(noFlag && 'refusals' in noFlag, 'no flag: refused as before');
  // With no browser tier (`thorough`), the whole drawing is read, so the advice offers the
  // flag only where the flag would draw the picture.
  const quick = await admitTierA({ root, drawn: null, width: 40, height: 20, tool: unmeasured, exportSvg: async () => webp });
  assert.deepEqual(quick && 'refusals' in quick ? quick.refusals.map((r) => r.code) : null, ['unmeasured'], 'a browser tier will take it: stopped at the first reason');
  const full = await admitTierA({ root, drawn: null, width: 40, height: 20, tool: unmeasured, thorough: true, exportSvg: async () => webp });
  assert.ok(full && 'refusals' in full);
  assert.deepEqual(full.refusals.map((r) => r.code), ['unmeasured', 'picture-type']);
  assert.doesNotMatch(noBrowserAdvice(full.refusals), /--allow-browser-free/);
  dom.window.close();
});

test('the route record carries the acceptance, and only when something was accepted', () => {
  const tool = acceptedRoute({ renderer: 'resvg-js-2.6.2' });
  assert.deepEqual(nodeRouteEnvironment(tool), { renderer: 'resvg-js-2.6.2', accepted: BROWSER_FREE_ACCEPTED }, 'a tool other than Design: renderer and acceptance, no route');
  const design = acceptedRoute({ route: 'operations' as const, renderer: 'design-draw-v9+resvg-js-2.6.2' });
  assert.deepEqual(nodeRouteEnvironment(design), { route: 'operations', renderer: 'design-draw-v9+resvg-js-2.6.2', accepted: BROWSER_FREE_ACCEPTED });
  assert.deepEqual(nodeRouteEnvironment({ route: 'operations', renderer: 'design-draw-v9+resvg-js-2.6.2' }), { route: 'operations', renderer: 'design-draw-v9+resvg-js-2.6.2' }, 'nothing accepted: the record is unchanged');
  assert.deepEqual(nodeRouteEnvironment({ renderer: 'resvg-js-2.6.2' }), {}, 'a tool picture with nothing accepted records no route, as before');
});

test('the CLI refuses by default with both ways forward; with the flag it draws, warns and records the acceptance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-allow-browser-free-'));
  try {
    // Colour Palette was measured outside the bands: a reason that only may differ.
    const out = join(dir, 'palette.png');
    const refused = cli(dir, ['color-palette', '--width=600', '--height=600', `--output=${out}`]);
    assert.equal(refused.status, 3, refused.stderr);
    assert.match(refused.stderr, /has not been measured inside the fidelity bands/);
    assert.match(refused.stderr, /To go on, install a browser render tier \(`lolly install-browser`, or the Lolly desktop app\) for the app's own render, or pass --allow-browser-free to accept a browser-free render that may differ\./);
    assert.equal(existsSync(out), false, 'nothing written by default');

    const accepted = cli(dir, ['color-palette', '--width=600', '--height=600', `--output=${out}`, '--allow-browser-free']);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(accepted.stderr, /Warning: this PNG was drawn without a browser because --allow-browser-free was given, and it may differ from the app's: the color-palette tool has not been measured/);
    const report = await verifyC2pa(new Uint8Array(readFileSync(out))) as { environment?: Record<string, unknown> };
    assert.equal(report.environment?.accepted, BROWSER_FREE_ACCEPTED, 'the credential records the acceptance');
    assert.match(String(report.environment?.renderer), /^resvg-js-\d/);

    // Under --strict the acceptance is a gate warning, so the run says no.
    const strict = cli(dir, ['color-palette', '--width=600', '--height=600', `--output=${join(dir, 'strict.png')}`, '--allow-browser-free', '--strict']);
    assert.equal(strict.status, 4, strict.stderr);

    // Print Sheet is a paged document: drawn here its pages would be the wrong size.
    const sheet = join(dir, 'sheet.png');
    const paged = cli(dir, ['print-sheet', '--width=600', '--height=600', `--output=${sheet}`, '--allow-browser-free']);
    assert.equal(paged.status, 3, paged.stderr);
    assert.match(paged.stderr, /--allow-browser-free does not apply here: drawn without a browser, the picture would be wrong, not just different, because a paged document/);
    assert.match(paged.stderr, /To go on, install a browser render tier \(`lolly install-browser`, or the Lolly desktop app\): drawn without a browser, this picture would be wrong, not just different\./);
    assert.equal(existsSync(sheet), false);
    // The same through the browser-free BMP, which reads the same facts.
    const bmp = join(dir, 'sheet.bmp');
    const pagedBmp = cli(dir, ['print-sheet', '--export=bmp', '--width=600', '--height=600', `--output=${bmp}`, '--allow-browser-free']);
    assert.notEqual(pagedBmp.status, 0, pagedBmp.stderr);
    assert.match(pagedBmp.stderr, /a paged document/);
    assert.equal(existsSync(bmp), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the flag changes nothing for a render the route admits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-allow-browser-free-admitted-'));
  try {
    const plain = join(dir, 'plain.png'), flagged = join(dir, 'flagged.png');
    const a = cli(dir, ['qr-code', '--url=https://lolly.tools', '--width=400', '--height=400', `--output=${plain}`, '--no-provenance']);
    const b = cli(dir, ['qr-code', '--url=https://lolly.tools', '--width=400', '--height=400', `--output=${flagged}`, '--no-provenance', '--allow-browser-free']);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.doesNotMatch(b.stderr, /Warning:/);
    assert.ok(readFileSync(plain).equals(readFileSync(flagged)), 'byte-equal with and without the flag');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a Design page\'s vector picture is read inside: a picture it holds is left out, so the flag does not draw the page', async () => {
  const { designSvgRefusals } = await import('../packages/node-shell/src/design-still.ts');
  const inner = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/></svg>';
  const page = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><image href="data:image/svg+xml;base64,${Buffer.from(inner).toString('base64')}" width="10" height="10"/></svg>`;
  const found = designSvgRefusals(page).map((r) => r.code);
  assert.ok(found.includes('picture-in-picture'), found.join(', '));
  assert.ok('refused' in acceptRefusals(designSvgRefusals(page), true));
  const plainPicture = page.replace(Buffer.from(inner).toString('base64'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h1v1z"/></svg>').toString('base64'));
  assert.deepEqual(designSvgRefusals(plainPicture).map((r) => r.code), ['vector-picture'], 'a plain vector picture only differs at its edges');
  // This route draws a picture's own bytes, so a variable it holds is refused, not rewritten.
  const variable = page.replace(Buffer.from(inner).toString('base64'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="var(--brand, #008657)" d="M0 0h1v1z"/></svg>').toString('base64'));
  assert.ok(designSvgRefusals(variable).some((r) => r.code === 'css-variable'));
  assert.ok('refused' in acceptRefusals(designSvgRefusals(variable), true));
});

test('a Design page refused only for its rounded clip is drawn with the flag, and its route record carries the acceptance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-allow-browser-free-design-'));
  try {
    const boxes = [
      { id: 'cover', kind: 'frame', x: 0, y: 0, w: 640, h: 400, bg: '#f4f1ea', order: 0, shape: 'rounded', radius: 48 },
      { id: 'corner', kind: 'box', x: -30, y: 300, w: 200, h: 140, bg: '#f76707', frame: 'cover' },
    ];
    const out = join(dir, 'page.png');
    const args = ['design', `--boxes=${JSON.stringify(boxes)}`, '--s=cover', '--export=png', `--output=${out}`];
    const refused = cli(dir, args);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /Design PNG export: handed to the browser render tier because the frame's rounded edge clips corner/);
    assert.match(refused.stderr, /or pass --allow-browser-free/);
    assert.equal(existsSync(out), false);
    const drawn = cli(dir, [...args, '--allow-browser-free']);
    assert.equal(drawn.status, 0, drawn.stderr);
    assert.match(drawn.stderr, /Warning: this Design PNG was drawn without a browser because --allow-browser-free was given, and it may differ from the app's: the frame's rounded edge clips corner/);
    const report = await verifyC2pa(new Uint8Array(readFileSync(out))) as { environment?: Record<string, unknown> };
    assert.equal(report.environment?.route, 'operations');
    assert.equal(report.environment?.accepted, BROWSER_FREE_ACCEPTED);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
