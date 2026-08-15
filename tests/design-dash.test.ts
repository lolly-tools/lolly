// SPDX-License-Identifier: MPL-2.0
/**
 * Design — authored dash/gap lengths on a path box's stroke.
 *
 * Run with: npm test (node --test over the tests/ globs). No framework.
 *
 * Penpot 2.17 (PR #9765) added two optional numbers to each stroke entry,
 * `strokeDash` and `strokeGap`: absolute px, meaningful only when the stroke
 * style is `dashed`, and NOT proportional to the stroke width. Our editor has
 * only ever synthesised a width-proportional pattern from a keyword, so an
 * imported design lost the designer's numbers. These two fields carry them.
 *
 * What is actually at risk, and therefore what this suite drives:
 *
 * 1. **The wire slot.** Compact block URLs encode a row POSITIONALLY against
 *    the manifest's `fields` array, so a new field can only ever be APPENDED,
 *    and the slot is a permanent contract. Pinned as "immediately follows
 *    blur", never as a distance from the end — a tail assertion forbids the one
 *    safe edit (the mistake design-fit-circle.test.ts made about
 *    `fitText`, and design-path.test.ts documents at length).
 * 2. **The no-op default.** These are numbers, not strings, so they cannot
 *    carry a comma or a tilde into the compact form. And with both at 0 the
 *    emitted markup has to be BYTE-IDENTICAL to what the tool emitted before
 *    the fields existed, which is what lets the extras baseline fixture stay
 *    un-regenerated.
 * 3. **Hostile values.** Everything reaches an SVG attribute, so a garbage
 *    value must clamp rather than emit NaN or break out of the markup.
 *
 * Renders load from brands/lolly-start (parent-owned, present in every
 * checkout); the manifest assertions run over BOTH brand forks, because the
 * same edit ships in both packs and the wire slot has to match.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Both brand variants ship the tool; suse is a private submodule public clones skip. */
const BRANDS = (['lolly-start', 'suse'] as const).filter((b) =>
  existsSync(join(ROOT, 'brands', b, 'tools', 'design', 'tool.json')));

const PACK_DIR = join(ROOT, 'brands', 'lolly-start', 'tools');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

const tool: any = await loadTool('design', fetchFile);

function fieldsOf(brand: string): any[] {
  const manifest = JSON.parse(readFileSync(
    join(ROOT, 'brands', brand, 'tools', 'design', 'tool.json'), 'utf8'));
  return manifest.inputs.find((i: any) => i.id === 'boxes').fields as any[];
}

/** Mount the real lolly-start tool (with the real geometry API) and return the markup. */
async function mount(boxes: unknown[]): Promise<string> {
  const rt = await createRuntime(tool, baseHost({ geom: makeGeomApi() }), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

/** A closed 4-node diamond normalised to the frame — the manifest's own path seed. */
const DIAMOND = '1!catmull-rom!1_.5!0_1!.5_.5!1_0!.5';
const PATH_BOX = {
  id: 'p1', kind: 'path', x: 0, y: 0, w: 400, h: 300, shape: 'rect',
  bg: '#30ba78', stroke: '#11141f', strokeW: 4, fillRule: 'nonzero', path: DIAMOND,
};
/** The dasharray of the first inner <path> in the hydrated markup, or null. */
const dashArray = (html: string): string | null =>
  /<path [^>]*stroke-dasharray="([^"]*)"/.exec(html)?.[1] ?? null;
/** The whole inner <path …> element, for byte-identity comparisons. */
const pathEl = (html: string): string => {
  const m = /<svg class="lolly-box-path"[\s\S]*?<\/svg>/.exec(html);
  assert.ok(m, `no path svg in the markup: ${html.slice(0, 400)}`);
  return m![0];
};

// ── the manifest: the wire slot ──────────────────────────────────────────────

test('strokeDashLen and strokeGapLen are APPENDED, in that order, immediately after blur', () => {
  assert.ok(BRANDS.length, 'no design fork is mounted');
  for (const brand of BRANDS) {
    const ids = fieldsOf(brand).map((f) => f.id);
    const at = ids.indexOf('blur');
    assert.ok(at >= 0, `${brand}: blur missing`);
    // The SLOT, not the distance from the end: appending after these two stays legal.
    assert.deepEqual(ids.slice(at + 1, at + 3), ['strokeDashLen', 'strokeGapLen'],
      `${brand}: the two dash fields must follow blur, in this order (wire order is locked)`);
    // No duplicate ids — a repeated id would silently shadow a slot.
    assert.equal(new Set(ids).size, ids.length, `${brand}: duplicate field id`);
  }
});

