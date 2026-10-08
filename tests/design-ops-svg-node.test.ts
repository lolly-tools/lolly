// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's browser-free Design page export (plan 295, P3d): the Node host for the
 * engine's `designPageSvg`, when it draws a page and when it hands one to the browser
 * tier, and the CLI run that delivers the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { HostV1, ExportFormat } from '@lolly-tools/core/host-v1';
import { createMockHost } from '@lolly-tools/core';
import { embedC2pa } from '@lolly/engine';
import { createRuntime } from '../engine/src/runtime.ts';
import { packQuery } from '../engine/src/url-pack.ts';
import { designPageSvg } from '../engine/src/design-page-svg.ts';
import { designOpsSvgNode } from '../packages/node-shell/src/design-ops-svg.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';
import { RenderIntegrityError } from '../packages/node-shell/src/render-integrity.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';
import { encodePng } from './helpers/studio3d-glb.ts';

const ROOT = repoRoot();
const boxes = [
  { id: 'cover', kind: 'frame', x: 0, y: 0, w: 640, h: 400, bg: '#f4f1ea', order: 0 },
  { id: 'title', kind: 'text', x: 40, y: 40, w: 560, h: 120, text: 'Drawn **without** a browser', fontSize: 40, frame: 'cover' },
  { id: 'chip', kind: 'box', x: 40, y: 200, w: 200, h: 80, bg: '#1c7ed6', shape: 'rounded', radius: 16, stroke: '#0b7285', strokeW: 4, frame: 'cover' },
  { id: 'second', kind: 'frame', x: 700, y: 0, w: 300, h: 200, order: 1 },
];
const frameNode = (id: string | null) => ({ getAttribute: (name: string) => (name === 'data-frame-id' ? id : null) }) as unknown as Element;
const text = createNodeTextAPI({ repoRoot: ROOT });
const host = { text, assets: { get: async (id: string) => { throw new Error(`no asset ${id}`); } } } as unknown as HostV1;
const doc = (rows: unknown[]) => ({ sourceDocument: { toolId: 'design', values: { boxes: rows } } });

test('a frame draws from the operations in Node, byte for byte the engine pipeline', async () => {
  const page = await designOpsSvgNode(frameNode('cover'), doc(boxes), host, { repoRoot: ROOT });
  assert.ok(page && 'svg' in page, `the page is drawn (${page && 'reason' in page ? page.reason : 'no page'})`);
  const expected = await designPageSvg({ boxes }, 'cover', { shaper: createNodeTextShaper({ repoRoot: ROOT }), toPath: (o) => text.toPath(o), picture: async () => null },
    { dpi: 96, size: { width: '640px', height: '400px', px: { w: 640, h: 400 } } });
  assert.equal(page.svg, expected.svg);
  assert.ok(!page.svg.includes('<text'), 'the words are outlines');
});

test('Node hands a page to the browser tier, with the reason, whenever it cannot draw all of it', async () => {
  assert.equal(await designOpsSvgNode(frameNode('cover'), {}, host, { repoRoot: ROOT }), null, 'not a Design document: not this path at all');
  const reason = async (node: Element, opts: object, rows: unknown[] = boxes) => {
    const out = await designOpsSvgNode(node, { ...doc(rows), ...opts }, host, { repoRoot: ROOT });
    return out && 'reason' in out ? out.reason : '';
  };
  assert.match(await reason(frameNode(null), {}), /not a single frame/);
  assert.match(await reason(frameNode('cover'), { watermark: true }), /watermark/);
  assert.match(await reason(frameNode('gone'), {}), /no visible frame "gone"/);
  const withEmoji = boxes.map((row) => (row.id === 'title' ? { ...row, text: 'Hello 👋' } : row));
  assert.match(await reason(frameNode('cover'), {}, withEmoji), /text-emoji \(title\)/);
  const withBrandColor = boxes.map((row) => (row.id === 'chip' ? { ...row, bg: 'var(--brand-primary)' } : row));
  assert.match(await reason(frameNode('cover'), {}, withBrandColor), /color-unresolved \(chip\)/, 'a brand colour only the live page can read');
  const withPicture = [...boxes, { id: 'pic', kind: 'image', x: 300, y: 200, w: 100, h: 100, image: 'missing/asset', frame: 'cover' }];
  assert.match(await reason(frameNode('cover'), {}, withPicture), /image-unread \(pic\)/, 'a picture the host cannot read is never left out');
});

