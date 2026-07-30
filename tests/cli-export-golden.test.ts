// SPDX-License-Identifier: MPL-2.0
/**
 * Golden byte tests for the CLI export path (shells/cli/src/run.ts + bridge.ts):
 * a native-<svg> fixture tool rendered through the REAL CLI mechanism — jsdom,
 * createCliBridge, runtime.export — into svg, emf, eps, eps-cmyk, dxf and csv,
 * with the exact output bytes pinned in tests/fixtures/cli-export.golden.json.
 * This is the only end-to-end coverage of the svgDomToIr → emitEmf/emitEps/
 * emitDxf pipeline under jsdom; the emitters and their data formats are shared
 * with the engine, so a byte diff here means the shared format output moved.
 *
 * Hermetic like tests/cli-smoke.test.ts: a self-contained fixture repo, with
 * LOLLY_ROOT pinned BEFORE the dynamic import so the whole run → bridge module
 * chain resolves against the fixture regardless of the active content profile.
 * The only file borrowed from the real checkout is the committed platform font
 * (shells/web/public/fonts/Outfit[wght].ttf), copied into the fixture so the
 * text cases exercise the real HarfBuzz outlining browser-free.
 *
 * Regenerate: UPDATE_GOLDENS=1 node --import ./tests/css-stub.mjs --test tests/cli-export-golden.test.ts
 * (then re-run without UPDATE_GOLDENS and diff-review the fixture change — the
 * golden diff IS the review artefact for any change to this seam.)
 *
 * KNOWN WEB/CLI DIVERGENCES pinned by these goldens (baseline for the eventual
 * unification pass — confirmed against the code on 2026-07-31):
 *   • SVG serialiser: the CLI serialises the live <svg> via jsdom's
 *     XMLSerializer (bridge.ts `format === 'svg'` branch); the web shell's
 *     renderSvg walks/rewrites the DOM. The CLI svg golden is per-CLI output —
 *     do NOT expect byte parity with a web export of the same tool.
 *   • No text outlining on CLI *svg* export: the CLI svg branch keeps live
 *     <text> elements verbatim (the text-svg golden asserts `<text` survives),
 *     where the web shell outlines runs to <path>. CLI EMF/EPS/DXF *do* outline
 *     (svgDomToIr + host.text = createNodeTextAPI — see bridge.ts:198-203; the
 *     old "lean CLI has no host.text" comments were stale and are fixed).
 *   • No annotation-comment stripping on CLI svg: nothing strips the engine's
 *     input-marker HTML comments (the CLI never calls annotateTemplate, so none
 *     appear — but the branch has no strip step either).
 *   • injectSvgMeta is DUPLICATED: shells/cli/src/bridge.ts carries its own
 *     copy of the web shell's provenance injector; the two can drift.
 *   • eps-cmyk on the CLI is naive rgbToCmyk only — emitEps's cmykPalette
 *     (brand palette CMYK overrides, built by the web shell's renderEps) is
 *     never passed, so brand colours separate differently here than on web.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile, copyFile } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, 'fixtures', 'cli-export.golden.json');
const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === '1';

// The committed platform face — present on a bare public clone (it is parent-repo
// content, not a brand pack), so the text cases run in CI. Guarded anyway: this
// file must never fail merely because a checkout is missing a font file.
const OUTFIT_SRC = join(HERE, '..', 'shells', 'web', 'public', 'fonts', 'Outfit[wght].ttf');
const outfitAvailable = existsSync(OUTFIT_SRC);
const SKIP_NO_OUTFIT = outfitAvailable ? false
  : `Platform font missing at ${OUTFIT_SRC} — text-outlining cases need it; ` +
    'restore the committed shells/web/public/fonts/Outfit[wght].ttf to run them.';

// ── self-contained fixture repo ─────────────────────────────────────────────
const root = await mkdtemp(join(tmpdir(), 'lolly-export-golden-'));
after(() => rm(root, { recursive: true, force: true }));

function manifest(id: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id,
    name: id,
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'community',
    render: { width: 120, height: 80, formats: ['svg'] },
    inputs: [],
    ...overrides,
  });
}

// vector-mark: every leaf-shape kind the IR walk handles (rect+stroke, circle
// with fill-opacity → the flatten path, path, polygon), one input-driven fill
// for the negative control. text-mark: a live <text> in the platform face —
// pins whether/where outlining happens per format. data-rows: a sibling
// template.csv with a comma-bearing value, so the csvCell quoting is in the bytes.
const VECTOR_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">' +
  '<rect x="4" y="4" width="112" height="72" fill="{{shade}}" stroke="#123456" stroke-width="2"/>' +
  '<circle cx="30" cy="40" r="18" fill="#e6194b" fill-opacity="0.5"/>' +
  '<path d="M60,20 C75,20 90,35 90,50 L60,60 Z" fill="#4363d8"/>' +
  '<polygon points="100,10 114,20 100,30" fill="#f58231"/>' +
  '</svg>';
const TEXT_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80">' +
  '<rect width="200" height="80" fill="#ffffff"/>' +
  '<text x="12" y="52" font-family="Outfit" font-size="32" fill="#112233">{{label}}</text>' +
  '</svg>';
const DATA_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
  '<rect width="100" height="100" fill="#3cb44b"/></svg>';
const CSV_TEMPLATE = 'item,qty\n{{csvCell item}},{{csvCell qty}}\n';

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(
  join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: 'vector-mark' }, { id: 'text-mark' }, { id: 'data-rows' }] }),
);
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));

for (const [id, files] of Object.entries({
  'vector-mark': {
    'tool.json': manifest('vector-mark', {
      render: { width: 120, height: 80, formats: ['svg', 'emf', 'eps', 'eps-cmyk', 'dxf'] },
      inputs: [{ id: 'shade', type: 'color', label: 'Shade', default: '#3cb44b' }],
    }),
    'template.html': VECTOR_TEMPLATE,
  },
  'text-mark': {
    'tool.json': manifest('text-mark', {
      render: { width: 200, height: 80, formats: ['svg', 'emf', 'eps', 'dxf'] },
      inputs: [{ id: 'label', type: 'text', label: 'Label', default: 'Hamburg' }],
    }),
    'template.html': TEXT_TEMPLATE,
  },
  'data-rows': {
    'tool.json': manifest('data-rows', {
      render: { width: 100, height: 100, formats: ['svg', 'csv'] },
      inputs: [
        { id: 'item', type: 'text', label: 'Item', default: 'widget, large' },
        { id: 'qty', type: 'number', label: 'Qty', default: 3 },
      ],
    }),
    'template.html': DATA_TEMPLATE,
    'template.csv': CSV_TEMPLATE,
  },
} as Record<string, Record<string, string>>)) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(root, 'tools', id, name), content);
  }
}

// The platform face, where packages/node-shell/src/text.ts's /fonts/ fallback
// (and FONT_DIRS scan) finds it under the pinned fixture root.
if (outfitAvailable) {
  const fontDir = join(root, 'shells', 'web', 'public', 'fonts');
  await mkdir(fontDir, { recursive: true });
  await copyFile(OUTFIT_SRC, join(fontDir, 'Outfit[wght].ttf'));
}

// Pin the whole run → bridge module chain to the fixture BEFORE first import
// (repoRoot() honours a marker-validated LOLLY_ROOT at first resolution).
process.env.LOLLY_ROOT = root;
const { runToolCli } = await import('../shells/cli/src/run.ts');

let seq = 0;
async function render(toolId: string, format: string, params: Record<string, string> = {}): Promise<Buffer> {
  const ext = format === 'eps-cmyk' ? 'eps' : format;
  const out = join(root, `out-${toolId}-${format}-${seq++}.${ext}`);
  await runToolCli({ toolId, params, outputPath: out, format });
  return readFile(out);
}

// ── golden fixture I/O ──────────────────────────────────────────────────────
// Text formats are stored utf8 (reviewable diffs); EMF bytes as base64.
interface GoldenEntry { encoding: 'utf8' | 'base64'; data: string }

function loadFixture(): Record<string, GoldenEntry> {
  if (!existsSync(FIXTURE_PATH)) return {};
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, GoldenEntry>;
}

const committed = loadFixture();
const regenerated: Record<string, GoldenEntry> = {};

after(() => {
  if (!UPDATE_GOLDENS) return;
  const sorted: Record<string, GoldenEntry> = {};
  for (const key of Object.keys(regenerated).sort()) sorted[key] = regenerated[key]!;
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
});

/** Render twice (byte-stability), then record or byte-compare against the golden. */
async function goldenCase(key: string, toolId: string, format: string): Promise<Buffer> {
  const live = await render(toolId, format);
  const again = await render(toolId, format);
  assert.ok(live.equals(again), `${key}: double render is not byte-stable`);
  const encoding = format === 'emf' ? 'base64' : 'utf8';
  const entry: GoldenEntry = { encoding, data: live.toString(encoding) };
  if (UPDATE_GOLDENS) {
    regenerated[key] = entry;
    return live;
  }
  const expected = committed[key];
  assert.ok(expected, `No committed golden for "${key}" — regenerate with: ` +
    'UPDATE_GOLDENS=1 node --import ./tests/css-stub.mjs --test tests/cli-export-golden.test.ts');
  assert.ok(live.equals(Buffer.from(expected.data, expected.encoding)),
    `Golden byte mismatch for "${key}" (CLI export output changed)`);
  return live;
}

