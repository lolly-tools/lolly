// SPDX-License-Identifier: MPL-2.0
/**
 * The reproducibility receipt: `lolly validate <artifact> --rebuild <session.lolly>`.
 *
 * docs/reproducibility.md's central claim is that a Lolly artifact is the output of
 * inputs you still hold. This suite is what makes that claim testable rather than
 * argued - render an artifact through the real CLI path, build the `.lolly` for the same
 * session, hand both back to the rebuild, and pin all three answers:
 *
 *   • an untouched pair reports IDENTICAL;
 *   • one changed input reports DIFFERENT, with the `content` reason and an offset;
 *   • a tool version the .lolly and the catalog disagree on is REPORTED as such, not
 *     silently folded into "content differs".
 *
 * Hermetic and Tier-A like tests/cli-export-golden.test.ts: a self-contained fixture repo
 * with LOLLY_ROOT pinned BEFORE the first import, the same native-<svg> `vector-mark`
 * fixture tool, and no browser anywhere - svg and dxf both come out of the DOM-free
 * emitters, which is exactly why they are the formats a rebuild is allowed to compare.
 *
 * The `.lolly` is written by the SHELL's own builder (shells/web/src/lib/lolly-pack.ts,
 * pure and DOM-free by design) rather than a test-local writer, so the file this reads is
 * the file the app ships, not a lookalike.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildLollyFile } from '../shells/web/src/lib/lolly-pack.ts';

// ── the fixture repo ────────────────────────────────────────────────────────
const root = await mkdtemp(join(tmpdir(), 'lolly-rebuild-test-'));
after(() => rm(root, { recursive: true, force: true }));

const TOOL_ID = 'vector-mark';
const TOOL_VERSION = '1.0.0';
const TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">' +
  '<rect x="4" y="4" width="112" height="72" fill="{{shade}}" stroke="#123456" stroke-width="2"/>' +
  '<polygon points="100,10 114,20 100,30" fill="#f58231"/>' +
  '</svg>';

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: TOOL_ID }] }));
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
await mkdir(join(root, 'tools', TOOL_ID), { recursive: true });
await writeFile(join(root, 'tools', TOOL_ID, 'tool.json'), JSON.stringify({
  id: TOOL_ID,
  name: TOOL_ID,
  version: TOOL_VERSION,
  engineVersion: '^1.0.0',
  status: 'community',
  render: { width: 120, height: 80, formats: ['svg', 'dxf'] },
  inputs: [{ id: 'shade', type: 'color', label: 'Shade', default: '#3cb44b' }],
}));
await writeFile(join(root, 'tools', TOOL_ID, 'template.html'), TEMPLATE);

// Pin the whole run → bridge → rebuild module chain to the fixture BEFORE first import.
process.env.LOLLY_ROOT = root;
const { runToolCli } = await import('../shells/cli/src/run.ts');
const { rebuildSession, sessionToParams, REBUILDABLE_FORMATS } = await import('../shells/cli/src/rebuild.ts');

/** Render through the REAL CLI path, bare (a credential embeds a fresh timestamp). */
let seq = 0;
async function render(format: string, params: Record<string, string> = {}): Promise<string> {
  const out = join(root, `artifact-${seq++}.${format}`);
  await runToolCli({ toolId: TOOL_ID, params: { 'no-provenance': '1', ...params }, outputPath: out, format });
  return out;
}

/** The `.lolly` the app would write for a session, through the shell's own builder. */
async function writeLolly(name: string, session: Record<string, unknown>, toolVersion = TOOL_VERSION): Promise<string> {
  const { blob } = await buildLollyFile({ session, toolId: TOOL_ID, toolVersion, userAssets: [] });
  const path = join(root, name);
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return path;
}

const session = (shade: string): Record<string, unknown> => ({
  __toolId: TOOL_ID,
  __toolVersion: TOOL_VERSION,
  __export_format: 'svg',
  shade,
});

// ── the receipt ─────────────────────────────────────────────────────────────

test('an untouched artifact and its session rebuild IDENTICAL (svg)', async () => {
  const artifact = await render('svg');
  const lolly = await writeLolly('same.lolly', session('#3cb44b'));
  const report = await rebuildSession(artifact, lolly);
  assert.equal(report.identical, true, `expected IDENTICAL, got reasons: ${JSON.stringify(report.reasons)}`);
  assert.deepEqual(report.reasons, []);
  assert.equal(report.firstDiff, -1);
  assert.equal(report.tool.id, TOOL_ID);
  // Non-vacuity: the comparison ran on real bytes, not on two empty buffers.
  assert.ok(report.bytes.artifact > 200 && report.bytes.rebuilt === report.bytes.artifact);
});

test('the same holds for a data/vector format that is not svg (dxf)', async () => {
  const artifact = await render('dxf');
  const lolly = await writeLolly('same-dxf.lolly', session('#3cb44b'));
  const report = await rebuildSession(artifact, lolly);
  assert.equal(report.identical, true, `expected IDENTICAL, got reasons: ${JSON.stringify(report.reasons)}`);
  assert.ok(report.bytes.artifact > 200);
});