test('the CLI exports a Design frame as SVG without a browser', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-ops-'));
  try {
    const out = join(dir, 'cover.svg');
    const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(boxes)}`, '--s=cover', '--export=svg', `--output=${out}`], {
      cwd: ROOT, encoding: 'utf8',
      // No web build to escalate to: success here can only be the browser-free path.
      env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), NO_COLOR: '1' },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stderr, /Escalating/);
    const svg = await readFile(out, 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="640px" height="400px" viewBox="0 0 640 400"/);
    // Convert paths is off by default, so the words stay live text. Outlined words are
    // covered by design-draw.test.ts and design-page-svg.test.ts.
    assert.ok(svg.includes('<metadata>') && svg.includes('fill="#1c7ed6"'), 'the export metadata and the box');
    assert.match(svg, /<tspan [^>]*>without<\/tspan>/, 'the words as live text');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Design SVGZ is gzip of the same operations SVG, including metadata and physical dimensions', async () => {
  const dom = new JSDOM('<div data-frame-id="cover"><span>editor</span><span>controls</span></div>');
  try {
    const bridge = await createCliBridge({ dom: dom as never });
    const node = dom.window.document.querySelector('[data-frame-id]')!;
    for (const convertPaths of [false, true]) {
      const opts = { ...doc(boxes), convertPaths, width: '210mm', height: '100mm',
        meta: { software: 'Lolly', source: 'https://lolly.tools/t/design', author: 'Example', tool: 'Design', contact: '', description: 'Proof' } };
      const svg = await bridge.export.render(node, 'svg', opts);
      const svgz = await bridge.export.render(node, 'svgz' as ExportFormat, opts);
      assert.equal(svgz.type, svg.type);
      assert.deepEqual(gunzipSync(Buffer.from(await svgz.arrayBuffer())), Buffer.from(await svg.arrayBuffer()));
      const markup = await svg.text();
      assert.match(markup, /width="210mm" height="100mm"/);
      assert.match(markup, /viewBox="0 0 640 400"/);
      assert.match(markup, /<metadata>/);
      assert.equal(markup.includes('<text'), !convertPaths);
    }
  } finally {
    dom.window.close();
  }
});

test('SVG and SVGZ refuse composed snapshots and retain all other whole-page admission reasons', async () => {
  const dom = new JSDOM('<div data-frame-id="cover"><span>editor</span><span>controls</span></div>');
  try {
    const bridge = await createCliBridge({ dom: dom as never });
    const node = dom.window.document.querySelector('[data-frame-id]')!;
    const picture = { id: 'pic', kind: 'image', x: 300, y: 200, w: 100, h: 100, image: 'missing/asset', frame: 'cover' };
    const cases: Array<{ opts: Parameters<HostV1['export']['render']>[2]; reason: RegExp }> = [
      { opts: { sourceDocument: { toolId: 'design', values: { boxes, textDocument: 'Stories' } } }, reason: /composes text stories/ },
      { opts: { ...doc(boxes), watermark: true }, reason: /watermark/ },
      { opts: doc(boxes.map(row => row.id === 'chip' ? { ...row, bgBlur: 8 } : row)), reason: /background-blur \(chip\)/ },
      { opts: doc(boxes.map(row => row.id === 'chip' ? { ...row, bg: 'var(--brand-primary)' } : row)), reason: /color-unresolved \(chip\)/ },
      { opts: doc([...boxes, picture]), reason: /image-unread \(pic\)/ },
      { opts: doc([...boxes, { ...picture, image: 'pictures/icon?theme=dark' }]), reason: /image-unread \(pic\)/ },
      { opts: doc(boxes.map(row => row.id === 'title' ? { ...row, text: 'Hello 👋' } : row)), reason: /text-emoji \(title\)/ },
    ];
    for (const format of ['svg', 'svgz']) for (const { opts, reason } of cases) {
      await assert.rejects(() => bridge.export.render(node, format as ExportFormat, opts), reason, `${format}: ${reason}`);
    }
    // Even if the composed render has one native SVG, its pre-hook snapshot cannot replace the composed page.
    node.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><text>Composed</text></svg>';
    await assert.rejects(() => bridge.export.render(node, 'svgz' as ExportFormat, cases[0]!.opts), /composes text stories/);

    const signed = await embedC2pa(encodePng(4, 4, () => [30, 140, 80, 255]), 'png', { title: 'Source picture', claimGenerator: 'Lolly test' });
    bridge.assets = { ...bridge.assets, get: async () => ({ source: 'library', id: 'pictures/signed', url: 'source.png', type: 'raster', format: 'png' }), bytes: async () => signed };
    node.innerHTML = '<span>editor</span><span>controls</span>';
    const opts = { ...doc([...boxes, { ...picture, image: 'pictures/signed' }]), c2pa: false };
    for (const format of ['svg', 'svgz']) await assert.rejects(() => bridge.export.render(node, format as ExportFormat, opts), /Content Credentials/);
  } finally {
    dom.window.close();
  }
});

test('an operations integrity error stays fatal rather than becoming a browser admission reason', async () => {
  const failure = new RenderIntegrityError('hook-failed', 'deliberate source integrity failure');
  const faulty = boxes.map(row => row.id === 'title' ? { ...row, get text(): string { throw failure; } } : row);
  await assert.rejects(() => designOpsSvgNode(frameNode('cover'), doc(faulty), host, { repoRoot: ROOT }), error => error === failure);
});

test('the CLI writes byte-identical SVG/SVGZ pages with default, live and outlined Design controls and no browser', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-svgz-'));
  try {
    const paths = await packQuery('convertPaths=1');
    assert.ok(paths, 'the same saved Convert paths state used by a shared link');
    const modes = [[], ['--text=live'], ['--text=outline'], [`--z=${paths}`, '--text=outline'], [`--z=${paths}`, '--width=210', '--height=100', '--unit=mm']];
    for (const [index, flags] of modes.entries()) {
      const outputs = [];
      for (const format of ['svg', 'svgz']) {
        const out = join(dir, `cover-${index}.${format}`);
        const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(boxes)}`, '--s=cover', `--export=${format}`, `--output=${out}`, '--no-provenance', ...flags], {
          cwd: ROOT, encoding: 'utf8', timeout: 30_000,
          env: { ...process.env, LOLLY_ROOT: ROOT, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDERER: 'chromium', NO_COLOR: '1' },
        });
        assert.equal(run.status, 0, `${format}: ${run.stderr}`);
        assert.doesNotMatch(run.stderr, /Escalating/);
        const bytes = await readFile(out);
        outputs.push(format === 'svgz' ? gunzipSync(bytes) : bytes);
      }
      assert.deepEqual(outputs[1], outputs[0], `mode ${flags.join(' ') || 'default'}`);
      assert.equal(outputs[0]!.toString().includes('<text'), index < 3, 'Design keeps its existing Convert paths model semantics');
      if (index === 4) assert.match(outputs[0]!.toString(), /width="210mm" height="100mm"/);
    }
    const out = join(dir, 'attributed.svgz');
    const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(boxes)}`, '--s=cover', '--export=svgz', `--output=${out}`], {
      cwd: ROOT, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, LOLLY_ROOT: ROOT, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDERER: 'chromium', NO_COLOR: '1' },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(gunzipSync(await readFile(out)).toString(), /<metadata>/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('outlined decoration keeps the existing underline refusal', async () => {
  for (const value of ['{u|Underline only}', '{u s|Underline and strike}']) {
    const rows = [boxes[0], { ...boxes[1], text: value }];
    const out = await designOpsSvgNode(frameNode('cover'), doc(rows), host, { repoRoot: ROOT });
    assert.ok(out && 'reason' in out);
    assert.match(out.reason, /text-decoration/, value);
  }
});

test('the CLI delivers variable-face outlined strikes as identical SVG/SVGZ without a browser', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-strikes-svgz-'));
  try {
    const paths = await packQuery('convertPaths=1');
    const rows = [boxes[0], ...[100, 400, 700, 900].map((weight, index) => ({ id: `strike-${weight}`, frame: 'cover', kind: 'text', x: 20, y: 20 + index * 80, w: 350, h: 70, fontSize: 48, weight, align: 'left', valign: 'top', text: '{s|Strike through}' }))];
    const outputs: Buffer[] = [];
    for (const format of ['svg', 'svgz']) {
      const out = join(dir, `strikes.${format}`);
      const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(rows)}`, '--s=cover', `--export=${format}`, `--output=${out}`, `--z=${paths}`, '--text=outline', '--no-provenance'], {
        cwd: ROOT, encoding: 'utf8', timeout: 30_000,
        env: { ...process.env, LOLLY_ROOT: ROOT, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDERER: 'chromium', NO_COLOR: '1' },
      });
      assert.equal(run.status, 0, run.stderr); assert.doesNotMatch(run.stderr, /Escalating/);
      const bytes = await readFile(out); outputs.push(format === 'svgz' ? gunzipSync(bytes) : bytes);
    }
    assert.deepEqual(outputs[0], outputs[1]);
    const svg = outputs[0]!.toString();
    assert.doesNotMatch(svg, /<text|<tspan/);
    const document = new JSDOM(svg).window.document;
    assert.equal(document.querySelectorAll('rect[height="4"]').length, 4, 'each resolved face carries the current CSS auto strike paint');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a recorded hook failure cannot become an SVG/SVGZ browser fallback or write a file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-svgz-broken-'));
  try {
    await mkdir(join(dir, 'catalog', 'tools'), { recursive: true });
    await mkdir(join(dir, 'catalog', 'assets'), { recursive: true });
    await mkdir(join(dir, 'tools', 'design'), { recursive: true });
    await writeFile(join(dir, 'catalog', 'tools', 'index.json'), JSON.stringify({ tools: [{ id: 'design' }] }));
    await writeFile(join(dir, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
    await writeFile(join(dir, 'tools', 'design', 'template.html'), '<div data-frame-id="f"><p>One</p><p>Two</p></div>');
    for (const hook of ['onInit', 'beforeExport']) {
      await writeFile(join(dir, 'tools', 'design', 'tool.json'), JSON.stringify({
        id: 'design', name: 'Design fixture', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
        render: { width: 120, height: 80, formats: ['svg'] }, hooks: { [hook]: true },
        inputs: [{ id: 'textDocument', type: 'longtext', default: 'Stories' }],
      }));
      await writeFile(join(dir, 'tools', 'design', 'hooks.js'), `function ${hook}() { throw new Error("deliberate SVG hook failure"); }`);
      for (const format of ['svg', 'svgz']) {
        const output = join(dir, `failed-${hook}.${format}`);
        const run = spawnSync(process.execPath, [join(ROOT, 'shells/cli/bin/lolly.ts'), 'run', 'design', `--export=${format}`, `--output=${output}`, '--no-provenance', '--html-fallback'], {
          cwd: dir, encoding: 'utf8', timeout: 30_000,
          env: { ...process.env, LOLLY_ROOT: dir, LOLLY_STATE_DIR: join(dir, 'state'), LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDERER: 'chromium', NO_COLOR: '1' },
        });
        assert.notEqual(run.status, 0, run.stderr);
        assert.match(run.stderr, hook === 'onInit' ? /render produced no usable output.*deliberate SVG hook failure/ : /Error: deliberate SVG hook failure/);
        assert.doesNotMatch(run.stderr, /Escalating/);
        assert.doesNotMatch(run.stderr, /Cannot export/);
        assert.equal(existsSync(output), false);
        assert.equal(existsSync(output.replace(/\.svgz?$/, '.html')), false, 'a fatal hook failure cannot produce an HTML substitute');
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Design SVG, SVGZ and PDF receive detached authored snapshots before hooks, without inferred page sizes', async () => {
  for (const format of ['svg', 'svgz', 'pdf']) {
    const value = createMockHost();
    let captured: Parameters<HostV1['export']['render']>[2];
    value.export.render = async (_node, _format, opts) => { captured = opts; return new Blob(['page']); };
    const tool = {
      manifest: { id: 'design', name: 'Design fixture', version: '1.0.300', engineVersion: '^1.0.0', status: 'community',
        render: { width: 1920, height: 1080, formats: ['svg', 'pdf'] }, hooks: { beforeExport: true },
        inputs: [{ id: 'boxes', type: 'blocks', fields: [{ id: 'bg', type: 'text' }] }] },
      template: '<div>page</div>', styles: null, hooksSource: 'function beforeExport(ctx) { ctx.model.find(x => x.id === "boxes").value[0].bg = "#aabbcc"; }',
      hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
    } as unknown as Parameters<typeof createRuntime>[0];
    const runtime = await createRuntime(tool, value, { boxes: [{ bg: '#112233' }] });
    try {
      await runtime.export({} as Element, format, { c2pa: false });
      assert.equal(captured?.sourceDocument?.toolId, 'design');
      assert.deepEqual(captured?.sourceDocument?.values.boxes, [{ bg: '#112233' }], 'beforeExport mutation cannot rewrite the snapshot');
      assert.equal(captured?.width, undefined);
      assert.equal(captured?.height, undefined);
      const snapshot = captured!.sourceDocument!.values.boxes as Array<{ bg: string }>;
      snapshot[0]!.bg = '#445566';
      assert.deepEqual(runtime.getModel().find(row => row.id === 'boxes')!.value, [{ bg: '#aabbcc' }], 'export IO cannot mutate the authored model');
    } finally {
      runtime.destroy();
    }
  }
});

test('beforeExport failure preserves its message and cause, and a later successful export is not poisoned', async () => {
  const value = createMockHost();
  let rendered = 0;
  value.export.render = async () => { rendered++; return new Blob(['page']); };
  const tool = {
    manifest: { id: 'svgz-export-recovery', name: 'Export fixture', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
      render: { width: 10, height: 10, formats: ['svg'] }, hooks: { beforeExport: true }, inputs: [{ id: 'ready', type: 'boolean', default: false }] },
    template: '<div>page</div>', styles: null, hooksSource: 'function beforeExport(ctx) { if (!ctx.model.find(x => x.id === "ready").value) throw new Error("Finish the page before export"); }',
    hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
  } as unknown as Parameters<typeof createRuntime>[0];
  const runtime = await createRuntime(tool, value, {});
  try {
    await assert.rejects(() => runtime.export({} as Element, 'svgz', { c2pa: false }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'ExportHookError');
      assert.equal(error.message, 'Finish the page before export');
      assert.ok(error.cause instanceof Error);
      assert.equal(error.cause.message, error.message);
      return true;
    });
    assert.equal(rendered, 0);
    assert.deepEqual(runtime.hookErrors, [], 'the failed attempt does not poison later attempts');
    await runtime.setInput('ready', true);
    assert.equal(await (await runtime.export({} as Element, 'svgz', { c2pa: false })).text(), 'page');
    assert.equal(rendered, 1);
  } finally {
    runtime.destroy();
  }
});