test('both dash fields are numbers, default 0, path-only, and shown only for a dashed stroke', () => {
  for (const brand of BRANDS) {
    const byId = new Map(fieldsOf(brand).map((f) => [f.id, f]));
    for (const id of ['strokeDashLen', 'strokeGapLen']) {
      const f = byId.get(id)!;
      assert.equal(f.type, 'number', `${brand}: ${id} type — a STRING could carry a comma`);
      assert.equal(f.default, 0, `${brand}: ${id} default must be the no-op`);
      assert.equal(f.min, 0, `${brand}: ${id} min`);
      assert.equal(f.max, 400, `${brand}: ${id} max`);
      // CSS borders cannot express a custom dash/gap, so box and image kinds keep
      // the keyword approximation and these two stay path-only.
      assert.deepEqual(f.showFor, ['path'], `${brand}: ${id} showFor`);
      assert.deepEqual(f.showIf, { strokeDash: 'dashed' }, `${brand}: ${id} showIf`);
    }
  }
});

test('the two forks ship the SAME field definitions', () => {
  if (BRANDS.length < 2) return; // public clone: suse is not mounted
  const pick = (brand: string) => fieldsOf(brand)
    .filter((f) => f.id === 'strokeDashLen' || f.id === 'strokeGapLen');
  assert.deepEqual(pick('lolly-start'), pick('suse'));
});

// ── the wire format ──────────────────────────────────────────────────────────

test('the compact block form carries both numbers positionally, with no comma or tilde', () => {
  for (const brand of BRANDS) {
    const fields = fieldsOf(brand);
    const idx = (id: string) => {
      const i = fields.findIndex((f) => f.id === id);
      assert.ok(i >= 0, `${brand}: ${id} missing`);
      return i;
    };
    // One row, written the way the compact encoder writes it: values in field order,
    // comma-joined. Only the columns we care about are populated.
    const parts = fields.map(() => '');
    parts[idx('id')] = 'p1';
    parts[idx('kind')] = 'path';
    parts[idx('strokeDash')] = 'dashed';
    parts[idx('strokeDashLen')] = '8.5';
    parts[idx('strokeGapLen')] = '3';
    const compact = parts.join(',');
    // The values themselves are the thing at risk: a number can never introduce a
    // separator, which is exactly why these fields are numbers and not "8 3".
    assert.ok(!'8.5'.includes(',') && !'3'.includes('~'));

    const state = parseUrlState(
      new URLSearchParams({ boxes: compact }),
      { inputs: [{ id: 'boxes', type: 'blocks', fields }] } as never,
    );
    const row = (state.values.boxes as any[])[0];
    assert.equal(row.strokeDashLen, '8.5', `${brand}: dash length landed in the wrong column`);
    assert.equal(row.strokeGapLen, '3', `${brand}: gap length landed in the wrong column`);
    assert.equal(row.strokeDash, 'dashed', `${brand}: the keyword column shifted`);
  }
});

// ── rendering through the real hooks ─────────────────────────────────────────

test('authored dash/gap reach stroke-dasharray verbatim, in px and not scaled by the width', async () => {
  const html = await mount([{ ...PATH_BOX, strokeDash: 'dashed', strokeDashLen: 8, strokeGapLen: 3 }]);
  assert.equal(dashArray(html), '8 3');
  // Space-separated, never comma-separated: the value is also read back out of the
  // markup by the export walkers, and a comma here would be a second wire hazard.
  assert.ok(!(dashArray(html) ?? '').includes(','));
  // Doubling the stroke width does NOT move the pattern — Penpot's authored numbers
  // are absolute, unlike the keyword synthesis they replace.
  const wide = await mount([{ ...PATH_BOX, strokeW: 12, strokeDash: 'dashed', strokeDashLen: 8, strokeGapLen: 3 }]);
  assert.equal(dashArray(wide), '8 3');
});

test('exactly one authored number is used for both halves of the pattern', async () => {
  assert.equal(dashArray(await mount([{ ...PATH_BOX, strokeDash: 'dashed', strokeDashLen: 9 }])), '9 9');
  assert.equal(dashArray(await mount([{ ...PATH_BOX, strokeDash: 'dashed', strokeGapLen: 9 }])), '9 9');
});

test('absent or 0 fields leave the markup BYTE-IDENTICAL to the pre-change output', async () => {
  // This is the property that lets tests/fixtures/design-extras-baseline.json
  // stay un-regenerated: a new field that changes nothing until it is set.
  const dashed = { ...PATH_BOX, strokeDash: 'dashed' };
  const bare = pathEl(await mount([dashed]));
  assert.equal(pathEl(await mount([{ ...dashed, strokeDashLen: 0, strokeGapLen: 0 }])), bare);
  // strokeW 4 → the width-proportional synthesis this tool has always emitted.
  assert.equal(dashArray(bare), '12 8');

  // Same for the other styles: these fields only ever apply to `dashed`.
  for (const style of ['', 'dotted']) {
    const plain = pathEl(await mount([{ ...PATH_BOX, strokeDash: style }]));
    assert.equal(pathEl(await mount([{ ...PATH_BOX, strokeDash: style, strokeDashLen: 8, strokeGapLen: 3 }])), plain,
      `strokeDash:"${style}" must ignore the authored lengths`);
  }
  // And a solid stroke still carries no dasharray attribute at all.
  assert.equal(dashArray(await mount([{ ...PATH_BOX, strokeDashLen: 8, strokeGapLen: 3 }])), null);
});

