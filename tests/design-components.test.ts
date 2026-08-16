// SPDX-License-Identifier: MPL-2.0
/**
 * Unit surface for the Penpot component collectors (engine/src/design-components.ts).
 *
 * Synthetic JSON only - the structures asserted here are the ones the REAL
 * fixtures pin (`tests/penpot-kitchen-sink.test.ts` for variants + instances,
 * `tests/penpot-keynote-replay.test.ts` for the 6-definition census). This suite
 * covers the branches a single file cannot: a missing master, a stale
 * `mainInstancePage`, an absent local file id, image slots, cycles.
 *
 * Run with: node --test tests/design-components.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { collectPenpotComponents, penpotComponentSlots } from '../engine/src/design-components.ts';

const FILE = 'file-local';
const PAGE = 'page-1';

/** A component record as Penpot serializes one. */
const rec = (o: Record<string, unknown>): Record<string, unknown> => ({
  path: '', modifiedAt: '2026-07-31T00:00:00.000Z', mainInstancePage: PAGE, ...o,
});
/** A shape, defaulting to a local main instance (masters name their own file). */
const shape = (o: Record<string, unknown>): Record<string, unknown> => ({
  type: 'frame', name: 'shape', shapes: [], ...o,
});
const page = (...shapes: Array<Record<string, unknown>>): Record<string, Record<string, unknown>> =>
  Object.fromEntries(shapes.map((s) => [String(s.id), s]));

// ── pointer parsing ──────────────────────────────────────────────────────────

test('design-components: a plain component record resolves to its master subtree', () => {
  const master = shape({ id: 'm1', name: 'CARD', componentId: 'c1', componentFile: FILE, mainInstance: true, componentRoot: true });
  const out = collectPenpotComponents(
    [rec({ id: 'c1', name: 'CARD', path: 'cards', mainInstanceId: 'm1' })],
    new Map([[PAGE, page(master)]]),
    { fileId: FILE },
  );
  assert.deepEqual(out.warnings, []);
  assert.equal(out.components.length, 1);
  assert.deepEqual(out.components[0], {
    id: 'c1', name: 'CARD', path: 'cards', rootShapeId: 'm1', pageId: PAGE,
    external: false, isVariantSet: false,
    variants: [{ id: 'c1', rootShapeId: 'm1', pageId: PAGE, properties: [], label: '' }],
  });
  // A non-variant component is still a one-entry variant list - one shape for
  // callers, so the template path never branches on variant-ness.
  assert.equal(out.components[0]!.variants[0]!.rootShapeId, out.components[0]!.rootShapeId);
});

test('design-components: components sort by path, then name, then id — zip order never leaks', () => {
  const shapes = page(
    shape({ id: 'm1' }), shape({ id: 'm2' }), shape({ id: 'm3' }),
  );
  const out = collectPenpotComponents([
    rec({ id: 'c3', name: 'B', path: 'text', mainInstanceId: 'm3' }),
    rec({ id: 'c1', name: 'Z', path: 'cards', mainInstanceId: 'm1' }),
    rec({ id: 'c2', name: 'A', path: 'text', mainInstanceId: 'm2' }),
  ], { [PAGE]: shapes }, { fileId: FILE });
  assert.deepEqual(out.components.map((c) => `${c.path}/${c.name}`), ['cards/Z', 'text/A', 'text/B']);
});

test('design-components: a record whose master is missing is dropped with a named warning', () => {
  const out = collectPenpotComponents(
    [rec({ id: 'c1', name: 'GHOST', mainInstanceId: 'gone' }), rec({ id: 'c2', name: 'REAL', mainInstanceId: 'm2' })],
    new Map([[PAGE, page(shape({ id: 'm2', componentFile: FILE, mainInstance: true }))]]),
    { fileId: FILE },
  );
  assert.deepEqual(out.components.map((c) => c.name), ['REAL']);
  assert.equal(out.warnings.length, 1);
  assert.match(out.warnings[0]!, /"GHOST".*master shape gone not found/);
});

