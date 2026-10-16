// SPDX-License-Identifier: MPL-2.0
/**
 * diagram-builder fixtures: six recorded diagrams keep their content census and
 * their direction through parse, render, and URL and session round trips.
 *
 * Run with: node --test "tests/diagram-builder-fixtures.test.ts"  (or pnpm test)
 * No test framework - uses node:test built-in.
 *
 * Each file in tests/fixtures/diagram-builder records a source (tool inputs, or a
 * literal shared link), the census a reader expects from it (ids, labels, directed
 * connections, groups and the layout direction) and the source features the tool
 * supports, simplifies or skips. The census is written from the source text, not
 * generated from the parser, so a parser or renderer change that loses content
 * fails here. tests/fixtures/diagram-builder/README.md describes the format.
 *
 * The parsers are compiled from the REAL hooks.js the way engine/src/runtime.ts
 * does (new Function('host', src)), and the render goes through createRuntime,
 * so these checks pin the shipping code, not a copy of the parsers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = new URL('../community/', import.meta.url);
const FIXTURES = new URL('./fixtures/diagram-builder/', import.meta.url);
const tool: any = await loadTool('diagram-builder', path => readFile(new URL(path, COMMUNITY), 'utf8'));
const manifestInput = (id: string) => tool.manifest.inputs.find((i: any) => i.id === id);

// ─── fixture format ──────────────────────────────────────────────────────────

interface CensusNode {
  id: string; source?: string; label: string; detail?: string; shape?: string;
  group?: string; parent?: string; start?: string; end?: string; milestone?: boolean; rtl?: boolean;
}
interface CensusEdge {
  from: string; to: string; label: string; style?: string; heads?: 'end' | 'none' | 'both';
  kind?: 'forward' | 'return'; messages?: string[];
}
interface CensusGroup { id: string; source?: string; label: string; members: string[] }
interface Fixture {
  id: string; title: string; purpose: string;
  inputs?: Record<string, unknown>;
  url?: string;
  source?: { participants: string[]; messages: { id: string; from: string; to: string; label: string; arrow: string }[] };
  census: {
    look?: string; diagramType: string; direction: 'right' | 'down' | 'chronological';
    nodes: CensusNode[]; edges: CensusEdge[]; groups: CensusGroup[];
  };
  features: { supported: string[]; simplified: string[]; unsupported: string[] };
}

/** Types that read a card's Group; the other types ignore the field. */
const GROUPED = new Set(['layercake', 'kanban', 'gantt']);
const REQUIRED = ['branch-return', 'dense-architecture', 'dated-roadmap', 'repeated-messages', 'long-multilingual', 'sparse-legacy-url'];
const files = readdirSync(FIXTURES).filter(name => name.endsWith('.json')).sort();
const raw = new Map(files.map(name => [name, readFileSync(new URL(name, FIXTURES), 'utf8')]));
const fixtures: Fixture[] = files.map(name => JSON.parse(raw.get(name)!));

// ─── the shipping parsers ────────────────────────────────────────────────────

interface Normalised {
  idx: number; id: string; label: string; detail: string; shape: string;
  parentId: string; layerId: string; _sd: number; _ed: number; _milestone: boolean;
}
interface Parsers {
  parseMermaid: (text: string) => any;
  parseDot: (text: string) => any;
  parseDsl: (text: string, mode: string) => any;
  parseTable: (text: string, mode: string) => any;
  normaliseNodes: (nodes: unknown[]) => Normalised[];
  parseDay: (value: unknown) => { day: number } | null;
  slug: (value: unknown) => string;
}
const hooks = readFileSync(new URL('diagram-builder/hooks.js', COMMUNITY), 'utf8');
const P = new Function('host',
  `${hooks}; return { parseMermaid, parseDot, parseDsl, parseTable, normaliseNodes, parseDay, slug };`,
)({ log: () => {} }) as Parsers;
const day = (iso: string) => P.parseDay(iso)!.day;

type Values = NonNullable<Parameters<typeof createRuntime>[2]>;

/** The values a fixture opens with: its inputs, or its link read the way a shell reads one. */
function openingValues(fx: Fixture): Values {
  if (fx.url !== undefined) return parseUrlState(fx.url, tool.manifest).values as Values;
  return structuredClone(fx.inputs!) as Values;
}

