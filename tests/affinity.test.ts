// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AffinityError, AFFINITY_MAX_INPUT, affinityKindOf, describeAffinityError, isAffinitySignature } from '../packages/node-shell/src/affinity.ts';
import { loadAffinityKernel } from '../packages/node-shell/src/affinity-node.ts';
import { mapAffinityDocument, type AffinityModel, type AffinityNode, type AffinityRun } from '../engine/src/design-map-affinity.ts';
import { manifest, measureAll, meanDifference } from '../scripts/affinity-corpus.ts';

const corpus = resolve(import.meta.dirname, '../plans/corpora/affinity');
const have = existsSync(join(corpus, 'patchy-vector.af'));
const wasmUrl = new URL('../packages/node-shell/wasm/affinity/affinity.wasm', import.meta.url);
const FETCH = 'run `node scripts/affinity-corpus.ts fetch` first';

/** A container header and nothing else: 00 FF K A, version 12, a document, no thumbnail and no tables. */
function header(): Uint8Array {
  const head = new Uint8Array(96), v = new DataView(head.buffer);
  head.set([0x00, 0xff, 0x4b, 0x41]); v.setUint16(4, 12, true);
  head.set(new TextEncoder().encode('nsrP'), 8); head.set(new TextEncoder().encode('#Inf'), 12);
  head.set(new TextEncoder().encode('Prot'), 64);
  return head;
}

test('the module imports nothing from the host and stays inside the size budget', async () => {
  const bytes = readFileSync(wasmUrl);
  const module = await WebAssembly.compile(bytes);
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  assert.ok(bytes.length <= 1.5 * 1024 * 1024, `${bytes.length} bytes raw`);
  assert.ok(gzipSync(bytes, { level: 9 }).length <= 600 * 1024);
});

test('the signature and the kind come from the first bytes and the name', () => {
  assert.equal(isAffinitySignature(header()), true);
  assert.equal(isAffinitySignature(new Uint8Array(64)), false);
  assert.equal(isAffinitySignature(header().subarray(0, 8)), false);
  assert.equal(affinityKindOf('Poster.AFDESIGN'), 'afdesign');
  assert.equal(affinityKindOf('a.afphoto'), 'afphoto');
  assert.equal(affinityKindOf('a.afpub'), 'afpub');
  assert.equal(affinityKindOf('plain'), 'af');
});

test('garbage, empty, header-only and noisy input is refused with a message and leaves the reader usable', async () => {
  const kernel = await loadAffinityKernel();
  assert.throws(() => kernel.inspect(new Uint8Array()), (e: unknown) => e instanceof AffinityError && e.code === 'failed' && /empty/.test(e.message));
  assert.throws(() => kernel.inspect(new Uint8Array(4096)), AffinityError);
  assert.throws(() => kernel.model(new TextEncoder().encode('%PDF-1.7 not affinity')), AffinityError);
  assert.throws(() => kernel.inspect(header()), AffinityError);
  const noise = header();
  let seed = 11; for (let i = 72; i < noise.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; noise[i] = seed >> 16; }
  assert.throws(() => kernel.model(noise), (e: unknown) => e instanceof AffinityError && e.code !== 'crashed');
  assert.equal(kernel.dead, false);
  assert.match(describeAffinityError(new AffinityError('failed', 'damaged Affinity file: x')), /could not be read on this device.*SVG or PDF/);
  assert.match(describeAffinityError(new AffinityError('limit', 'too big')), /SVG or PDF/);
});

test('input over 96 MB is refused before it reaches the reader', async () => {
  const kernel = await loadAffinityKernel();
  assert.throws(() => kernel.inspect(new Uint8Array(AFFINITY_MAX_INPUT + 1)), (e: unknown) => e instanceof AffinityError && e.code === 'limit');
  assert.equal(kernel.dead, false);
});

// ── the mapper, on a hand-written model ─────────────────────────────────────