// ── vector-mark: the svgDomToIr → emitter pipeline, per format ──────────────

test('golden: CLI svg export (per-CLI serialisation, not web parity)', async () => {
  const svg = (await goldenCase('vector-mark.svg', 'vector-mark', 'svg')).toString('utf8');
  // Non-vacuity: real document structure, the provenance block, and the
  // hydrated input value must all be present in the golden bytes.
  assert.ok(svg.length > 400, 'svg output is suspiciously small');
  assert.match(svg, /^<\?xml version="1\.0" standalone="no"\?>/);
  assert.match(svg, /<svg\b/);
  assert.match(svg, /<metadata>/, 'injectSvgMeta provenance block missing');
  assert.match(svg, /#3cb44b/, 'hydrated {{shade}} default missing');
});

test('golden: emf bytes via svgDomToIr + emitEmf under jsdom', async () => {
  const emf = await goldenCase('vector-mark.emf', 'vector-mark', 'emf');
  assert.ok(emf.length > 200, 'emf output is suspiciously small');
  // EMR_HEADER record type 1 (LE) at offset 0, then the ' EMF' signature at 40.
  assert.equal(emf.readUInt32LE(0), 1, 'missing EMR_HEADER record');
  assert.equal(emf.toString('latin1', 40, 44), ' EMF', 'missing EMF signature');
});

test('golden: eps text via emitEps (RGB)', async () => {
  const eps = (await goldenCase('vector-mark.eps', 'vector-mark', 'eps')).toString('utf8');
  assert.ok(eps.length > 400, 'eps output is suspiciously small');
  assert.match(eps, /^%!PS-Adobe/);
  assert.match(eps, /setrgbcolor/, 'RGB EPS must paint with setrgbcolor');
});

test('golden: eps-cmyk text via emitEps (naive DeviceCMYK, no palette on CLI)', async () => {
  const eps = (await goldenCase('vector-mark.eps-cmyk', 'vector-mark', 'eps-cmyk')).toString('utf8');
  assert.match(eps, /^%!PS-Adobe/);
  assert.match(eps, /setcmykcolor/, 'CMYK EPS must paint with setcmykcolor');
  assert.doesNotMatch(eps, /setrgbcolor/, 'CMYK EPS must not fall back to RGB paint');
});

test('golden: dxf text via emitDxf', async () => {
  const dxf = (await goldenCase('vector-mark.dxf', 'vector-mark', 'dxf')).toString('utf8');
  assert.ok(dxf.length > 400, 'dxf output is suspiciously small');
  assert.match(dxf, /ENTITIES/);
  assert.match(dxf, /EOF\s*$/);
});

test('negative control: a perturbed input changes the svg AND emf bytes', async () => {
  const svg = await render('vector-mark', 'svg', { shade: '#000000' });
  const emf = await render('vector-mark', 'emf', { shade: '#000000' });
  const goldenSvg = UPDATE_GOLDENS ? regenerated['vector-mark.svg'] : committed['vector-mark.svg'];
  const goldenEmf = UPDATE_GOLDENS ? regenerated['vector-mark.emf'] : committed['vector-mark.emf'];
  assert.ok(goldenSvg && goldenEmf, 'vector-mark goldens must exist before the control runs');
  assert.ok(!svg.equals(Buffer.from(goldenSvg.data, goldenSvg.encoding)),
    'shade change must alter the svg bytes — the golden would pass on constant output');
  assert.ok(!emf.equals(Buffer.from(goldenEmf.data, goldenEmf.encoding)),
    'shade change must alter the emf bytes — the golden would pass on constant output');
});

// ── text-mark: where outlining happens on the CLI, per format ───────────────

test('golden: CLI svg export keeps live <text> — NO outlining on the svg branch', { skip: SKIP_NO_OUTFIT }, async () => {
  const svg = (await goldenCase('text-mark.svg', 'text-mark', 'svg')).toString('utf8');
  assert.match(svg, /<text\b/, 'CLI svg export serialises live <text> (divergence from web, which outlines)');
  assert.match(svg, /Hamburg/, 'hydrated label missing');
  assert.doesNotMatch(svg, /<path\b[^>]*d="M[^"]{200,}/, 'unexpectedly found glyph-outline paths in CLI svg');
});

