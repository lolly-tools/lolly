// SPDX-License-Identifier: MPL-2.0
/**
 * The `depth` reserved param, from URL/argv to the export options object
 * (plans/61-deeprichpixels.md §10 item 1).
 *
 * The parse/serialize contract lives in tests/engine.test.ts; this file covers the
 * two THREADING paths, which is where a reserved param usually rots: the value is
 * parsed by the engine and then quietly dropped by a shell.
 *
 *   • CLI - end-to-end through the REAL runToolCli path (jsdom, createCliBridge,
 *     runtime.export). A fixture tool's `beforeExport` hook receives the very
 *     ExportOpts object shells/cli/src/run.ts assembled, and stamps what it sees
 *     onto the rendered <svg> - so the exported bytes report whether `--depth=`
 *     survived the trip. Hermetic like tests/cli-smoke.test.ts: a self-contained
 *     fixture repo with LOLLY_ROOT pinned BEFORE the dynamic import, so the whole
 *     run → bridge chain resolves against the fixture whatever profile is active.
 *
 *   • Web - shells/web/src/views/tool.ts is a DOM-bound module with no headless
 *     entry point, so its threading is asserted by scanning the source for the
 *     three links in the chain (destructure → view opts → export opts), the same
 *     technique shells/web/src/lib/a11y-prefs-contract.test.ts uses for CSS. Each
 *     scan is paired with a NEGATIVE CONTROL: the same matcher run against a copy
 *     of the source with that line deleted must fail, so the assertion can't be a
 *     regex that matches anything.
 *
 * NOTE there is deliberately no consumer of `depth` yet - nothing reads it and
 * decides a bit depth. These tests pin the plumbing only; when the first consumer
 * lands (the 16-bit cICP PNG path) it brings its own depth-follows-provenance
 * tests.
 *
 * Run with: node --test tests/depth-param-threading.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── self-contained fixture repo ─────────────────────────────────────────────
const root = await mkdtemp(join(tmpdir(), 'lolly-depth-thread-'));
after(() => rm(root, { recursive: true, force: true }));

const MANIFEST = JSON.stringify({
  id: 'depth-probe',
  name: 'depth-probe',
  version: '1.0.0',
  engineVersion: '^1.0.0',
  status: 'community',
  hooks: { beforeExport: true },
  render: { width: 100, height: 100, formats: ['svg'] },
  inputs: [{ id: 'label', type: 'text', label: 'Label', default: 'hi' }],
});

const TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
  '<rect width="100" height="100" fill="#3cb44b" /></svg>';

// The probe: report EXACTLY what the shell put on the export opts. `absent` is a
// distinct answer from any depth value, so "threaded nothing" and "threaded 8"
// can never be confused.
const HOOKS = `
function beforeExport(ctx) {
  const svg = ctx.node.querySelector('svg');
  svg.setAttribute('data-seen-depth', 'depth' in ctx.opts ? String(ctx.opts.depth) : 'absent');
}
`;

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(
  join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: 'depth-probe' }] }),
);
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
await mkdir(join(root, 'tools', 'depth-probe'), { recursive: true });
await writeFile(join(root, 'tools', 'depth-probe', 'tool.json'), MANIFEST);
await writeFile(join(root, 'tools', 'depth-probe', 'template.html'), TEMPLATE);
await writeFile(join(root, 'tools', 'depth-probe', 'hooks.js'), HOOKS);

// Pin the run → bridge module chain to the fixture BEFORE first import.
process.env.LOLLY_ROOT = root;
const { runToolCli } = await import('../shells/cli/src/run.ts');

// Render the probe tool through the real CLI path and report what the hook saw.
async function seenDepth(params: Record<string, string>): Promise<string> {
  const out = join(root, `out-${Math.random().toString(36).slice(2)}.svg`);
  await runToolCli({ toolId: 'depth-probe', params, outputPath: out, format: 'svg' });
  const svg = await readFile(out, 'utf8');
  const m = /data-seen-depth="([^"]*)"/.exec(svg);
  assert.ok(m, `no data-seen-depth in the exported SVG:\n${svg}`);
  return m![1]!;
}

test('CLI: --depth= reaches the export opts (8/16/float), junk and auto thread nothing', async () => {
  // A real request travels: `--depth=16` → parseUrlState → run.ts's exportOpts.
  assert.equal(await seenDepth({ depth: '16' }), '16');
  assert.equal(await seenDepth({ depth: '8' }), '8');
  assert.equal(await seenDepth({ depth: 'float' }), 'float');

  // NEGATIVE CONTROL - no param at all: the opts object is exactly what it was
  // before this param existed. `absent` (not 'auto', not 'undefined') proves the
  // probe distinguishes "not threaded" from "threaded a value".
  assert.equal(await seenDepth({}), 'absent');

  // 'auto' IS the default, so an explicit --depth=auto is indistinguishable from
  // no flag - nothing is written onto the opts.
  assert.equal(await seenDepth({ depth: 'auto' }), 'absent');

  // Junk degrades to auto in the engine parser, so it likewise threads nothing:
  // no shell ever sees a depth Lolly does not support.
  assert.equal(await seenDepth({ depth: '32' }), 'absent');
  assert.equal(await seenDepth({ depth: 'deep' }), 'absent');
});

// ── web shell threading (source contract) ───────────────────────────────────

const TOOL_VIEW = readFileSync(new URL('../shells/web/src/views/tool.ts', import.meta.url), 'utf8');
const TOOL_ACTIONS = readFileSync(new URL('../shells/web/src/views/tool-actions.ts', import.meta.url), 'utf8');

test('web: ?depth= is destructured, carried on the view opts, and set on the export opts', () => {
  // Link 1 - parseUrlState's `depth` is actually taken out of the parsed state,
  // alongside the `hdr` it mirrors.
  const destructured = /parseUrlState\(/.test(TOOL_VIEW) && /depth: urlDepth\b/.test(TOOL_VIEW);
  assert.equal(destructured, true, 'views/tool.ts must destructure `depth: urlDepth` from parseUrlState');

  // Link 2 - it reaches the export-panel defaults (so the manual export path can
  // see a link's request), with 'auto' carrying nothing.
  assert.match(TOOL_VIEW, /depth:\s+urlDepth !== 'auto' \? urlDepth : undefined/);

  // Link 3 - and the auto-export path sets it on the opts handed to runtime.export.
  assert.match(TOOL_VIEW, /if \(urlDepth !== 'auto'\) expOpts\.depth = urlDepth;/);

  // Link 4 - the export panel's own opts builder passes a link's request through.
  assert.match(TOOL_ACTIONS, /exportDefaults\.depth \? \{ depth: exportDefaults\.depth \} : \{\}/);

  // The types that carry it exist on both hops (ExportDefaults and RunExportOpts).
  assert.equal(TOOL_VIEW.match(/^\s+depth\?: DepthSetting;$/gm)?.length, 2,
    'both ExportDefaults and RunExportOpts must declare `depth?: DepthSetting`');
});

test('web: the threading scan is a real check — each link fails when deleted', () => {
  // NEGATIVE CONTROL for the test above. Delete each threading line from a COPY of
  // the source and re-run its matcher: if the matcher still passes, it was matching
  // something incidental and the test above proves nothing.
  const drop = (src: string, needle: RegExp): string =>
    src.split('\n').filter(l => !needle.test(l)).join('\n');

  assert.equal(/depth: urlDepth\b/.test(drop(TOOL_VIEW, /depth: urlDepth\b/)), false);
  assert.equal(/if \(urlDepth !== 'auto'\) expOpts\.depth = urlDepth;/
    .test(drop(TOOL_VIEW, /expOpts\.depth = urlDepth/)), false);
  assert.equal(/exportDefaults\.depth \? \{ depth: exportDefaults\.depth \} : \{\}/
    .test(drop(TOOL_ACTIONS, /exportDefaults\.depth/)), false);
  assert.equal(drop(TOOL_VIEW, /^\s+depth\?: DepthSetting;$/).match(/^\s+depth\?: DepthSetting;$/gm), null);

  // And the scan is anchored to THIS param: a name nothing threads is never found.
  assert.equal(/depth: urlBitDepth\b/.test(TOOL_VIEW), false);
});
