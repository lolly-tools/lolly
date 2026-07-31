// SPDX-License-Identifier: MPL-2.0
/**
 * The Penpot kitchen-sink fixture — the first REAL observation of every format
 * structure the round 4–6 Penpot work inferred from Penpot's source.
 *
 * `tests/fixtures/penpot-kitchen-sink.penpot` is a genuine Penpot 2.17.1-RC4
 * export of a file authored for exactly this purpose, so unlike
 * `penpot-keynote-replay.test.ts` (a personal deck that lives on one machine
 * and is therefore skip-gated) this suite is UNGATED: the file is in the repo,
 * so every clone and CI run reads the same bytes.
 *
 * What it observes, one shape per structure:
 *   - `backgroundBlur` as its own 2.17 shape attribute, beside `blur`, and the
 *     two coexisting on one shape;
 *   - `strokeDash`/`strokeGap` on a strokes[] entry — authored 6/3, 12/4, an
 *     authored 0, and a "dashed" stroke with neither key;
 *   - an in-file `tokens.json`, and the `appliedTokens` map that names its
 *     tokens on the shapes;
 *   - a prototype interaction (unconsumed today — pinned for the flow-ordering
 *     plan);
 *   - a 2-variant component set with instances, one variant-switched and one
 *     fill-overridden (unconsumed today — pinned for components-as-templates).
 *
 * Every assertion below quotes the file, not our inference. Where the two
 * disagreed the parser was fixed and the fix is named in the test.
 *
 * Run with: node --test tests/penpot-kitchen-sink.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';

import { penpotShapeToNode, penpotBackgroundBlurPx, penpotDashArray, finalizeBoxes } from '../engine/src/design-map.ts';
import { extractPenpotProject, scanPenpotAppliedTokens, scanPenpotUsage, summarizeTokensDoc } from '../engine/src/brand-import.ts';
import { createTokenSet, tokenSetNames } from '../engine/src/tokens.ts';
import { proposeRolesFromTokens, proposeFontsFromTokens, withRoleAliases } from '../shells/web/src/lib/brand-propose.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'tests/fixtures/penpot-kitchen-sink.penpot');

type Shape = Record<string, any>;

const entries = unzipSync(new Uint8Array(readFileSync(FIXTURE))) as Record<string, Uint8Array>;
const dec = new TextDecoder();
const readJson = (path: string): any => JSON.parse(dec.decode(entries[path]!));
const paths = Object.keys(entries);

const SHAPE_RE = /^files\/[^/]+\/pages\/[^/]+\/[^/]+\.json$/;
const shapes: Shape[] = paths.filter(p => SHAPE_RE.test(p)).map(readJson);
/** The one shape with this `name`. Names are unique in the authored file. */
function byName(name: string): Shape {
  const hit = shapes.filter(s => s.name === name);
  assert.equal(hit.length, 1, `expected exactly one shape named ${JSON.stringify(name)}, got ${hit.length}`);
  return hit[0]!;
}

// ── census ───────────────────────────────────────────────────────────────────

test('kitchen sink: the archive is a Penpot 2.17.1-RC4 export declaring the features under test', () => {
  const manifest = readJson('manifest.json');
  assert.equal(manifest.type, 'penpot/export-files');
  assert.equal(manifest.version, 1);
  assert.equal(manifest.generatedBy, 'penpot/2.17.1-RC4');
  assert.equal(manifest.files.length, 1);
  const file = manifest.files[0];
  assert.equal(file.name, 'Lolly kitchen sink seed');
  // The three features this suite exists for, plus the components/v2 baseline.
  for (const f of ['design-tokens/v1', 'variants/v1', 'components/v2']) {
    assert.ok(file.features.includes(f), `manifest declares ${f}`);
  }
  // 57, not the export's 65: the 8 objects/*.png thumbnail previews are stripped
  // from the committed fixture (271 KB nothing reads); every JSON entry is the
  // genuine 2.17.1-RC4 output, untouched.
  assert.equal(paths.length, 57, 'entry count — a re-export that changes this needs re-reading');
  assert.equal(shapes.length, 34, 'page shapes (incl. the root frame)');
  assert.equal(paths.filter(p => /\/components\/[^/]+\.json$/.test(p)).length, 2, 'two component records');
  assert.equal(paths.filter(p => /\/tokens\.json$/.test(p)).length, 1, 'one in-file token doc');
});

// ── (a) background blur ──────────────────────────────────────────────────────