/** What the parser makes of the source, reduced to the census fields. */
function parseStage(fx: Fixture) {
  const v = openingValues(fx);
  const source = String(v.source ?? manifestInput('source').default);
  const type = String(v.diagramType ?? manifestInput('diagramType').default);
  let parsed: any;
  if (source === 'mermaid') parsed = P.parseMermaid(String(v.mermaid));
  else if (source === 'dot') parsed = P.parseDot(String(v.dot));
  else if (source === 'text') parsed = { ...P.parseDsl(String(v.dsl), type), warns: [] };
  else if (source === 'table') parsed = { ...P.parseTable(String(v.table), type), warns: [] };
  else parsed = { nodes: v.nodes ?? [], layers: v.layers ?? [], arrows: v.arrows ?? [], warns: [] };
  const diagramType = parsed.diagramType || type;
  const dirInput = diagramType === 'org' || diagramType === 'mindmap' ? 'orgDir' : diagramType === 'timeline' ? 'timelineDir' : 'flowDir';
  const direction = diagramType === 'gantt' ? 'chronological'
    : parsed.dir || (diagramType === 'layercake' ? 'down' : String(v[dirInput] ?? manifestInput(dirInput).default));
  const nodes = P.normaliseNodes(parsed.nodes);
  const edges = (parsed.arrows as any[]).map(a => ({
    from: P.slug(a.from), to: P.slug(a.to), label: String(a.label ?? '').trim(), style: a.style || 'solid',
    heads: a.head === 'none' ? 'none' : a.double === true || a.head === 'double' ? 'both' : 'end',
  }));
  const groups = (parsed.layers as any[]).map(l => {
    const id = P.slug(l.layerId) || P.slug(l.label);
    return { id, label: String(l.label).trim(), members: nodes.filter(n => n.layerId === id).map(n => n.id) };
  });
  return { values: v, diagramType, direction, nodes, edges, groups, warns: parsed.warns as string[] };
}

// ─── reading a rendered diagram ──────────────────────────────────────────────

interface Box { minX: number; minY: number; maxX: number; maxY: number }
type Point = { x: number; y: number };

/** Every coordinate pair of an absolute M/L/Q/C/Z path, which is all this tool emits. */
function pointsOf(d: string): Point[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) || []).map(Number);
  const out: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i]!, y: nums[i + 1]! });
  return out;
}
function boxOf(points: Point[]): Box {
  return {
    minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
    minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)),
  };
}
const centre = (b: Box): Point => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
const distance = (p: Point, b: Box) => Math.hypot(Math.max(b.minX - p.x, 0, p.x - b.maxX), Math.max(b.minY - p.y, 0, p.y - b.maxY));
const inside = (p: Point, b: Box, slack = 1) => p.x >= b.minX - slack && p.x <= b.maxX + slack && p.y >= b.minY - slack && p.y <= b.maxY + slack;
/** A card or band outline is the first path it draws itself; a depth shadow sits in a nested group. */
function outline(el: Element): Box {
  const path = el.querySelector(':scope > path');
  assert.ok(path, `${el.getAttribute('aria-label')}: an outline path is drawn`);
  return boxOf(pointsOf(path.getAttribute('d')!));
}
const squash = (s: string) => s.replace(/\s+/g, '');
const SHORTENED = /Some text is shortened/;

