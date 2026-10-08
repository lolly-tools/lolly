// SPDX-License-Identifier: MPL-2.0
/** Browser-free Design PDF admission, print finishing and delivered credentials. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, PDFName, PDFArray, decodePDFRawStream, PDFRawStream } from 'pdf-lib';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { embedC2pa, extractC2paStore, verifyC2pa } from '@lolly/engine';
import { encodePng } from './helpers/studio3d-glb.ts';
import { designOpsPdfNode } from '../packages/node-shell/src/design-ops-pdf.ts';
import { nodePathFormat, NODE_FORMATS } from '../packages/node-shell/src/raster.ts';
import { printGeometryForSize } from '../packages/node-shell/src/pdf-finishing.ts';
import type { PdfFinishingOpts } from '../packages/node-shell/src/pdf-finishing.ts';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';

const ROOT = repoRoot();
const rows = [
  { id: 'a', kind: 'frame', x: 0, y: 0, w: 640, h: 400, bg: '#ffffff', order: 0 },
  { id: 'title', kind: 'text', frame: 'a', x: 24, y: 24, w: 590, h: 90, text: 'Outlined PDF', fontSize: 38 },
  { id: 'chip', kind: 'box', frame: 'a', x: 24, y: 150, w: 180, h: 100, bg: '#1c7ed6', shape: 'rounded', radius: 16 },
  { id: 'b', kind: 'frame', x: 700, y: 0, w: 300, h: 200, bg: '#0b7285', order: 1 },
];
const pageNode = (ids: Array<string | null> = ['a', 'b']) => ({ querySelectorAll: () => ids.map((id) => ({ getAttribute: () => id })) }) as unknown as Element;
const host = { text: createNodeTextAPI({ repoRoot: ROOT }), assets: { get: async () => null }, log: () => {} } as unknown as HostV1;
const options = (overrides: PdfFinishingOpts = {}): PdfFinishingOpts => ({
  sourceDocument: { toolId: 'design', values: { boxes: rows } }, convertPaths: true,
  meta: { software: 'Lolly', source: 'https://lolly.tools/t/design', tool: 'Design', author: 'Example', contact: '', description: 'A PDF proof' },
  ...overrides,
});
const bytesOf = async (opts = options(), use = host) => {
  const out = await designOpsPdfNode(pageNode(), opts, use, { repoRoot: ROOT });
  assert.ok(out && 'pdf' in out, out && 'reason' in out ? out.reason : 'not admitted');
  return new Uint8Array(await out.pdf.arrayBuffer());
};

test('only Design PDF is a Node candidate; complete outlined pages reopen with their authored sizes and metadata', async () => {
  assert.equal(nodePathFormat({ id: 'design' }, 'pdf'), true);
  assert.equal(nodePathFormat({ id: 'other' }, 'pdf'), false);
  assert.equal(NODE_FORMATS.includes('pdf'), false);
  const doc = await PDFDocument.load(await bytesOf(), { updateMetadata: false });
  assert.deepEqual(doc.getPages().map((p) => p.getSize()), [{ width: 480, height: 300 }, { width: 225, height: 150 }]);
  assert.equal(doc.getTitle(), 'Design');
  assert.equal(doc.getAuthor(), 'Example');
  assert.equal(doc.getCreator(), 'Lolly');
  assert.equal(doc.getProducer(), 'Lolly');
  const intent = doc.catalog.lookup(PDFName.of('OutputIntents'), PDFArray);
  assert.equal(intent.size(), 1);
  assert.ok(doc.getPages().every((p) => p.node.get(PDFName.of('TrimBox'))));
  assert.ok(!doc.context.enumerateIndirectObjects().some(([, o]) => String(o).includes('/Type /Font')), 'all artwork text is outlined');
});

test('bleed, marks and page boxes use the same finishing geometry on every page', async () => {
  const opts = options({ bleed: '3mm', cropMarks: true, registrationMarks: true, bleedMarks: true, colorBars: true, barStyle: 'rgb-swatches' });
  const doc = await PDFDocument.load(await bytesOf(opts), { updateMetadata: false });
  for (const [i, page] of doc.getPages().entries()) {
    const f = i ? { w: 225, h: 150 } : { w: 480, h: 300 };
    const g = printGeometryForSize(f.w, f.h, opts, opts.palette)!;
    assert.deepEqual(page.getSize(), { width: g.page.w, height: g.page.h });
    assert.deepEqual(page.getTrimBox(), { x: g.boxes.trim.x, y: g.page.h - g.boxes.trim.y - g.boxes.trim.h, width: f.w, height: f.h });
    assert.deepEqual(page.getArtBox(), page.getTrimBox());
    assert.ok(page.getBleedBox().width > f.w);
    const contents = page.node.lookup(PDFName.of('Contents'), PDFArray);
    assert.ok(contents.size() >= 2, 'print operators are added after the artwork stream');
  }
});

test('proof attribution keeps its existing unembedded-font PDF-X claim withholding', async () => {
  const doc = await PDFDocument.load(await bytesOf(options({ provenance: true })), { updateMetadata: false });
  const metadata = doc.catalog.lookup(PDFName.of('Metadata'));
  assert.ok(metadata instanceof PDFRawStream);
  const xml = new TextDecoder().decode(decodePDFRawStream(metadata).decode());
  assert.ok(xml.includes('Lolly'));
  assert.ok(!xml.includes('GTS_PDFXVersion'));
  assert.equal(doc.catalog.lookup(PDFName.of('OutputIntents'), PDFArray).size(), 1);
});

test('live text, composed stories, standard passwords, watermark and unsupported pages preserve their explicit browser reason', async () => {
  const reason = async (opts: PdfFinishingOpts, node = pageNode()) => {
    const out = await designOpsPdfNode(node, opts, host, { repoRoot: ROOT });
    return out && 'reason' in out ? out.reason : '';
  };
  assert.equal(await designOpsPdfNode(pageNode(), {}, host, { repoRoot: ROOT }), null);
  assert.match(await reason(options({ convertPaths: false })), /live text/);
  assert.match(await reason(options({ sourceDocument: { toolId: 'design', values: { boxes: rows, textDocument: 'Stories' } } })), /composes text/);
  assert.match(await reason(options({ password: 'secret' })), /standard password/);
  assert.match(await reason(options({ watermark: true })), /watermark/);
  assert.match(await reason(options(), pageNode(['a', null])), /not a Design frame/);
  const withShadow = rows.map((r) => r.id === 'chip' ? { ...r, shadow: 'box' } : r);
  assert.match(await reason(options({ sourceDocument: { toolId: 'design', values: { boxes: withShadow } } })), /shadow.*chip/);
  const withPicture = [...rows, { id: 'image', kind: 'image', frame: 'a', x: 300, y: 150, w: 80, h: 80, image: 'pictures/icon?theme=dark' }];
  assert.match(await reason(options({ sourceDocument: { toolId: 'design', values: { boxes: withPicture } } })), /image-unread.*image/);
});

test('a credentialed picture is handed whole to the browser even when the caller disables final signing', async () => {
  const png = encodePng(4, 4, () => [30, 140, 80, 255]);
  const signed = await embedC2pa(png, 'png', { title: 'Source picture', claimGenerator: 'Lolly test' });
  assert.ok(extractC2paStore(signed));
  const pictures = { ...host, assets: { get: async () => ({ id: 'pictures/signed', url: 'source.png', type: 'image' }), bytes: async () => signed } } as unknown as HostV1;
  const opts = options({ c2pa: false, sourceDocument: { toolId: 'design', values: { boxes: [...rows, { id: 'image', kind: 'image', frame: 'a', x: 300, y: 150, w: 80, h: 80, image: 'pictures/signed' }] } } });
  const out = await designOpsPdfNode(pageNode(), opts, pictures, { repoRoot: ROOT });
  assert.ok(out && 'reason' in out && out.reason.includes('Content Credentials'));
});

test('the CLI delivers a marked, credentialed outlined Design PDF while its browser endpoints are unavailable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-pdf-'));
  try {
    const file = join(dir, 'deck.pdf');
    const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(rows)}`, '--text=outline', '--export=pdf', '--bleed=3mm', '--marks=crop,reg', `--output=${file}`], {
      cwd: ROOT, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDERER: 'chromium', NO_COLOR: '1' },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stderr, /Escalating|Content Credentials not attached/);
    const bytes = new Uint8Array(await readFile(file));
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    assert.equal(doc.getPageCount(), 2);
    assert.equal(doc.getPage(0).getTrimBox().width, 480);
    assert.ok(doc.getPage(0).getMediaBox().width > 480, 'CLI print settings are applied');
    assert.ok(extractC2paStore(bytes));
    const report = await verifyC2pa(bytes);
    assert.ok(report.checks.some((c) => c.code === 'assertion.dataHash.match' && c.ok), 'the final credential binds the finished marked bytes');
    assert.ok(report.checks.some((c) => c.code === 'claimSignature.validated' && c.ok));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a recorded hook failure cannot become a PDF browser admission fallback', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-pdf-broken-'));
  try {
    await mkdir(join(dir, 'catalog', 'tools'), { recursive: true });
    await mkdir(join(dir, 'catalog', 'assets'), { recursive: true });
    await mkdir(join(dir, 'tools', 'design'), { recursive: true });
    await writeFile(join(dir, 'catalog', 'tools', 'index.json'), JSON.stringify({ tools: [{ id: 'design' }] }));
    await writeFile(join(dir, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
    await writeFile(join(dir, 'tools', 'design', 'tool.json'), JSON.stringify({
      id: 'design', name: 'Design fixture', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
      render: { width: 120, height: 80, formats: ['pdf'] }, hooks: { onInit: true }, inputs: [],
    }));
    await writeFile(join(dir, 'tools', 'design', 'template.html'), '<div data-pdf-page data-frame-id="f"></div>');
    await writeFile(join(dir, 'tools', 'design', 'hooks.js'), 'function onInit() { throw new Error("deliberate PDF hook failure"); }');
    const output = join(dir, 'failed.pdf');
    const run = spawnSync(process.execPath, [join(ROOT, 'shells/cli/bin/lolly.ts'), 'run', 'design', '--export=pdf', '--text=outline', `--output=${output}`, '--no-provenance'], {
      cwd: dir, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, LOLLY_ROOT: dir, LOLLY_STATE_DIR: join(dir, 'state'), LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDERER: 'chromium', NO_COLOR: '1' },
    });
    assert.notEqual(run.status, 0, run.stderr);
    assert.match(run.stderr, /render produced no usable output.*deliberate PDF hook failure/);
    assert.doesNotMatch(run.stderr, /Escalating/);
    assert.equal(existsSync(output), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