test('kitchen sink: backgroundBlur is its own 4-key attribute, and the legacy in-blur form never appears', () => {
  assert.deepEqual(byName('frosted-panel bgblur20').backgroundBlur, {
    id: '5e894a8d-af51-4435-b69f-7ffe8121b57b',
    type: 'background-blur',
    value: 20,
    hidden: false,
  }, 'exactly {id,type,value,hidden} — the inferred shape, observed');

  const withBg = shapes.filter(s => s.backgroundBlur);
  assert.deepEqual(
    withBg.map(s => [s.name, s.backgroundBlur.value, s.backgroundBlur.type]).sort(),
    [
      ['both-blurs layer4 bgblur10', 10, 'background-blur'],
      ['frosted-panel bgblur20', 20, 'background-blur'],
      ['frosted-text bgblur12', 12, 'background-blur'],
      ['stroke-only-frost bgblur16 nofill', 16, 'background-blur'],
    ].sort(),
  );
  for (const s of withBg) {
    assert.deepEqual(Object.keys(s.backgroundBlur).sort(), ['hidden', 'id', 'type', 'value']);
    assert.equal(typeof s.backgroundBlur.value, 'number');
    assert.equal(s.backgroundBlur.hidden, false);
  }

  // The legacy pre-2.17 encoding — `blur: {type:'background-blur'}` — is accepted
  // by penpotBackgroundBlurPx but 2.17 does NOT write it: every `blur` here is a
  // layer blur, and a shape may legally carry one of each.
  const withBlur = shapes.filter(s => s.blur);
  assert.deepEqual(
    withBlur.map(s => [s.name, s.blur.value, s.blur.type]).sort(),
    [
      ['both-blurs layer4 bgblur10', 4, 'layer-blur'],
      ['ellipse layerblur8', 8, 'layer-blur'],
    ].sort(),
  );
  assert.deepEqual(shapes.filter(s => s.blur?.type === 'background-blur'), [], 'no legacy in-blur background blur');

  const both = byName('both-blurs layer4 bgblur10');
  assert.equal(both.blur.type, 'layer-blur');
  assert.equal(both.backgroundBlur.type, 'background-blur');
  assert.notEqual(both.blur.id, both.backgroundBlur.id, 'siblings, each with its own id');
});

test('kitchen sink: penpotBackgroundBlurPx maps the observed values through the Skia-sigma constant', () => {
  // R = 1.1547 * value + 1 (see design-map.ts). The fixture only fixes the INPUT;
  // the constant stays the documented approximation until a pixel comparison.
  assert.equal(penpotBackgroundBlurPx(byName('frosted-panel bgblur20')), 24.1);
  assert.equal(penpotBackgroundBlurPx(byName('frosted-text bgblur12')), 14.9);
  assert.equal(penpotBackgroundBlurPx(byName('stroke-only-frost bgblur16 nofill')), 19.5);
  assert.equal(penpotBackgroundBlurPx(byName('both-blurs layer4 bgblur10')), 12.5);
  // A layer-blur-only shape has no background blur at all.
  assert.equal(penpotBackgroundBlurPx(byName('ellipse layerblur8')), 0);
});

test('kitchen sink: background blur reaches the node box, and the documented text/vector exemptions hold', () => {
  const panel = penpotShapeToNode(byName('frosted-panel bgblur20'))!;
  assert.equal(panel.kind, 'box');
  assert.equal(panel.bgBlur, 24.1);

  // A fill-less rect still frosts — the box rect IS the painted region.
  assert.equal(penpotShapeToNode(byName('stroke-only-frost bgblur16 nofill'))!.bgBlur, 19.5);

  // Both blurs land on the same node, on their own fields.
  const both = penpotShapeToNode(byName('both-blurs layer4 bgblur10'))!;
  assert.equal(both.bgBlur, 12.5);
  assert.equal(both.blur, 4);

  // Text drops it (Penpot masks the blur to the glyphs; the shell warns).
  const text = penpotShapeToNode(byName('frosted-text bgblur12'))!;
  assert.equal(text.kind, 'text');
  assert.equal(text.bgBlur, undefined);

  const rows = finalizeBoxes([panel, both]) as any[];
  assert.deepEqual(rows.map(r => r.bgBlur), [24.1, 12.5]);
});

// ── (b) strokeDash / strokeGap ───────────────────────────────────────────────

