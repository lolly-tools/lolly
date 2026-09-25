// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly smoke` - the catalog-wide render gate (shells/cli/src/smoke.ts).
 *
 * The gate's whole value is its exit code: ✓ tools render at manifest defaults, a
 * hooks.js regression is that tool's ✗ (via assertRenderOk inside the CLI write
 * path), and tools that legitimately can't render headlessly are skipped with a
 * reason - never failed, never silently green.
 *
 * The e2e cases run against a SELF-CONTAINED fixture repo: repoRoot() honours a
 * marker-validated LOLLY_ROOT, node:test runs each file in its own process, and
 * smoke.ts resolves the root at first import - so setting the env var before the
 * dynamic import below pins every module in the chain (smoke → run → bridge) to the
 * fixture. That keeps this file hermetic across content profiles (CI runs the
 * lolly-start fallback, local dev usually runs suse).
 *
 * Run with: node --test tests/cli-smoke.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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

/** A PDF transform whose exportFile runs `body` with the uploaded file bound to `f`. */
function transformTool(id: string, body: string): Record<string, string> {
  return {
    'tool.json': manifest(id, {
      hooks: { exportFile: true },
      render: { width: 100, height: 100, formats: ['pdf'] },
      inputs: [{ id: 'source', type: 'file', label: 'PDF', accept: ['.pdf', 'application/pdf'] }],
    }),
    'template.html': '<div>{{label}}</div>',
    'hooks.js':
      'async function exportFile(ctx) { var f = null; ctx.model.forEach(function (i) { if (i.id === "source") f = i.value; }); ' +
      'if (!f || !f.bytes) throw new Error("no file reached the hook"); ' + body + ' }',
  };
}

const SVG_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
  '<rect width="100" height="100" fill="#3cb44b" /><text x="10" y="55">{{label}}</text></svg>';

const THROWING_HOOKS = "function onInit() { throw new Error('deliberately broken fixture hook'); }";

// ok-tool renders; broken-hook fails on the runToolCli svg path; layout-broken has no
// Node-native format (png only) so it exercises the inline html fallback, and fails
// there; cap-gated is skipped on its manifest alone (no template needed - the skip
// must happen before any load/render work); transform-tool has a file input no committed
// fixture satisfies, so the transform lane skips it; echo-pdf runs over the PDF fixture
// and passes; wrong-bytes declares pdf but hands back PNG bytes, so the magic-byte check
// fails it; browser-only asks for the browser tier, which smoke never launches.
await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(
  join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({
    version: '1',
    tools: [
      { id: 'ok-tool' }, { id: 'broken-hook' }, { id: 'layout-broken' }, { id: 'cap-gated' }, { id: 'transform-tool' }, { id: 'layout-svg' },
      { id: 'echo-pdf' }, { id: 'wrong-bytes' }, { id: 'browser-only' },
    ],
  }),
);
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));

// The transform lane's files for this suite: its own tiny PDF, so the suite needs no
// file from the real checkout. The kinds and types mirror TRANSFORM_FIXTURES.
await mkdir(join(root, 'fixtures'), { recursive: true });
await writeFile(join(root, 'fixtures', 'tiny.pdf'), '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const FIXTURES = [
  { kind: 'pdf', ext: '.pdf', mime: 'application/pdf', path: join(root, 'fixtures', 'tiny.pdf') },
  { kind: 'svg', ext: '.svg', mime: 'image/svg+xml', path: join(root, 'fixtures', 'absent.svg') },
];

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
      render: { width: 100, height: 100, formats: ['png'], portable: true },
    }),
    'template.html': '<div class="card">{{label}}</div>',
    'hooks.js': THROWING_HOOKS,
    'presentation.js': 'document.body.dataset.ready = "yes";',
  },
  'cap-gated': { 'tool.json': manifest('cap-gated', { capabilities: ['capture'] }) },
  // A HEALTHY html-layout tool that declares svg first. It has no browser-free vector
  // path, and smoke may not launch the tier that has one - the `~` bucket. It used to
  // score `✓ layout-svg svg->html`, i.e. a format substitution scored as a real render.
  'layout-svg': {
    'tool.json': manifest('layout-svg', {
      hooks: { onInit: true },
      render: { width: 100, height: 100, formats: ['svg', 'html'], portable: true },
    }),
    'template.html': '<div><p>{{label}}</p><p>second box</p></div>',
    'hooks.js': "function onInit() { return { label: 'Portable page hydrated' }; }",
    'presentation.js': 'document.body.dataset.ready = "yes";',
  },
  'transform-tool': {
    'tool.json': manifest('transform-tool', {
      hooks: { exportFile: true },
      render: { width: 100, height: 100, formats: ['pdf'] },
      inputs: [{ id: 'doc', type: 'file', label: 'Doc', accept: ['.xyz'] }],
    }),
  },
  'echo-pdf': transformTool('echo-pdf', 'return { bytes: f.bytes, filename: "out.pdf" };'),
  'wrong-bytes': transformTool('wrong-bytes', 'return { bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]), filename: "out.pdf" };'),
  'browser-only': transformTool('browser-only', 'throw new Error("This step needs a browser canvas.");'),
  // Not in the catalog index (smoke never sees it): a batch-only converter that writes
  // WAV bytes whatever it is fed, with an audioFormat select choosing its container.
  'echo-wav': {
    'tool.json': manifest('echo-wav', {
      hooks: { exportFile: true },
      render: { width: 100, height: 100, formats: ['wav', 'mp3', 'mp4'] },
      inputs: [
        { id: 'source', type: 'file', label: 'Audio', accept: ['.pdf', 'audio/*'] },
        { id: 'audioFormat', type: 'select', label: 'Format', default: 'wav', options: [{ value: 'wav', label: 'WAV' }, { value: 'mp3', label: 'MP3' }] },
      ],
    }),
    'template.html': '<div>{{label}}</div>',
    'hooks.js':
      'async function exportFile() { return { bytes: new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32]), filename: "out.wav" }; }',
  },
} as Record<string, Record<string, string>>)) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(root, 'tools', id, name), content);
  }
}

