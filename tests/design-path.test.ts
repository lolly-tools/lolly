// SPDX-License-Identifier: MPL-2.0
/**
 * Layout Studio path boxes - persistence + HEADLESS render (Stage C of
 * plans/57-pen-tool-and-vector-ops.md).
 *
 * The point of the stage, and therefore of this suite, is that no editor is
 * involved anywhere: a pen shape is one row of the `boxes` blocks array, and a
 * URL render, a CLI render and an export all run manifest -> inputs -> hooks ->
 * template. So everything here drives the REAL artefacts - the shipped
 * `tool.json` (for the field order that IS the wire format), the shipped
 * `hooks.js` compiled the way `engine/src/runtime.ts` compiles it, and the real
 * `makeGeomApi()` as `host.geom` - never a re-implementation of any of them.
 *
 * Four things are actually at risk, and each has its own section:
 *
 * 1. **The wire format.** `decodeBlocksCompact` splits on `~` then `,`, and those
 *    separators cannot be escaped: the compact string rides in the query raw and
 *    `URLSearchParams` percent-DECODES it before the block splitter runs, which
 *    is why `encodeBlocksCompact` in the web shell refuses to emit a compact
 *    string at all when a value contains either. So the test is not "does
 *    percent-encoding survive" (it does not) but "does the encoding contain
 *    neither separator", asserted on paths with negative coordinates,
 *    high-precision floats, and a node count in the hundreds - plus a real round
 *    trip through both blocks URL forms.
 * 2. **The lowering.** The emitted `d` is compared GEOMETRICALLY - bounds, area
 *    and point membership, computed from the path - never by string equality,
 *    which would only be testing `toFixed`.
 * 3. **The degrades.** `host.geom` absent and `fromNodes` failing must both
 *    produce something visible and a `host.log` warning, because a throw out of
 *    `onInit` is caught and DISCARDED by the runtime: a silent path box is a bug
 *    report nobody can file.
 * 4. **The regression.** This edits a SHIPPED tool, so every other kind's
 *    computed extras are locked byte-for-byte against a fixture captured from
 *    the pre-change `hooks.js`
 *    (`tests/fixtures/design-extras-baseline.json`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import {
  decodeAuthoredPath, decodeAuthoredPaths, decodeAuthoredPathsResult,
  encodeAuthoredPath, encodeAuthoredPaths,
} from '../engine/src/geom/authored-url.ts';
import type { AuthoredPath, Node as SplineNode } from '../engine/src/geom/spline.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { isPackAvailable, packQuery, unpackToken } from '../engine/src/url-pack.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
/** design is single-sourced in the public community pack (2026-08-16
 *  consolidation), so every manifest assertion runs over the one manifest all
 *  profiles share. The per-pack loop shape survives so a future re-fork slots
 *  back in; the SUSE-variant half retired with the fork. */
const BRANDS: readonly string[] = ['community'];
const toolDir = (pack: string): string => join(ROOT, pack, 'design');

interface Row { [k: string]: unknown }
interface FieldSpec { id: string; type?: string; showFor?: string[]; options?: { value: string }[] }
interface Manifest {
  inputs: {
    id: string; type: string; fields?: FieldSpec[];
    canvas?: Record<string, unknown>;
  }[];
}

function manifest(brand: string): Manifest {
  return JSON.parse(readFileSync(join(toolDir(brand), 'tool.json'), 'utf8')) as Manifest;
}
function boxesInput(brand: string) {
  const i = manifest(brand).inputs.find((x) => x.id === 'boxes');
  assert.ok(i, `${brand}: no boxes input`);
  return i!;
}

// ── the hook, compiled the way the runtime compiles it ────────────────────────

/**
 * `new Function('host', src + '; return {…}')` - the same closure-scope injection
 * `getHookFactory` in engine/src/runtime.ts performs. Loading the real file this
 * way (rather than importing it, which would need it to be a module) is what makes
 * this a test of the shipped tool DATA and not of a copy.
 */
type Extras = Record<string, string[]>;
interface FakeHost {
  geom?: unknown;
  log: (level: string, msg: string) => void;
}
function loadCompute(brand: string, host: FakeHost): (boxes: Row[], extra?: Row) => Extras {
  const src = readFileSync(join(toolDir(brand), 'hooks.js'), 'utf8');
  const factory = new Function(
    'host',
    `${src}; return { onInit: typeof onInit !== 'undefined' ? onInit : null };`,
  ) as (h: FakeHost) => { onInit: (ctx: { model: unknown }) => Extras };
  const hooks = factory(host);
  return (boxes, extra = {}) => hooks.onInit({
    model: [
      { id: 'background', value: '#eef1f0' },
      { id: 'transparentBg', value: false },
      { id: 'boxes', value: boxes },
      ...Object.entries(extra).map(([id, value]) => ({ id, value })),
    ],
  });
}

function withGeom(brand = 'community') {
  const logs: string[] = [];
  const compute = loadCompute(brand, { geom: makeGeomApi(), log: (l, m) => logs.push(`${l}: ${m}`) });
  return { compute, logs };
}

// ── geometry oracles ─────────────────────────────────────────────────────────

const geom = makeGeomApi();