test('one changed input reports DIFFERENT with the content reason and an offset', async () => {
  const artifact = await render('svg');                       // rendered at #3cb44b
  const lolly = await writeLolly('moved.lolly', session('#000000'));
  const report = await rebuildSession(artifact, lolly);
  assert.equal(report.identical, false);
  const codes = report.reasons.map(r => r.code);
  assert.deepEqual(codes, ['content'], 'a plain value change must report content, and nothing it did not check');
  assert.ok(report.firstDiff > 0, 'a content difference must name where it starts');
  assert.match(report.reasons[0]!.detail, /3cb44b|000000/, 'the hint must quote the bytes that moved');
});

test('a tool version the .lolly and the catalog disagree on is named as its own reason', async () => {
  const artifact = await render('svg');
  const lolly = await writeLolly('older-tool.lolly', session('#000000'), '0.9.0');
  const report = await rebuildSession(artifact, lolly);
  assert.equal(report.identical, false);
  const codes = report.reasons.map(r => r.code);
  assert.ok(codes.includes('tool-version'), `expected a tool-version reason, got ${JSON.stringify(report.reasons)}`);
  assert.match(report.reasons.find(r => r.code === 'tool-version')!.detail, /0\.9\.0/);
});

test('a version match reports NO tool-version reason - a reason is only ever a checked one', async () => {
  const artifact = await render('svg');
  const lolly = await writeLolly('same-tool.lolly', session('#000000'));
  const report = await rebuildSession(artifact, lolly);
  assert.equal(report.reasons.some(r => r.code === 'tool-version'), false);
});

// ── the refusal ─────────────────────────────────────────────────────────────

test('a raster or PDF artifact is refused, not guessed at', async () => {
  const lolly = await writeLolly('refuse.lolly', session('#3cb44b'));
  for (const bad of ['poster.png', 'poster.pdf', 'poster.jpg', 'poster.webp']) {
    await assert.rejects(
      () => rebuildSession(join(root, bad), lolly),
      (e: Error & { exit?: number; kind?: string }) => {
        assert.equal(e.exit, 2, 'a refusal is a usage answer, not a failed comparison');
        assert.equal(e.kind, 'FORMAT_NOT_REBUILDABLE');
        assert.match(e.message, /determinism/, 'the refusal must say where the reason is written down');
        return true;
      },
      `${bad} must be refused`,
    );
  }
  assert.deepEqual([...REBUILDABLE_FORMATS], ['svg', 'emf', 'eps', 'dxf', 'csv']);
});

// ── the session → params conversion ─────────────────────────────────────────

test('session values become CLI params through the engine serializer, markers and all', () => {
  const manifest = {
    id: TOOL_ID,
    inputs: [{ id: 'shade', type: 'color', label: 'Shade', default: '#3cb44b' }],
  } as Parameters<typeof sessionToParams>[0];
  const { params, assetRefs } = sessionToParams(manifest, {
    ...session('#ff0000'),
    __export_width: '210',
    __export_height: '297',
    __export_unit: 'mm',
    __export_dpi: '300',
  });
  // The value round-trips through the engine's own serializer, in whichever form the
  // tool's URL contract uses (compact '#'-less colours are per-tool opt-in).
  assert.equal(params.shade, '#ff0000');
  // A synthesised input the session never recorded writes no param, so a rebuild does
  // not hand the tool a flag it never declared.
  assert.equal(params.convertPaths, undefined);
  // The physical intent the session was saved with rebuilds at its own size, not the
  // tool's default - the same reserved params a link carries.
  assert.equal(params.width, '210');
  assert.equal(params.height, '297');
  assert.equal(params.unit, 'mm');
  assert.equal(params.dpi, '300');
  // `__`-prefixed markers are never mistaken for inputs.
  assert.equal(params.__toolId, undefined);
  assert.equal(params.__export_format, undefined);
  assert.equal(assetRefs, 0);
});

test('a px session writes no unit param, so a default render stays a default render', () => {
  const manifest = { id: TOOL_ID, inputs: [] } as Parameters<typeof sessionToParams>[0];
  const { params } = sessionToParams(manifest, { __export_unit: 'px', __export_dpi: '' });
  assert.equal(params.unit, undefined);
  assert.equal(params.dpi, undefined);
});

// ── the file itself ─────────────────────────────────────────────────────────

test('the node reader refuses a .lolly whose parts do not match its integrity map', async () => {
  const { readLollyFile } = await import('@lolly-tools/node-shell/lolly-file');
  const { readZip, storeZip } = await import('@lolly/engine');
  const path = await writeLolly('tamper.lolly', session('#3cb44b'));
  const original = new Uint8Array(await readFile(path));
  assert.ok(readLollyFile(original), 'the untampered file must read cleanly first');

  // A perfectly VALID zip is still a lie if a part moved. Rewrite session.json with a
  // different colour and re-store the archive, so every CRC is correct and only the
  // manifest's digest disagrees - the case a CRC check alone would wave through.
  const rewritten = readZip(original).map(e => ({
    name: e.name,
    bytes: e.name === 'session.json'
      ? new TextEncoder().encode(Buffer.from(e.bytes).toString('utf8').replace('#3cb44b', '#000000'))
      : e.bytes,
  }));
  assert.throws(() => readLollyFile(storeZip(rewritten)), /integrity/i);
});