function renderCensus(fx: Fixture, html: string, notice: string, values: Record<string, unknown>) {
  const dom = new JSDOM(html);
  const svg = dom.window.document.querySelector('svg');
  assert.ok(svg, `${fx.id}: a diagram is rendered`);
  assert.doesNotMatch(svg.textContent || '', /Could not build/, `${fx.id}: the build did not fail`);
  assert.doesNotMatch(svg.outerHTML, /NaN|Infinity/, `${fx.id}: every coordinate is finite`);
  const legacy = fx.census.look === 'legacy';
  assert.equal(svg.hasAttribute('data-diagram-look'), !legacy, `${fx.id}: ${legacy ? 'the Legacy' : 'a modern'} renderer drew it`);

  // Cards: a modern card carries its id; a Gantt bar or a Legacy card points at its source row.
  const rows = P.normaliseNodes((values.nodes as unknown[]) ?? []);
  const cards = new Map<string, Element>();
  for (const el of svg.querySelectorAll('[data-diagram-node]')) cards.set(el.getAttribute('data-diagram-node')!, el);
  if (!cards.size) {
    for (const el of svg.querySelectorAll('[data-canvas-input^="nodes:"]')) {
      const m = /^nodes:(\d+)$/.exec(el.getAttribute('data-canvas-input')!);
      const row = m && rows.find(n => n.idx === Number(m[1]));
      if (row) cards.set(row.id, el);
    }
  }
  assert.deepEqual([...cards.keys()].sort(), fx.census.nodes.map(n => n.id).sort(), `${fx.id}: every card is drawn once`);
  const boxes = new Map<string, Box>();
  for (const n of fx.census.nodes) {
    const el = cards.get(n.id)!;
    assert.equal(el.getAttribute('aria-label'), n.label, `${fx.id}/${n.id}: the accessible name is the label`);
    const lines = [...el.querySelectorAll('text')].map(t => t.textContent || '');
    const shown = squash(lines.join(''));
    const expected = squash(n.label + (n.detail ?? ''));
    if (shown !== expected) assert.match(notice, SHORTENED, `${fx.id}/${n.id}: text is only shortened with a notice`);
    for (const line of lines) {
      assert.doesNotMatch(line, /^(?:\p{M}|\u200d|\ufe0f|\u{1f3fb}|\u{1f3fc}|\u{1f3fd}|\u{1f3fe}|\u{1f3ff})|\u200d$/u, `${fx.id}/${n.id}: wrapping keeps graphemes whole`);
    }
    if (n.rtl) {
      for (const t of el.querySelectorAll('text')) assert.equal(t.getAttribute('direction'), 'rtl', `${fx.id}/${n.id}: drawn right to left`);
    }
    boxes.set(n.id, outline(el));
  }

  // Groups: a band is the button whose settings edit band rows or band spacing.
  const bands = [...svg.querySelectorAll('[role="button"][data-canvas-settings]')].filter(el => {
    const settings = el.getAttribute('data-canvas-settings')!;
    return settings === 'rowGap siblingGap' || / layers(?::\d+)?:bandFill$/.test(' ' + settings);
  });
  assert.deepEqual(bands.map(el => el.getAttribute('aria-label')), fx.census.groups.map(g => g.label), `${fx.id}: every group is drawn once, in order`);
  const bandBoxes = bands.map(outline);
  fx.census.groups.forEach((g, i) => {
    const shown = squash([...bands[i]!.querySelectorAll('text')].map(t => t.textContent).join(''));
    if (shown !== squash(g.label)) assert.match(notice, SHORTENED, `${fx.id}/${g.id}: a group name is only shortened with a notice`);
    for (const member of g.members) {
      assert.ok(inside(centre(boxes.get(member)!), bandBoxes[i]!), `${fx.id}: ${member} sits inside the ${g.label} group`);
    }
  });

  // Connections.
  const hierarchy = new Set(fx.census.nodes.filter(n => n.parent).map(n => `${n.parent}>${n.id}`));
  if (legacy) legacyConnections(fx, svg, boxes);
  else modernConnections(fx, svg, boxes, hierarchy);

  layoutDirection(fx, boxes, bandBoxes);
  dom.window.close();
}