test('kitchen sink: strokeDash/strokeGap are camelCase numbers on the strokes[] entry, written only when authored', () => {
  assert.deepEqual(byName('dashed 6-3 center').strokes, [{
    strokeStyle: 'dashed',
    strokeColor: '#1b1b3a',
    strokeOpacity: 1,
    strokeAlignment: 'center',
    strokeWidth: 3,
    strokeDash: 6,
    strokeGap: 3,
  }], 'the literal serialization — camelCase keys, numeric values, no wrapper');

  const st = byName('dashed 12-4 inner').strokes[0];
  assert.equal(st.strokeDash, 12);
  assert.equal(st.strokeGap, 4);
  assert.equal(typeof st.strokeDash, 'number');
  assert.equal(st.strokeAlignment, 'inner');

  // The authored 0: Penpot WROTE it. `strokeDash: 0` is a real serialized value,
  // not an omission — which is why engine strokeLen accepts 0 as authored
  // (`n >= 0`) rather than treating it as absent.
  const zero = byName('dashed 0-8 outer').strokes[0];
  assert.equal(zero.strokeDash, 0);
  assert.equal(zero.strokeGap, 8);
  assert.ok(Object.hasOwn(zero, 'strokeDash'), 'the key is present, holding 0');

  // "dashed" with neither key — the user picked the style and never touched the
  // number inputs. Penpot omits both entirely rather than writing its default.
  const keyless = byName('dashed default no-dash-keys').strokes[0];
  assert.equal(keyless.strokeStyle, 'dashed');
  assert.equal(keyless.strokeDash, undefined);
  assert.equal(keyless.strokeGap, undefined);
  assert.deepEqual(Object.keys(keyless).sort(),
    ['strokeAlignment', 'strokeColor', 'strokeOpacity', 'strokeStyle', 'strokeWidth']);

  // dotted carries caps, never dash lengths; `mixed` is a real serialized style
  // value (our mapper knows it — it used to fall through to solid).
  const dotted = byName('dotted round-caps').strokes[0];
  assert.equal(dotted.strokeStyle, 'dotted');
  assert.equal(dotted.strokeDash, undefined);
  assert.deepEqual([dotted.strokeCapStart, dotted.strokeCapEnd], ['round', 'round']);
  assert.equal(byName('mixed style').strokes[0].strokeStyle, 'mixed');

  // Surprise worth pinning: the authored "none over solid" stack came back with
  // ONE entry — Penpot dropped the `none` stroke at save, so the entry-level
  // skip in topPenpotStroke/applyPenpotStroke stays synthetic-only coverage.
  const multi = byName('multi-stroke none-above-solid');
  assert.equal(multi.strokes.length, 1);
  assert.equal(multi.strokes[0].strokeStyle, 'solid');
  assert.deepEqual(shapes.filter(s => (s.strokes ?? []).some((e: any) => e?.strokeStyle === 'none')), []);
});

test('kitchen sink: authored dash/gap land in DesignNode strokeDashLen/strokeGapLen', () => {
  const n = (name: string) => penpotShapeToNode(byName(name)) as any;

  const six = n('dashed 6-3 center');
  assert.equal(six.strokeDash, 'dashed');
  assert.deepEqual([six.strokeDashLen, six.strokeGapLen], [6, 3]);

  const twelve = n('dashed 12-4 inner');
  assert.deepEqual([twelve.strokeDashLen, twelve.strokeGapLen], [12, 4]);

  // Keyless: Penpot's own renderer fallback, width + 10 for BOTH (width 4 → 14).
  const keyless = n('dashed default no-dash-keys');
  assert.equal(keyless.strokeW, 4);
  assert.deepEqual([keyless.strokeDashLen, keyless.strokeGapLen], [14, 14]);

  // The authored 0 is a DELIBERATE v1 divergence, now pinned against the real
  // bytes: Penpot's `calculate-dasharray` would emit "0,8" (Clojure `or` keeps a
  // 0), which SVG paints as nothing under a butt cap. We take the width+10
  // fallback for the dash and honour the authored gap, so the border stays
  // visible. Moving this is a rendering decision, not a parsing one.
  const zero = n('dashed 0-8 outer');
  assert.equal(zero.strokeW, 3);
  assert.deepEqual([zero.strokeDashLen, zero.strokeGapLen], [13, 8]);
  assert.equal(penpotDashArray('dashed', 3, 0, 8), '13,8');

  // dotted/mixed keep the width-proportional synthesis — no authored lengths.
  const dotted = n('dotted round-caps');
  assert.equal(dotted.strokeDash, 'dotted');
  assert.equal(dotted.strokeDashLen, undefined);
  const mixed = n('mixed style');
  assert.equal(mixed.strokeDash, 'dashed', 'mixed maps to the nearest CSS keyword');
  assert.equal(mixed.strokeDashLen, undefined);

  // Solid is byte-identical to a pre-dash-feature import.
  const solid = n('solid outer align');
  assert.deepEqual([solid.strokeDash, solid.strokeDashLen, solid.strokeGapLen], ['', undefined, undefined]);
});

