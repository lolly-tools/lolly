// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly smoke` — the catalog-wide render gate (shells/cli/src/smoke.ts).
 *
 * The gate's whole value is its exit code: ✓ tools render at manifest defaults, a
 * hooks.js regression is that tool's ✗ (via assertRenderOk inside the CLI write
 * path), and tools that legitimately can't render headlessly are skipped with a
 * reason — never failed, never silently green.
 *
 * The e2e cases run against a SELF-CONTAINED fixture repo: repoRoot() honours a
 * marker-validated LOLLY_ROOT, node:test runs each file in its own process, and
 * smoke.ts resolves the root at first import — so setting the env var before the
 * dynamic import below pins every module in the chain (smoke → run → bridge) to the
 * fixture. That keeps this file hermetic across content profiles (CI runs the
 * lolly-start fallback, local dev usually runs suse).
 *
 * Run with: node --test tests/cli-smoke.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'lolly-smoke-fixture-'));
after(() => rm(root, { recursive: true, force: true }));

function manifest(id: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id,
    name: id,
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'community',
    render: { width: 100, height: 100, formats: ['svg'] },
    inputs: [{ id: 'label', type: 'text', label: 'Label', default: 'hi' }],
    ...overrides,
  });
}

const SVG_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
  '<rect width="100" height="100" fill="#3cb44b" /><text x="10" y="55">{{label}}</text></svg>';

const THROWING_HOOKS = "function onInit() { throw new Error('deliberately broken fixture hook'); }";

// ok-tool renders; broken-hook fails on the runToolCli svg path; layout-broken has no
// Node-native format (png only) so it exercises the inline html fallback, and fails
// there; cap-gated is skipped on its manifest alone (no template needed — the skip
// must happen before any load/render work); transform-tool is the exportFile skip.
await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(
  join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({
    version: '1',
    tools: [{ id: 'ok-tool' }, { id: 'broken-hook' }, { id: 'layout-broken' }, { id: 'cap-gated' }, { id: 'transform-tool' }],
  }),
);
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));

for (const [id, files] of Object.entries({
  'ok-tool': { 'tool.json': manifest('ok-tool'), 'template.html': SVG_TEMPLATE },
  'broken-hook': {
    'tool.json': manifest('broken-hook', { hooks: { onInit: true } }),
    'template.html': SVG_TEMPLATE,
    'hooks.js': THROWING_HOOKS,
  },
  'layout-broken': {
    'tool.json': manifest('layout-broken', {
      hooks: { onInit: true },
      render: { width: 100, height: 100, formats: ['png'] },
    }),
    'template.html': '<div class="card">{{label}}</div>',
    'hooks.js': THROWING_HOOKS,
  },
  'cap-gated': { 'tool.json': manifest('cap-gated', { capabilities: ['capture'] }) },
  'transform-tool': {
    'tool.json': manifest('transform-tool', {
      hooks: { exportFile: true },
      render: { width: 100, height: 100, formats: ['pdf'] },
      inputs: [{ id: 'doc', type: 'file', label: 'Doc' }],
    }),
  },
} as Record<string, Record<string, string>>)) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(root, 'tools', id, name), content);
  }
}

// Pin the whole smoke → run → bridge module chain to the fixture BEFORE first import.
process.env.LOLLY_ROOT = root;
const { smokeCli, pickSmokeFormat, skipReason } = await import('../shells/cli/src/smoke.ts');

function run(opts: { only?: string; format?: string } = {}): Promise<{ code: number; out: string }> {
  let out = '';
  return smokeCli({ ...opts, out: (line: string) => { out += line; } }).then(code => ({ code, out }));
}

test('pickSmokeFormat: first declared Node-native format, declared spelling kept', () => {
  assert.equal(pickSmokeFormat(['png', 'jpeg', 'svg', 'ics']), 'svg');
  assert.equal(pickSmokeFormat(['ics', 'png', 'svg']), 'ics');
  assert.equal(pickSmokeFormat(['SVG', 'png']), 'SVG');
  // Browser-only format lists → null (the caller uses the inline html fallback).
  assert.equal(pickSmokeFormat(['pptx', 'pdf', 'mp4']), null);
  assert.equal(pickSmokeFormat(['png', 'webp']), null);
  assert.equal(pickSmokeFormat([]), null);
});

test('skipReason: transform + live-capture tools skip; everything else is strict', () => {
  const base = { id: 't', render: { formats: ['svg'] } };
  assert.equal(skipReason(base), null);
  assert.match(skipReason({ ...base, hooks: { exportFile: true } })!, /transform tool/);
  assert.match(skipReason({ ...base, capabilities: ['capture'] })!, /needs capture/);
  assert.match(skipReason({ ...base, capabilities: ['camera', 'microphone'] })!, /camera\+microphone/);
  // A non-capture capability (wasm, network, compose) is NOT a reason to skip.
  assert.equal(skipReason({ ...base, capabilities: ['wasm'] }), null);
  // A forced format the tool doesn't declare skips it rather than failing it.
  assert.match(skipReason(base, 'ics')!, /does not declare "ics"/);
  assert.equal(skipReason(base, 'SVG'), null);
});

test('smoke over a catalog with broken tools: ✓/✗/skip rows and exit 1', async () => {
  const { code, out } = await run();
  assert.equal(code, 1);
  assert.match(out, /✓ ok-tool\s+svg/);
  // Both failure paths are strict: the runToolCli svg path and the inline html fallback.
  assert.match(out, /✗ broken-hook\s+svg\s+.*onInit failed: deliberately broken fixture hook/);
  assert.match(out, /✗ layout-broken\s+html\s+.*onInit failed: deliberately broken fixture hook/);
  assert.match(out, /– cap-gated\s+—\s+skipped: needs capture/);
  assert.match(out, /– transform-tool\s+—\s+skipped: transform tool/);
  assert.match(out, /smoke: 1 ✓ {2}2 ✗ {2}2 skipped {2}\(5 tools/);
});

test('smoke --only renders just the requested ids (all green → exit 0)', async () => {
  const { code, out } = await run({ only: 'ok-tool' });
  assert.equal(code, 0);
  assert.match(out, /✓ ok-tool/);
  assert.doesNotMatch(out, /broken-hook/);
  assert.match(out, /\(1 tools/);
});

test('smoke --only with an unknown id is a usage error (exit 2, nothing rendered)', async () => {
  const { code, out } = await run({ only: 'ok-tool,no-such-tool' });
  assert.equal(code, 2);
  assert.equal(out, '');
});

test('smoke --format refuses non-Node-native formats (browser-free budget)', async () => {
  // png would need resvg-or-Chromium tiers per tool — smoke never launches a browser.
  const { code, out } = await run({ format: 'png' });
  assert.equal(code, 2);
  assert.equal(out, '');
});

test('smoke --format forces one format; non-declaring tools skip instead of failing', async () => {
  const { code, out } = await run({ only: 'ok-tool,layout-broken', format: 'svg' });
  assert.equal(code, 0);
  assert.match(out, /✓ ok-tool\s+svg/);
  assert.match(out, /– layout-broken\s+—\s+skipped: does not declare "svg"/);
});
