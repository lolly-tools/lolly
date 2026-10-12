// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { hydrate } from '../engine/src/template.ts';
import { nodeToBox, penpotShapeToNode } from '../engine/src/design-map.ts';
import { boxesToPenpotDoc, buildPenpotEntries, seededPenpotUuid } from '../engine/src/penpot-file.ts';
import { compileDesignDraw } from '../engine/src/design-draw.ts';
import { designPageSvg } from '../engine/src/design-page-svg.ts';
import { hasVisibleDesignGroupComposite, paintDesignGroupPage } from '../shells/web/src/bridge/export-group-compositing.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';

const hooks = readFileSync(new URL('../community/design/hooks.js', import.meta.url), 'utf8');
const compute = new Function('host', `${hooks}; return compute;`)({});
const template = readFileSync(new URL('../community/design/template.html', import.meta.url), 'utf8');
const box = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, kind: 'box', x: 120, y: 80, w: 100, h: 40, bg: '#ff0000', ...extra });
const source = () => [
  box('f', { kind: 'frame', x: 100, y: 50, w: 300, h: 200, pageId: 'one', stroke: '#000', strokeW: 4 }),
  box('outer', { kind: 'group', frame: 'f', opacity: 50, blend: 'multiply' }),
  box('a', { group: 'outer', opacity: 80 }),
  box('inner', { kind: 'group', group: 'outer', opacity: 50 }),
  box('b', { group: 'inner', bg: '#0000ff' }),
];
const model = (boxes: Record<string, unknown>[], pages = [{ id: 'one', name: 'One' }]) => [{ id: 'boxes', value: boxes }, { id: 'pages', value: pages }, { id: 'background', value: '#ffffff' }];

test('nested group wrappers apply appearance once and retain canonical leaf indices and frame origin', () => {
  const rows = source(), before = JSON.stringify(rows), output = compute(model(rows));
  const dom = new JSDOM(hydrate(template, output)).window.document;
  const outer = dom.querySelector('[data-design-group="outer"]')!, inner = dom.querySelector('[data-design-group="inner"]')!;
  assert.equal(inner.parentElement, outer);
  assert.equal(outer.parentElement?.getAttribute('data-frame-id'), 'f');
  assert.match(outer.getAttribute('style')!, /isolation:isolate;opacity:0\.5;mix-blend-mode:multiply/);
  assert.match(inner.getAttribute('style')!, /opacity:0\.5/);
  assert.equal(outer.getAttribute('data-canvas-input'), null, 'compositor dimensions do not masquerade as group geometry');
  const leaf = dom.querySelector('[data-box-id="a"]')!;
  assert.equal(leaf.getAttribute('data-canvas-input'), 'boxes:2');
  assert.match(leaf.getAttribute('style')!, /left:16px;top:26px/);
  assert.match(leaf.getAttribute('style')!, /opacity:0\.8/);
  assert.ok(!dom.querySelector('[data-box-id="b"]')!.getAttribute('style')!.includes('opacity:'));
  assert.equal(JSON.stringify(rows), before);
});

test('loose page and pasteboard groups share wrappers without crossing artboard or page boundaries', () => {
  const rows = [...source(), box('loose', { kind: 'group', pageId: 'two', opacity: 60 }), box('c', { group: 'loose' })];
  const pages = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];
  const preview = new JSDOM(hydrate(template, compute(model(rows, pages), undefined, undefined, undefined, { pageId: 'two' }))).window.document;
  assert.equal(preview.querySelector('[data-design-group="outer"]'), null);
  assert.equal(preview.querySelector('[data-box-id="c"]')?.parentElement?.getAttribute('data-design-group'), 'loose');
  assert.equal(preview.querySelector('[data-design-group="loose"]')?.closest('[data-pdf-page]'), null);
  const full = new JSDOM(hydrate(template, compute(model(rows, pages)))).window.document;
  assert.equal(full.querySelector('[data-design-group="loose"]')?.closest('[data-frame-id]')?.getAttribute('data-frame-id'), '__page-export:two');
  const bare = new JSDOM(hydrate(template, compute([{ id: 'boxes', value: rows.slice(1).map(row => ({ ...row, frame: '', pageId: '' })) }]))).window.document;
  assert.equal(bare.querySelector('[data-design-group="outer"]')?.closest('.artboard') !== null, true);
});

