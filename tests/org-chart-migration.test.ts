// SPDX-License-Identifier: MPL-2.0
/**
 * Flow Chart (org-chart) — the plan-90 `connectors` EDGE input migrates to plan-96 bound
 * PATH boxes, and the chart that comes out is the chart that went in.
 *
 * Plan 96 P4 retires the edge model: a connector is no longer a row of a second `connectors`
 * blocks input, it is an ordinary `kind:'path'` box whose `bindStart`/`bindEnd` name the two
 * cards its ends are attached to. The conversion happens in the tool's own hook, on load, and
 * writes the emptied input back — which means every chart anyone has ever saved, and every
 * share link anyone has ever sent, goes through it exactly once.
 *
 * A migration that *nearly* draws the old picture is a migration that silently redecorates
 * other people's documents. So the bar here is a GOLDEN one, and it is deliberately not a
 * screenshot: `buildConnectorSvg` is driven with the OLD edge rows, the real tool is driven
 * with the same old state, and the two committed `<svg class="oc-connectors">` layers must be
 * the identical STRING — every `d` attribute, every arrowhead path, to 2dp. That is the only
 * comparison that catches a bend fraction, a head inset or a gap pull-back moving by a pixel.
 *
 * Four things are pinned:
 *   1. the shipped DEFAULT chart, before and after the reseed;
 *   2. every one of the thirteen route styles, crossed with every arrow/head/dash the edge
 *      vocabulary allows — because the `route` override is precisely what stops six spline
 *      kinds collapsing thirteen routes into four;
 *   3. the migration is a ONE-TIME write (`connectors` comes back empty; a second render
 *      neither re-migrates nor re-writes), and
 *   4. it never blanks `boxes` — the failure mode that empties a whole document.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { buildConnectorSvg, makeConnectorsApi, CONNECTOR_ROUTE_STYLES } from '../engine/src/connectors.ts';
import type { EdgeRect } from '../engine/src/connectors.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { decodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';
import { baseHost } from './helpers/host.ts';

// org-chart ships in the (private) SUSE brand pack. Gate on the SOURCE pack, not the
// gitignored tools/ profile view: with the pack mounted, a missing tool is a FAIL.
const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'suse', 'tools');
const PACK_MOUNTED = existsSync(PACK_DIR);
const SKIP = !PACK_MOUNTED && 'SUSE brand pack not mounted (see profiles.json)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(PACK_DIR, 'org-chart', 'tool.json')),
    'brands/suse/tools/org-chart/tool.json is missing — the pack is mounted, so the tool was renamed or deleted');
}

const fetchFile = (path: string): Promise<string> => readFile(join(PACK_DIR, path), 'utf8');
/** A host carrying the two optional APIs the hook feature-detects: without them it draws
 *  nothing at all, which would make every assertion below pass vacuously. */
const HOST = (): unknown => baseHost({ connectors: makeConnectorsApi(), geom: makeGeomApi() });

const tool: any = PACK_MOUNTED ? await loadTool('org-chart', fetchFile) : null;
const manifest: any = PACK_MOUNTED
  ? JSON.parse(await readFile(join(PACK_DIR, 'org-chart', 'tool.json'), 'utf8'))
  : null;

/** The artboard coordinate space the hook's connector <svg> uses (render.width/height). */
const CW = 1600, CH = 1000;
/** Exactly the defaults `canvas.connect` declared and the old hook applied. */
const LEGACY_OPTS = {
  width: CW, height: CH, layerClass: 'oc-connectors',
  defaultStyle: 'elbow', defaultArrow: 'end', defaultHead: 'open',
  defaultColor: '#30ba78', defaultWidth: 3.5,
};

/** The shipped default chart's CARDS (the reseed appended the path boxes; these are what
 *  was there before it, and what an old saved document still holds). */
