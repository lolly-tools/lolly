// SPDX-License-Identifier: MPL-2.0
/**
 * The free-canvas `canvas` block's validation contract (plans/104 §9.2 M0-D, §10).
 *
 * The gap this closes, measured 2026-08-11: `canvas` had no
 * `additionalProperties`, and its `properties` list had fallen 21 keys behind the
 * shipped manifests (design's frame/vector/decoration keys, org-chart's six
 * stroke keys, sequence-studio's `linkField`, `import` on five tools). An open
 * object with a stale property list validates ANY key, so a typo'd `shadowBlrField`
 * shipped clean - and stayed silent at runtime too, because the overlay's write
 * no-ops on a sub-field the row doesn't carry and the compact blocks URL drops the
 * undeclared field on the way out. Nothing anywhere said "that control does nothing".
 *
 * The fix is two halves that have to be tested as two halves:
 *
 *   1. The KEY set is closed - `additionalProperties: false` in BOTH schema copies,
 *      with the union re-derived first so org-chart still passes (the trap: flip the
 *      flag against a stale list and CI fails on a shipped tool).
 *   2. The REFERENCE side is checked by scripts/lib/canvas-refs.ts, because no JSON
 *      Schema can assert that `canvas.xField: "x"` names an id in a SIBLING array.
 *
 * So this file proves it bites both ways AND that it doesn't bite the real
 * manifests: a typo'd key fails, a `*Field` pointing at a missing id fails, and the
 * shipped org-chart / design manifests pass both halves unchanged.
 *
 * The last test is the anti-regression one: it re-derives the canvas-key union
 * across every MOUNTED pack and asserts the schema still covers it. That is the
 * check whose absence let the list fall 21 keys behind - a new canvas key now fails
 * here (in the pack that adds it) rather than silently widening the open set.
 *
 * Both schema copies are kept byte-identical by tests/lolly-tools-core.test.ts, so
 * this file does not re-compare them; it drives each copy's REAL validator instead
 * (validateManifest reads schemas/, validateTool reads packages/core/schema/).
 *
 * Run with: npm test - or node --test "tests/canvas-schema-contract.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateManifest } from '../engine/src/validate.ts';
import { validateTool } from '../packages/core/src/index.ts';
import { canvasFieldRefErrors, isFieldRefKey } from '../scripts/lib/canvas-refs.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ─── a minimal, well-formed canvas manifest ──────────────────────────────────

/** The sub-fields the synthetic canvas declares - the ids every *Field points at. */
const FIELDS = [
  { id: 'id', type: 'text' },
  { id: 'x', type: 'number' },
  { id: 'y', type: 'number' },
  { id: 'w', type: 'number' },
  { id: 'h', type: 'number' },
  { id: 'rot', type: 'number' },
  { id: 'shadowBlur', type: 'number' },
];

const CANVAS = {
  idField: 'id',
  xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot',
  shadowBlurField: 'shadowBlur',
};

/** A canvas tool manifest; `canvas` overrides replace the block wholesale. */
function canvasManifest(canvas: Record<string, unknown> = CANVAS, fields = FIELDS): any {
  return {
    id: 'synthetic-canvas',
    name: 'Synthetic Canvas',
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'official',
    render: { width: 100, height: 100, formats: ['svg'], layout: 'editor' },
    inputs: [
      { id: 'boxes', type: 'blocks', fields, canvas },
    ],
  };
}

// ─── half 1: the canvas key set is CLOSED ────────────────────────────────────

test('both validators accept a well-formed canvas block', () => {
  const m = canvasManifest();
  assert.equal(validateManifest(m).valid, true, JSON.stringify(validateManifest(m).errors));
  assert.equal(validateTool(m).valid, true, JSON.stringify(validateTool(m).errors));
});

test('both validators REJECT an unknown canvas key (the typo case)', () => {
  // One character off a real key. Before additionalProperties:false this validated
  // clean and shipped as a control that silently did nothing.
  const m = canvasManifest({ ...CANVAS, shadowBlrField: 'shadowBlur' });
  const eng = validateManifest(m);
  const core = validateTool(m);
  assert.equal(eng.valid, false, 'engine schema must reject an unknown canvas key');
  assert.equal(core.valid, false, 'core schema must reject an unknown canvas key');
  // And it must be legible: the offending key names itself in the error.
  assert.ok(
    JSON.stringify(eng.errors).includes('shadowBlrField'),
    `error should name the offending key, got ${JSON.stringify(eng.errors)}`,
  );
});