// ── (c) tokens.json + appliedTokens ──────────────────────────────────────────

test('kitchen sink: the in-file tokens.json is a Tokens-Studio doc with an EMPTY $themes beside a real set', () => {
  const doc = readJson('files/ddb7145f-a1be-80bb-8008-69139da641d1/tokens.json');
  assert.deepEqual(Object.keys(doc), ['Global', '$themes', '$metadata']);
  assert.deepEqual(doc.$themes, [], 'no theme was authored — Penpot still writes the key, empty');
  assert.deepEqual(doc.$metadata, {
    tokenSetOrder: ['Global'],
    activeThemes: [],
    activeSets: ['Global'],
  }, 'the set layering lives in $metadata, NOT in $themes');

  assert.deepEqual(doc.Global.brand.primary, { $value: '#F23AE5', $type: 'color', $description: '' });
  assert.deepEqual(doc.Global.brand.surface, { $value: '#151035', $type: 'color', $description: '' });
  // The type token: PLURAL `$type` and an ARRAY `$value` — Tokens-Studio's
  // fontFamilies shape, not DTCG's singular `fontFamily` string.
  assert.deepEqual(doc.Global.type.brand, {
    $value: ['Work Sans'],
    $type: 'fontFamilies',
    $description: '',
  });
});

test('kitchen sink: a themeless Penpot doc is still LAYERED — set names must not become path prefixes', () => {
  // THE MISMATCH THIS FIXTURE FOUND. Set detection used to be "$themes is
  // non-empty", so "Global" read as a GROUP and every token flattened to
  // `Global.brand.primary` — which no longer joined to the `brand.primary` that
  // Penpot writes in appliedTokens, silently dropping the token-first role
  // proposal back to hex guessing. tokenSetNames now also accepts
  // $metadata.tokenSetOrder.
  const { doc, warnings } = extractPenpotProject(entries);
  assert.deepEqual(warnings, []);
  assert.deepEqual(tokenSetNames(doc), ['Global']);

  const ts = createTokenSet(doc);
  assert.equal(ts.get('brand.primary')?.value, '#F23AE5');
  assert.equal(ts.get('brand.surface')?.value, '#151035');
  assert.equal(ts.get('Global.brand.primary'), undefined, 'the set name is NOT part of the path');
  const type = ts.get('type.brand')!;
  assert.equal(type.type, 'fontFamilies');
  assert.deepEqual(type.value, ['Work Sans']);

  const s = summarizeTokensDoc(doc);
  assert.deepEqual(s.sets, ['Global']);
  assert.deepEqual(s.themes, []);
  assert.equal(s.tokenCount, 3);
  assert.equal(s.colorCount, 2);

  // A plain DTCG doc (no tokenSetOrder) is still one implicit set — the guard
  // that keeps this fix from reclassifying ordinary token files.
  assert.equal(tokenSetNames({ color: { brand: { $value: '#fff', $type: 'color' } } }), null);
  // …and a tokenSetOrder naming a key the doc doesn't have is not trusted either.
  assert.equal(tokenSetNames({ Global: {}, $metadata: { tokenSetOrder: ['Nope'] } }), null);
});