function modernConnections(fx: Fixture, svg: Element, boxes: Map<string, Box>, hierarchy: Set<string>) {
  const drawn = [...svg.querySelectorAll('[data-diagram-edge]')].map(el => {
    const [from, to] = el.getAttribute('data-diagram-edge')!.split(':');
    return { from: from!, to: to!, el };
  });
  /** A route leaves its source, arrives at its target and draws the stated heads after its hit area. */
  const route = (el: Element, from: string, to: string, heads: 'end' | 'none' | 'both') => {
    const a = boxes.get(from)!, b = boxes.get(to)!;
    const points = pointsOf(el.querySelector('path[data-export-hide]')!.getAttribute('d')!);
    const start = points[0]!, end = points[points.length - 1]!;
    assert.ok(distance(start, a) <= 8 && distance(start, a) < distance(start, b), `${fx.id}: ${from} > ${to} leaves ${from}`);
    assert.ok(distance(end, b) <= 8 && distance(end, b) < distance(end, a), `${fx.id}: ${from} > ${to} arrives at ${to}`);
    const hit = [...el.children].findIndex(c => c.hasAttribute('data-export-hide'));
    const drawnHeads = [...el.children].filter((c, k) => c.tagName === 'path' && k > hit).length;
    assert.equal(drawnHeads, { none: 0, end: 1, both: 2 }[heads], `${fx.id}: ${from} > ${to} draws ${heads} heads`);
  };
  // An org chart routes a parent with one child like a connection, headless and parent first.
  for (const h of drawn.filter(e => hierarchy.has(`${e.from}>${e.to}`))) route(h.el, h.from, h.to, 'none');
  const edges = drawn.filter(e => !hierarchy.has(`${e.from}>${e.to}`));
  assert.deepEqual(edges.map(e => `${e.from}>${e.to}`), fx.census.edges.map(e => `${e.from}>${e.to}`), `${fx.id}: every connection is drawn once, in source order`);
  for (const [i, e] of fx.census.edges.entries()) route(edges[i]!.el, e.from, e.to, e.heads ?? 'end');
  const labelled = [...svg.querySelectorAll('[role="button"][tabindex="-1"]')];
  const withLabels = fx.census.edges.map((e, i) => ({ e, el: edges[i]!.el })).filter(({ e }) => e.label);
  assert.equal(labelled.length, withLabels.length, `${fx.id}: one label per labelled connection`);
  withLabels.forEach(({ e, el }, i) => {
    assert.equal(labelled[i]!.getAttribute('aria-label'), el.getAttribute('aria-label'), `${fx.id}: label ${i} belongs to ${e.from} > ${e.to}`);
    assert.equal(labelled[i]!.textContent, e.label, `${fx.id}: ${e.from} > ${e.to} keeps its label`);
  });
}

/** Legacy draws straight shafts and triangle heads with no ids, so a head is matched by geometry. */
function legacyConnections(fx: Fixture, svg: Element, boxes: Map<string, Box>) {
  const heads = [...svg.querySelectorAll(':scope > path')]
    .map(p => p.getAttribute('d')!)
    .filter(d => /^M[-\d.]+ [-\d.]+L[-\d.]+ [-\d.]+L[-\d.]+ [-\d.]+Z$/.test(d))
    .map(d => {
      const [tip, a, b] = pointsOf(d) as [Point, Point, Point];
      const ux = tip.x - (a.x + b.x) / 2, uy = tip.y - (a.y + b.y) / 2, len = Math.hypot(ux, uy);
      return { tip, ux: ux / len, uy: uy / len };
    });
  const take = (from: string, to: string) => {
    const a = centre(boxes.get(from)!), b = centre(boxes.get(to)!), len = Math.hypot(b.x - a.x, b.y - a.y);
    const k = heads.findIndex(h => distance(h.tip, boxes.get(to)!) <= 1.5 && (h.ux * (b.x - a.x) + h.uy * (b.y - a.y)) / len > 0.999);
    assert.ok(k >= 0, `${fx.id}: a head on ${to} points away from ${from}`);
    heads.splice(k, 1);
  };
  for (const e of fx.census.edges) {
    if (e.heads !== 'none') take(e.from, e.to);
    if (e.heads === 'both') take(e.to, e.from);
  }
  assert.equal(heads.length, 0, `${fx.id}: no arrowhead without a connection`);
  const labels = [...svg.querySelectorAll(':scope > text[font-size="11.5"]')].map(t => t.textContent).sort();
  assert.deepEqual(labels, fx.census.edges.map(e => e.label).filter(Boolean).sort(), `${fx.id}: every connection label is drawn`);
}

