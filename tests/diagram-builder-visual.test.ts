// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { buildDiagramHooks } from '../scripts/build-diagram-hooks.ts';
import { baseHost } from './helpers/host.ts';

const directory = new URL('../community/', import.meta.url);
const source = await readFile(new URL('diagram-builder/hooks.js', directory), 'utf8');
const tool = await loadTool('diagram-builder', path => readFile(new URL(path, directory), 'utf8'));
const geom = makeGeomApi();
const colour = makeColorApi();
const api = new Function('host', `${source}; return { dbHead, dbRounded, dbSample, dbPort, dbRoute, dbHits, dbRamp, dbAppearance, dbAccent };`)({ color: colour });
const values = (runtime: Awaited<ReturnType<typeof createRuntime>>) => Object.fromEntries(runtime.getModel().map(item => [item.id, item.value]));
async function render(initial: Parameters<typeof createRuntime>[2] = {}, overrides: Record<string, unknown> = {}) {
  return createRuntime(tool, baseHost({ geom, color: colour, ...overrides }), initial);
}
function svgOf(runtime: Awaited<ReturnType<typeof createRuntime>>) {
  const dom = new JSDOM(runtime.getHydrated() as string);
  const svg = dom.window.document.querySelector('svg');
  assert.ok(svg, 'a diagram is rendered');
  assert.doesNotMatch(svg.textContent || '', /Could not build/);
  return { dom, svg };
}