test('kitchen sink: appliedTokens names bare dotted token paths, and the census tallies all 8 by class', () => {
  // The literal serialization: a flat attribute→name map, no braces, no set prefix.
  assert.deepEqual(byName('backdrop-magenta saturated').appliedTokens, { fill: 'brand.surface' });
  assert.deepEqual(byName('backdrop-caption text').appliedTokens, { fontFamily: 'type.brand' });

  const refs = shapes.flatMap(s => Object.entries(s.appliedTokens ?? {}));
  assert.equal(refs.length, 8, 'eight applied references across the file');
  assert.deepEqual(refs.filter(([a]) => a === 'fill').length, 7);
  assert.deepEqual(refs.filter(([a]) => a === 'fontFamily').length, 1);

  assert.deepEqual(scanPenpotAppliedTokens(entries), [
    { name: 'brand.surface', fills: 4, strokes: 0, text: 0, type: 0, geometry: 0, total: 4 },
    { name: 'brand.primary', fills: 3, strokes: 0, text: 0, type: 0, geometry: 0, total: 3 },
    { name: 'type.brand', fills: 0, strokes: 0, text: 0, type: 1, geometry: 0, total: 1 },
  ]);
  // 7 fills but only 4 + 3 counted as `fills`: the eighth ref is the fontFamily,
  // and the text shape's own fill ref would have counted as `text` — the file has
  // none, which is why `text` is 0 everywhere.
});

test('kitchen sink: the token-first ingest path proposes roles from the designer\'s own token names', () => {
  const { doc } = extractPenpotProject(entries);
  const applied = scanPenpotAppliedTokens(entries);
  const roles = proposeRolesFromTokens(doc, applied, scanPenpotUsage(entries))!;
  assert.ok(roles, 'the doc declares colour tokens, so the token-first path must not decline');
  // The names, not the hexes, are what a token-first install writes.
  assert.deepEqual(roles.refs, { primary: 'brand.primary', surface: 'brand.surface' });
  assert.equal(roles.primary, '#F23AE5');
  assert.equal(roles.surface, '#151035');
  assert.equal(roles.surfaceLook, 'dark');

  assert.equal(proposeFontsFromTokens(doc, applied).brand, 'Work Sans',
    'the fontFamilies token, weighted by its single applied reference');

  // And the roles survive the install write: a themeless-but-layered doc gets a
  // new SET, never a top-level `color` group (which tokenSetOrder would then
  // never activate, resolving the roles to nothing).
  const installed = withRoleAliases(doc!, roles.refs);
  assert.deepEqual(Object.keys(installed), ['Global', '$themes', '$metadata', 'Lolly roles']);
  assert.deepEqual((installed.$metadata as any).tokenSetOrder, ['Global', 'Lolly roles']);
  assert.deepEqual((installed.$metadata as any).activeSets, ['Global', 'Lolly roles']);
  assert.deepEqual(installed.$themes, [], 'no themes were invented');
  const ts = createTokenSet(installed);
  assert.equal(ts.get('color.semantic.primary')?.value, '#F23AE5');
  assert.equal(ts.get('color.semantic.surface')?.value, '#151035');
});

// ── (d) prototype interaction ────────────────────────────────────────────────

test('kitchen sink: the prototype interaction shape is pinned (read-only — nothing consumes it yet)', () => {
  const withInteractions = shapes.filter(s => Array.isArray(s.interactions) && s.interactions.length);
  assert.equal(withInteractions.length, 1);
  const src = withInteractions[0]!;
  assert.equal(src.name, 'effects');
  assert.equal(src.type, 'frame');

  assert.deepEqual(src.interactions, [{
    eventType: 'click',
    actionType: 'navigate',
    destination: '47daf613-b10b-41f2-926f-9bac1e20ae5c',
    positionRelativeTo: '0ba9fa20-9738-4e7b-ab39-2a640556e6ec',
    preserveScroll: false,
    animation: { animationType: 'dissolve', duration: 300, easing: 'linear' },
  }], 'trigger = eventType, action = actionType, animation is a nested object');

  // `destination` is a real shape id in the same page (the "strokes" frame), and
  // `positionRelativeTo` is the source frame itself — the pair a flow-ordering
  // reader would follow.
  const it0 = src.interactions[0] as Record<string, any>;
  assert.equal(shapes.find(s => s.id === it0.destination)?.name, 'strokes');
  assert.equal(it0.positionRelativeTo, src.id);

  // Flows live on the PAGE record, not the shape, and name a starting frame.
  const page = readJson('files/ddb7145f-a1be-80bb-8008-69139da641d1/pages/d1b6b7c9-cced-466c-b71e-3575b7196282.json');
  assert.equal(page.name, 'Kitchen sink');
  const flows = Object.values(page.flows) as any[];
  assert.equal(flows.length, 1);
  assert.equal(flows[0].name, 'Flow 1');
  assert.equal(flows[0].startingFrame, src.id);

  // Nothing in the engine reads interactions today; the import must simply not
  // choke on a shape carrying them.
  assert.ok(penpotShapeToNode(src) !== undefined);
});