// Pin the whole smoke → run → bridge module chain to the fixture BEFORE first import,
// and pin the browser tier to a directory with no built shell so the `~` case below is
// deterministic and no Chromium is ever launched (smoke's own budget rule, enforced).
process.env.LOLLY_ROOT = root;
process.env.LOLLY_WEB_DIST = join(root, 'no-such-dist');
delete process.env.LOLLY_WEB_BASE;
const { runBatchCli } = await import('../shells/cli/src/batch.ts');
const {
  smokeCli, pickSmokeFormat, skipReason, pickTransformFixture, checkTransformOutput, transformPlan,
} = await import('../shells/cli/src/smoke.ts');

function run(opts: { only?: string; format?: string } = {}): Promise<{ code: number; out: string }> {
  let out = '';
  return smokeCli({ ...opts, fixtures: FIXTURES, out: (line: string) => { out += line; } }).then(code => ({ code, out }));
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

test('skipReason: live-capture tools skip; everything else is strict', () => {
  const base = { id: 't', render: { formats: ['svg'] } };
  assert.equal(skipReason(base), null);
  // A transform is not skipped here: it runs in the transform lane over a fixture.
  assert.equal(skipReason({ ...base, hooks: { exportFile: true } }), null);
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
  assert.match(out, /– cap-gated\s+-\s+skipped: needs capture/);
  assert.match(out, /– transform-tool\s+-\s+skipped: transform tool with no committed fixture for its input \(accepts \.xyz\)/);
  assert.match(out, /✓ echo-pdf\s+pdf\s+[\d,]+ B .*\(transform over tiny\.pdf\)/);
  assert.match(out, /✗ wrong-bytes\s+-\s+the output bytes are png, which "pdf" does not declare; the output is kept as wrong-bytes\.rejected/);
  assert.match(out, /– browser-only\s+-\s+skipped: needs a tier smoke does not run: This step needs a browser canvas\./);
  // A layout tool with no browser-free path to its own first format is its OWN bucket:
  // never a ✓ for the format it could not produce, and never a ✗ either (that would be
  // a statement about smoke's browser-free budget, not about the tool).
  assert.match(out, /~ layout-svg\s+svg:html\s+.*layout tool: no browser-free svg; hooks ok/);
  assert.doesNotMatch(out, /✓ layout-svg/);
  assert.match(out, /smoke: 2 ✓ {2}3 ✗ {2}1 ~ \(layout tools rendered as html\) {2}3 skipped {2}\(9 tools/);
});

test('smoke --only renders just the requested ids (all green → exit 0)', async () => {
  const { code, out } = await run({ only: 'ok-tool' });
  assert.equal(code, 0);
  assert.match(out, /✓ ok-tool/);
  assert.doesNotMatch(out, /broken-hook/);
  assert.match(out, /\(1 tools/);
});

test('portable layout fallback snapshots hook output without a browser export', async () => {
  const { code, out } = await run({ only: 'layout-svg' });
  assert.equal(code, 0);
  assert.match(out, /~ layout-svg\s+svg:html/);
  const directory = /outputs in (.+)\n/.exec(out)![1]!;
  const html = await readFile(join(directory, 'layout-svg.html'), 'utf8');
  assert.match(html, /<p>Portable page hydrated<\/p>/);
  assert.doesNotMatch(html, /<script/);
});

test('smoke --only with an unknown id is a usage error (exit 2, nothing rendered)', async () => {
  const { code, out } = await run({ only: 'ok-tool,no-such-tool' });
  assert.equal(code, 2);
  assert.equal(out, '');
});

test('smoke --format refuses non-Node-native formats (browser-free budget)', async () => {
  // png would need resvg-or-Chromium tiers per tool - smoke never launches a browser.
  const { code, out } = await run({ format: 'png' });
  assert.equal(code, 2);
  assert.equal(out, '');
});

test('smoke --format forces one format; non-declaring tools skip instead of failing', async () => {
  const { code, out } = await run({ only: 'ok-tool,layout-broken', format: 'svg' });
  assert.equal(code, 0);
  assert.match(out, /✓ ok-tool\s+svg/);
  assert.match(out, /– layout-broken\s+-\s+skipped: does not declare "svg"/);
});

test('pickTransformFixture follows the tool accept order', () => {
  const set = [
    { kind: 'pptx', ext: '.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', path: '/f/a.pptx' },
    { kind: 'pdf', ext: '.pdf', mime: 'application/pdf', path: '/f/a.pdf' },
    { kind: 'png', ext: '.png', mime: 'image/png', path: '/f/a.png' },
    { kind: 'svg', ext: '.svg', mime: 'image/svg+xml', path: '/f/a.svg' },
    { kind: 'ttf', ext: '.ttf', mime: 'font/ttf', path: '/f/a.ttf' },
  ];
  // JPEG is listed first but has no fixture, so the PNG wins over the PDF listed later.
  assert.equal(pickTransformFixture(['image/jpeg', 'image/png', 'application/pdf'], set)?.kind, 'png');
  assert.equal(pickTransformFixture('.pptx,application/pdf', set)?.kind, 'pptx');
  assert.equal(pickTransformFixture(['image/*'], set)?.kind, 'png');
  assert.equal(pickTransformFixture(['font/ttf', '.otf'], set)?.kind, 'ttf');
  assert.equal(pickTransformFixture(['audio/*', '.wav'], set), null);
  assert.equal(pickTransformFixture(undefined, set), null);
});

test('transformPlan: a forced format runs only on a fixture of that kind', () => {
  const pngSvg = { kind: 'png', ext: '.png', mime: 'image/png', path: join(root, 'fixtures', 'tiny.pdf') };
  const svg = { kind: 'svg', ext: '.svg', mime: 'image/svg+xml', path: join(root, 'fixtures', 'tiny.pdf') };
  const redactLike = {
    id: 'r', hooks: { exportFile: true }, render: { formats: ['png', 'svg'] },
    inputs: [{ id: 'source', type: 'file', accept: ['image/png', 'image/svg+xml'] }],
  };
  // Unforced: the tool's own first fixture.
  assert.deepEqual(transformPlan(redactLike, undefined, [pngSvg, svg]), { fixture: pngSvg, inputId: 'source' });
  // Forced svg: the default fixture is a png, so it is skipped rather than steered onto
  // an SVG its default run never takes.
  assert.match((transformPlan(redactLike, 'svg', [pngSvg, svg]) as { skip: string }).skip, /runs over a png fixture, so it writes png, not "svg"/);
  // A tool that declares svg but accepts only png: the same skip, never a false fail.
  const pngOnly = { ...redactLike, inputs: [{ id: 'source', type: 'file', accept: ['image/png'] }] };
  assert.match((transformPlan(pngOnly, 'svg', [pngSvg, svg]) as { skip: string }).skip, /not "svg"/);
  // A file input shown only for some settings gives no default run.
  const conditional = { ...redactLike, inputs: [{ id: 'lut', type: 'file', accept: ['.cube'], showIf: { mode: ['custom'] } }] };
  assert.match((transformPlan(conditional, undefined, [pngSvg]) as { skip: string }).skip, /"lut" is shown only for some settings/);
  // No fixtures at all: an installed CLI with no source checkout.
  assert.match((transformPlan(redactLike, undefined, []) as { skip: string }).skip, /only with a source checkout/);
});

test('checkTransformOutput: non-empty, and magic bytes one of the declared formats', () => {
  const enc = (t: string): Uint8Array => new TextEncoder().encode(t);
  const pdf = enc('%PDF-1.7\n');
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
  const ttf = new Uint8Array([0, 1, 0, 0, 0, 0]);
  assert.deepEqual(checkTransformOutput(pdf, ['pdf']), { kind: 'pdf', checked: true });
  assert.deepEqual(checkTransformOutput(zip, ['pptx']), { kind: 'pptx', checked: true });
  assert.deepEqual(checkTransformOutput(zip, ['pdf', 'zip']), { kind: 'zip', checked: true });
  assert.deepEqual(checkTransformOutput(ttf, ['ttf', 'otf', 'woff']), { kind: 'ttf', checked: true });
  assert.match((checkTransformOutput(new Uint8Array(), ['pdf']) as { error: string }).error, /empty/);
  assert.match((checkTransformOutput(pdf, ['png', 'jpg']) as { error: string }).error, /bytes are pdf/);
  assert.match((checkTransformOutput(new Uint8Array([1, 2, 3, 4]), ['pdf']) as { error: string }).error, /no magic bytes for pdf/);
  // A tool that declares only formats with no signature passes on bytes alone, and says so.
  assert.deepEqual(checkTransformOutput(enc('hello'), ['html']), { kind: 'html', checked: false });
  // Audio containers are identified, so a tool that declares both audio and video
  // formats (clean, trim) is not failed for writing audio.
  const av = ['wav', 'mp3', 'm4a', 'opus', 'mp4', 'webm'];
  assert.deepEqual(checkTransformOutput(enc('RIFF\0\0\0\0WAVEfmt '), av), { kind: 'wav', checked: true });
  assert.deepEqual(checkTransformOutput(enc('OggS\0\u0002'), av), { kind: 'opus', checked: true });
  assert.deepEqual(checkTransformOutput(enc('ID3\u0004\0'), av), { kind: 'mp3', checked: true });
  assert.deepEqual(checkTransformOutput(new Uint8Array([0xff, 0xfb, 0x90, 0x64]), av), { kind: 'mp3', checked: true });
  assert.deepEqual(checkTransformOutput(enc('\0\0\0\u0018ftypM4A \0\0\0\0'), av), { kind: 'm4a', checked: true });
  assert.deepEqual(checkTransformOutput(enc('\0\0\0\u0018ftypisom\0\0\0\0'), av), { kind: 'mp4', checked: true });
  // A QuickTime file is not called mp4.
  assert.match((checkTransformOutput(enc('\0\0\0\u0014ftypqt  \0\0\0\0'), ['mp4', 'webm']) as { error: string }).error, /bytes are mov/);
  // Unidentified bytes pass unchecked only when a declared format has no signature.
  assert.deepEqual(checkTransformOutput(new Uint8Array([1, 2, 3, 4]), ['pdf', 'html']), { kind: 'html', checked: false });
});

test('the transform lane writes its output under the identified extension', async () => {
  const { code, out } = await run({ only: 'echo-pdf' });
  assert.equal(code, 0);
  const directory = /outputs in (.+)\n/.exec(out)![1]!;
  const bytes = await readFile(join(directory, 'echo-pdf.pdf'));
  assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('smoke --format on a transform tool that does not declare it skips it', async () => {
  const { code, out } = await run({ only: 'echo-pdf', format: 'svg' });
  assert.equal(code, 0);
  assert.match(out, /– echo-pdf\s+-\s+skipped: does not declare "svg"/);
});

test('a failed transform keeps its output as <id>.rejected', async () => {
  const { code, out } = await run({ only: 'wrong-bytes' });
  assert.equal(code, 1);
  const directory = /outputs in (.+)\n/.exec(out)![1]!;
  const kept = await readFile(join(directory, 'wrong-bytes.rejected'));
  assert.deepEqual([...kept.subarray(0, 4)], [137, 80, 78, 71]);
});

test('batch names a transform row after the bytes, even when they are audio', async () => {
  // The input is a .mp4 name: the row must not be saved as .mp4 because the bytes were
  // not a signature format-sniff knows.
  await writeFile(join(root, 'fixtures', 'talk.mp4'), '%PDF-1.4\n');
  const csv = join(root, 'wav.csv');
  await writeFile(csv, `toolId,source\necho-wav,${join(root, 'fixtures', 'talk.mp4')}\n`);
  const outDir = join(root, 'wav-out');
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  let code: number;
  try { code = await runBatchCli(csv, { outDir }); } finally { process.stderr.write = write; }
  assert.equal(code, 0);
  assert.deepEqual(await readdir(outDir), ['01-talk.wav']);
});