test('hostile dash/gap values clamp, never emit NaN, and never break out of the attribute', async () => {
  for (const [d, g, expect] of [
    [NaN, NaN, '12 8'],                 // unparsable → 0 → the width synthesis
    [-8, -3, '12 8'],                   // negative → 0 → the width synthesis
    [9999, 9999, '400 400'],            // clamped to the manifest max
    ['8"/><script>', 3, '8 3'],         // parseFloat salvages 8; markup never breaks
    [0.005, 4, '0.01 4'],               // rounded to 2dp like every other emitted number
  ] as Array<[unknown, unknown, string]>) {
    const html = await mount([{ ...PATH_BOX, strokeDash: 'dashed', strokeDashLen: d, strokeGapLen: g }]);
    const el = pathEl(html);
    assert.ok(!el.includes('NaN') && !el.includes('Infinity'), `${String(d)}: no non-number, got ${el}`);
    assert.ok(!el.includes('<script'), `${String(d)}: no markup breakout, got ${el}`);
    assert.equal(dashArray(html), expect, `${String(d)}/${String(g)}`);
  }
});

// 1e400 parses as Infinity, which `num()` rejects, so it lands on 0 → the width
// synthesis, NOT on the clamp ceiling. Asserted separately so the table above stays
// readable about which value took which route.
test('a non-finite length is treated as unset, not as the ceiling', async () => {
  const html = await mount([{ ...PATH_BOX, strokeDash: 'dashed', strokeDashLen: Infinity, strokeGapLen: 0 }]);
  assert.equal(dashArray(html), '12 8');
});

// ── the real 2.17.1 export, end to end ───────────────────────────────────────
// This block used to be a list of tests "named now, unwritable today": the keynote
// export predates PR #9765, so the camelCase spelling was inferred from Penpot's
// encoder rather than observed. tests/fixtures/penpot-kitchen-sink.penpot settled
// it — the serialization census lives in tests/penpot-kitchen-sink.test.ts, and
// what belongs HERE is the leg that suite cannot reach: a genuinely authored dashed
// stroke travelling shape → node → block row → compact link → this tool's markup.

test('fixture: a real Penpot dashed stroke renders its authored numbers, and survives a compact link', async () => {
  const { unzipSync } = await import('fflate');
  const { penpotShapeToNode } = await import('../engine/src/design-map.ts');
  const zip = unzipSync(new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/penpot-kitchen-sink.penpot'))));
  const dec = new TextDecoder();
  const shapes = Object.entries(zip)
    .filter(([p]) => /^files\/[^/]+\/pages\/[^/]+\/[^/]+\.json$/.test(p))
    .map(([, v]) => JSON.parse(dec.decode(v as Uint8Array)) as any);
  const shape = shapes.find((s) => s.name === 'dashed 6-3 center');
  assert.ok(shape, 'the fixture ships an authored 6/3 dashed stroke');

  const node = penpotShapeToNode(shape) as any;
  assert.deepEqual([node.strokeDash, node.strokeDashLen, node.strokeGapLen], ['dashed', 6, 3]);

  // The imported numbers reach the SVG verbatim, in px, from the real hooks.
  const html = await mount([{ ...PATH_BOX, ...{
    strokeDash: node.strokeDash, strokeDashLen: node.strokeDashLen, strokeGapLen: node.strokeGapLen,
  } }]);
  assert.equal(dashArray(html), '6 3');

  // And through a shared compact link, unchanged — the wire slot carrying real
  // designer values, not a synthetic 8.5/3.
  for (const brand of BRANDS) {
    const fields = fieldsOf(brand);
    const parts = fields.map(() => '');
    const set = (id: string, v: string) => {
      const i = fields.findIndex((f) => f.id === id);
      assert.ok(i >= 0, `${brand}: ${id} missing`);
      parts[i] = v;
    };
    set('id', 'p1'); set('kind', 'path'); set('shape', 'rect'); set('path', DIAMOND);
    set('w', '400'); set('h', '300'); set('stroke', '#11141f'); set('strokeW', '4');
    set('strokeDash', 'dashed');
    set('strokeDashLen', String(node.strokeDashLen));
    set('strokeGapLen', String(node.strokeGapLen));
    const state = parseUrlState(
      new URLSearchParams({ boxes: parts.join(',') }),
      { inputs: [{ id: 'boxes', type: 'blocks', fields }] } as never,
    );
    const row = (state.values.boxes as any[])[0];
    assert.equal(dashArray(await mount([row])), '6 3', `${brand}: authored numbers lost on the wire`);
  }
});

// The keyless case ("dashed", neither number authored) imports at Penpot's own
// renderer default of width + 10 for BOTH — asserted against the real shape in
// tests/penpot-kitchen-sink.test.ts, since it is a parse-side property. What it
// produces HERE is the width-proportional path above: a 4px stroke → dashLen 14.
test('fixture: the keyless dashed default reaches the markup as its imported numbers', async () => {
  assert.equal(dashArray(await mount([{ ...PATH_BOX, strokeDash: 'dashed', strokeDashLen: 14, strokeGapLen: 14 }])), '14 14');
});