// ── (e) variants + component instances ───────────────────────────────────────

test('kitchen sink: a variant set is a container frame plus ONE component record per variant', () => {
  const container = shapes.find(s => s.isVariantContainer)!;
  assert.ok(container, 'the variant set is marked with isVariantContainer on the wrapper frame');
  assert.equal(container.type, 'frame');
  assert.equal(container.layout, 'flex', 'Penpot lays a variant set out as a flex frame');
  assert.equal(container.variantId, undefined, 'the CONTAINER carries no variantId — its children do');
  assert.equal(container.shapes.length, 2);

  // Each variant's main instance is a componentRoot frame pointing back at the
  // container through `variantId`, and names its value in `variantName`.
  const mains = container.shapes.map((id: string) => shapes.find(s => s.id === id)!);
  for (const m of mains) {
    assert.equal(m.componentRoot, true);
    assert.equal(m.mainInstance, true);
    assert.equal(m.variantId, container.id, 'variantId points at the variant CONTAINER');
  }
  assert.deepEqual(mains.map((m: Shape) => m.variantName).sort(), ['Value 1', 'Value 2']);
  assert.equal(new Set(mains.map((m: Shape) => m.componentId)).size, 2,
    'two variants = two separate component ids, NOT one component with a props array');

  // The property NAME/VALUE pair lives on the component record, not the shape.
  const comps = paths.filter(p => /\/components\/[^/]+\.json$/.test(p)).map(readJson);
  assert.equal(comps.length, 2);
  for (const c of comps) {
    assert.equal(c.variantId, container.id);
    assert.equal(c.name, container.name);
    assert.equal(Array.isArray(c.variantProperties), true);
    assert.equal(c.variantProperties.length, 1);
    assert.equal(c.variantProperties[0].name, 'Property 1');
  }
  assert.deepEqual(comps.map((c: any) => c.variantProperties[0].value).sort(), ['Value 1', 'Value 2']);
  // mainInstanceId joins the record back to its frame.
  assert.deepEqual(comps.map((c: any) => c.mainInstanceId).sort(), mains.map((m: Shape) => m.id).sort());
});

test('kitchen sink: an instance is shapeRef + componentId, and an override is a `touched` keyword list', () => {
  // Copies live at page root; a main instance lives inside the variant container.
  const copies = shapes.filter(s => s.componentRoot && !s.mainInstance);
  assert.equal(copies.length, 2, 'two placed instances');
  for (const c of copies) {
    assert.equal(c.parentId, '00000000-0000-0000-0000-000000000000', 'placed at page root');
    assert.ok(c.shapeRef, 'shapeRef points at the main instance it copies');
    assert.ok(c.componentId);
    assert.equal(c.mainInstance, undefined, 'a copy is not the main instance');
  }

  // The variant-SWITCHED copy is simply a copy of the OTHER variant's main —
  // switching a variant rewrites componentId/shapeRef, it does not add an override.
  const container = shapes.find(s => s.isVariantContainer)!;
  const value2Main = container.shapes
    .map((id: string) => shapes.find(s => s.id === id)!)
    .find((m: Shape) => m.variantName === 'Value 2')!;
  const switched = copies.find(c => c.shapeRef === value2Main.id)!;
  assert.ok(switched, 'one copy references the Value 2 main instance');
  assert.equal(switched.componentId, value2Main.componentId);
  assert.equal(switched.touched, undefined, 'a clean variant switch touches nothing');

  // The fill-OVERRIDDEN copy: the override is on the CHILD rect, recorded as the
  // keyword group `fill-group` in a `touched` array, with the new value carried by
  // the ordinary attribute (here an appliedTokens ref, since it was set to a token).
  const overridden = copies.find(c => c.id !== switched.id)!;
  const child = shapes.find(s => s.parentId === overridden.id)!;
  assert.deepEqual(child.touched, ['fill-group'], 'a plain string keyword list, not a diff object');
  assert.deepEqual(child.appliedTokens, { fill: 'brand.surface' });
  assert.ok(child.shapeRef, 'the child keeps its own shapeRef into the main instance child');

  // The untouched copy's child carries no `touched` at all.
  const cleanChild = shapes.find(s => s.parentId === switched.id)!;
  assert.equal(cleanChild.touched, undefined);
  assert.deepEqual(cleanChild.appliedTokens, { fill: 'brand.primary' });
});