test('diagram helper assembly is current', () => assert.equal(buildDiagramHooks(), source));
test('new diagrams seed Minimal; sparse historical input and explicit Legacy retain the legacy renderer', async () => {
  const fresh = await render();
  assert.equal(values(fresh).look, 'minimal');
  assert.equal(values(fresh).arrowHead, 'open');
  assert.equal(values(fresh).labelSize, 16);
  assert.equal(values(fresh).gridBg, 'none');
  const historical: Record<string, string>[] = [{ source: 'text' }, { look: 'legacy' }, { title: 'Saved diagram' }];
  for (const input of historical) {
    const old = await render(input);
    assert.equal(values(old).look, 'legacy');
    assert.equal(values(old).labelSize, 10);
    assert.doesNotMatch(old.getHydrated() as string, /data-diagram-look/);
  }
});
test('look recipes and authored overrides survive runtime save/reload and reset is explicit', async () => {
  const rt = await render({ look: 'flow', cardWidth: 264, nodeFill: '#abcdef', directionMarkers: 'none' });
  assert.equal(values(rt).cardWidth, 264);
  assert.equal(values(rt).nodeFill, '#abcdef');
  const restored = await render(values(rt));
  assert.equal(restored.getHydrated(), rt.getHydrated());
  await rt.setInput('look', 'studio');
  assert.equal(values(rt).nodeFill, '#abcdef', 'look selection keeps authored colour');
  await rt.setInput('resetLook', true);
  assert.equal(values(rt).nodeFill, '');
  assert.equal(values(rt).resetLook, false);
  assert.equal(values(rt).cardWidth, 208);
});
test('URL round trips retain look, authored styles and appended per-edge routing', async () => {
  const rt = await render({ look: 'studio', cardWidth: 260, connectionRoute: 'elbow', arrows: [{ from: 'ceo', to: 'design', route: 'curve', color: '#6644aa' }] });
  const query = serializeUrlState(rt.getModel());
  const parsed = parseUrlState(query, tool.manifest);
  const restored = await render(parsed.values);
  assert.equal(restored.getHydrated(), rt.getHydrated());
});
test('explicit global fill takes precedence over focal material; brand radius stays linked across reload', async () => {
  const tokens = { resolve: async (path: string) => path === '{shape.radius}' ? '8px' : null };
  const inherited = await render({ look: 'minimal' }, { tokens });
  assert.equal(values(inherited).radiusMode, 'design');
  const restored = await render(values(inherited), { tokens });
  assert.equal(inherited.getHydrated(), restored.getHydrated());
  const custom = await render({ look: 'studio', cornerRadius: 12, nodeFill: '#abcdef' }, { tokens });
  assert.equal(values(custom).radiusMode, 'custom');
  const { dom, svg } = svgOf(custom);
  assert.ok(svg.querySelector('[data-diagram-node="ceo"] path[fill="#abcdef"]'));
  dom.window.close();
});
test('open head wings are exactly 90 degrees apart and 45 degrees from the shaft, with round caps', () => {
  for (const tangent of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 3, y: -4 }]) {
    const markup = api.dbHead({ x: 100, y: 100 }, tangent, 10, '#123456', 'open', 2);
    assert.match(markup, /stroke-linecap="round"/);
    assert.match(markup, /stroke-linejoin="round"/);
    const d = /d="([^"]+)"/.exec(markup)![1];
    const [a, tip, b] = api.dbSample(d);
    const va = { x: a.x - tip.x, y: a.y - tip.y }, vb = { x: b.x - tip.x, y: b.y - tip.y };
    assert.ok(Math.abs(va.x * vb.x + va.y * vb.y) < 0.001);
    assert.ok(Math.abs(Math.abs((va.x * tangent.x + va.y * tangent.y) / (Math.hypot(va.x, va.y) * Math.hypot(tangent.x, tangent.y))) - Math.SQRT1_2) < 0.001);
  }
});
test('tiny rounded elbows stay within their segments and degenerate paths remain finite', () => {
  const points = api.dbSample(api.dbRounded([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 8, y: 1 }], 40));
  assert.ok(points.every((p: { x: number; y: number }) => p.x >= 0 && p.x <= 8 && p.y >= 0 && p.y <= 1));
  assert.equal(api.dbRounded([{ x: 0, y: 0 }, { x: 0, y: 0 }], 20), '');
});
test('ports lie on actual diamond, ellipse, pill, cylinder and hexagon silhouettes', () => {
  const n = { cx: 0, cy: 0, hw: 100, hh: 30 };
  const diamond = api.dbPort({ ...n, shape: 'diamond' }, 'right', 1, 0);
  assert.equal(diamond.x / 100 + Math.abs(diamond.y) / 30, 1);
  const ellipse = api.dbPort({ ...n, shape: 'ellipse' }, 'right', 1, 0);
  assert.ok(Math.abs((ellipse.x / 100) ** 2 + (ellipse.y / 30) ** 2 - 1) < 1e-9);
  const pill = api.dbPort({ ...n, shape: 'pill' }, 'right', 1, 0);
  assert.ok(Math.abs((pill.x - 70) ** 2 + pill.y ** 2 - 900) < 1e-9);
  assert.ok(api.dbPort({ ...n, shape: 'cylinder' }, 'top', 1, 0).y > -30);
  assert.equal(api.dbPort({ ...n, shape: 'hexagon' }, 'right', 1, 0).x, 80);
});
test('a connection routes around an unrelated card and a self loop is finite', () => {
  const a = { cx: 0, cy: 0, hw: 80, hh: 30 }, b = { cx: 520, cy: 0, hw: 80, hh: 30 }, obstacle = { cx: 260, cy: 0, hw: 80, hh: 60 };
  const style = { routeDirection: 'right', arrowWidth: 1.75, inp: { bendRadius: 16, cardDepth: 1 } };
  const route = api.dbRoute(a, b, style, [a, b, obstacle], 0.5, 0.5, 'elbow', 0);
  assert.equal(route.unresolved, false);
  assert.ok(route.points.every((p: { x: number; y: number }, i: number) => !i || !api.dbHits(route.points[i - 1], p, obstacle, 10)));
  assert.doesNotMatch(api.dbRoute(a, a, style, [a], 0.5, 0.5, 'elbow', 0).d, /NaN|Infinity/);
});
test('DTCG gradient stop positions affect the cumulative-distance ramp', () => {
  const ramp = api.dbRamp('#000000', '#ffffff', { inp: {}, brand: { gradient: { value: [
    { color: '#ff0000', position: 0 }, { color: '#00ff00', position: 0.25 }, { color: '#0000ff', position: 1 },
  ] } } });
  assert.equal(ramp[16], '#00ff00');
  assert.equal(ramp[64], '#0000ff');
});
test('every look uses portable geometry with live text and valid bounds', async () => {
  for (const look of ['minimal', 'editorial', 'soft', 'flow', 'studio']) {
    const { dom, svg } = svgOf(await render({ look, source: 'text', diagramType: 'process', flowDir: 'right', dsl: 'Discover -> Build -> Share' }));
    assert.equal(svg.dataset.diagramLook, look);
    assert.equal(svg.querySelectorAll('[data-diagram-node]').length, 3);
    assert.equal(svg.querySelectorAll('[data-diagram-edge]').length, 2);
    assert.ok(svg.querySelectorAll('text').length >= 3);
    assert.equal(svg.querySelectorAll('filter, linearGradient, radialGradient, marker').length, 0);
    assert.doesNotMatch(svg.outerHTML, /NaN|Infinity/);
    dom.window.close();
  }
});
test('all diagram types and source modes remain renderable with modern styling', async () => {
  for (const diagramType of ['org', 'mindmap', 'layercake', 'kanban', 'process', 'timeline', 'cycle', 'pyramid', 'matrix', 'gantt']) {
    const { dom, svg } = svgOf(await render({ look: 'minimal', diagramType }));
    assert.doesNotMatch(svg.outerHTML, /NaN|Infinity/);
    dom.window.close();
  }
  for (const source of ['visual', 'text', 'ascii', 'mermaid', 'dot', 'pikchr', 'table']) {
    const { dom } = svgOf(await render({ look: 'flow', source }));
    dom.window.close();
  }
});
test('partial design systems use neutral fallbacks and brand changes are resolved on the next render', async () => {
  let primary = '#983ace', family = 'Example Sans';
  const tokens = {
    colors: async () => [{ path: 'color.semantic.primary', value: primary }],
    resolve: async (path: string) => path === '{font.brand}' ? family : null,
  };
  const rt = await render({ look: 'editorial', source: 'text', dsl: 'Root\n  Child' }, { tokens });
  assert.match(rt.getHydrated() as string, /#983ace/);
  assert.match(rt.getHydrated() as string, /font-family="Example Sans"/);
  primary = '#b23b28'; family = 'Another Sans';
  await rt.setInput('title', 'Changed brand');
  assert.match(rt.getHydrated() as string, /#b23b28/);
  assert.match(rt.getHydrated() as string, /font-family="Another Sans"/);
  assert.doesNotMatch(rt.getHydrated() as string, /SUSE|#983ace/);
});
test('long labels wrap without reducing type and cycle ranks keep every node', async () => {
  const { dom, svg } = svgOf(await render({ look: 'minimal', source: 'mermaid', mermaid: 'graph LR\n A[Eine außergewöhnlich lange Beschriftung] --> B{Ready?}\n B --> C[Build]\n C --> B\n B --> D[Share]' }));
  assert.equal(svg.querySelectorAll('[data-diagram-node]').length, 4);
  const text = [...svg.querySelectorAll('[data-diagram-node="a"] text')];
  assert.ok(text.length > 1);
  assert.ok(text.every(t => Number(t.getAttribute('font-size')) === 16));
  assert.equal(text.map(t => t.textContent).join(' ').replace(/\s/g, ''), 'EineaußergewöhnlichlangeBeschriftung');
  dom.window.close();
});
test('imported layer defaults follow two-accent, monochrome and incomplete design systems', async () => {
  for (const [primary, secondary] of [['#6e35cf', '#ef702a'], ['#222222', '#222222'], ['#284c74', undefined]]) {
    const tokens = { colors: async () => [
      { path: 'color.semantic.primary', value: primary },
      ...(secondary ? [{ path: 'color.semantic.secondary', value: secondary }] : []),
    ] };
    const rt = await render({ look: 'soft', source: 'text', diagramType: 'layercake', dsl: '# Experience\nWebsite\n# Services\nIdentity' }, { tokens });
    assert.doesNotMatch(rt.getHydrated() as string, /#90ebcd|#bff1ea|#d8f3ec|SUSE/);
  }
});
test('missing-glyph notices remain visible after cached measurements', async () => {
  const text = { fontUrl: async () => ({ url: 'test:font' }), toPath: async () => ({ advanceWidth: 5, notdef: 1 }) };
  const rt = await render({ look: 'minimal', source: 'text', dsl: '東京\n  العربية' }, { text });
  assert.match(rt.getHydrated() as string, /characters are missing/);
  await rt.setInput('title', 'Changed');
  assert.match(rt.getHydrated() as string, /characters are missing/);
  assert.match(rt.getHydrated() as string, /direction="rtl"/);
});

test('canvas annotations name the visible source and the original authored connection row', async () => {
  const sources: Record<string, string>[] = [
    { source: 'text', dsl: 'A -> B' },
    { source: 'mermaid', mermaid: 'graph LR\nA[One] --> B[Two]' },
    { source: 'dot', dot: 'digraph { a -> b }' },
    { source: 'pikchr', pikchr: 'box "One"; arrow; box "Two"' },
  ];
  for (const input of sources) {
    const rt = await render({ ...input, look: 'minimal', diagramType: 'process' });
    const { dom, svg } = svgOf(rt);
    const ref = input.source === 'text' ? 'dsl' : input.source;
    assert.ok(svg.querySelector(`[data-diagram-node][data-canvas-input="${ref}"]`));
    assert.equal(svg.querySelector('[data-canvas-input^="nodes:"]'), null);
    dom.window.close();
  }
  const rt = await render({ look: 'minimal', arrows: [{ from: 'ceo', to: 'design', label: 'Advises' }] });
  const { dom, svg } = svgOf(rt);
  assert.ok(svg.querySelector('[data-diagram-edge][data-canvas-input="arrows:0"]'));
  assert.ok(svg.querySelector('[data-diagram-edge] [data-export-hide]'));
  dom.window.close();
});

test('wrapped groups retain card width and disconnected process components stay together', async () => {
  const group = await render({ look: 'minimal', source: 'text', diagramType: 'layercake', layerColumns: 3, dsl: '# Capabilities\nOne\nTwo\nThree\nFour\nFive\nSix' });
  const { dom, svg } = svgOf(group);
  const cards = [...svg.querySelectorAll('[data-diagram-node]')];
  assert.equal(cards.length, 6);
  const textY = cards.map(card => Number(card.querySelector('text')?.getAttribute('y')));
  assert.equal(new Set(textY).size, 2);
  assert.ok(Math.max(...textY.slice(0, 3)) < Math.min(...textY.slice(3)));
  dom.window.close();
  const process = await render({ look: 'minimal', source: 'dot', dot: 'digraph { rankdir=LR; a -> x; b -> x; c -> y; d -> y; }' });
  const output = svgOf(process);
  const y = (id: string) => Number(output.svg.querySelector(`[data-diagram-node="${id}"] text`)?.getAttribute('y'));
  assert.ok(y('a') < y('x') && y('x') < y('b'));
  assert.ok(y('c') < y('y') && y('y') < y('d'));
  assert.ok(y('b') < y('c'));
  output.dom.window.close();
});

test('per-card emphasis overrides the look and diamond text fits the actual inner rectangle', async () => {
  const rt = await render({ look: 'studio', focalEmphasis: 'none', nodes: [
    { nodeId: 'a', label: 'Design', detail: 'Brand and product', shape: 'diamond', emphasis: 'accent' },
    { nodeId: 'b', label: 'Build', shape: 'rounded', emphasis: 'quiet' },
  ] });
  const { dom, svg } = svgOf(rt);
  assert.doesNotMatch(rt.getHydrated() as string, /Some cards need more space/);
  const fill = (id: string) => svg.querySelector(`[data-diagram-node="${id}"] > path`)?.getAttribute('fill');
  assert.notEqual(fill('a'), fill('b'));
  dom.window.close();
});
