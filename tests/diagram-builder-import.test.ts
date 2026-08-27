// SPDX-License-Identifier: MPL-2.0
/**
 * diagram-builder text-format import: Mermaid (flowchart + sequenceDiagram) and
 * DOT / Graphviz.
 *
 * Run with: node --test "tests/diagram-builder-import.test.ts"  (or npm test)
 * No test framework - uses node:test built-in.
 *
 * The parsers are plain functions inside the tool's hooks.js, which ships as tool
 * DATA and may not be imported. These tests compile the REAL hooks.js the way
 * engine/src/runtime.ts does (new Function('host', src)) and drive the parsers
 * directly, so what is pinned here is the shipping code, not a copy of it.
 *
 * Both parsers answer the same shape the visual editor produces - {nodes, layers,
 * arrows} plus a diagram type and a direction - so the assertions below are about
 * that shape: node ids, labels, shapes and fills; edge count, labels and styles;
 * which band holds a node; the flow direction. The last group is the rule that
 * matters most for pasted text: syntax outside the subset is COLLECTED AS A
 * WARNING and skipped, never executed and never thrown.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// diagram-builder is a community tool - always present in a full checkout. Load it
// from the SOURCE pack (community/), not the gitignored tools/ profile view, so the
// suite never silently skips: a missing dir means the tool was renamed or deleted,
// which must FAIL here.
const COMMUNITY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const TOOL_DIR = join(COMMUNITY_DIR, 'diagram-builder');
assert.ok(existsSync(join(TOOL_DIR, 'tool.json')),
  'community/diagram-builder/tool.json is missing - the tool was renamed or deleted');

interface ParsedNode {
  nodeId: string; label: string; detail: string; shape: string; fill: string; layer: string; stroke?: string;
}
interface ParsedArrow {
  from: string; to: string; label: string; style: string; head: string; width: number; double: boolean; color: string;
}
interface Parsed {
  nodes: ParsedNode[];
  layers: { layerId: string; label: string; bandFill: string }[];
  arrows: ParsedArrow[];
  diagramType: string;
  dir: string;
  warns: string[];
}
interface Parsers {
  parseMermaid: (text: string) => Parsed;
  parseDot: (text: string) => Parsed;
}

/** Compile hooks.js exactly as engine/src/runtime.ts getHookFactory does. */
function parsers(): Parsers {
  const src = readFileSync(join(TOOL_DIR, 'hooks.js'), 'utf8');
  const factory = new Function(
    'host',
    `${src}; return { parseMermaid: parseMermaid, parseDot: parseDot };`,
  ) as (host: unknown) => Parsers;
  return factory({ log: () => {} });
}

const P = parsers();

const ids = (r: Parsed) => r.nodes.map(n => n.nodeId);
const labels = (r: Parsed) => r.nodes.map(n => n.label);
const edges = (r: Parsed) => r.arrows.map(a => `${a.from}>${a.to}`);
const node = (r: Parsed, id: string) => r.nodes.find(n => n.nodeId === id) as ParsedNode;
const edge = (r: Parsed, from: string, to: string) => r.arrows.find(a => a.from === from && a.to === to) as ParsedArrow;

// ─── Mermaid flowchart ───────────────────────────────────────────────────────

test('mermaid: graph and flowchart headers both set the direction', () => {
  assert.equal(P.parseMermaid('graph LR\n A --> B').dir, 'right');
  assert.equal(P.parseMermaid('flowchart LR\n A --> B').dir, 'right');
  assert.equal(P.parseMermaid('flowchart RL\n A --> B').dir, 'right');
  assert.equal(P.parseMermaid('flowchart TD\n A --> B').dir, 'down');
  assert.equal(P.parseMermaid('flowchart BT\n A --> B').dir, 'down');
  assert.equal(P.parseMermaid('flowchart TB\n A --> B').dir, 'down');
});