test('design-components: a stale mainInstancePage still resolves — ids are unique file-wide', () => {
  const out = collectPenpotComponents(
    [rec({ id: 'c1', name: 'CARD', mainInstanceId: 'm1', mainInstancePage: 'page-that-moved' })],
    new Map([['page-2', page(shape({ id: 'm1', componentFile: FILE, mainInstance: true }))]]),
    { fileId: FILE },
  );
  assert.deepEqual(out.warnings, []);
  assert.equal(out.components[0]!.pageId, 'page-2', 'the page it was actually found on');
});

test('design-components: garbage in — non-array records and junk entries are ignored', () => {
  for (const bad of [null, undefined, {}, 'nope', 7]) {
    const out = collectPenpotComponents(bad, {}, { fileId: FILE });
    assert.deepEqual(out.components, []);
    assert.deepEqual(out.externals, { instances: 0, files: [], components: [] });
  }
  const out = collectPenpotComponents([null, 'x', rec({ id: 'c1', name: 'A', mainInstanceId: 'm1' })],
    { [PAGE]: page(shape({ id: 'm1' })) }, { fileId: FILE });
  assert.deepEqual(out.components.map((c) => c.id), ['c1']);
});

// ── variants ─────────────────────────────────────────────────────────────────

test('design-components: N records sharing a variantId group to ONE component with N variants', () => {
  // The kitchen-sink structure, synthesised: one record per variant, same name,
  // the property pair on the RECORD, the container frame holding both masters.
  const container = shape({ id: 'vc', name: 'button', isVariantContainer: true, layout: 'flex', shapes: ['m2', 'm1'] });
  const mkMain = (id: string, cid: string, vn: string) => shape({
    id, name: 'button', componentId: cid, componentFile: FILE, mainInstance: true, componentRoot: true,
    variantId: 'vc', variantName: vn,
  });
  const out = collectPenpotComponents([
    rec({ id: 'c2', name: 'button', mainInstanceId: 'm2', variantId: 'vc', variantProperties: [{ name: 'Size', value: 'Large' }] }),
    rec({ id: 'c1', name: 'button', mainInstanceId: 'm1', variantId: 'vc', variantProperties: [{ name: 'Size', value: 'Compact' }] }),
  ], new Map([[PAGE, page(container, mkMain('m1', 'c1', 'Compact'), mkMain('m2', 'c2', 'Large'))]]), { fileId: FILE });

  assert.equal(out.components.length, 1, 'one logical component, not two near-duplicate templates');
  const c = out.components[0]!;
  assert.equal(c.id, 'vc', 'the SET id is the variant container id');
  assert.equal(c.name, 'button');
  assert.equal(c.isVariantSet, true);
  assert.deepEqual(c.variants.map((v) => v.label), ['Compact', 'Large'], 'variants ordered by label, not zip order');
  assert.deepEqual(c.variants[0]!.properties, [{ name: 'Size', value: 'Compact' }]);
  assert.equal(c.rootShapeId, 'm1', 'the default variant is the first by label');
});

test('design-components: a single-variant set is still a set (the group key is variantId)', () => {
  const out = collectPenpotComponents(
    [rec({ id: 'c1', name: 'chip', mainInstanceId: 'm1', variantId: 'vc', variantProperties: [{ name: 'P', value: 'V' }] })],
    { [PAGE]: page(shape({ id: 'm1', componentFile: FILE, mainInstance: true })) }, { fileId: FILE },
  );
  assert.equal(out.components[0]!.id, 'vc');
  assert.equal(out.components[0]!.isVariantSet, true);
  assert.deepEqual(out.components[0]!.variants.map((v) => v.label), ['V']);
});