/** The `d` of the single `<path>` inside a box's emitted markup. */
function pathD(markup: string): string {
  const m = /<path d="([^"]*)"/.exec(markup);
  assert.ok(m, `no <path d> in: ${markup.slice(0, 200)}`);
  return m![1]!;
}
function attr(markup: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`).exec(markup);
  return m ? m[1]! : null;
}
function bounds(d: string) {
  const r = geom.bounds(d);
  assert.ok(r.ok, 'bounds failed');
  assert.ok(r.ok && r.value, 'empty bounds');
  return (r as { ok: true; value: { x0: number; y0: number; x1: number; y1: number } }).value;
}
function area(d: string): number {
  const r = geom.area(d);
  assert.ok(r.ok, 'area failed');
  return Math.abs((r as { ok: true; value: number }).value);
}
function inside(d: string, x: number, y: number, rule?: 'nonzero' | 'evenodd'): boolean {
  const r = geom.contains(d, x, y, rule ? { fillRule: rule } : undefined);
  assert.ok(r.ok, 'contains failed');
  return (r as { ok: true; value: boolean }).value;
}
/** No NaN/Infinity anywhere in emitted markup - the specific failure a scaled,
 *  garbage-fed lowering would produce. */
function assertNoNaN(markup: string): void {
  assert.ok(!/NaN|Infinity|undefined|null/.test(markup), `markup carries a non-number: ${markup}`);
}

// ── fixtures ─────────────────────────────────────────────────────────────────

/** A closed 4-node diamond, normalised to the box frame: the seed shape the
 *  manifest's `addKinds` path entry uses. */
const DIAMOND: AuthoredPath = {
  kind: 'catmull-rom',
  nodes: [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }],
  closed: true,
};

function pathBox(over: Row = {}): Row {
  return {
    id: 'pen', kind: 'path', x: 100, y: 50, w: 400, h: 300, shape: 'rect',
    bg: '#30ba78', stroke: '', strokeW: 0, fillRule: 'nonzero',
    path: encodeAuthoredPath(DIAMOND),
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Manifest - the shape Stages D and E build against
// ─────────────────────────────────────────────────────────────────────────────

test('manifest: kind gains "path", canvas gains pathField, and both brands agree', () => {
  for (const brand of BRANDS) {
    const input = boxesInput(brand);
    const kind = input.fields!.find((f) => f.id === 'kind')!;
    assert.ok(kind.options!.some((o) => o.value === 'path'), `${brand}: kind has no 'path' option`);
    assert.equal(input.canvas!.pathField, 'path', `${brand}: canvas.pathField`);
    const addKinds = input.canvas!.addKinds as { id: string; seed?: Row }[];
    const seedEntry = addKinds.find((k) => k.id === 'path');
    assert.ok(seedEntry, `${brand}: addKinds has no path entry`);
    // The starter shape must be a REAL shape: "add path" producing an empty box
    // would look like a broken tool.
    const seeded = decodeAuthoredPath(String(seedEntry!.seed!.path));
    assert.ok(seeded, `${brand}: addKinds path seed does not decode`);
    assert.ok(seeded!.nodes.length >= 3, `${brand}: path seed is not a shape`);
  }
});

test('manifest: the four new sub-fields are APPENDED, in order, and `path` is hidden', () => {
  // Field order is the compact-URL wire format: inserting a field would decode
  // every link already shared into the wrong columns. What must be pinned is each
  // field's SLOT, not its distance from the end - a test that pins the tail forbids
  // appending, which is the one safe edit. (Exactly the mistake
  // tests/design-fit-circle.test.ts made about `fitText`, and it was made
  // again here: ten timeline fields appended after `fillRule` broke this and
  // nothing was wrong.)
  for (const brand of BRANDS) {
    const ids = boxesInput(brand).fields!.map((f) => f.id);
    const at = ids.indexOf('fitText');
    assert.ok(at >= 0, `${brand}: fitText missing`);
    assert.deepEqual(
      ids.slice(at + 1, at + 5), ['path', 'stroke', 'strokeW', 'fillRule'],
      `${brand}: the four fields must stay contiguous in their slot, right after fitText`,
    );

    const byId = new Map(boxesInput(brand).fields!.map((f) => [f.id, f]));
    const path = byId.get('path')!;
    // `text`, because the value is an opaque machine-written string; `showFor: []`
    // (the manifest's existing per-kind visibility mechanism, listing no kind) so
    // it never renders as a sidebar control.
    assert.equal(path.type ?? 'text', 'text', `${brand}: path field type`);
    assert.deepEqual(path.showFor, [], `${brand}: path field must be hidden via showFor: []`);
    assert.equal(byId.get('stroke')!.type, 'color');
    assert.equal(byId.get('strokeW')!.type, 'number');
    assert.equal(byId.get('fillRule')!.type, 'select');
    assert.deepEqual(
      byId.get('fillRule')!.options!.map((o) => o.value), ['nonzero', 'evenodd'],
    );
    // stroke/strokeW also serve box/image kinds since the design importer began
    // mapping Penpot strokes onto CSS borders (boxCss), and `frame` since artboards
    // gained a fill/stroke like any shape; fillRule remains a path-geometry concept
    // and stays path-only.
    for (const id of ['stroke', 'strokeW']) {
      assert.deepEqual(byId.get(id)!.showFor, ['path', 'box', 'image', 'frame'], `${brand}: ${id} showFor`);
    }
    assert.deepEqual(byId.get('fillRule')!.showFor, ['path'], `${brand}: fillRule showFor`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. The wire format
// ─────────────────────────────────────────────────────────────────────────────

/** A path with the three properties that break naive encodings at once: negative
 *  coordinates (handles overshoot the frame), full-precision floats, and a node
 *  count in the hundreds. */
function bigPath(n: number): AuthoredPath {
  const nodes: SplineNode[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    nodes.push({
      x: 0.5 + 0.61803398875 * Math.cos(t),
      y: 0.5 + 0.41421356237 * Math.sin(t),
      hInX: -0.0273456 * Math.sin(t),
      hInY: 0.0198765 * Math.cos(t),
      hOutX: 0.0273456 * Math.sin(t),
      hOutY: -0.0198765 * Math.cos(t),
      continuity: i % 3 === 0 ? 'symmetric' : i % 3 === 1 ? 'smooth' : 'corner',
    });
  }
  return { kind: 'cubic', nodes, closed: true };
}

test('encoding: round-trips exactly, and carries neither blocks separator', () => {
  for (const p of [DIAMOND, bigPath(1), bigPath(2), bigPath(347), { ...bigPath(5), closed: false },
    { kind: 'catmull-rom', nodes: DIAMOND.nodes, closed: true, tension: 0.25 } as AuthoredPath]) {
    const enc = encodeAuthoredPath(p);
    // THE property. Neither separator can be escaped inside the compact blocks
    // string, so their absence is what makes the format usable at all.
    assert.ok(!enc.includes(','), 'encoded path contains a comma');
    assert.ok(!enc.includes('~'), 'encoded path contains a tilde');
    // Percent-encoding must be a no-op, or the wire form would be 3x the bytes.
    assert.equal(encodeURIComponent(enc), enc, 'encoded path is not already URL-safe');

    const back = decodeAuthoredPath(enc);
    assert.ok(back, 'decode returned null');
    assert.equal(back!.kind, p.kind);
    assert.equal(back!.closed, p.closed);
    assert.equal(back!.nodes.length, p.nodes.length);
    if (p.tension !== undefined) assert.equal(back!.tension, p.tension);
    for (let i = 0; i < p.nodes.length; i++) {
      const a: SplineNode = p.nodes[i]!;
      const b: SplineNode = back!.nodes[i]!;
      for (const k of ['x', 'y', 'hInX', 'hInY', 'hOutX', 'hOutY'] as const) {
        if (a[k] === undefined || a[k] === 0) continue;
        // 6 decimals of a NORMALISED coordinate - a nanometre on an A4 page.
        assert.ok(Math.abs((b[k] ?? 0) - a[k]!) <= 5e-7, `node ${i}.${k}: ${b[k]} != ${a[k]}`);
      }
      assert.equal(b.continuity, a.continuity, `node ${i}.continuity`);
    }
    // Re-encoding the decoded path is a fixed point: the format is canonical, so a
    // link does not churn just because it was opened and re-shared.
    assert.equal(encodeAuthoredPath(back!), enc, 'encoding is not canonical');
  }
});

// ── the plural form ──────────────────────────────────────────────────────────
//
// A value carries a LIST of paths, because one `AuthoredPath` holds one `nodes` run
// and a great many shapes are not one run: a boolean subtract punches a hole. The
// separator is `*` - unreserved under encodeURIComponent, neither blocks delimiter,
// and unreachable by any other production in the grammar (records are `_`, fields
// `!`, kinds `[a-z][a-z0-9-]*`, continuity `c`/`s`/`y`, numbers digits/`.`/`-`).

/** A square ring: outer loop clockwise on screen, inner loop counter-clockwise, so
 *  the inner one reads as a HOLE under the nonzero rule. */
const RING: AuthoredPath[] = [
  { kind: 'line', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
  {
    kind: 'line', closed: true,
    nodes: [{ x: 0.25, y: 0.25 }, { x: 0.25, y: 0.75 }, { x: 0.75, y: 0.75 }, { x: 0.75, y: 0.25 }],
  },
];

test('encoding: a SINGLE path is byte-identical to what the singular format has always emitted', () => {
  // Written out literally, because this is the one assertion that can catch the wire
  // form drifting: links already produced in this format have to keep decoding, so a
  // new arity must not cost the old one a single byte.
  assert.equal(encodeAuthoredPath(DIAMOND), '1!catmull-rom!1_.5!0_1!.5_.5!1_0!.5');
  // And the plural entry point agrees with it exactly - no wrapper, no length marker,
  // no separator for a list of one.
  assert.equal(encodeAuthoredPaths([DIAMOND]), '1!catmull-rom!1_.5!0_1!.5_.5!1_0!.5');
  assert.ok(!encodeAuthoredPaths([DIAMOND]).includes('*'));
});

test('encoding: several paths round-trip, and the value is still delimiter-safe', () => {
  const enc = encodeAuthoredPaths(RING);
  assert.ok(enc.includes('*'), 'two paths should be separated');
  assert.equal(enc.split('*').length, 2);
  // The properties that make the format usable at all hold for the plural form too.
  assert.ok(!enc.includes(','), 'encoded paths contain a comma');
  assert.ok(!enc.includes('~'), 'encoded paths contain a tilde');
  assert.equal(encodeURIComponent(enc), enc, 'the plural form is not already URL-safe');

  const back = decodeAuthoredPaths(enc);
  assert.ok(back, 'plural decode returned null');
  assert.deepEqual(back, RING);
  // Concatenation, not nesting: each segment is exactly what the singular form emits.
  assert.deepEqual(enc.split('*'), RING.map(encodeAuthoredPath));

  // Mixed kinds, tensions, handles and closedness in one value. Every coordinate here
  // is exact at six decimals, so a deep-equal round trip is a fair test of the codec
  // rather than of its documented quantisation.
  const mixed: AuthoredPath[] = [
    DIAMOND,
    {
      kind: 'cubic', closed: false,
      nodes: [
        { x: 0.125, y: 0.25, hOutX: 0.0625, hOutY: -0.125, continuity: 'smooth' },
        { x: 0.875, y: 0.75, hInX: -0.0625, hInY: 0.125 },
      ],
    },
    { kind: 'catmull-rom', nodes: DIAMOND.nodes, closed: true, tension: 0.25 },
  ];
  assert.deepEqual(decodeAuthoredPaths(encodeAuthoredPaths(mixed)), mixed);
});

test('encoding: decode∘encode is a fixed point at BOTH arities', () => {
  // Why it has to be: re-sharing an opened link must not change its bytes, or every
  // cache and equality check keyed on the value churns.
  for (const paths of [[DIAMOND], RING, [bigPath(31)], [DIAMOND, ...RING], [{ ...bigPath(9), closed: false }]]) {
    const enc = encodeAuthoredPaths(paths);
    const once = decodeAuthoredPaths(enc);
    assert.ok(once, 'decode returned null');
    const again = encodeAuthoredPaths(once!);
    assert.equal(again, enc, 'plural encoding is not canonical');
    assert.deepEqual(decodeAuthoredPaths(again), once);
  }
  // The singular pair keeps its own fixed point, unchanged.
  const one = encodeAuthoredPath(bigPath(13));
  assert.equal(encodeAuthoredPath(decodeAuthoredPath(one)!), one);
});

test('encoding: the singular decode REFUSES a multi-path value rather than returning the first', () => {
  const enc = encodeAuthoredPaths(RING);
  // Silently answering with contour 1 of 2 would drop the hole - the same class of
  // defect as decoding half a path, which this codec exists not to do.
  assert.equal(decodeAuthoredPath(enc), null);
  assert.equal(decodeAuthoredPaths(enc)!.length, 2);
  // A single-path value still decodes through the singular door.
  assert.deepEqual(decodeAuthoredPath(encodeAuthoredPath(DIAMOND)), DIAMOND);
});

test('encoding: the node ceiling is on the WHOLE value, so N paths cannot multiply it', () => {
  const run = (n: number): AuthoredPath => ({
    kind: 'line', closed: true,
    nodes: Array.from({ length: n }, (_, i) => ({ x: i / n, y: 0.5 })),
  });
  // Two paths, each legal on its own, are 20002 nodes together.
  const half = encodeAuthoredPath(run(10_001));
  assert.ok(decodeAuthoredPath(half), 'one 10001-node path is under the ceiling');
  const both = `${half}*${half}`;
  assert.equal(decodeAuthoredPaths(both), null);
  assert.equal(decodeAuthoredPathsResult(both), 'too-complex');
  // And the encoder refuses to produce such a value in the first place, rather than
  // writing a field nothing will ever read back.
  assert.throws(() => encodeAuthoredPaths([run(10_001), run(10_001)]), /20002 nodes/);
  // Exactly at the ceiling is allowed - the limit is a limit, not a margin.
  assert.equal(decodeAuthoredPaths(`${encodeAuthoredPath(run(10_000))}*${encodeAuthoredPath(run(10_000))}`)!.length, 2);
});

test('encoding: a malformed member poisons the whole value, and the reason is reported', () => {
  const good = encodeAuthoredPath(DIAMOND);
  for (const bad of ['', 'nonsense', '2!cubic!1_.5!0', '1!cubic!1_abc!0']) {
    assert.equal(decodeAuthoredPaths(`${good}*${bad}`), null, `accepted a bad member: ${bad}`);
    assert.equal(decodeAuthoredPathsResult(`${good}*${bad}`), 'malformed');
  }
  // The reason-carrying door keeps "not a shape" and "too big to read" apart, which is
  // what lets a caller say something different about each.
  assert.deepEqual(decodeAuthoredPathsResult(good), [DIAMOND]);
  assert.equal(decodeAuthoredPathsResult('1!cubic!1'.padEnd(400_001, '_.5!0')), 'too-complex');
});

test('encoding: the bridge carries the plural form both ways', () => {
  const enc = geom.encodeAuthored(RING as never);
  assert.ok(enc.ok);
  const value = (enc as { ok: true; value: string }).value;
  assert.equal(value, encodeAuthoredPaths(RING));
  const dec = geom.decodeAuthored(value);
  assert.ok(dec.ok);
  assert.deepEqual((dec as { ok: true; value: AuthoredPath[] }).value, RING);
  // A bare path and a one-element list are the same value on the wire.
  assert.equal(
    (geom.encodeAuthored([DIAMOND] as never) as { ok: true; value: string }).value,
    (geom.encodeAuthored(DIAMOND as never) as { ok: true; value: string }).value,
  );
  // Past the ceiling is 'too-large' (well-formed, too big) and never 'invalid-argument'
  // (not a path) - the distinction the whole API is built on.
  const run = (n: number): AuthoredPath => ({
    kind: 'line', closed: true, nodes: Array.from({ length: n }, (_, i) => ({ x: i / n, y: 0.5 })),
  });
  const over = geom.encodeAuthored([run(10_001), run(10_001)] as never);
  assert.equal(over.ok, false);
  assert.equal((over as { ok: false; code: string }).code, 'too-large');
  const tooBig = geom.decodeAuthored(`${encodeAuthoredPath(run(10_001))}*${encodeAuthoredPath(run(10_001))}`);
  assert.equal(tooBig.ok, false);
  assert.equal((tooBig as { ok: false; code: string }).code, 'too-large');
  assert.equal((geom.decodeAuthored('nonsense') as { ok: false; code: string }).code, 'invalid-argument');
});

test('encoding: refuses a value that is not one, rather than half-decoding it', () => {
  for (const bad of [
    '', '   ', 'nonsense', '2!cubic!1_.5!0', '1!!1_.5!0', '1!CUBIC!1_.5!0',
    '1!cubic!1', '1!cubic!1_.5', '1!cubic!1_abc!0', '1!cubic!1_.5!0!!!!!!x',
    '1!cubic!1_1e3!0', '1!cubic!1_ 0.5!0', '1!cubic!1_.5!0!c',
    '<svg onload=1>', '1!cubic!1_Infinity!0', `1!cubic!1${'_.5!0'.repeat(20001)}`,
  ]) {
    assert.equal(decodeAuthoredPath(bad), null, `decoded junk: ${bad.slice(0, 40)}`);
  }
});

test('encoding: one home — host.geom exposes the SAME codec the engine exports', () => {
  const enc = geom.encodeAuthored(DIAMOND as never);
  assert.ok(enc.ok);
  assert.equal((enc as { ok: true; value: string }).value, encodeAuthoredPath(DIAMOND));
  const dec = geom.decodeAuthored((enc as { ok: true; value: string }).value);
  assert.ok(dec.ok);
  // ALWAYS a list, even for a one-path value: a caller that got handed a bare path
  // for the common case would render the first contour of a holed shape and drop
  // the hole, which is the whole defect this arity exists to prevent.
  assert.deepEqual((dec as { ok: true; value: AuthoredPath[] }).value, [DIAMOND]);
  // The bridge returns failures, never throws - a throw out of a hook is swallowed.
  for (const bad of ['', 'nope', null as never, 42 as never]) {
    const r = geom.decodeAuthored(bad);
    assert.equal(r.ok, false);
    assert.equal((r as { ok: false; code: string }).code, 'invalid-argument');
  }
  assert.equal(geom.encodeAuthored({ kind: 'cubic', nodes: [], closed: false }).ok, false);
  assert.equal(geom.encodeAuthored({ kind: 'Bad Kind', nodes: DIAMOND.nodes, closed: true }).ok, false);
  assert.equal(
    geom.encodeAuthored({ kind: 'cubic', nodes: [{ x: Number.NaN, y: 0 }], closed: false }).ok, false,
  );
});

/** The web shell's compact encoder (shells/web/src/views/tool.ts
 *  `encodeBlocksCompact`), reproduced as the two lines it is so the wire format can
 *  be exercised from a node test. It BAILS to the JSON form when any value carries
 *  `,` or `~`; the assertion below is that a path value never triggers that. */
function encodeBlocksCompact(rows: Row[], fields: FieldSpec[]): string | null {
  const vals = rows.map((r) => fields.map((f) => {
    const v = String(r[f.id] ?? '');
    return f.type === 'color' ? v.replace(/^#/, '') : v;
  }));
  if (vals.some((r) => r.some((v) => v.includes('~') || v.includes(',')))) return null;
  return vals.map((r) => r.map(encodeURIComponent).join(',')).join('~');
}

test('URL: a path box survives the COMPACT blocks form (the one with unescapable separators)', () => {
  const input = boxesInput('community');
  const fields = input.fields!;
  const rows: Row[] = [
    { id: 'a', kind: 'text', x: 10, y: 20, w: 300, h: 100, text: 'hello world', fg: '#112233' },
    pathBox({ path: encodeAuthoredPath(bigPath(347)) }),
    pathBox({ id: 'p2', path: encodeAuthoredPath({ ...DIAMOND, closed: false }) }),
  ];
  const compact = encodeBlocksCompact(rows, fields);
  // Not null: a path box must never be what forces the whole boxes array onto the
  // JSON fallback.
  assert.ok(compact, 'compact encoding bailed — a path value carried a separator');

  // Through a real URL, which is where percent-decoding happens BEFORE the block
  // splitter sees the string.
  const url = new URL(`https://lolly.tools/#/t/design?boxes=${compact}`);
  const qs = url.hash.slice(url.hash.indexOf('?') + 1);
  const state = parseUrlState(qs, { inputs: [input] } as never);
  const out = state.values.boxes as Row[];
  assert.equal(out.length, 3, 'row count changed through the URL');
  for (let i = 1; i < 3; i++) {
    const decoded = decodeAuthoredPath(String(out[i]!.path));
    const wanted = decodeAuthoredPath(String(rows[i]!.path));
    assert.deepEqual(decoded, wanted, `row ${i} path did not survive the round trip`);
  }
  // And the rest of the row still lands in the right columns - the failure mode a
  // stray separator would cause.
  assert.equal(out[0]!.text, 'hello world');
  assert.equal(out[1]!.kind, 'path');
  assert.equal(out[1]!.fillRule, 'nonzero');
  assert.equal(out[1]!.w, '400');
});