function defaultCards(): any[] {
  const boxes = manifest.inputs.find((i: any) => i.id === 'boxes').default as any[];
  return boxes.filter((b) => b.kind !== 'path');
}
/** The five edges the manifest shipped before plan 96 P4 reseeded them away. */
const LEGACY_EDGES = [
  { id: 'c1', from: 'ceo', to: 'cto', style: 'elbow', arrow: 'end', dash: 'solid', color: '#30ba78', width: 3.5 },
  { id: 'c2', from: 'ceo', to: 'coo', style: 'elbow', arrow: 'end', dash: 'solid', color: '#30ba78', width: 3.5 },
  { id: 'c3', from: 'ceo', to: 'cfo', style: 'elbow', arrow: 'end', dash: 'solid', color: '#30ba78', width: 3.5 },
  { id: 'c4', from: 'cto', to: 'eng1', style: 'elbow', arrow: 'end', dash: 'solid', color: '#30ba78', width: 3.5 },
  { id: 'c5', from: 'cto', to: 'eng2', style: 'elbow', arrow: 'end', dash: 'solid', color: '#30ba78', width: 3.5 },
];

const rectsOf = (cards: any[]): Map<string, EdgeRect> =>
  new Map(cards.map((b) => [String(b.id), { x: b.x, y: b.y, w: b.w, h: b.h }]));

/** What the OLD renderer drew for these edges — the golden. */
const legacyLayer = (cards: any[], edges: any[]): string =>
  buildConnectorSvg(edges, rectsOf(cards), LEGACY_OPTS);

/** The committed connector layer the REAL tool emits for a given input state. */
async function toolLayer(values: Record<string, unknown>): Promise<{ svg: string; rt: any }> {
  const rt = await createRuntime(tool, HOST() as never, values as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const html = rt.getHydrated() as string;
  const m = /<svg class="oc-connectors"[\s\S]*?<\/svg>/.exec(html);
  assert.ok(m, 'the committed connector layer is present');
  return { svg: m[0], rt };
}

const modelValue = (rt: any, id: string): unknown =>
  (rt.getModel() as Array<{ id: string; value: unknown }>).find((i) => i.id === id)?.value;

// ── 1. the shipped default chart ────────────────────────────────────────────────

test('golden: the migrated default chart is byte-identical to the edge render', { skip: SKIP }, async () => {
  const cards = defaultCards();
  const { svg } = await toolLayer({ boxes: cards, connectors: LEGACY_EDGES });
  assert.equal(svg, legacyLayer(cards, LEGACY_EDGES));
});

test('golden: the RESEEDED default (no edges at all) draws the same chart', { skip: SKIP }, async () => {
  // The manifest now ships the connectors as path boxes and an empty `connectors`. If the
  // reseed's hand-computed frames or encoded paths were wrong, this is where it shows.
  const { svg, rt } = await toolLayer({});
  assert.equal(svg, legacyLayer(defaultCards(), LEGACY_EDGES));
  assert.deepEqual(modelValue(rt, 'connectors'), [], 'nothing left to migrate');
  assert.equal((modelValue(rt, 'boxes') as any[]).length, 11, '6 cards + 5 connectors');
});

// ── 2. every route × every decoration ───────────────────────────────────────────

test('golden: all thirteen routes survive the migration, bend for bend', { skip: SKIP }, async () => {
  const cards = defaultCards().slice(0, 2);          // ceo + cto, a diagonal pair
  for (const style of CONNECTOR_ROUTE_STYLES) {
    const edges = [{ id: 'e1', from: 'ceo', to: 'cto', style, arrow: 'end', dash: 'solid', color: '#30ba78', width: 3.5 }];
    const { svg } = await toolLayer({ boxes: cards, connectors: edges });
    assert.equal(svg, legacyLayer(cards, edges), `route ${style}`);
  }
});

test('golden: every arrow × head × dash × width × colour survives too', { skip: SKIP }, async () => {
  const cards = defaultCards().slice(0, 3);
  let n = 0;
  for (const arrow of ['none', 'end', 'both']) {
    for (const head of ['triangle', 'open', 'circle', 'diamond', 'bar']) {
      for (const dash of ['solid', 'dashed', 'dotted']) {
        const edges = [{
          id: 'e1', from: 'ceo', to: 'coo',
          style: arrow === 'both' ? 'curved' : 'elbow-src',
          arrow, head, dash, color: '#fe7c3f', width: 6,
        }];
        const { svg } = await toolLayer({ boxes: cards, connectors: edges });
        assert.equal(svg, legacyLayer(cards, edges), `${arrow}/${head}/${dash}`);
        n++;
      }
    }
  }
  assert.equal(n, 45, 'the whole cross-product ran');
});

test('golden: an edge with NO optional fields takes the tool\'s own defaults', { skip: SKIP }, async () => {
  // The migration has to reproduce the hook's defaults (elbow, end, open, #30ba78, 3.5),
  // not the engine's generic ones (straight, end, triangle, #94a3b8, 2.5).
  const cards = defaultCards().slice(0, 2);
  const edges = [{ id: 'e1', from: 'ceo', to: 'cto' }];
  const { svg } = await toolLayer({ boxes: cards, connectors: edges });
  assert.equal(svg, legacyLayer(cards, edges));
  assert.match(svg, /stroke="#30ba78"/, 'the tool default colour, not the engine one');
});

// ── 3. the migrated ROWS themselves ─────────────────────────────────────────────

test('the migrated box is a real path box: bound at both ends, decorated, node-editable', { skip: SKIP }, async () => {
  const cards = defaultCards().slice(0, 2);
  const edges = [{ id: 'c1', from: 'ceo', to: 'cto', style: 'elbow-tgt', arrow: 'both', head: 'diamond', dash: 'dashed', color: '#123456', width: 7 }];
  const { rt } = await toolLayer({ boxes: cards, connectors: edges });
  const boxes = modelValue(rt, 'boxes') as any[];
  assert.equal(boxes.length, 3, 'the two cards plus one connector');
  const line = boxes[2];
  assert.equal(line.kind, 'path');
  assert.equal(line.bindStart, 'ceo');
  assert.equal(line.bindEnd, 'cto');
  assert.equal(line.route, 'elbow-tgt', 'the route override is what keeps 13 styles reachable');
  assert.equal(line.headStart, 'diamond');
  assert.equal(line.headEnd, 'diamond');
  assert.equal(line.strokeDash, 'dashed');
  assert.equal(line.stroke, '#123456');
  assert.equal(line.strokeW, 7);
  // The encoded path really decodes — a two-node open straight run, so the Node tool can
  // pick it up and either end can be dragged off its card.
  const decoded = decodeAuthoredPaths(String(line.path));
  assert.ok(Array.isArray(decoded), `the path field decodes (${line.path})`);
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0]!.kind, 'line');
  assert.equal(decoded[0]!.closed, false);
  assert.equal(decoded[0]!.nodes.length, 2);
  // …and its frame really spans the two cards it joins (what selection + marquee read).
  assert.ok(line.w >= 1 && line.h >= 1);
  for (const n of decoded[0]!.nodes) {
    assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, 'nodes are normalised inside the frame');
  }
});