test('golden: CLI eps DOES outline <text> via host.text (Outfit, HarfBuzz in node)', { skip: SKIP_NO_OUTFIT }, async () => {
  const eps = (await goldenCase('text-mark.eps', 'text-mark', 'eps')).toString('utf8');
  assert.match(eps, /^%!PS-Adobe/);
  // Glyph outlines arrive as curve-heavy path prims; a font operator would mean
  // live text leaked through. emitEps writes no fonts by design.
  assert.doesNotMatch(eps, /findfont|show\b/, 'EPS must carry outlines, never font/show operators');
  const curves = (eps.match(/curveto/g) ?? []).length;
  assert.ok(curves > 20, `expected many curveto ops from glyph outlines, got ${curves}`);
});

test('golden: CLI emf outlines <text> too (byte-pinned)', { skip: SKIP_NO_OUTFIT }, async () => {
  const emf = await goldenCase('text-mark.emf', 'text-mark', 'emf');
  assert.equal(emf.readUInt32LE(0), 1);
  assert.equal(emf.toString('latin1', 40, 44), ' EMF');
  // A 7-glyph run outlines to far more bytes than the bare background rect would.
  assert.ok(emf.length > 2000, `emf with outlined text is suspiciously small (${emf.length} bytes)`);
});

test('negative control: changing the label changes the outlined eps bytes (glyphs are real)', { skip: SKIP_NO_OUTFIT }, async () => {
  const perturbed = await render('text-mark', 'eps', { label: 'Hxmburg' });
  const golden = UPDATE_GOLDENS ? regenerated['text-mark.eps'] : committed['text-mark.eps'];
  assert.ok(golden, 'text-mark.eps golden must exist before the control runs');
  assert.ok(!perturbed.equals(Buffer.from(golden.data, golden.encoding)),
    'a one-letter label change must reshape the outlines — otherwise the text never reached HarfBuzz');
});

// ── data format: engine-hydrated sibling template through the CLI bridge ────

test('golden: csv from a sibling template.csv with pinned inputs', async () => {
  const csv = (await goldenCase('data-rows.csv', 'data-rows', 'csv')).toString('utf8');
  assert.match(csv, /^item,qty\n/);
  assert.match(csv, /"widget, large",3/, 'csvCell must RFC-4180-quote the comma-bearing value');
});