test('both validators REJECT an unknown key inside canvas.connect', () => {
  const m = canvasManifest({
    ...CANVAS,
    connect: { input: 'edges', fromField: 'from', toField: 'to', bogusField: 'nope' },
  }, FIELDS);
  assert.equal(validateManifest(m).valid, false, 'engine schema must close canvas.connect too');
  assert.equal(validateTool(m).valid, false, 'core schema must close canvas.connect too');
});

test('the schema declares the canvas set closed, in the copy the engine reads', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/tool.schema.json'), 'utf8'));
  const canvas = findCanvasSchema(schema);
  assert.ok(canvas, 'schemas/tool.schema.json must still carry a blocks `canvas` schema');
  assert.equal(canvas.additionalProperties, false,
    'canvas must stay a CLOSED set — an open one is how the property list fell 21 keys behind');
});

test('shadowField is documented as the select it is, not a Boolean', () => {
  // It has always been a 4-way select (none | box | text | content, and a
  // depth-capable tool adds `depth`); the description said "Boolean sub-field",
  // which is the kind of doc bug that gets copied into the next manifest.
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/tool.schema.json'), 'utf8'));
  const desc = String(findCanvasSchema(schema).properties.shadowField.description);
  assert.ok(!/^Boolean sub-field/.test(desc), `shadowField is not a Boolean: ${desc}`);
  assert.match(desc, /SELECT sub-field/);
  for (const value of ['none', 'box', 'text', 'content', 'depth']) {
    assert.ok(desc.includes(`'${value}'`), `shadowField description should name the '${value}' value`);
  }
});

// ─── half 2: every *Field names a real sub-field ─────────────────────────────

test('canvasFieldRefErrors passes a manifest whose *Field values all resolve', () => {
  assert.deepEqual(canvasFieldRefErrors(canvasManifest()), []);
});

test('canvasFieldRefErrors FAILS a *Field pointing at a missing id', () => {
  // The key is spelled correctly (so the schema is happy) - the VALUE is the typo.
  // This is the failure mode JSON Schema structurally cannot see.
  const m = canvasManifest({ ...CANVAS, rotationField: 'rotation' }); // the field is `rot`
  const errs = canvasFieldRefErrors(m);
  assert.equal(errs.length, 1, JSON.stringify(errs));
  assert.match(errs[0]!, /canvas\.rotationField names "rotation"/);
  // The schema alone is NOT enough - it validates this manifest happily, which is
  // exactly why the check lives in the validator.
  assert.equal(validateManifest(m).valid, true, 'a resolvable-looking name is schema-valid by construction');
});

test('canvasFieldRefErrors FAILS a non-string / empty *Field value', () => {
  assert.equal(canvasFieldRefErrors(canvasManifest({ ...CANVAS, xField: '' })).length, 1);
  assert.equal(canvasFieldRefErrors(canvasManifest({ ...CANVAS, xField: 42 })).length, 1);
});

test('canvasFieldRefErrors reports EVERY broken reference, not just the first', () => {
  const errs = canvasFieldRefErrors(canvasManifest({ ...CANVAS, xField: 'ex', yField: 'why' }));
  assert.equal(errs.length, 2, JSON.stringify(errs));
});

test('canvasFieldRefErrors ignores canvas keys that are not field references', () => {
  // `frameKind` is a literal `kind` VALUE, `pathLayerClass` a CSS class, `minSize` a
  // number - none of them name a sub-field, and none of them end in `Field`.
  const errs = canvasFieldRefErrors(canvasManifest({
    ...CANVAS, frameKind: 'frame', pathLayerClass: 'lolly-connectors', minSize: 8,
    grid: { size: 20, default: true }, fixedCanvas: true, addKinds: [{ id: 'box' }],
  }));
  assert.deepEqual(errs, []);
  assert.equal(isFieldRefKey('frameKind'), false);
  assert.equal(isFieldRefKey('pathLayerClass'), false);
  assert.equal(isFieldRefKey('zField'), true);
});

test('canvas.connect field references resolve against the EDGES input, not the boxes', () => {
  const withEdges = (connect: Record<string, unknown>): any => {
    const m = canvasManifest({ ...CANVAS, connect });
    m.inputs.push({ id: 'edges', type: 'blocks', fields: [{ id: 'from', type: 'text' }, { id: 'to', type: 'text' }] });
    return m;
  };
  assert.deepEqual(canvasFieldRefErrors(withEdges({ input: 'edges', fromField: 'from', toField: 'to' })), []);
  // `x` is a BOXES field - it must not satisfy a connector reference.
  assert.equal(canvasFieldRefErrors(withEdges({ input: 'edges', fromField: 'x' })).length, 1);
  // And an edges input that doesn't exist is its own error.
  const orphan = canvasFieldRefErrors(canvasManifest({ ...CANVAS, connect: { input: 'nope', fromField: 'from' } }));
  assert.equal(orphan.length, 1);
  assert.match(orphan[0]!, /canvas\.connect\.input names "nope"/);
});