test('a migrated id never collides with a card that already owns it', { skip: SKIP }, async () => {
  const cards = [...defaultCards().slice(0, 2), { id: 'ln1', kind: 'box', x: 10, y: 10, w: 40, h: 40 }];
  const edges = [{ id: 'c1', from: 'ceo', to: 'cto' }];
  const { rt } = await toolLayer({ boxes: cards, connectors: edges });
  const boxes = modelValue(rt, 'boxes') as any[];
  const ids = boxes.map((b) => String(b.id));
  assert.equal(new Set(ids).size, ids.length, `ids stay unique: ${ids.join(',')}`);
  assert.equal(boxes[boxes.length - 1]!.id, 'ln2', 'it stepped over the taken ln1');
});

test('a dangling or self edge migrates to nothing, exactly as it rendered to nothing', { skip: SKIP }, async () => {
  const cards = defaultCards().slice(0, 2);
  const edges = [
    { id: 'x1', from: 'ceo', to: 'nobody' },
    { id: 'x2', from: 'ghost', to: 'cto' },
    { id: 'x3', from: 'ceo', to: 'ceo' },
  ];
  const { svg, rt } = await toolLayer({ boxes: cards, connectors: edges });
  assert.equal(svg, legacyLayer(cards, edges), 'both drew nothing');
  assert.equal((modelValue(rt, 'boxes') as any[]).length, 2, 'and no box was minted for them');
});