function layoutDirection(fx: Fixture, boxes: Map<string, Box>, bandBoxes: Box[]) {
  const { direction } = fx.census;
  const at = (id: string) => centre(boxes.get(id)!);
  if (direction === 'chronological') {
    // Time runs left to right on one scale: bars start at their start day and end after their inclusive end day.
    const bars = fx.census.nodes.filter(n => !n.milestone);
    const first = bars.reduce((a, b) => day(a.start!) <= day(b.start!) ? a : b);
    const last = bars.reduce((a, b) => day(a.start!) >= day(b.start!) ? a : b);
    const x0 = boxes.get(first.id)!.minX, d0 = day(first.start!);
    const scale = (boxes.get(last.id)!.minX - x0) / (day(last.start!) - d0);
    assert.ok(scale > 0, `${fx.id}: later dates sit further right`);
    const x = (iso: string, extra = 0) => x0 + scale * (day(iso) + extra - d0);
    for (const n of fx.census.nodes) {
      const b = boxes.get(n.id)!;
      if (n.milestone) { assert.ok(Math.abs(centre(b).x - x(n.start!)) <= 1, `${fx.id}/${n.id}: the milestone sits on its date`); continue; }
      assert.ok(Math.abs(b.minX - x(n.start!)) <= 1, `${fx.id}/${n.id}: the bar starts on its start date`);
      assert.ok(Math.abs(b.maxX - x(n.end!, 1)) <= 1, `${fx.id}/${n.id}: the bar ends after its end date`);
    }
    return;
  }
  const axis = direction === 'right' ? 'x' : 'y';
  if (fx.census.diagramType === 'layercake') {
    bandBoxes.forEach((b, i) => { if (i) assert.ok(b.minY > bandBoxes[i - 1]!.maxY, `${fx.id}: group ${i + 1} stacks below group ${i}`); });
  }
  for (const n of fx.census.nodes) {
    if (n.parent) assert.ok(at(n.id)[axis] > at(n.parent)[axis] + 1, `${fx.id}: ${n.id} follows its parent ${n.parent} (${direction})`);
  }
  for (const e of fx.census.edges) {
    if (e.kind === 'forward') assert.ok(at(e.to)[axis] > at(e.from)[axis] + 1, `${fx.id}: ${e.from} > ${e.to} runs ${direction}`);
    if (e.kind === 'return') assert.ok(at(e.to)[axis] < at(e.from)[axis] - 1, `${fx.id}: ${e.from} > ${e.to} returns against the flow`);
  }
  if (fx.source) {
    const order = fx.source.participants.map(id => at(id)[axis]);
    assert.ok(order.every((v, i) => !i || v > order[i - 1]!), `${fx.id}: participants keep their declared order`);
  }
}

// ─── the tests ───────────────────────────────────────────────────────────────

test('the six recorded fixtures are present, named after their files and free of brand material', () => {
  for (const id of REQUIRED) assert.ok(files.includes(`${id}.json`), `${id}.json is recorded`);
  for (const [name, text] of raw) {
    const fx: Fixture = JSON.parse(text);
    assert.equal(`${fx.id}.json`, name, `${name}: id matches the file name`);
    assert.ok(fx.title && fx.purpose, `${name}: says what it is for`);
    assert.ok((fx.inputs === undefined) !== (fx.url === undefined), `${name}: records inputs or a link, not both`);
    assert.doesNotMatch(text, /suse/i, `${name}: no brand-specific content, so it works on lolly-start`);
    assert.doesNotMatch(text, /"image"\s*:\s*"[^"]/, `${name}: no asset references`);
  }
});

test('census records agree with themselves: source ids, group members and merged messages', () => {
  for (const fx of fixtures) {
    const ids = new Set(fx.census.nodes.map(n => n.id));
    assert.equal(ids.size, fx.census.nodes.length, `${fx.id}: node ids are unique`);
    for (const n of fx.census.nodes) {
      if (n.source) assert.equal(P.slug(n.source), n.id, `${fx.id}: ${n.source} becomes ${n.id}`);
      if (n.parent) assert.ok(ids.has(n.parent), `${fx.id}: ${n.id} reports to a recorded node`);
    }
    for (const e of fx.census.edges) assert.ok(ids.has(e.from) && ids.has(e.to), `${fx.id}: ${e.from} > ${e.to} joins recorded nodes`);
    for (const g of fx.census.groups) {
      if (g.source) assert.equal(P.slug(g.source), g.id, `${fx.id}: ${g.source} becomes ${g.id}`);
      assert.deepEqual(g.members, fx.census.nodes.filter(n => n.group === g.id).map(n => n.id), `${fx.id}: ${g.id} lists its members in order`);
    }
    if (!fx.source) continue;
    // Every message belongs to exactly one connection, numbered by its position in the source.
    const position = new Map(fx.source.messages.map((m, i) => [m.id, i + 1]));
    const merged = fx.census.edges.flatMap(e => e.messages ?? []);
    assert.deepEqual([...merged].sort(), fx.source.messages.map(m => m.id).sort(), `${fx.id}: every message is accounted for once`);
    for (const e of fx.census.edges) {
      const messages = e.messages!.map(id => fx.source!.messages.find(m => m.id === id)!);
      assert.ok(messages.every(m => m.from === e.from && m.to === e.to), `${fx.id}: ${e.from} > ${e.to} merges only its own direction`);
      assert.equal(e.label, messages.map(m => `${position.get(m.id)}. ${m.label}`).join(' · '), `${fx.id}: ${e.from} > ${e.to} keeps each message and its number`);
    }
  }
});