const ident: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
const black = { t: 'solid' as const, c: { model: 'rgb' as const, r: 0, g: 0, b: 0, a: 1 } };
const red = { t: 'solid' as const, c: { model: 'rgb' as const, r: 1, g: 0, b: 0, a: 1 } };
const para = { align: 'left', left: 0, right: 0, first: 0, before: 0, after: 0, leading: null, autoLeading: 1 };
const run = (text: string, extra: Partial<AffinityRun> = {}): AffinityRun => ({
  text, postscript: 'Arial-BoldMT', family: 'Arial', weight: 400, italic: false, features: [], allCaps: false, underline: false, strike: false,
  size: 20, tracking: 0, hScale: 1, leading: null, fill: black, stroke: null, para, ...extra,
});
const node = (name: string, kind: AffinityNode['kind'], extra: Partial<AffinityNode> = {}): AffinityNode => ({
  class: 'Scop', name, visible: true, locked: false, opacity: 1, blend: 'Normal', kind, mask: null, pixelMask: null, effects: [], children: [], ...extra,
});
const square = (x: number, y: number, s: number) => [{ s: [x, y] as [number, number], z: true, c: [
  [x, y, x + s, y, x + s, y], [x + s, y, x + s, y + s, x + s, y + s], [x + s, y + s, x, y + s, x, y + s], [x, y + s, x, y, x, y],
] as [number, number, number, number, number, number][] }];
const circleish = [{ s: [10, 0] as [number, number], z: true, c: [[10, 5.5, 5.5, 10, 0, 10], [-5.5, 10, -10, 5.5, -10, 0], [-10, -5.5, -5.5, -10, 0, -10], [5.5, -10, 10, -5.5, 10, 0]] as [number, number, number, number, number, number][] }];

function sample(): AffinityModel {
  const board = node('Poster', {
    t: 'artboard', rect: [100, 50, 420, 250], path: square(100, 50, 200), evenOdd: false, background: [red], strokes: [],
  }, {
    children: [
      node('Group A', { t: 'group' }, {
        class: 'Grup',
        children: [
          node('Box', { t: 'shape', path: square(120, 70, 100), fills: [red], strokes: [{ paint: black, width: 4, cap: 'round', join: 'miter', miter: 4, align: 'center', dash: [[8, 4], 0], behind: false }], evenOdd: false }, {
            opacity: 0.5, blend: 'Multiply', effects: [{ t: 'shadow', inner: false, c: { model: 'rgb', r: 0, g: 0, b: 0, a: 1 }, opacity: 0.5, radius: 6, distance: 10, angle: Math.PI / 2 }, { t: 'glow', c: { model: 'rgb', r: 1, g: 1, b: 0, a: 1 }, opacity: 1, radius: 4 }],
          }),
          node('Round', { t: 'shape', path: circleish, fills: [{ t: 'gradient', k: 'linear', stops: [{ o: 0, c: { model: 'rgb', r: 1, g: 0, b: 0, a: 1 }, bias: 0.5 }, { o: 1, c: { model: 'rgb', r: 0, g: 0, b: 1, a: 1 }, bias: 0.5 }], tf: [100, 0, 0, 100, 250, 150] }], strokes: [], evenOdd: true }),
          node('Hidden', { t: 'shape', path: square(0, 0, 5), fills: [red], strokes: [], evenOdd: false }, { visible: false }),
        ],
      }),
      node('Title', { t: 'text', runs: [run('Hello '), run('bold', { weight: 700, fill: red }), run('\nsecond line', { italic: true, underline: true })], align: 'left', anchor: [130, 200], frame: null, tf: ident, textTf: ident }, { effects: [{ t: 'overlay', paint: red, opacity: 1, blend: 'Normal' }] }),
      node('Pic', { t: 'image', w: 40, h: 20, tf: [2, 0, 0, 2, 300, 60], enc: 'png', cmyk: false, data: { o: 0, l: 8 } }, { blend: 'LinearLight' }),
      node('Mask', { t: 'shape', path: square(0, 0, 5), fills: [red], strokes: [], evenOdd: false }, { mask: circleish }),
    ],
  });
  return { dpi: 72, savedBy: null, warnings: ['adjustment layers (left out) (2×)', 'blur effects (left out) (1×)'], cmykProfile: false, masters: [], spreads: [
    { bounds: [0, 0, 500, 300], pages: [], transparent: false, nodes: [board, node('Outside', { t: 'shape', path: square(0, 0, 5), fills: [red], strokes: [], evenOdd: false })] },
  ] };
}