// ── 4. the migration writes ONCE, and never blanks the document ─────────────────

test('the migration is one-time: the emptied input does not re-migrate', { skip: SKIP }, async () => {
  const cards = defaultCards();
  const { rt } = await toolLayer({ boxes: cards, connectors: LEGACY_EDGES });
  const after = modelValue(rt, 'boxes') as any[];
  assert.equal(after.length, 11);
  assert.deepEqual(modelValue(rt, 'connectors'), []);
  // Feed the MIGRATED state straight back in: no edges, so nothing converts and the box
  // count is unchanged. (Re-migrating would double every connector on every reload.)
  const second = await toolLayer({ boxes: after, connectors: [] });
  assert.equal((modelValue(second.rt, 'boxes') as any[]).length, 11, 'still eleven');
  assert.equal(second.svg, legacyLayer(cards, LEGACY_EDGES), 'and still the same chart');
});

test('a render with nothing to migrate leaves `boxes` alone — it never writes undefined', { skip: SKIP }, async () => {
  // The failure this guards is not cosmetic: a hook patch keys off key PRESENCE, so
  // `{ boxes: undefined }` blanks the input and empties the whole document on every render.
  const cards = defaultCards();
  const { rt } = await toolLayer({ boxes: cards, connectors: [] });
  const after = modelValue(rt, 'boxes');
  assert.ok(Array.isArray(after), 'boxes is still an array, not undefined');
  assert.equal((after as any[]).length, cards.length);
  const html = rt.getHydrated() as string;
  assert.equal((html.match(/class="lolly-box oc-box"/g) || []).length, cards.length, 'every card still renders');
});

// ── the unified render: a FREE path box draws its own shape ─────────────────────

test('an UNBOUND path box renders as an ordinary authored path, not as a connector', { skip: SKIP }, async () => {
  const cards = defaultCards().slice(0, 1);
  const free = {
    id: 'p1', kind: 'path', x: 100, y: 700, w: 300, h: 120, rot: 0, shape: 'rect', bg: '',
    path: '1!line!0_0!0_1!1', stroke: '#30ba78', strokeW: 4, headEnd: 'triangle',
    bindStart: '', bindEnd: '',
  };
  const { svg, rt } = await toolLayer({ boxes: [...cards, free], connectors: [] });
  const html = rt.getHydrated() as string;
  assert.match(html, /class="lolly-box-path"/, 'it draws inside its own box <svg>');
  assert.doesNotMatch(svg, /<path|<line/, 'and NOT in the connector layer');
});

test('binding ONE end hands the same box to connector management', { skip: SKIP }, async () => {
  const cards = defaultCards().slice(0, 1);          // ceo
  const half = {
    id: 'p1', kind: 'path', x: 700, y: 600, w: 200, h: 100, rot: 0, shape: 'rect', bg: '',
    path: '1!line!0_0!0_1!1', stroke: '#30ba78', strokeW: 4, headEnd: 'triangle',
    bindStart: 'ceo', bindEnd: '',
  };
  const { svg, rt } = await toolLayer({ boxes: [...cards, half], connectors: [] });
  const html = rt.getHydrated() as string;
  assert.doesNotMatch(html, /class="lolly-box-path"/, 'the box <svg> steps aside');
  assert.match(svg, /<path d="M/, 'the connector layer draws it');
  assert.match(svg, /Z" fill="#30ba78"\/>/, 'with its head');
  // The free end is the path's own LAST node in canvas px: x + 1·w, y + 1·h = (900, 700).
  // The head TIP stops a gap short of it (a routed head sits in clear space, never jammed
  // against its endpoint), so the check is that the line ends AT that point within one gap
  // — max(8, headSize·0.8) = 12.8 at width 4 — and nowhere near any card.
  const tip = /L([\d.]+) ([\d.]+)"/.exec(svg);
  assert.ok(tip, `the shaft ends somewhere: ${svg}`);
  assert.ok(Math.hypot(Number(tip[1]) - 900, Number(tip[2]) - 700) < 30,
    `routed to the free node (900,700), got ${tip[1]},${tip[2]}`);
});