test('design-components: identically named components WITHOUT a variantId stay separate', () => {
  // The distinction that makes grouping safe: Penpot allows two unrelated
  // components to share a name, and only `variantId` says they are one set.
  const out = collectPenpotComponents([
    rec({ id: 'c1', name: 'card', mainInstanceId: 'm1' }),
    rec({ id: 'c2', name: 'card', mainInstanceId: 'm2' }),
  ], { [PAGE]: page(shape({ id: 'm1' }), shape({ id: 'm2' })) }, { fileId: FILE });
  assert.deepEqual(out.components.map((c) => c.id), ['c1', 'c2']);
  assert.deepEqual(out.components.map((c) => c.isVariantSet), [false, false]);
});

// ── externals census ─────────────────────────────────────────────────────────

test('design-components: externality is decided by componentFile, even when the id is also local', () => {
  // The keynote case: an instance copied from a duplicated library keeps the
  // SAME componentId as a local definition. "no local definition" would miss it.
  const master = shape({ id: 'm1', componentId: 'c1', componentFile: FILE, mainInstance: true, componentRoot: true });
  const localCopy = shape({ id: 's1', name: 'local copy', componentId: 'c1', componentFile: FILE, componentRoot: true, shapeRef: 'm1' });
  const foreignSameId = shape({ id: 's2', name: 'foreign twin', componentId: 'c1', componentFile: 'lib-a', componentRoot: true });
  const foreignOther = shape({ id: 's3', name: 'logo', componentId: 'cx', componentFile: 'lib-b', componentRoot: true });
  const foreignAgain = shape({ id: 's4', name: 'logo', componentId: 'cx', componentFile: 'lib-b', componentRoot: true });

  const out = collectPenpotComponents(
    [rec({ id: 'c1', name: 'CARD', mainInstanceId: 'm1' })],
    new Map([[PAGE, page(master, localCopy, foreignSameId, foreignOther, foreignAgain)]]),
    { fileId: FILE },
  );
  assert.equal(out.externals.instances, 3, 'three foreign instance roots');
  assert.deepEqual(out.externals.files, ['lib-a', 'lib-b']);
  assert.deepEqual(out.externals.components, [
    { componentId: 'c1', componentFile: 'lib-a', name: 'foreign twin', instances: 1 },
    { componentId: 'cx', componentFile: 'lib-b', name: 'logo', instances: 2 },
  ]);
  assert.equal(out.components.length, 1, 'and the local definition is unaffected');
});

test('design-components: the local file id is inferred from a master when the caller has none', () => {
  const master = shape({ id: 'm1', componentId: 'c1', componentFile: FILE, mainInstance: true, componentRoot: true });
  const foreign = shape({ id: 's1', name: 'ext', componentId: 'cz', componentFile: 'lib', componentRoot: true });
  const out = collectPenpotComponents([rec({ id: 'c1', name: 'A', mainInstanceId: 'm1' })],
    { [PAGE]: page(master, foreign) });
  assert.equal(out.localFileId, FILE, 'a master always names its own file in componentFile');
  assert.equal(out.externals.instances, 1);
  assert.deepEqual(out.warnings, []);
});

test('design-components: with no derivable file id the census declines rather than guesses', () => {
  const master = shape({ id: 'm1', mainInstance: true });   // no componentFile
  const foreign = shape({ id: 's1', componentId: 'cz', componentFile: 'lib', componentRoot: true });
  const out = collectPenpotComponents([rec({ id: 'c1', name: 'A', mainInstanceId: 'm1' })],
    { [PAGE]: page(master, foreign) });
  assert.equal(out.localFileId, null);
  assert.deepEqual(out.externals, { instances: 0, files: [], components: [] });
  assert.match(out.warnings[0]!, /census skipped/);
});

test('design-components: masters never count as external instances', () => {
  // A master carries componentId + componentFile like any instance root does.
  const master = shape({ id: 'm1', componentId: 'c1', componentFile: 'lib-elsewhere', mainInstance: true, componentRoot: true });
  const out = collectPenpotComponents([rec({ id: 'c1', name: 'A', mainInstanceId: 'm1' })],
    { [PAGE]: page(master) }, { fileId: FILE });
  assert.equal(out.externals.instances, 0);
});