test('artboards become frames of editable rows with a plain report', async () => {
  const stored: unknown[] = [];
  const result = await mapAffinityDocument(sample(), { image: img => { stored.push(img); return { id: 'asset-1', type: 'raster' }; } });
  assert.equal(result.frames.length, 1);
  const frame = result.frames[0]!;
  assert.equal(frame.name, 'Poster'); assert.equal(frame.width, 320); assert.equal(frame.height, 200); assert.equal(frame.background, '#ff0000');
  const byName = (n: string) => frame.boxes.find(b => b.name === n)!;
  // A rectangle stays a rectangle, moved into the artboard's own coordinates, with its stroke and shadow.
  const box = byName('Box');
  assert.equal(box.kind, 'box'); assert.equal(box.shape, 'rect');
  assert.equal(box.x, 20 - 2); assert.equal(box.y, 20 - 2); assert.equal(box.w, 104); assert.equal(box.strokeW, 4);
  assert.equal(box.blend, 'multiply'); assert.equal(box.opacity, 50); assert.equal(box.group, 'Group A');
  assert.equal(box.strokeDashArray, '8 4'); assert.equal(box.shadow, 'box'); assert.equal(box.shadowY, 10); assert.equal(box.shadowBlur, 6);
  // A curve is a path row with Design's own authored nodes and the fill rule.
  const round = byName('Round');
  assert.equal(round.kind, 'path'); assert.equal(round.fillRule, 'evenodd'); assert.match(String(round.path), /^1!cubic!1/);
  assert.match(String(round.grad), /^lin\.srgb_90_/);
  assert.ok(!frame.boxes.some(b => b.name === 'Hidden'));
  // Text stays text, with run styles in Design's markup.
  const title = byName('Title');
  assert.equal(title.kind, 'text'); assert.match(String(title.text), /\{#ff0000 w700\|bold\}/); assert.match(String(title.text), /\n\*\{u\|second line\}\*$/);
  assert.equal(title.fontSize, 20);
  const pic = byName('Pic');
  assert.equal(pic.kind, 'image'); assert.equal(pic.x, 200); assert.equal(pic.w, 80); assert.equal(stored.length, 1);
  const text = result.report.map(r => `${r.kind}: ${r.text}`);
  assert.ok(text.includes('dropped: Hidden layers'));
  assert.ok(text.includes('dropped: Vector masks'));
  assert.ok(text.some(t => /^effect: Outer glows/.test(t)));
  assert.ok(text.some(t => /^effect: Colour and gradient overlays/.test(t)));
  assert.ok(text.some(t => /Blend mode LinearLight imported as Normal/.test(t)));
  assert.ok(text.some(t => /^dropped: Objects outside every artboard/.test(t)));
  assert.ok(text.some(t => /^adjustment: adjustment layers/.test(t)));
  assert.ok(text.some(t => /^effect: blur effects/.test(t)));
});

test('a document with no artboards maps each spread, and an unplaceable picture is reported', async () => {
  const model = sample();
  model.spreads = [{ bounds: [0, 0, 200, 100], pages: [], transparent: true, nodes: [node('Pic', { t: 'image', w: 10, h: 10, tf: ident, enc: 'other', cmyk: false, data: null })] }, { bounds: [0, 0, 50, 50], pages: [], transparent: false, nodes: [] }];
  const result = await mapAffinityDocument(model, { image: () => { throw new Error('should not be asked'); } });
  assert.deepEqual(result.frames.map(f => [f.name, f.width, f.height, f.background, f.spread]), [['Spread 1', 200, 100, '', 0], ['Spread 2', 50, 50, '#ffffff', 1]]);
  assert.ok(result.report.some(r => r.text === 'Pictures in a format Design cannot read'));
});

test('a canvas past the pixel limit and an empty model are refused', async () => {
  const model = sample();
  model.spreads = [{ bounds: [0, 0, 20000, 20000], pages: [], transparent: false, nodes: [] }];
  await assert.rejects(mapAffinityDocument(model, { image: () => null }), /too large/);
  model.spreads = [];
  await assert.rejects(mapAffinityDocument(model, { image: () => null }), /No pages/);
});

test('mean difference is zero for equal pictures and scales with the gap', () => {
  const a = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]);
  assert.equal(meanDifference(a, a), 0);
  assert.equal(Math.round(meanDifference(a, new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]))), 50);
});