// ── (f) the component collectors read the observed structure ─────────────────
// (Appended block — imports hoist; kept here so the block stays append-only.)
import { collectPenpotComponents, penpotComponentSlots } from '../engine/src/design-components.ts';

const FILE_ID = 'ddb7145f-a1be-80bb-8008-69139da641d1';
const PAGE_ID = 'd1b6b7c9-cced-466c-b71e-3575b7196282';
/** The fixture's one page as the collectors take it: pageId → shapeId → shape. */
const shapesByPage = (): Map<string, Record<string, Shape>> =>
  new Map([[PAGE_ID, Object.fromEntries(shapes.map(s => [String(s.id), s]))]]);
const componentRecords = (): Shape[] =>
  paths.filter(p => /\/components\/[^/]+\.json$/.test(p)).map(readJson);

test('kitchen sink: the 2-variant component set collects as ONE logical component', () => {
  const container = shapes.find(s => s.isVariantContainer)!;
  const out = collectPenpotComponents(componentRecords(), shapesByPage(), { fileId: FILE_ID });
  assert.deepEqual(out.warnings, []);

  // THE REASON THIS GROUPING EXISTS: two records, one name, and every shape in
  // the set carries that same name — ungrouped, the user sees two templates
  // called "radii 4-8-16-32" with nothing to tell them apart.
  assert.equal(componentRecords().length, 2, 'two records on disk…');
  assert.equal(out.components.length, 1, '…one logical component');
  const c = out.components[0]!;
  assert.equal(c.id, container.id, 'the set id is the variant CONTAINER id, not either record id');
  assert.equal(c.name, 'radii 4-8-16-32');
  assert.equal(c.path, '', 'the fixture authored no grouping path');
  assert.equal(c.isVariantSet, true);
  assert.equal(c.external, false);

  assert.deepEqual(c.variants.map(v => v.label), ['Value 1', 'Value 2'], 'ordered by property value');
  assert.deepEqual(c.variants.map(v => v.properties), [
    [{ name: 'Property 1', value: 'Value 1' }],
    [{ name: 'Property 1', value: 'Value 2' }],
  ], 'the property pair rides the RECORD, mirrored onto the variant');
  // Each variant points at its own main instance, and the default is the first.
  const mainOf = (label: string): Shape => shapes.find(s => s.mainInstance && s.variantName === label)!;
  assert.deepEqual(c.variants.map(v => v.rootShapeId), [mainOf('Value 1').id, mainOf('Value 2').id]);
  assert.equal(c.rootShapeId, mainOf('Value 1').id, 'the default variant is Value 1');
  assert.ok(c.variants.every(v => v.pageId === PAGE_ID));
  assert.deepEqual(c.variants.map(v => v.id).sort(), componentRecords().map((r: Shape) => r.id).sort());
});

test('kitchen sink: every instance is local, so the external-library census is empty', () => {
  const out = collectPenpotComponents(componentRecords(), shapesByPage());
  // No fileId passed: it is inferred from a master, which names its own file.
  assert.equal(out.localFileId, FILE_ID);
  assert.deepEqual(out.externals, { instances: 0, files: [], components: [] });
  assert.deepEqual(out.warnings, []);
  // The two placed copies DO carry componentFile — it is simply the local one.
  const copies = shapes.filter(s => s.componentRoot && !s.mainInstance);
  assert.equal(copies.length, 2);
  assert.ok(copies.every(s => s.componentFile === FILE_ID));
});

test('kitchen sink: this variant set has no fill-in-the-blank slots, and says so', () => {
  const out = collectPenpotComponents(componentRecords(), shapesByPage(), { fileId: FILE_ID });
  const byId = Object.fromEntries(shapes.map(s => [String(s.id), s]));
  const lookup = (id: string): unknown => byId[id];

  // The honest negative: the fixture's set is a solid-fill rect in a frame — no
  // text, no image fill — so inference must return nothing rather than invent a
  // slot per shape. The positive path is pinned by the keynote replay (14 text +
  // 4 image slots across its 6 masters) and by tests/design-components.test.ts.
  for (const v of out.components[0]!.variants) {
    assert.deepEqual(penpotComponentSlots(byId[v.rootShapeId], lookup), [], `variant ${v.label}: no slots`);
  }
  const master = byId[out.components[0]!.rootShapeId]!;
  assert.equal(master.shapes.length, 1);
  assert.equal(byId[master.shapes[0]]!.type, 'rect');
  // Worth pinning: that rect maps to a node of kind 'image' — the per-corner
  // radii take design-map's baked-vector branch. Slot inference reads the FILL,
  // not the node kind, so a baked vector is decoration and not an asset slot.
  const child = penpotShapeToNode(byId[master.shapes[0]]!) as any;
  assert.equal(child.kind, 'image');
  assert.ok(child._vectorPath, 'a baked outline, not a fillImage');
  assert.equal(child._fillImageId, undefined);
  // …and a placed copy of it is equally slotless (instances are full copies).
  const copy = shapes.find(s => s.componentRoot && !s.mainInstance)!;
  assert.deepEqual(penpotComponentSlots(copy, lookup), []);
});