test('native Penpot archives retain collective group opacity, blend and independent child opacity', () => {
  const rows = source(), doc = boxesToPenpotDoc(rows, { name: 'Group document', canvas: { w: 400, h: 300 }, pages: [{ id: 'one', name: 'One' }] });
  const built = buildPenpotEntries(doc, { uuid: seededPenpotUuid(306) });
  const records = Object.values(built.entries).filter((value): value is string => typeof value === 'string').map(value => { try { return JSON.parse(value); } catch { return null; } });
  const outer = records.find(row => row?.type === 'group' && row.name === 'outer');
  assert.ok(outer); assert.equal(outer.opacity, .5); assert.equal(outer.blendMode, 'multiply');
  const mapped = nodeToBox(penpotShapeToNode(outer, { preserveHierarchy: true }), { id: 'restored' });
  assert.equal(mapped.kind, 'group'); assert.equal(mapped.opacity, 50); assert.equal(mapped.blend, 'multiply');
  assert.equal(records.find(row => row?.type === 'rect' && row.opacity === .8)?.opacity, .8);
  assert.deepEqual(built.warnings, []);
  assert.throws(() => boxesToPenpotDoc(rows.map(row => row.id === 'outer' ? { ...row, blur: 4 } : row), { name: 'Group document', canvas: { w: 400, h: 300 }, pages: [{ id: 'one', name: 'One' }] }), /SVG copy/);
});

test('direct drawing shortcuts report group compositing instead of drawing marker fills or losing descendants', async () => {
  const rows = source(), drawing = compileDesignDraw(rows as never, { width: 300, height: 200 }, { effects: true });
  assert.ok(drawing.findings.some(row => row.feature === 'group-compositing'));
  assert.ok(!drawing.ops.some(row => row.id === 'outer' || row.id === 'inner'));
  const result = await designPageSvg({ boxes: rows }, 'f', { picture: async () => null, shaper: async () => { throw new Error('This fixture has no text to shape.'); } });
  assert.ok(result.findings.some(row => row.feature === 'group-compositing'));
});

test('PDF group capture preserves point placement, obeys capture bounds and fails visibly when disabled or unavailable', async () => {
  const dom = new JSDOM('<div id="root"><div data-design-group="g" style="opacity:.5"><div>paint</div></div></div>');
  const oldWindow = globalThis.window; Object.assign(globalThis, { window: dom.window });
  try {
    const root = dom.window.document.getElementById('root')!, draws: unknown[][] = [], captures: number[][] = [];
    const pdf = { addImage: (...args: unknown[]) => draws.push(args) }, region = { x: 12, y: 34, w: 144, h: 72 };
    const options = { rasterFallback: true, dpi: 150, maxPixels: 200 };
    assert.equal(hasVisibleDesignGroupComposite(root), true);
    assert.equal(await paintDesignGroupPage(pdf, root, region, options, async (_node, w, h) => { captures.push([w, h]); return 'data:image/png;base64,capture'; }), true);
    assert.deepEqual(captures, [[200, 150]]);
    assert.deepEqual(draws, [['data:image/png;base64,capture', 'PNG', 12, 34, 144, 72]]);
    await assert.rejects(paintDesignGroupPage(pdf, root, region, { ...options, rasterFallback: false }, async () => null), /Enable raster fallback/);
    await assert.rejects(paintDesignGroupPage(pdf, root, region, options, async () => null), /could not capture/);
    root.style.display = 'none';
    assert.equal(hasVisibleDesignGroupComposite(root), false);
    assert.equal(await paintDesignGroupPage(pdf, root, region, { ...options, rasterFallback: false }, async () => null), false);
  } finally { Object.assign(globalThis, { window: oldWindow }); dom.window.close(); }
});

test('CLI drawing shortcuts refuse group effects with explicit browser capability codes', async () => {
  const dom = new JSDOM('<div data-pdf-page data-frame-id="f"><div data-design-group="outer"><div>paint</div></div></div>');
  try {
    const bridge = await createCliBridge({ dom: dom as never }), node = dom.window.document.body.firstElementChild!;
    const options = { sourceDocument: { toolId: 'design', values: { boxes: source() } } };
    await assert.rejects(bridge.export.render(node, 'svg', options), (error: Error & { code?: string }) => {
      assert.equal(error.code, 'NEEDS_BROWSER'); assert.match(error.message, /group-compositing/); return true;
    });
    await assert.rejects(bridge.export.render(node, 'pdf', options), (error: Error & { code?: string }) => {
      assert.equal(error.code, 'DESIGN_PDF_BROWSER_REQUIRED'); assert.match(error.message, /group-compositing/); return true;
    });
  } finally { dom.window.close(); }
});