// ─── the real manifests must still pass BOTH halves ──────────────────────────
//
// org-chart is the trap the plan called out: it ships six stroke keys the schema
// did not list, so flipping additionalProperties:false against the stale list
// would have failed a shipped tool in CI. It lives in the PRIVATE SUSE pack, so
// gate on the pack (never skip silently when it IS mounted).

const SUSE_PACK = join(ROOT, 'brands/suse/tools');
const PACK_MOUNTED = existsSync(SUSE_PACK);
const SKIP_SUSE = !PACK_MOUNTED && 'SUSE brand pack not mounted (see profiles.json)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(SUSE_PACK, 'org-chart/tool.json')),
    'brands/suse/tools/org-chart/tool.json is missing — pack is mounted, so the tool was renamed or deleted');
}

test('the real org-chart manifest passes the schema AND the reference check', { skip: SKIP_SUSE }, () => {
  const m = JSON.parse(readFileSync(join(SUSE_PACK, 'org-chart/tool.json'), 'utf8'));
  const eng = validateManifest(m);
  assert.equal(eng.valid, true, `org-chart must validate against the closed canvas set: ${JSON.stringify(eng.errors)}`);
  assert.equal(validateTool(m).valid, true, 'org-chart must validate against the core schema copy too');
  assert.deepEqual(canvasFieldRefErrors(m), [], 'org-chart canvas.*Field values must all resolve');
});

test('the parent-owned design manifest passes the schema AND the reference check', () => {
  // brands/lolly-start is parent-owned, so this half runs on a public clone too - 
  // and it is the widest canvas block in the tree (63 keys).
  const path = join(ROOT, 'brands/lolly-start/tools/design/tool.json');
  const m = JSON.parse(readFileSync(path, 'utf8'));
  const eng = validateManifest(m);
  assert.equal(eng.valid, true, `design must validate: ${JSON.stringify(eng.errors)}`);
  assert.equal(validateTool(m).valid, true, 'design must validate against the core schema copy too');
  assert.deepEqual(canvasFieldRefErrors(m), []);
});

// ─── the anti-regression guard: the schema must cover every mounted pack ─────

test('every canvas key in every MOUNTED pack is declared in the schema', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/tool.schema.json'), 'utf8'));
  const declared = new Set(Object.keys(findCanvasSchema(schema).properties));
  const seen = new Map<string, string[]>();   // key → tools using it
  let manifests = 0;

  for (const pack of ['brands/lolly-start/tools', 'brands/suse/tools', 'community']) {
    const abs = join(ROOT, pack);
    if (!existsSync(abs)) continue;           // pack not mounted (private submodule)
    for (const dir of readdirSync(abs).sort()) {
      const file = join(abs, dir, 'tool.json');
      if (!statSync(join(abs, dir)).isDirectory() || !existsSync(file)) continue;
      manifests++;
      const m = JSON.parse(readFileSync(file, 'utf8'));
      for (const input of m.inputs ?? []) {
        if (!input?.canvas) continue;
        for (const key of Object.keys(input.canvas)) {
          if (!seen.has(key)) seen.set(key, []);
          seen.get(key)!.push(`${pack}/${dir}`);
        }
      }
    }
  }

  assert.ok(manifests > 20, `expected the community pack at least; scanned only ${manifests} manifests`);
  const undeclared = [...seen].filter(([k]) => !declared.has(k))
    .map(([k, tools]) => `${k} (${tools.join(', ')})`);
  assert.deepEqual(undeclared, [],
    'a shipped canvas key is missing from schemas/tool.schema.json — with additionalProperties:false ' +
    'that tool now FAILS validation. Add the key (both schema copies) with a one-line description.');
});

/** The blocks branch's `canvas` subschema, found by shape rather than by path. */
function findCanvasSchema(node: any): any {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const v of node) { const r = findCanvasSchema(v); if (r) return r; }
    return null;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'canvas' && v && typeof v === 'object' && (v as any).properties) return v;
    const r = findCanvasSchema(v); if (r) return r;
  }
  return null;
}