for (const fx of fixtures) {
  test(`${fx.id}: the parser keeps the census, the direction and the reported features`, () => {
    const parsed = parseStage(fx);
    assert.equal(parsed.diagramType, fx.census.diagramType);
    assert.equal(parsed.direction, fx.census.direction);
    assert.deepEqual(parsed.nodes.map(n => n.id), fx.census.nodes.map(n => n.id), 'source ids, in order');
    for (const [i, n] of fx.census.nodes.entries()) {
      const got = parsed.nodes[i]!;
      assert.equal(got.label, n.label, `${n.id}: label`);
      assert.equal(got.detail, n.detail ?? '', `${n.id}: detail`);
      if (n.shape) assert.equal(got.shape, n.shape, `${n.id}: shape`);
      if (GROUPED.has(fx.census.diagramType)) assert.equal(got.layerId, n.group ?? '', `${n.id}: group`);
      assert.equal(got.parentId, n.parent ?? '', `${n.id}: parent`);
      if (n.start) assert.equal(got._sd, day(n.start), `${n.id}: start date`);
      if (n.end) assert.equal(got._ed, day(n.end), `${n.id}: end date`);
      assert.equal(got._milestone, n.milestone === true, `${n.id}: milestone`);
    }
    assert.deepEqual(parsed.edges, fx.census.edges.map(e => ({
      from: e.from, to: e.to, label: e.label, style: e.style ?? 'solid', heads: e.heads ?? 'end',
    })), 'directed connections, labels, line styles and heads, in order');
    assert.deepEqual(parsed.groups, fx.census.groups.map(g => ({ id: g.id, label: g.label, members: g.members })), 'groups and their members');
    assert.deepEqual(parsed.warns, fx.features.unsupported, 'unsupported source lines are reported, not applied');
  });

  test(`${fx.id}: the census and direction survive render, URL and session round trips`, async () => {
    const host = () => baseHost({ geom: makeGeomApi(), color: makeColorApi() });
    const values = (rt: Awaited<ReturnType<typeof createRuntime>>) => Object.fromEntries(rt.getModel().map(item => [item.id, item.value]));
    const first = await createRuntime(tool, host(), openingValues(fx));
    const html = first.getHydrated() as string;
    const notice = first.getHydratedText('{{ganttWarning}}');
    if (fx.census.look) assert.equal(values(first).look, fx.census.look, 'the look a link opens with');
    renderCensus(fx, html, notice, values(first));

    const link = serializeUrlState(first.getModel());
    const fromLink = await createRuntime(tool, host(), parseUrlState(link, tool.manifest).values);
    assert.equal(fromLink.getHydrated(), html, 'a link written from the diagram reopens the same drawing');
    assert.equal(serializeUrlState(fromLink.getModel()), link, 'and writes the same link again');
    renderCensus(fx, fromLink.getHydrated() as string, fromLink.getHydratedText('{{ganttWarning}}'), values(fromLink));

    const saved = JSON.parse(JSON.stringify(values(first)));
    const reopened = await createRuntime(tool, host(), saved);
    assert.equal(reopened.getHydrated(), html, 'a saved session reopens the same drawing');
    renderCensus(fx, reopened.getHydrated() as string, reopened.getHydratedText('{{ganttWarning}}'), values(reopened));
  });
}

test('the README states a contract for every diagram type, in manifest order', () => {
  const readme = readFileSync(new URL('diagram-builder/README.md', COMMUNITY), 'utf8');
  const section = /^## Diagram types\n([\s\S]*?)(?=^## )/m.exec(readme)?.[1];
  assert.ok(section, 'README has a Diagram types section');
  const rows = [...section.matchAll(/^\| `([a-z]+)` \|/gm)].map(m => m[1]);
  assert.deepEqual(rows, manifestInput('diagramType').options.map((o: { value: string }) => o.value));
});