// ── the public corpus ───────────────────────────────────────────────────────

test('the manifest lists only clearly licensed files under the corpus limit', async () => {
  const entries = await manifest();
  assert.equal(entries.length, 53);
  assert.ok(entries.every(e => ['MIT', 'CC0-1.0', 'Apache-2.0'].includes(e.licence) && /^[0-9a-f]{64}$/.test(e.sha256) && /^[0-9a-f]{40}$/.test(e.commit)));
  assert.ok(entries.reduce((n, e) => n + e.bytes, 0) < 150 * 1024 * 1024);
});

test('stage 1 opens every corpus file with its preview and facts', { skip: have ? false : FETCH }, async () => {
  const kernel = await loadAffinityKernel();
  let opened = 0;
  for (const e of (await manifest()).filter(x => /\.(af|afdesign|aftemplate)$/.test(x.name))) {
    const info = kernel.inspect(new Uint8Array(await readFile(join(corpus, e.name))), e.name);
    assert.ok(info.preview && info.preview.width > 0 && info.preview.png.length > 100, e.name);
    assert.deepEqual([...info.preview!.png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], e.name);
    assert.ok(info.container >= 8 && info.container <= 12, e.name);
    assert.ok(info.document && info.document.pages >= 1, e.name);
    opened++;
  }
  assert.equal(opened, 51);
  const boards = kernel.inspect(new Uint8Array(await readFile(join(corpus, 'patchy-artboards.af'))), 'patchy-artboards.af');
  assert.equal(boards.container, 12); assert.equal(boards.document!.artboards, 2); assert.equal(boards.kind, 'af');
});

test('stage 2 maps every corpus file and its artboards stay near the embedded thumbnails', { skip: have ? false : FETCH }, async () => {
  const { summary, results } = await measureAll();
  assert.equal(summary.stage2Mapped, 51);
  assert.equal(summary.comparedFiles, 51);
  // Recorded 2026-11-02: 3.62 % over files, 3.3 % over 56 artboards. Lab pixels, adjustments and masks are the large ones.
  assert.ok(summary.meanOfArtboardsPercent! <= 5, `mean ${summary.meanOfArtboardsPercent}`);
  assert.ok(summary.meanOfFileMeansPercent! <= 5, `mean ${summary.meanOfFileMeansPercent}`);
  for (const r of results) assert.ok(r.meanDiffPercent! <= 55, `${r.file} differs by ${r.meanDiffPercent}`);
});

test('lolly affinity prints the facts, writes the preview and the Design rows', { skip: have ? false : FETCH }, async () => {
  const run = promisify(execFile), bin = resolve(import.meta.dirname, '../shells/cli/bin/lolly.ts');
  const source = join(corpus, 'patchy-artboards.af'), dir = await mkdtemp(join(tmpdir(), 'lolly-cli-affinity-'));
  try {
    const { stdout } = await run(process.execPath, [bin, 'affinity', source, '--json']);
    const facts = JSON.parse(stdout) as { kind: string; container: number; artboards: number };
    assert.deepEqual([facts.kind, facts.container, facts.artboards], ['af', 12, 2]);
    await run(process.execPath, [bin, 'affinity', source, `--preview=${join(dir, 'p.png')}`]);
    assert.deepEqual([...(await readFile(join(dir, 'p.png'))).subarray(1, 4)], [0x50, 0x4e, 0x47]);
    const { stderr } = await run(process.execPath, [bin, 'affinity', source, `--output=${join(dir, 'd.json')}`]);
    const design = JSON.parse(await readFile(join(dir, 'd.json'), 'utf8')) as { frames: { boxes: unknown[] }[]; report: unknown[] };
    assert.equal(design.frames.length, 2); assert.equal(typeof stderr, 'string');
    await assert.rejects(run(process.execPath, [bin, 'affinity', join(dir, 'p.png')]), /not an Affinity document/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