test('URL: a path box survives the engine JSON blocks form too', () => {
  const input = boxesInput('community');
  const rows = [pathBox({ path: encodeAuthoredPath(bigPath(120)) })];
  const qs = serializeUrlState([{ ...input, value: rows } as never]);
  const state = parseUrlState(qs, { inputs: [input] } as never);
  const out = (state.values.boxes as Row[])[0]!;
  assert.deepEqual(
    decodeAuthoredPath(String(out.path)),
    decodeAuthoredPath(String(rows[0]!.path)),
  );
});

test('URL: DEFLATE packing keeps a realistic path link to a sane length', async (t) => {
  if (!isPackAvailable()) return t.skip('no CompressionStream in this runtime');
  const input = boxesInput('community');
  /** A node-only spline (`hyperbezier`/`catmull-rom` - the pen-tool default owns its
   *  own handles) and the same node count WITH four handle offsets each: the cheap
   *  and expensive ends of what a pen tool actually stores. */
  const nodesOnly = (n: number): AuthoredPath => ({
    kind: 'catmull-rom', closed: true,
    nodes: bigPath(n).nodes.map((p) => ({ x: p.x, y: p.y })),
  });
  const lines: string[] = [];
  const measured: { label: string; raw: number; packed: number; ceiling: number }[] = [];
  for (const [label, p, ceiling] of [
    ['24 nodes, no handles', nodesOnly(24), 1000],
    ['120 nodes, no handles', nodesOnly(120), 2500],
    ['24 nodes + handles', bigPath(24), 1500],
    ['120 nodes + handles', bigPath(120), 4000],
    // The honest upper end: a 500-node fully-handled path is a traced outline, not a
    // drawn one, and its link is past where a URL is the right container even packed.
    // Recorded rather than wished away.
    ['500 nodes + handles', bigPath(500), 12_000],
  ] as [string, AuthoredPath, number][]) {
    const rows: Row[] = [
      { id: 'bg', kind: 'box', x: 0, y: 0, w: 1080, h: 1080, shape: 'rect', bg: '#0c322c' },
      pathBox({ path: encodeAuthoredPath(p) }),
    ];
    const raw = `boxes=${encodeBlocksCompact(rows, input.fields!)!}`;
    const token = await packQuery(raw);
    assert.ok(token, 'packQuery returned nothing');
    const packed = `z=${token}`;
    lines.push(`      ${label.padEnd(22)} field ${String(rows[1]!.path).length
      } chars · query ${raw.length} · packed ${packed.length} (${
      (100 * packed.length / raw.length).toFixed(0)}%)`);
    measured.push({ label, raw: raw.length, packed: packed.length, ceiling });
    assert.equal(await unpackToken(token!), raw, 'pack round trip is lossy');
  }
  // Reported before asserted, so a regression shows the numbers rather than only the
  // one that broke.
  console.log(lines.join('\n'));
  for (const m of measured) {
    // Two claims, and only these two. Packing always wins, and the result stays
    // inside the ceiling recorded for that size - so a pen shape lives in a LINK
    // rather than only in a saved session.
    assert.ok(m.packed < m.raw, `${m.label}: packing did not help (${m.packed} vs ${m.raw})`);
    assert.ok(m.packed < m.ceiling, `${m.label}: packed link is ${m.packed} chars`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. The lowering - hooks.js -> inline <svg><path>
// ─────────────────────────────────────────────────────────────────────────────

test('render: a path box lowers to a real <path> whose geometry is the intended shape', () => {
  for (const brand of BRANDS) {
    const { compute, logs } = withGeom(brand);
    const out = compute([pathBox()]);
    const markup = out.pathHtml![0]!;
    assert.equal(logs.length, 0, `${brand}: a good path logged: ${logs.join('; ')}`);
    assertNoNaN(markup);

    // Box-local pixel space with a 1:1 viewBox - never "0 0 1 1", which would scale
    // the stroke non-uniformly with the box.
    assert.match(markup, /^<svg class="lolly-box-path" width="400" height="300" viewBox="0 0 400 300"/);
    const d = pathD(markup);

    // GEOMETRIC comparison, not string equality. The diamond's four normalised
    // nodes map to (200,0) (400,150) (200,300) (0,150) in a 400x300 box, and a
    // closed centripetal Catmull-Rom through them is a rounded, convex blob: it
    // touches all four box edges and its area sits between the inscribed diamond
    // (half the box) and the box itself.
    const b = bounds(d);
    assert.ok(Math.abs(b.x0) <= 4 && Math.abs(b.x1 - 400) <= 4, `${brand}: x extent ${b.x0}..${b.x1}`);
    assert.ok(Math.abs(b.y0) <= 4 && Math.abs(b.y1 - 300) <= 4, `${brand}: y extent ${b.y0}..${b.y1}`);
    const a = area(d);
    assert.ok(a > 0.5 * 400 * 300 && a < 0.95 * 400 * 300, `${brand}: area ${a}`);
    // The interior really is interior, and the corners really are outside.
    assert.equal(inside(d, 200, 150), true, `${brand}: centre outside`);
    assert.equal(inside(d, 4, 4), false, `${brand}: corner inside`);

    // Paint: `bg` is the PATH's fill, and the div behind it stays transparent so a
    // pen shape never sits on an opaque rectangle of its own colour.
    assert.equal(attr(markup, 'fill'), '#30ba78', `${brand}: fill`);
    assert.equal(attr(markup, 'fill-rule'), 'nonzero', `${brand}: fill-rule`);
    assert.match(out.boxStyle![0]!, /background:transparent;/, `${brand}: box div is not transparent`);
    // opacity / blend ride on the box div exactly as they do for every other kind.
    const dim = compute([pathBox({ opacity: 40, blend: 'multiply' })]);
    assert.match(dim.boxStyle![0]!, /opacity:0\.4;mix-blend-mode:multiply;/, `${brand}: opacity/blend`);
  }
});

test('render: a multi-contour path is ONE <path> whose d holds every subpath, hole included', () => {
  // The case Stage E produces and Stage C did not originally render: a boolean subtract
  // is several contours, and `fill-rule` is a property of a PATH - so two <path>
  // elements can never subtract, while one <path> with two subpaths does it for free.
  for (const brand of BRANDS) {
    const { compute, logs } = withGeom(brand);
    const markup = compute([pathBox({ w: 200, h: 200, path: encodeAuthoredPaths(RING) })]).pathHtml![0]!;
    assert.equal(logs.length, 0, `${brand}: a good multi-contour path logged: ${logs.join('; ')}`);
    assertNoNaN(markup);
    // ONE element, not one per contour.
    assert.equal((markup.match(/<svg/g) ?? []).length, 1, `${brand}: svg count`);
    assert.equal((markup.match(/<path/g) ?? []).length, 1, `${brand}: path count`);

    const d = pathD(markup);
    // Two subpaths: a `d` carries as many movetos as there are contours.
    assert.equal((d.match(/M/gi) ?? []).length, 2, `${brand}: subpath count in ${d}`);

    // Computed independently: the outer square is the whole 200x200 frame and the inner
    // one spans 0.25..0.75 of it, i.e. 100x100 - so a ring of 40000 - 10000.
    assert.equal(area(d), 30_000, `${brand}: ring area`);
    // And the hole is a real hole, not just a lower area: the centre is OUTSIDE the
    // filled region while a point in the ring's material is inside.
    assert.equal(inside(d, 100, 100), false, `${brand}: the hole is filled`);
    assert.equal(inside(d, 10, 10), true, `${brand}: the ring's material is not filled`);
    // x=25 is in the ring's left arm; the hole spans 50..150, so 60 would be INSIDE it.
    assert.equal(inside(d, 25, 100), true, `${brand}: the left arm of the ring is not filled`);
    // Bounds are the outer loop's, so nothing was dropped.
    const b = bounds(d);
    assert.deepEqual([b.x0, b.y0, b.x1, b.y1], [0, 0, 200, 200], `${brand}: ring bounds`);
  }
});

test('render: one unusable contour among several refuses the whole shape, visibly', () => {
  // Half a shape is exactly the confidently-wrong artwork the codec refuses to produce,
  // so the renderer must not draw the contours it CAN when one of them cannot lower.
  const { compute, logs } = withGeom();
  // One contour carries a kind no engine can lower (spiro is now a real solver, so an
  // unknown kind is the refusal case). Half a shape must never be drawn.
  const mixed = `${encodeAuthoredPath(RING[0]!)}*${encodeAuthoredPath({ ...RING[1]!, kind: 'zigzag' as AuthoredPath['kind'] })}`;
  assertUndrawn(compute([pathBox({ path: mixed })]).pathHtml![0]!, logs, /invalid-argument/);
});

test('render: stroke and fill-rule are honoured; an unfilled stroked path is possible', () => {
  const { compute } = withGeom();
  const stroked = compute([pathBox({ bg: '', stroke: '#ff0000', strokeW: 6.25 })]).pathHtml![0]!;
  assert.equal(attr(stroked, 'fill'), 'none');
  assert.equal(attr(stroked, 'stroke'), '#ff0000');
  assert.equal(attr(stroked, 'stroke-width'), '6.25');

  // A zero width means no stroke at all, not a hairline.
  const zero = compute([pathBox({ stroke: '#ff0000', strokeW: 0 })]).pathHtml![0]!;
  assert.equal(attr(zero, 'stroke'), null);

  const eo = compute([pathBox({ fillRule: 'evenodd' })]).pathHtml![0]!;
  assert.equal(attr(eo, 'fill-rule'), 'evenodd');

  // The rule is not decoration: a pentagram's core is wound TWICE, so it fills
  // under nonzero and is a hole under even-odd. The emitted attribute is what a
  // renderer reads, so a path box that ignored `fillRule` would be caught here.
  const star: AuthoredPath = {
    kind: 'line', closed: true,
    nodes: Array.from({ length: 5 }, (_, k) => {
      const a = (-90 + ((k * 2) % 5) * 72) * Math.PI / 180;
      return { x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) };
    }),
  };
  const d = pathD(compute([pathBox({ path: encodeAuthoredPath(star) })]).pathHtml![0]!);
  assert.equal(inside(d, 200, 150, 'nonzero'), true, 'star core not filled under nonzero');
  assert.equal(inside(d, 200, 150, 'evenodd'), false, 'star core filled under even-odd');
});

test('render: the STROKE is not clipped — the <svg> box and viewBox pad by half the width', () => {
  // The second half of the reported bounding-box bug, and independent of the frame refit: the
  // pen tool makes the frame the curve's TIGHT bbox, so a stroke straddles the frame edge and
  // half of it falls outside - and an outer <svg> clips to its viewport, in the browser AND in
  // SVG output (a nested <svg> clips by default), so a shape whose curve fits perfectly still
  // lost half its outline all the way round. The fix is geometric rather than
  // `overflow: visible`, because three renderers read this markup.
  for (const brand of BRANDS) {
    const { compute, logs } = withGeom(brand);
    // A square that fills the frame exactly: bounds 0..400 × 0..300, so every edge of the
    // stroke straddles a viewport edge.
    const square: AuthoredPath = {
      kind: 'line', closed: true,
      nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    };
    const plain = compute([pathBox({ bg: '#30ba78', stroke: '', strokeW: 0, path: encodeAuthoredPath(square) })]).pathHtml![0]!;
    const markup = compute([pathBox({ bg: '', stroke: '#0e1217', strokeW: 20, path: encodeAuthoredPath(square) })]).pathHtml![0]!;
    assert.equal(logs.length, 0, `${brand}: a good stroked path logged: ${logs.join('; ')}`);
    assertNoNaN(markup);

    // stroke-width 20 with a round join and cap reaches exactly 10 past the curve, so the
    // element grows by 10 on every side and the viewBox origin moves to (-10, -10).
    assert.equal(attr(markup, 'width'), '420', `${brand}: width`);
    assert.equal(attr(markup, 'height'), '320', `${brand}: height`);
    assert.equal(attr(markup, 'viewBox'), '-10 -10 420 320', `${brand}: viewBox`);
    // The pad is a viewBox shift, NOT a transform: path coordinates still map to 0..w / 0..h,
    // so the `d` is byte-identical to the unpadded one and the geometry is untouched.
    assert.equal(pathD(markup), pathD(plain), `${brand}: the path data changed`);
    const b = bounds(pathD(markup));
    assert.deepEqual([b.x0, b.y0, b.x1, b.y1], [0, 0, 400, 300], `${brand}: the curve still fills 0..w × 0..h`);

    // styles.css pins the element to the frame with `inset: 0; width/height: 100%`, so the
    // grown geometry has to be inline or the browser pulls it straight back.
    const style = attr(markup, 'style') || '';
    assert.match(style, /inset:auto/, `${brand}: inset is not released, so left/top cannot bite`);
    assert.match(style, /left:-10px/, `${brand}: left offset`);
    assert.match(style, /top:-10px/, `${brand}: top offset`);
    assert.match(style, /width:420px/, `${brand}: inline width`);
    assert.match(style, /height:320px/, `${brand}: inline height`);
    // And the box div must stop clipping, or the pad is cut off one level up.
    const style0 = compute([pathBox({ stroke: '#0e1217', strokeW: 20 })]).boxStyle![0]!;
    assert.match(style0, /overflow:visible;/, `${brand}: the box div still clips its path`);

    // An UNSTROKED path needs no pad, and gets none - its markup is unchanged, which is what
    // keeps every existing filled shape byte-identical.
    assert.equal(attr(plain, 'viewBox'), '0 0 400 300', `${brand}: an unstroked path is unpadded`);
    assert.equal(attr(plain, 'style'), null, `${brand}: and carries no inline geometry`);
  }
});

test('render: normalised nodes scale with the box, and handles scale with them', () => {
  const { compute } = withGeom();
  // A single cubic segment across the frame, with handles.
  const p: AuthoredPath = {
    kind: 'cubic', closed: false,
    nodes: [{ x: 0, y: 0.5, hOutX: 0.25, hOutY: -0.5 }, { x: 1, y: 0.5, hInX: -0.25, hInY: -0.5 }],
  };
  const small = pathD(compute([pathBox({ w: 100, h: 100, path: encodeAuthoredPath(p) })]).pathHtml![0]!);
  const big = pathD(compute([pathBox({ w: 400, h: 200, path: encodeAuthoredPath(p) })]).pathHtml![0]!);
  const sb = bounds(small), bb = bounds(big);
  // Endpoints span the frame; the handle pulls the curve above the chord by a
  // fraction of the HEIGHT, so the vertical extent scales with h and not with w.
  assert.ok(Math.abs(sb.x1 - 100) < 0.5 && Math.abs(bb.x1 - 400) < 0.5, 'x did not scale with w');
  const sUp = 50 - sb.y0, bUp = 100 - bb.y0;
  assert.ok(sUp > 5 && bUp > 10, 'handles did not bend the curve');
  assert.ok(Math.abs(bUp / sUp - 2) < 0.02, `handle offsets did not scale with h: ${sUp} vs ${bUp}`);
});

test('render: every other kind emits an empty pathHtml, and a path box emits no text/media', () => {
  const { compute } = withGeom();
  const out = compute([
    { id: 'a', kind: 'box', w: 10, h: 10, bg: '#fff' },
    { id: 'b', kind: 'text', w: 10, h: 10, text: 'hi' },
    { id: 'c', kind: 'image', w: 10, h: 10, image: { url: 'https://ex.test/a.png' } },
    pathBox({ id: 'd', path: encodeAuthoredPath(DIAMOND) }),
  ]);
  assert.deepEqual(out.pathHtml!.slice(0, 3), ['', '', '']);
  assert.ok(out.pathHtml![3]!.includes('<path'));
  // A path box carries no image and no text of its own here, so the other extras
  // stay empty - the shape is the only thing painted.
  assert.equal(out.mediaHtml![3], '');
  assert.equal(out.textHtml![3], '');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Degrades - visible and logged, never silent and never thrown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The documented degrade: a dashed outline of the box frame in `currentColor`,
 * marked `lolly-box-path-undrawn`, plus a `host.log('warn', …)`. Rationale, in
 * one line: an invisible element is the only answer a user cannot act on, and a
 * throw out of `onInit` is caught and DISCARDED by the runtime, so the warning is
 * the sole channel there is.
 */
function assertUndrawn(markup: string, logs: string[], why: RegExp): void {
  assert.match(markup, /class="lolly-box-path lolly-box-path-undrawn"/);
  assert.match(markup, /stroke-dasharray="6 4"/);
  assert.match(markup, /stroke="currentColor"/);
  assertNoNaN(markup);
  assert.ok(logs.length >= 1, 'the degrade did not log');
  assert.match(logs.join(' | '), why);
}

test('degrade: host.geom absent — visible outline + a warning naming the missing bridge', () => {
  const logs: string[] = [];
  const compute = loadCompute('community', { log: (l, m) => logs.push(`${l}: ${m}`) });
  const out = compute([pathBox()]);
  assertUndrawn(out.pathHtml![0]!, logs, /host\.geom is unavailable/);
  assert.match(logs[0]!, /^warn: design: /);
  // Every other kind is unaffected by a missing geom bridge.
  const mixed = compute([{ id: 'b', kind: 'text', w: 10, h: 10, text: 'hi' }]);
  assert.equal(mixed.pathHtml![0], '');
  assert.equal(mixed.textHtml![0], 'hi');
});

test('degrade: a partial host.geom (no fromNodes) is treated as absent, not as a crash', () => {
  const logs: string[] = [];
  const compute = loadCompute('community', {
    geom: { decodeAuthored: () => ({ ok: true, value: DIAMOND }) },
    log: (l, m) => logs.push(`${l}: ${m}`),
  });
  assertUndrawn(compute([pathBox()]).pathHtml![0]!, logs, /host\.geom is unavailable/);
});

test('degrade: fromNodes returns ok:false — the code and message reach the log', () => {
  // A real refusal from the real bridge: a kind no engine has ever heard of answers
  // 'invalid-argument', which the tool degrades to an undrawn outline + a warning.
  // (Spiro USED to be the "known but unimplemented" example - it is now a real solver,
  // engine/src/geom/spiro.ts, so an unknown kind is the refusal case.)
  const { compute, logs } = withGeom();
  // Cast: 'zigzag' is deliberately not a SplineKind - the codec must carry an unknown
  // kind through untouched so a LATER engine can be the one to name it.
  const out = compute([pathBox({
    path: encodeAuthoredPath({ ...DIAMOND, kind: 'zigzag' as AuthoredPath['kind'] }),
  })]);
  assertUndrawn(out.pathHtml![0]!, logs, /invalid-argument/);
});

test('degrade: an empty path field is an empty state, not an error', () => {
  const { compute, logs } = withGeom();
  for (const v of ['', undefined, null]) {
    const out = compute([pathBox({ path: v })]);
    assert.equal(out.pathHtml![0], '', `path=${String(v)} should render nothing`);
  }
  // Nothing authored yet is not a defect, so it must not fill the log with warnings
  // on every keystroke.
  assert.deepEqual(logs, []);
});

test('degrade: garbage / hostile / absurd path fields never throw and never emit NaN', () => {
  const { compute } = withGeom();
  for (const v of [
    'garbage', '1!cubic', '1!cubic!1_NaN!NaN', '1!cubic!1_1e400!0',
    '{"kind":"cubic","nodes":[]}', '1!cubic!1_.5!0!!!!!!!!!!',
    `1!cubic!1${'_.5!.5'.repeat(50000)}`, '\u0000', '../../etc/passwd',
  ]) {
    const out = compute([pathBox({ path: v })]);
    const markup = out.pathHtml![0]!;
    assertNoNaN(markup);
    assert.ok(!markup || markup.includes('lolly-box-path-undrawn'), `unexpected markup for ${v.slice(0, 20)}`);
  }
  // A degenerate box size still produces finite markup rather than a divide-by-zero.
  for (const dim of [{ w: 0, h: 0 }, { w: -5, h: 1 }, { w: 'x', h: null }]) {
    assertNoNaN(compute([pathBox(dim)]).pathHtml![0]!);
  }
  // A one-node path lowers to no curves: `ok` with no geometry is an ANSWER, so it
  // renders nothing rather than crying wolf.
  const one = compute([pathBox({ path: encodeAuthoredPath({ kind: 'cubic', nodes: [{ x: 0.5, y: 0.5 }], closed: false }) })]);
  assert.equal(one.pathHtml![0], '');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Injection - the extra is emitted through {{{ }}}, which does not escape
// ─────────────────────────────────────────────────────────────────────────────

test('injection: hostile path / bg / stroke / fillRule values are neutralised', () => {
  const { compute } = withGeom();
  const hostile = [
    '"><script>alert(1)</script>',
    "' onload='alert(1)",
    'red" onmouseover="x',
    '#fff;background:url(javascript:alert(1))',
    '</svg><img src=x onerror=alert(1)>',
    'url(#evil)',
  ];
  for (const v of hostile) {
    for (const field of ['path', 'bg', 'stroke', 'fillRule'] as const) {
      const row = pathBox({ [field]: v, stroke: field === 'stroke' ? v : '#000', strokeW: 4 });
      const markup = compute([row]).pathHtml![0]!;
      // Nothing that could open a tag or an attribute survives.
      assert.ok(!markup.includes('<script'), `${field}: script tag survived`);
      assert.ok(!/onerror|onload|onmouseover/i.test(markup), `${field}: event handler survived`);
      assert.ok(!markup.includes('javascript:'), `${field}: javascript: survived`);
      // Exactly one <svg> and one </svg>: a value cannot break out of the element.
      assert.equal((markup.match(/<svg/g) ?? []).length, markup ? 1 : 0, `${field}: svg count`);
      assert.equal((markup.match(/<path/g) ?? []).length, markup ? 1 : 0, `${field}: path count`);
      // And the paint attributes only ever hold validated values.
      if (markup && !markup.includes('undrawn')) {
        assert.match(attr(markup, 'fill')!, /^(none|#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\))$/);
        assert.match(attr(markup, 'fill-rule')!, /^(nonzero|evenodd)$/);
        const s = attr(markup, 'stroke');
        if (s !== null) assert.match(s, /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\))$/);
      }
    }
  }
  // The box style is the other sink: a fill that could inject CSS is rejected there
  // too (a path box's div is transparent regardless, which is belt and braces).
  const styled = compute([pathBox({ bg: 'red;position:fixed' })]);
  assert.ok(!styled.boxStyle![0]!.includes('position:fixed'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5b. Stroke decoration - style / ends / corners
//
// The canvas editor's stroke panel writes `strokeDash`, `strokeCap` and `strokeJoin`;
// this is the other end of that, i.e. what the three renderers actually receive. Every
// one of these values lands in an ATTRIBUTE inside markup emitted through `{{{ }}}`, so
// the whitelist is a security property and not a tidiness one - `stroke-dasharray` in
// particular is the one attribute that would otherwise carry arbitrary numbers (and
// `NaN`) straight through `esc()`.
// ─────────────────────────────────────────────────────────────────────────────

test('manifest: strokeDash / strokeCap / strokeJoin are appended after the existing fields', () => {
  // Slot-relative, never distance-from-the-end: appending is the one safe edit to a
  // blocks input, so an assertion that forbade it would fail on the next feature rather
  // than on a real defect. What must hold is that the three are CONTIGUOUS, in this
  // order, and after `fillRule` - anything else is a wire-format change.
  for (const brand of BRANDS) {
    const ids = boxesInput(brand).fields!.map((f) => f.id);
    const rule = ids.indexOf('fillRule');
    const dash = ids.indexOf('strokeDash');
    assert.ok(rule >= 0, `${brand}: fillRule missing`);
    assert.ok(dash > rule, `${brand}: strokeDash must come after fillRule`);
    assert.deepEqual(
      ids.slice(dash, dash + 3), ['strokeDash', 'strokeCap', 'strokeJoin'],
      `${brand}: the three stroke-decoration fields must stay contiguous, in order`,
    );
    assert.equal(new Set(ids).size, ids.length, `${brand}: a duplicated field id would alias a wire slot`);

    const byId = new Map(boxesInput(brand).fields!.map((f) => [f.id, f]));
    // Closed sets, matching the whitelists in hooks.js exactly - a value the manifest
    // offers but the hook rejects would be a control that silently does nothing.
    assert.deepEqual(byId.get('strokeDash')!.options!.map((o) => o.value), ['', 'dashed', 'dotted']);
    assert.deepEqual(byId.get('strokeCap')!.options!.map((o) => o.value), ['round', 'butt', 'square']);
    assert.deepEqual(byId.get('strokeJoin')!.options!.map((o) => o.value), ['round', 'miter', 'bevel']);
    // strokeDash also serves box/image (the importer's CSS-border strokes honour
    // dashed/dotted); cap/join are stroked-path geometry and stay path-only.
    for (const id of ['strokeDash', 'strokeCap', 'strokeJoin']) {
      assert.equal(byId.get(id)!.type, 'select', `${brand}: ${id} type`);
      assert.deepEqual(byId.get(id)!.showFor, id === 'strokeDash' ? ['path', 'box', 'image', 'frame'] : ['path'], `${brand}: ${id} showFor`);
    }
  }
});

/** A stroked path box: `bg: ''` so the fill is `none` and the stroke is the only paint. */
const strokedBox = (over: Row = {}): Row => pathBox({ bg: '', stroke: '#0e1217', strokeW: 10, ...over });

test('render: the DEFAULTS are byte-identical to the hard-coded round/round/undashed markup', () => {
  // The stroke decoration was hard-coded before it was controllable (round cap, round
  // join, no dash array), so an existing shape's markup has to be unchanged to the
  // character - including the ABSENCE of stroke-dasharray and stroke-miterlimit, either
  // of which would change what an SVG or PDF consumer receives for artwork nobody edited.
  for (const brand of BRANDS) {
    const { compute, logs } = withGeom(brand);
    const bare = compute([strokedBox()]).pathHtml![0]!;
    const d = pathD(bare);
    const expected =
      '<svg class="lolly-box-path" width="410" height="310" viewBox="-5 -5 410 310"' +
      ' preserveAspectRatio="none" style="inset:auto;left:-5px;top:-5px;width:410px;height:310px">' +
      `<path d="${d}" fill="none" fill-rule="nonzero" stroke="#0e1217" stroke-width="10"` +
      ' stroke-linejoin="round" stroke-linecap="round"></path></svg>';
    assert.equal(bare, expected, `${brand}: the default stroked markup changed`);
    assert.equal(logs.length, 0, `${brand}: a default shape logged: ${logs.join('; ')}`);

    // Writing the defaults explicitly must produce the same bytes, so a shape edited to
    // its own default is not a diff in an export.
    assert.equal(
      compute([strokedBox({ strokeDash: '', strokeCap: 'round', strokeJoin: 'round' })]).pathHtml![0]!,
      expected, `${brand}: explicit defaults differ from omitted ones`,
    );
    // And so must every value the hook does not recognise: an unknown keyword falls back
    // to the default rather than reaching the attribute.
    assert.equal(
      compute([strokedBox({ strokeDash: 'zigzag', strokeCap: 'ROUND', strokeJoin: 'miter-clip' })]).pathHtml![0]!,
      expected, `${brand}: an unknown keyword did not fall back to the default`,
    );
  }
});

test('render: the stroke style is a dasharray PROPORTIONAL to the width, and dotted respects the cap', () => {
  const { compute } = withGeom();
  const dash = (over: Row): string | null => attr(compute([strokedBox(over)]).pathHtml![0]!, 'stroke-dasharray');

  // Solid is the absence of the attribute, not a dasharray that happens to be continuous.
  assert.equal(dash({ strokeDash: '' }), null);
  // Dashed: 3 wide on, 2 wide off - a ratio, so a dash keeps its proportion at any width
  // and at any export scale.
  assert.equal(dash({ strokeDash: 'dashed', strokeW: 10 }), '30 20');
  assert.equal(dash({ strokeDash: 'dashed', strokeW: 2.5 }), '7.5 5');
  // Dotted with a ROUND (or square) cap is a ZERO-length dash: the cap alone paints the
  // full width, so a real dash would paint a lozenge instead of a dot.
  assert.equal(dash({ strokeDash: 'dotted', strokeW: 10 }), '0 20');
  assert.equal(dash({ strokeDash: 'dotted', strokeW: 10, strokeCap: 'square' }), '0 20');
  // A flat cap paints NOTHING at zero length, so it needs a real width-long dash - which
  // is a square dot, correctly.
  assert.equal(dash({ strokeDash: 'dotted', strokeW: 10, strokeCap: 'butt' }), '10 10');
  // No stroke width means no stroke at all, so there is nothing to dash.
  assert.equal(dash({ strokeDash: 'dashed', strokeW: 0 }), null);
  assert.equal(dash({ strokeDash: 'dashed', strokeW: 10, stroke: '' }), null);
});

test('render: line ends and corners reach the attributes, and a miter join states its limit', () => {
  const { compute } = withGeom();
  const one = (over: Row): string => compute([strokedBox(over)]).pathHtml![0]!;
  for (const cap of ['butt', 'round', 'square']) {
    assert.equal(attr(one({ strokeCap: cap }), 'stroke-linecap'), cap, `cap ${cap}`);
  }
  for (const join of ['miter', 'round', 'bevel']) {
    assert.equal(attr(one({ strokeJoin: join }), 'stroke-linejoin'), join, `join ${join}`);
  }
  // The miter limit is emitted EXPLICITLY, because the three renderers disagree on the
  // default (SVG says 4, PDF says 10) and the stroke pad below is sized from a known
  // number. Every other join leaves it out.
  assert.equal(attr(one({ strokeJoin: 'miter' }), 'stroke-miterlimit'), '4');
  assert.equal(attr(one({ strokeJoin: 'round' }), 'stroke-miterlimit'), null);
  assert.equal(attr(one({ strokeJoin: 'bevel' }), 'stroke-miterlimit'), null);
});

test('render: the stroke pad GROWS for the two decorations that reach past half the width', () => {
  // The pad exists so a stroke on the frame edge is not clipped by the nested <svg>'s own
  // viewport (in the browser, in SVG output and in PDF). A round cap and a round join both
  // reach exactly half the width; a square cap reaches half·√2 along the diagonal and a
  // miter spike reaches miterlimit·half. A pad that is merely usually right is a clipped
  // outline the user cannot explain, so each case is pinned.
  for (const brand of BRANDS) {
    const { compute } = withGeom(brand);
    const geo = (over: Row): string | null => attr(compute([strokedBox({ strokeW: 20, ...over })]).pathHtml![0]!, 'viewBox');
    assert.equal(geo({}), '-10 -10 420 320', `${brand}: round/round pads by half the width`);
    // 20 · √2/2 = 14.142… → 14.14 at the hook's 2-decimal rounding.
    assert.equal(geo({ strokeCap: 'square' }), '-14.14 -14.14 428.28 328.28', `${brand}: a square cap's corner`);
    // 20 · 4/2 = 40.
    assert.equal(geo({ strokeJoin: 'miter' }), '-40 -40 480 380', `${brand}: a miter spike`);
    // The larger of the two wins rather than the two adding up.
    assert.equal(geo({ strokeCap: 'square', strokeJoin: 'miter' }), '-40 -40 480 380', `${brand}: max, not sum`);
    // A dash changes no geometry - it is paint along the same centreline.
    assert.equal(geo({ strokeDash: 'dashed' }), '-10 -10 420 320', `${brand}: a dash must not move the viewBox`);
  }
});

test('injection: hostile strokeDash / strokeCap / strokeJoin values are neutralised', () => {
  const { compute } = withGeom();
  const hostile = [
    '"><script>alert(1)</script>',
    'round" onload="alert(1)',
    '4 2" stroke="url(#evil)',
    '</svg><img src=x onerror=alert(1)>',
    'NaN',
    '1e400',
    '../../etc/passwd',
    ' ',
  ];
  for (const v of hostile) {
    for (const field of ['strokeDash', 'strokeCap', 'strokeJoin'] as const) {
      const markup = compute([strokedBox({ [field]: v })]).pathHtml![0]!;
      assert.ok(!markup.includes('<script'), `${field}: script tag survived`);
      assert.ok(!/onerror|onload|onmouseover/i.test(markup), `${field}: event handler survived`);
      assert.equal((markup.match(/<svg/g) ?? []).length, 1, `${field}: svg count`);
      assert.equal((markup.match(/<path/g) ?? []).length, 1, `${field}: path count`);
      assert.equal((markup.match(/stroke="/g) ?? []).length, 1, `${field}: a second stroke attribute appeared`);
      assertNoNaN(markup);
      // The attributes only ever hold a member of the closed set - and a rejected
      // dash style is the ABSENCE of stroke-dasharray, never an escaped copy of the
      // user's string.
      assert.match(attr(markup, 'stroke-linecap')!, /^(butt|round|square)$/, `${field}: linecap`);
      assert.match(attr(markup, 'stroke-linejoin')!, /^(miter|round|bevel)$/, `${field}: linejoin`);
      const da = attr(markup, 'stroke-dasharray');
      if (da !== null) assert.match(da, /^[0-9.]+ [0-9.]+$/, `${field}: dasharray shape`);
    }
  }
  // A hostile width is a number or it is nothing - the pad geometry is computed FROM it,
  // so a non-number there would put NaN in the viewBox as well as in stroke-width.
  for (const w of ['NaN', '1e400', 'Infinity', '4"/><script>x</script>', -50, 1e12]) {
    const markup = compute([strokedBox({ strokeW: w })]).pathHtml![0]!;
    assertNoNaN(markup);
    const sw = attr(markup, 'stroke-width');
    if (sw !== null) {
      assert.match(sw, /^[0-9.]+$/, `strokeW=${String(w)}: not a plain number`);
      assert.ok(Number(sw) > 0 && Number(sw) <= 400, `strokeW=${String(w)}: outside the clamp`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Regression - every other kind is byte-identical to before the change
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The failure that matters most, because this edits a SHIPPED tool: the fixture
 * was captured by running the PRE-change `hooks.js` over the box set below, so a
 * single changed character in any other kind's computed style, text, media or fit
 * fails here. `pathHtml` is the one key allowed to be new.
 */
const REGRESSION_BOXES: Row[] = [
  { id: 'paper', kind: 'box', x: 0, y: 0, w: 1080, h: 1080, rot: 0, shape: 'rect', bg: '#ffffff' },
  { id: 'accent', kind: 'box', x: 700, y: -220, w: 680, h: 680, rot: 18, shape: 'ellipse', bg: '#d1e7ff', opacity: 60, blend: 'multiply' },
  { id: 'rounded', kind: 'box', x: 40, y: 60, w: 300, h: 180, rot: -7.25, shape: 'rounded', radius: 24, bg: 'rgb(10, 20, 30)', clip: 'accent', shadow: 'box', shadowColor: '#00000055', shadowX: 4, shadowY: 6, shadowBlur: 12 },
  { id: 'pill', kind: 'box', x: 10, y: 900, w: 400, h: 90, shape: 'pill', bg: 'tomato', align: 'right', valign: 'bottom' },
  { id: 'head', kind: 'text', x: 120, y: 430, w: 840, h: 280, rot: 0, shape: 'rect', text: 'Design once,\n{#4f84ba w600 mono u|ship **everywhere**}\n- a bullet\n1. ordered', fg: '#0e1217', fontSize: 92, align: 'left', valign: 'top', weight: '700', font: 'sans', lineHeight: 1.1, tracking: 2.5, ligatures: false, alternates: true, pad: 16, fitText: true, shadow: 'text' },
  { id: 'sub', kind: 'text', x: 120, y: 735, w: 840, h: 120, shape: 'rect', text: 'Your brand, on every canvas. 5 \\* 3 \\_ 2', fg: '#5c646d', fontSize: 34, align: 'center', valign: 'middle', weight: '950', font: 'Custom Family!!', lineHeight: 1.3 },
  { id: 'img', kind: 'image', x: 500, y: 100, w: 200, h: 200, shape: 'rounded', fit: 'cover', imgpos: 'left top', image: { url: 'https://ex.test/a.png', type: 'raster' }, shadow: 'content' },
  { id: 'lot', kind: 'image', x: 500, y: 320, w: 200, h: 200, shape: 'rect', fit: 'cover', image: { url: 'https://ex.test/a.json', type: 'lottie' } },
  { id: 'vid', kind: 'image', x: 500, y: 540, w: 200, h: 200, shape: 'circle', fit: 'contain', image: { url: 'https://ex.test/a.mp4', type: 'video' } },
  { id: 'nasty', kind: 'box', x: 1, y: 2, w: 3, h: 4, shape: 'rect', bg: 'red;position:fixed', text: '<img src=x onerror=alert(1)>', fg: '"><script>bad()</script>', blend: 'evil', fit: 'nope', imgpos: 'nope' },
];

test('regression: every pre-existing kind computes byte-identically to before the change', () => {
  const baseline = JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'design-extras-baseline.json'), 'utf8'),
  ) as Extras;
  const { compute } = withGeom();
  const out = compute(REGRESSION_BOXES);
  // What this test locks is that no PRE-EXISTING extra changed. It deliberately
  // does not pin the set of new keys: other work appends extras of its own (the
  // timeline fields' `timeAttrs`/`seqAttrs` did exactly that), and a regression
  // lock that fails when someone adds an unrelated key is a lock on the wrong
  // thing - it reports a conflict where there is no defect.
  assert.ok('pathHtml' in out, 'pathHtml extra missing');
  assert.deepEqual(out.pathHtml, REGRESSION_BOXES.map(() => ''), 'pathHtml must be empty for every non-path kind');
  for (const key of Object.keys(baseline)) {
    assert.deepEqual(out[key], baseline[key], `extra "${key}" changed`);
  }
});

// The SUSE-variant regression twin retired with the consolidation (2026-08-16):
// design is single-sourced in community, so there is no second variant whose
// extras could diverge - the property holds by construction.

// ─────────────────────────────────────────────────────────────────────────────
// 7. The template actually emits it
// ─────────────────────────────────────────────────────────────────────────────

test('template: pathHtml is emitted raw inside .lolly-box in both variants', () => {
  for (const brand of BRANDS) {
    const tpl = readFileSync(join(toolDir(brand), 'template.html'), 'utf8');
    // Raw ({{{ }}}) because it is markup - which is why hooks.js escapes every
    // interpolated value itself.
    assert.ok(tpl.includes('{{{lookup ../pathHtml @index}}}'), `${brand}: template does not emit pathHtml`);
    // Inside the box div, and BEFORE the media/text so the shape paints behind them.
    const box = tpl.indexOf('class="lolly-box"');
    const path = tpl.indexOf('{{{lookup ../pathHtml @index}}}');
    const media = tpl.indexOf('{{{lookup ../mediaHtml @index}}}');
    assert.ok(box >= 0 && box < path && path < media, `${brand}: pathHtml is in the wrong place`);
    const css = readFileSync(join(toolDir(brand), 'styles.css'), 'utf8');
    assert.ok(/\.lolly-box-path\s*\{/.test(css), `${brand}: styles.css has no .lolly-box-path rule`);
  }
});