// ── (f) prototype flow → scene order (penpot-design-system.md §4) ────────────
// Imported here rather than at the top so this block appends cleanly.
import { readingOrder, penpotFlowOrder } from '../engine/src/design-map.ts';
//
// (d) above pins the raw interaction JSON; this block runs the real ordering
// pass over it. Two things the plan inferred wrong, corrected here against the
// file: `actionType` is `navigate`, not `navigate-to`, and the flow's starting
// frame lives on the PAGE record (`flows[].startingFrame`), not on the shape.

test('kitchen sink: the authored flow drives scene order, and the dissolve becomes the destination scene entrance', () => {
  const root = shapes.find(s => String(s.id).startsWith('00000000'))!;
  const byId: Record<string, any> = {};
  for (const s of shapes) byId[String(s.id)] = s;
  const boards = (root.shapes as string[]).map(id => byId[id]).filter(s => s && s.type === 'frame');
  const spatial = readingOrder(boards, (b: any) => ({ x: b.selrect.x, y: b.selrect.y, w: b.selrect.width, h: b.selrect.height }));
  assert.deepEqual(spatial.map((b: any) => b.name),
    ['effects', 'strokes', 'geometry', 'radii 4-8-16-32', 'radii 4-8-16-32'],
    'the reading-order baseline this file has shipped with');

  const page = readJson('files/ddb7145f-a1be-80bb-8008-69139da641d1/pages/d1b6b7c9-cced-466c-b71e-3575b7196282.json');
  const flow = penpotFlowOrder(spatial.map((b: any) => String(b.id)), byId, page);
  assert.equal(flow.hasFlow, true, 'one navigate edge is a flow');
  const names = (ids: string[]): string[] => ids.map(id => String(byId[id].name));
  // effects → strokes is the authored edge; the three boards the flow never
  // reaches follow in reading order, which is what this file's layout already said.
  assert.deepEqual(names(flow.ordered), ['effects', 'strokes', 'geometry', 'radii 4-8-16-32', 'radii 4-8-16-32']);
  assert.deepEqual(flow.transitions, {
    '47daf613-b10b-41f2-926f-9bac1e20ae5c': { enter: 'fade', enterMs: 300 },
  }, 'dissolve/300ms on the edge INTO "strokes" becomes that scene fade; nothing else animates');

  // The flow really is doing the ordering, not agreeing with it by accident: feed
  // the boards in REVERSE reading order and the walk still opens on the starting
  // frame and puts its destination second.
  const rev = penpotFlowOrder([...spatial].reverse().map((b: any) => String(b.id)), byId, page);
  assert.deepEqual(names(rev.ordered).slice(0, 2), ['effects', 'strokes']);
  assert.deepEqual(names(rev.ordered).slice(2), ['radii 4-8-16-32', 'radii 4-8-16-32', 'geometry'],
    'the unreached remainder keeps the order it was handed — reversed in, reversed out');
});

test('kitchen sink: with the interactions stripped, ordering falls back byte-identically to reading order', () => {
  const root = shapes.find(s => String(s.id).startsWith('00000000'))!;
  const byId: Record<string, any> = {};
  for (const s of shapes) byId[String(s.id)] = s;
  const stripped: Record<string, any> = {};
  for (const [id, s] of Object.entries(byId)) { const { interactions, ...rest } = s; stripped[id] = rest; }
  const ids = (root.shapes as string[]).filter(id => byId[id] && byId[id].type === 'frame');
  const flow = penpotFlowOrder(ids, stripped, null);
  assert.equal(flow.hasFlow, false, 'this is the keynote case — zero interactions');
  assert.deepEqual(flow.ordered, ids, 'the input order comes back untouched');
  assert.deepEqual(flow.transitions, {});
});