test('mermaid: node shapes and quoted text', () => {
  const r = P.parseMermaid([
    'flowchart TD',
    '  A["Client app"]',
    '  B(API)',
    '  C[(Database)]',
    '  D{Decide}',
    '  E{{Cache}}',
    '  F([Queue])',
    '  G((Hub))',
  ].join('\n'));
  assert.deepEqual(ids(r), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.equal(node(r, 'a').label, 'Client app', 'quotes are stripped from the label');
  assert.deepEqual(r.nodes.map(n => n.shape), ['box', 'rounded', 'cylinder', 'diamond', 'hexagon', 'pill', 'circle']);
});

test('mermaid: chained edges and fan-out in both directions', () => {
  const r = P.parseMermaid([
    'flowchart LR',
    '  A --> B --> C',
    '  A --> D & E',
    '  D & E --> F',
  ].join('\n'));
  assert.deepEqual(edges(r), ['a>b', 'b>c', 'a>d', 'a>e', 'd>f', 'e>f']);
  assert.deepEqual(ids(r), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('mermaid: an ampersand inside a node label is not a fan-out', () => {
  const r = P.parseMermaid('flowchart LR\n A["R & D"] --> B');
  assert.deepEqual(edges(r), ['a>b']);
  assert.equal(node(r, 'a').label, 'R & D');
});

test('mermaid: edge labels in both forms, plus dotted and thick lines', () => {
  const r = P.parseMermaid([
    'flowchart LR',
    '  A -->|cache miss| B',
    '  A -- warm --> C',
    '  A -.-> D',
    '  A ==> E',
    '  A --- F',
  ].join('\n'));
  assert.equal(edge(r, 'a', 'b').label, 'cache miss');
  assert.equal(edge(r, 'a', 'c').label, 'warm');
  assert.equal(edge(r, 'a', 'd').style, 'dotted');
  assert.equal(edge(r, 'a', 'e').width, 3.5);
  assert.equal(edge(r, 'a', 'f').head, 'none', 'a plain --- link draws no arrowhead');
});

test('mermaid: subgraphs become bands, nested ones fold into the outermost', () => {
  const r = P.parseMermaid([
    'graph TD',
    '  subgraph edge[Edge tier]',
    '    A[CDN]',
    '    subgraph inner[Inner]',
    '      B[WAF]',
    '    end',
    '  end',
    '  subgraph core[Core]',
    '    C[App]',
    '  end',
    '  A --> B --> C',
  ].join('\n'));
  assert.equal(r.diagramType, 'layercake');
  assert.deepEqual(r.layers.map(l => `${l.layerId}=${l.label}`), ['edge=Edge tier', 'core=Core']);
  assert.equal(node(r, 'a').layer, 'edge');
  assert.equal(node(r, 'b').layer, 'edge', 'the nested subgraph folds into the band already open');
  assert.equal(node(r, 'c').layer, 'core', 'the band closes at the right end');
  assert.equal(r.warns.length, 1);
  assert.match(String(r.warns[0]), /nested subgraph/);
});

test('mermaid: comments are ignored and unsupported directives are warnings, not throws', () => {
  const r = P.parseMermaid([
    '%% a comment',
    'flowchart LR',
    '  A --> B',
    '  click A "https://example.com"',
    '  style A fill:#f00',
    '  classDef big font-size:20px',
    '  class A big',
    '  linkStyle 0 stroke:#0f0',
  ].join('\n'));
  assert.deepEqual(ids(r), ['a', 'b'], 'no node is invented from a skipped directive');
  assert.equal(r.warns.length, 5);
  assert.ok(r.warns.every(w => typeof w === 'string' && w.length > 0));
});

test('mermaid: a semicolon separates statements on one line', () => {
  // The form the Mermaid docs open with - the whole graph on one line.
  const r = P.parseMermaid('graph TD;A[Client]-->B;B-->C;');
  assert.equal(r.dir, 'down');
  assert.deepEqual(ids(r), ['a', 'b', 'c']);
  assert.deepEqual(edges(r), ['a>b', 'b>c']);
  assert.equal(node(r, 'a').label, 'Client');
  // A semicolon inside a label or an edge label is not a separator.
  const q = P.parseMermaid('graph LR;A["one; two"]-->|"three; four"|B;');
  assert.deepEqual(ids(q), ['a', 'b']);
  assert.equal(node(q, 'a').label, 'one; two');
  assert.equal(edge(q, 'a', 'b').label, 'three; four');
});

test('mermaid: a :::class suffix does not invent a node', () => {
  const r = P.parseMermaid([
    'flowchart LR',
    '  A[Client] --> B',
    '  A:::big',
    '  B[Server]:::big --> C',
  ].join('\n'));
  assert.deepEqual(ids(r), ['a', 'b', 'c'], 'the class suffix is dropped, not turned into a card');
  assert.equal(node(r, 'a').label, 'Client');
  assert.equal(node(r, 'b').label, 'Server', 'a definition carrying a class still defines the node');
});

// ─── Mermaid sequenceDiagram ─────────────────────────────────────────────────

test('mermaid sequence: participants in order, messages as numbered arrows', () => {
  const r = P.parseMermaid([
    'sequenceDiagram',
    '  participant A as Alice',
    '  actor B as Bob',
    '  A->>B: Hello',
    '  B-->>A: Hi back',
    '  A->>C: New face',
  ].join('\n'));
  assert.equal(r.diagramType, 'process');
  assert.equal(r.dir, 'right', 'participants read left to right');
  assert.deepEqual(ids(r), ['a', 'b', 'c'], 'declared first, then first-seen');
  assert.deepEqual(labels(r), ['Alice', 'Bob', 'C'], '"as" gives the display name');
  assert.deepEqual(edges(r), ['a>b', 'b>a', 'a>c']);
  assert.equal(edge(r, 'a', 'b').label, '1. Hello');
  assert.equal(edge(r, 'b', 'a').label, '2. Hi back');
  assert.equal(edge(r, 'b', 'a').style, 'dashed', '-->> is a dashed reply');
  assert.equal(edge(r, 'a', 'b').style, 'solid');
});

test('mermaid sequence: repeat messages merge, -x loses its head, blocks are warnings', () => {
  const r = P.parseMermaid([
    'sequenceDiagram',
    '  A->>B: ping',
    '  A-xB: lost',
    '  Note right of B: thinking',
    '  loop every minute',
    '    A->>B: ping again',
    '  end',
  ].join('\n'));
  assert.deepEqual(edges(r), ['a>b'], 'the same direction merges into one arrow');
  assert.equal(edge(r, 'a', 'b').label, '1. ping · 2. lost · 3. ping again');
  assert.deepEqual(r.warns, ['Note right of B: thinking', 'loop every minute', 'end']);
});

test('mermaid sequence: the +/- activation shorthand is not part of the name', () => {
  const r = P.parseMermaid([
    'sequenceDiagram',
    '  Alice->>+John: Hello',
    '  John-->>-Alice: Hi back',
  ].join('\n'));
  assert.deepEqual(ids(r), ['alice', 'john']);
  assert.deepEqual(labels(r), ['Alice', 'John'], 'no card is called "+John"');
  assert.deepEqual(edges(r), ['alice>john', 'john>alice']);
});

// ─── DOT / Graphviz ──────────────────────────────────────────────────────────

test('dot: header, rankdir, node defaults, shapes, fills and multi-line labels', () => {
  const r = P.parseDot([
    '// a line comment',
    'digraph pipeline {',
    '  rankdir=LR',
    '  node [shape=box]',
    '  build [label="Build"]',
    '  test [label="Test\\nnightly", fillcolor="#e8f4f0"]',
    '  ship [label=<<b>Ship</b>>, shape=cylinder]',
    '  plain [shape=plaintext color=teal]',
    '  build -> test -> ship',
    '}',
  ].join('\n'));
  assert.equal(r.dir, 'right');
  assert.equal(r.diagramType, 'process');
  assert.deepEqual(ids(r), ['build', 'test', 'ship', 'plain']);
  assert.equal(node(r, 'build').shape, 'box', 'node [shape=box] is the default');
  assert.equal(node(r, 'ship').shape, 'cylinder', 'an explicit shape beats the default');
  assert.equal(node(r, 'ship').label, 'Ship', 'HTML-ish labels have their tags stripped');
  assert.equal(node(r, 'test').label, 'Test');
  assert.equal(node(r, 'test').detail, 'nightly', 'the second line of a label becomes the subtitle');
  assert.equal(node(r, 'test').fill, '#e8f4f0');
  assert.equal(node(r, 'plain').shape, 'text');
  assert.equal(node(r, 'plain').stroke, '#1f8f86', 'a named colour resolves from the shared table');
  assert.deepEqual(edges(r), ['build>test', 'test>ship'], 'a -> b -> c is a chain');
});

test('dot: a later edge does not overwrite a node declared earlier', () => {
  const r = P.parseDot('digraph { node [shape=box]; a [shape=diamond, label="Choose"]; a -> b }');
  assert.equal(node(r, 'a').shape, 'diamond');
  assert.equal(node(r, 'a').label, 'Choose');
  assert.equal(node(r, 'b').shape, 'box');
});

test('dot: edge attributes - label, style, direction and arrowhead', () => {
  const r = P.parseDot([
    'digraph {',
    '  a -> b [label="retry", style=dashed]',
    '  a -> c [style=dotted]',
    '  a -> d [style=bold]',
    '  a -> e [dir=both]',
    '  a -> f [dir=none]',
    '  a -> g [dir=back]',
    '  a -> h [arrowhead=vee, color="#ff0000"]',
    '  a -> i [style=invis]',
    '}',
  ].join('\n'));
  assert.equal(edge(r, 'a', 'b').label, 'retry');
  assert.equal(edge(r, 'a', 'b').style, 'dashed');
  assert.equal(edge(r, 'a', 'c').style, 'dotted');
  assert.equal(edge(r, 'a', 'd').width, 3.5);
  assert.equal(edge(r, 'a', 'e').double, true);
  assert.equal(edge(r, 'a', 'f').head, 'none');
  assert.equal(edge(r, 'g', 'a').to, 'a', 'dir=back reverses the arrow');
  assert.equal(edge(r, 'a', 'h').head, 'open');
  assert.equal(edge(r, 'a', 'h').color, '#ff0000');
  assert.equal(edge(r, 'a', 'i'), undefined, 'an invisible edge is dropped');
  assert.equal(r.warns.length, 1, 'and says so');
});

test('dot: clusters become bands, nested ones fold, plain subgraphs do not', () => {
  const r = P.parseDot([
    'graph G {',
    '  subgraph cluster_edge {',
    '    label="Edge tier"',
    '    cdn',
    '    subgraph cluster_inner { waf }',
    '  }',
    '  subgraph cluster_core { app }',
    '  subgraph plain_group { util }',
    '  cdn -- waf -- app',
    '}',
  ].join('\n'));
  assert.equal(r.diagramType, 'layercake');
  assert.deepEqual(r.layers.map(l => `${l.layerId}=${l.label}`), ['cluster-edge=Edge tier', 'cluster-core=Core']);
  assert.equal(node(r, 'cdn').layer, 'cluster-edge');
  assert.equal(node(r, 'waf').layer, 'cluster-edge', 'the nested cluster folds into the outer band');
  assert.equal(node(r, 'app').layer, 'cluster-core');
  assert.equal(node(r, 'util').layer, '', 'a subgraph that is not a cluster gets no band');
  assert.equal(edge(r, 'cdn', 'waf').head, 'none', 'an undirected -- link draws no arrowhead');
});

test('dot: node lists, brace groups, quoted ids and block comments', () => {
  const r = P.parseDot([
    'digraph {',
    '  /* a block',
    '     comment */',
    '  a, b -> c',
    '  c -> {d e}',
    '  "long name" -> a',
    '}',
  ].join('\n'));
  assert.deepEqual(ids(r), ['a', 'b', 'c', 'd', 'e', 'long-name']);
  assert.equal(node(r, 'long-name').label, 'long name', 'a quoted id keeps its spacing as the label');
  assert.deepEqual(edges(r), ['a>c', 'b>c', 'c>d', 'c>e', 'long-name>a']);
});

test('dot: syntax outside the subset is skipped and logged, never run', () => {
  const r = P.parseDot([
    'digraph {',
    '  bgcolor=beige',
    '  this is not dot at all',
    '  a -> b',
    '}',
  ].join('\n'));
  assert.deepEqual(ids(r), ['a', 'b'], 'nothing is invented from the skipped lines');
  assert.deepEqual(edges(r), ['a>b']);
  assert.equal(r.warns.length, 2);
});

test('dot: prose either side of an arrow is not an endpoint', () => {
  // The node-statement path already refuses a bare run of words; the edge path must
  // refuse it too, or a sentence containing "->" becomes two cards.
  const r = P.parseDot('digraph {\n  this is prose -> and so is this\n  a -> b\n}');
  assert.deepEqual(ids(r), ['a', 'b'], 'nothing is invented from the sentence');
  assert.deepEqual(edges(r), ['a>b']);
  assert.ok(r.warns.length >= 1, 'and the skipped line is reported');
});

test('dot: a port suffix addresses the declared node, not a new one', () => {
  const r = P.parseDot('digraph { a [label="Alpha"]; b; a:f0 -> b:f1:n }');
  assert.deepEqual(ids(r), ['a', 'b'], 'a:f0 is node a, not a card called "a:f0"');
  assert.equal(node(r, 'a').label, 'Alpha');
  assert.deepEqual(edges(r), ['a>b']);
  assert.deepEqual(ids(P.parseDot('digraph { "a:b" -> c }')), ['a-b', 'c'], 'a quoted id keeps its colon');
});

test('dot: an empty or junk document parses to nothing instead of throwing', () => {
  for (const src of ['', '   ', '}}}{{{', 'digraph {']) {
    const r = P.parseDot(src);
    assert.ok(Array.isArray(r.nodes), `parseDot(${JSON.stringify(src)}) must answer a shape`);
  }
});

// ─── manifest + end to end ───────────────────────────────────────────────────

const fetchFile = (path: string) => readFile(join(COMMUNITY_DIR, path), 'utf8');
const tool: any = await loadTool('diagram-builder', fetchFile);

test('manifest: the DOT source mode and its input exist, and every text mode takes a file', () => {
  const input = (id: string) => tool.manifest.inputs.find((i: any) => i.id === id);
  const sources = input('source').options.map((o: any) => o.value);
  assert.deepEqual(sources, ['visual', 'text', 'ascii', 'mermaid', 'dot', 'pikchr', 'table']);
  assert.deepEqual(input('dot').showIf, { source: 'dot' });
  assert.equal(input('dot').type, 'longtext');
  // Plan 87's unified attachment, one per text mode - no per-tool paste button.
  const accepts: [string, string][] = [
    ['dsl', '.txt'],
    ['asciiArt', '.txt'],
    ['mermaid', '.mmd,.mermaid,.txt,text/plain'],
    ['dot', '.dot,.gv,.txt'],
    ['pikchr', '.pikchr,.txt'],
    ['table', '.csv,.tsv,.txt,.xlsx'],
  ];
  for (const [id, accept] of accepts) {
    assert.equal(input(id).dataSource?.accept, accept, `${id} declares its dataSource accept`);
  }
});

test('the shipped DOT sample renders a diagram, not the empty-state placeholder', async () => {
  const sample = tool.manifest.inputs.find((i: any) => i.id === 'dot').default;
  const parsed = P.parseDot(sample);
  assert.deepEqual(ids(parsed), ['build', 'test', 'ship']);
  assert.equal(parsed.arrows.length, 3);
  assert.deepEqual(parsed.warns, [], 'the sample we ship must parse cleanly');

  const rt = await createRuntime(tool, baseHost(), { source: 'dot' });
  const html = rt.getHydrated() as string;
  assert.match(html, /<svg/, 'the tool renders an SVG');
  assert.ok(html.includes('Build') && html.includes('Ship'), 'the sample labels are drawn');
  assert.ok(!html.includes('Paste DOT'), 'the placeholder hint must not be what we see');
});

test('every source mode mounts on its shipped default and draws a real diagram', async () => {
  // The click-to-focus contract: a card jumps to whichever field the diagram was
  // built from, so each source maps to its own input, never to the hidden card list.
  const modes: [string, string][] = [
    ['visual', 'nodes'], ['text', 'dsl'], ['ascii', 'asciiArt'], ['mermaid', 'mermaid'],
    ['dot', 'dot'], ['pikchr', 'pikchr'], ['table', 'table'],
  ];
  for (const [source, field] of modes) {
    const rt = await createRuntime(tool, baseHost(), { source });
    const html = rt.getHydrated() as string;
    assert.match(html, /<svg/, `${source} renders an SVG`);
    assert.ok(!/Paste |Type a diagram|Draw boxes/.test(html), `${source} draws its sample, not the empty-state hint`);
    assert.ok(html.includes(`data-canvas-input="${field}"`), `${source} sends a card click to the ${field} input`);
  }
});

test('a sequenceDiagram mounts and draws its participants', async () => {
  const rt = await createRuntime(tool, baseHost(), {
    source: 'mermaid',
    mermaid: 'sequenceDiagram\n  participant A as Shopper\n  A->>+Cart: add item\n  Cart-->>-A: total',
  });
  const html = rt.getHydrated() as string;
  assert.match(html, /<svg/);
  assert.ok(html.includes('Shopper') && html.includes('Cart'), 'both participants are drawn');
  assert.ok(!html.includes('+Cart'), 'the activation marker never reaches the card');
});