// ── slot inference ───────────────────────────────────────────────────────────

const lookupOf = (shapes: Record<string, Record<string, unknown>>) => (id: string): unknown => shapes[id];

test('design-components: text shapes and image fills become slots, in authored child order', () => {
  const shapes = page(
    shape({ id: 'root', name: 'CARD', shapes: ['title', 'photo', 'plain', 'body'] }),
    shape({ id: 'title', type: 'text', name: 'heading', content: { children: [{ children: [{ children: [{ text: 'Lorem ipsum' }] }] }] } }),
    shape({ id: 'photo', type: 'rect', name: 'avatar', fills: [{ fillImage: { id: 'media-9', keepAspectRatio: true } }] }),
    shape({ id: 'plain', type: 'rect', name: 'divider', fills: [{ fillColor: '#000000' }] }),
    shape({ id: 'body', type: 'text', name: 'copy' }),
  );
  const slots = penpotComponentSlots(shapes.root, lookupOf(shapes));
  assert.deepEqual(slots, [
    { shapeId: 'title', kind: 'text', label: 'heading', text: 'Lorem ipsum' },
    { shapeId: 'photo', kind: 'image', label: 'avatar', imageId: 'media-9' },
    { shapeId: 'body', kind: 'text', label: 'copy' },
  ]);
  assert.equal(slots.length, 3, 'the solid-fill rect and the root frame contribute nothing');
});

test('design-components: a master with no text and no image fills has no slots at all', () => {
  const shapes = page(
    shape({ id: 'root', shapes: ['a'] }),
    shape({ id: 'a', type: 'rect', name: 'block', fills: [{ fillColor: '#f23ae5' }] }),
  );
  assert.deepEqual(penpotComponentSlots(shapes.root, lookupOf(shapes)), []);
});

test('design-components: text wins over an image fill on the same shape (penpotShapeToNode order)', () => {
  const s = shape({ id: 't', type: 'text', name: 'over', content: { children: [{ children: [{ children: [{ text: 'hi' }] }] }] },
    fills: [{ fillImage: { id: 'media-1' } }] });
  assert.deepEqual(penpotComponentSlots(s, () => undefined),
    [{ shapeId: 't', kind: 'text', label: 'over', text: 'hi' }]);
});

test('design-components: hidden shapes and their subtrees are not slots', () => {
  const shapes = page(
    shape({ id: 'root', shapes: ['gone', 'kept'] }),
    shape({ id: 'gone', name: 'draft', hidden: true, shapes: ['ghost'] }),
    shape({ id: 'ghost', type: 'text', name: 'ghost copy' }),
    shape({ id: 'kept', type: 'text', name: 'kept copy' }),
  );
  assert.deepEqual(penpotComponentSlots(shapes.root, lookupOf(shapes)).map((s) => s.label), ['kept copy']);
});

test('design-components: the walk is cycle-safe and tolerates dangling child ids', () => {
  const shapes = page(
    shape({ id: 'root', shapes: ['a', 'missing'] }),
    shape({ id: 'a', type: 'text', name: 'a', shapes: ['root', 'a'] }),
  );
  assert.deepEqual(penpotComponentSlots(shapes.root, lookupOf(shapes)).map((s) => s.shapeId), ['a']);
  assert.deepEqual(penpotComponentSlots(null, () => undefined), []);
  assert.deepEqual(penpotComponentSlots('nope', () => undefined), []);
});

test('design-components: an image-filled ROOT is itself a slot', () => {
  const s = shape({ id: 'r', type: 'rect', name: 'cover', fills: [{ fillColor: '#fff' }, { fillImage: { id: 'm-2' } }] });
  assert.deepEqual(penpotComponentSlots(s, () => undefined),
    [{ shapeId: 'r', kind: 'image', label: 'cover', imageId: 'm-2' }]);
});
