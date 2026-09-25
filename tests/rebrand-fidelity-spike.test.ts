// SPDX-License-Identifier: MPL-2.0
/**
 * The fidelity spike end to end (plan 274 work package 0c): the adversarial
 * fixture read into a `SourceDeckV1` and compiled faithfully into Design's own
 * authored values.
 *
 * What this suite is here to prove, in the plan's own words:
 *
 *   - every source object is accounted for exactly once, which `finalizeReport`
 *     checks inside the compile and this file checks again on the counts;
 *   - a native chart with no fallback picture reaches Design as an authored
 *     placeholder layer that the report names as unresolved, and is never
 *     counted as a picture of the source;
 *   - a chart whose fallback picture the file does carry reaches Design as a
 *     real image layer;
 *   - lineage runs both ways for every layer;
 *   - the compile is a function of its input alone: two runs, identical JSON.
 *
 * Run with: node --test "tests/rebrand-fidelity-spike.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)
import Ajv from 'ajv/dist/2020.js';

import { inflatePptx } from '../packages/node-shell/src/pptx.ts';
import { sourceDeckFromPptx } from '../packages/node-shell/src/rebrand/index.ts';
import { compileFaithful } from '../engine/src/deck-compile.ts';
import { addEntry, emptyReport, finalizeReport } from '../engine/src/rebrand-report.ts';
import type {
  CompiledDeckV1,
  DesignBoxRowV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceObjectV1,
} from '../packages/core/src/rebrand-v1.ts';
import { readFixture } from './helpers/rebrand-fixtures.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

let cached: Promise<SourceDeckV1> | null = null;

function source(): Promise<SourceDeckV1> {
  cached ??= (async (): Promise<SourceDeckV1> => {
    const bytes = readFixture('adversarial.pptx');
    const parts = await inflatePptx(bytes);
    return sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'spike-1',
      name: 'adversarial.pptx',
      bytes: bytes.byteLength,
      sink: async (_bytes: Uint8Array, _mime: string, hint: string): Promise<string> => `user/media/${hint.slice(0, 16)}`,
      reader: { name: 'pptx-read', version: 'test' },
    });
  })();
  return cached;
}

async function compiled(): Promise<CompiledDeckV1> {
  return compileFaithful(await source());
}

function rowText(row: DesignBoxRowV1, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

test('one frame per slide, carrying the slide title as its name', async () => {
  const deck = await source();
  const out = await compiled();
  assert.equal(out.frames.length, deck.slides.length);
  out.frames.forEach((frame, index) => {
    const slide = deck.slides[index];
    assert.ok(slide);
    assert.equal(frame.sourceSlideId, slide.id);
    assert.equal(frame.width > 0 && frame.height > 0, true);
    const first = frame.layers[0];
    assert.ok(first, 'the frame row leads its layer list');
    assert.equal(first.kind, 'frame');
    assert.equal(first.id, frame.id);
  });
  assert.deepEqual(out.frames.map((f) => f.name), ['Quarterly review', 'Market data', 'Regional detail']);
});

test('the unreadable chart became a placeholder layer the report names as unresolved', async () => {
  const deck = await source();
  const out = await compiled();

  const unavailable = deck.slides.flatMap((s) => s.objects).filter((o) => o.fidelity.state === 'unavailable');
  assert.equal(unavailable.length, 1, 'the fixture has exactly one object nothing can be shown for');
  const chart = unavailable[0];
  assert.ok(chart);

  const frame = out.frames.find((f) => f.placeholderLayerIds.length > 0);
  assert.ok(frame, 'a placeholder should have been authored');
  assert.equal(frame.placeholderLayerIds.length, 2, 'a muted box and its label');

  const box = frame.layers.find((row) => row.id === frame.placeholderLayerIds[0]);
  const label = frame.layers.find((row) => row.id === frame.placeholderLayerIds[1]);
  assert.ok(box);
  assert.ok(label);
  assert.equal(box.kind, 'box');
  assert.equal(label.kind, 'text');
  assert.equal(rowText(label, 'text'), 'Chart could not be read');
  assert.equal(rowText(box, 'name'), chart.id, 'the placeholder names the object it stands for');
  assert.equal(box.image, undefined, 'a placeholder is never a picture of the source');

  const entry = out.report.entries.find((e) => e.objectId === chart.id && e.disposition === 'unresolved');
  assert.ok(entry, 'the report must name the object as unresolved');
  assert.equal(entry.code, 'object.unresolved');
  assert.equal(entry.fidelity, 'unavailable');
  assert.equal(entry.reason, 'native-chart-no-fallback');
  assert.equal(entry.layerId, box.id);
  assert.equal(
    out.report.entries.some((e) => e.code === 'object.placeholder-authored' && e.objectId === chart.id),
    true,
  );

  // The chart the file does carry a fallback picture for is a real image layer.
  const preserved = deck.slides
    .flatMap((s) => s.objects)
    .find((o) => o.kind === 'chart' && o.fidelity.state === 'raster-preserved');
  assert.ok(preserved);
  const imageLayer = out.frames
    .flatMap((f) => f.layers)
    .find((row) => rowText(row, 'name') === preserved.id);
  assert.ok(imageLayer);
  assert.equal(imageLayer.kind, 'image');
  assert.equal(imageLayer.image, preserved.fidelity.fallbackAssetRef);
});

test('every source object is accounted for exactly once', async () => {
  const deck = await source();
  const out = await compiled();
  const ids = deck.slides.flatMap((s) => s.objects).map((o) => o.id);

  const dispositions = out.report.entries.filter((e) => e.disposition);
  assert.equal(dispositions.length, ids.length, 'one disposition per object, no more and no fewer');
  assert.deepEqual([...new Set(dispositions.map((e) => e.objectId))].sort(), [...ids].sort());

  const counts = out.report.counts.objects;
  assert.equal(counts.retained + counts.transformed + counts.removed + counts.unresolved, ids.length);
  assert.equal(counts.unresolved, 1);
  assert.equal(counts.transformed, 1, 'the one table was carried over cell by cell');
  assert.equal(counts.removed, 0, 'the faithful mode removes nothing');

  // The invariant holds when re-checked from the outside, and breaks when an id is withheld.
  finalizeReport(out.report, ids);
  assert.throws(() => finalizeReport(out.report, [...ids, 'ppt/slides/slide9.xml.0']), /does not account for every source object/);

  assert.equal(out.report.counts.slides.source, deck.slides.length);
  assert.equal(out.report.counts.slides.included, deck.slides.length);
});

test('lineage runs both ways and covers every layer', async () => {
  const deck = await source();
  const out = await compiled();

  const layerIds = out.frames.flatMap((f) => f.layers.map((row) => String(row.id)));
  assert.equal(new Set(layerIds).size, layerIds.length, 'layer ids should be unique across the document');

  const backward = new Map(out.lineage.backward.map((e) => [e.layerId, e]));
  for (const id of layerIds) {
    assert.equal(backward.has(id), true, `no backward lineage for layer ${id}`);
  }
  assert.equal(out.lineage.backward.length, layerIds.length);

  const forward = new Map(out.lineage.forward.map((e) => [e.sourceObjectId, e.layerIds]));
  for (const object of deck.slides.flatMap((s) => s.objects)) {
    const produced = forward.get(object.id);
    assert.ok(produced, `no forward lineage for object ${object.id}`);
    assert.equal(produced.length > 0, true);
    for (const id of produced) assert.equal(layerIds.includes(id), true, `${id} is not a layer of this document`);
  }

  const placeholderIds = out.frames.flatMap((f) => f.placeholderLayerIds);
  for (const id of placeholderIds) {
    assert.equal(backward.get(id)?.derived, 'placeholder');
  }

  // Sorted output, so two hosts write the same bytes.
  assert.deepEqual(out.lineage.forward.map((e) => e.sourceObjectId), [...forward.keys()].sort());
  assert.deepEqual(out.lineage.backward.map((e) => e.layerId), [...backward.keys()].sort());
});

test('the compile is a function of its input alone', async () => {
  const deck = await source();
  assert.equal(JSON.stringify(compileFaithful(deck)), JSON.stringify(compileFaithful(deck)));
  assert.notEqual(
    JSON.stringify(compileFaithful(deck, { idPrefix: 'a' })),
    JSON.stringify(compileFaithful(deck, { idPrefix: 'b' })),
    'the id prefix should reach the output',
  );
});

test('the report refuses an entry that accounts for nothing', () => {
  const report = emptyReport(`sha256:${'0'.repeat(64)}`, 0);
  addEntry(report, { code: 'object.retained', disposition: 'retained' });
  assert.throws(() => finalizeReport(report, ['a']), /accounts for nothing/);

  const second = emptyReport(`sha256:${'0'.repeat(64)}`, 0);
  addEntry(second, { code: 'object.retained', objectId: 'a', disposition: 'retained', class: 'title' });
  addEntry(second, { code: 'object.removed', objectId: 'a', disposition: 'removed', class: 'title' });
  assert.throws(() => finalizeReport(second, ['a']), /more than one/);
  assert.equal(second.counts.byClass.title?.retained, 1);
  assert.equal(second.counts.byClass.title?.removed, 1);
  assert.equal(second.entries[0]?.message, 'The object was carried over.', 'a code with no message gets a plain one');
});

test('the compiled deck validates against schemas/rebrand-compiled-v1.schema.json', async () => {
  const out = await compiled();
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of ['report', 'compiled']) {
    ajv.addSchema(JSON.parse(readFileSync(join(ROOT, `schemas/rebrand-${name}-v1.schema.json`), 'utf8')) as object);
  }
  const validate = ajv.getSchema('https://lolly.tools/schemas/rebrand-compiled-v1.schema.json');
  assert.ok(validate, 'the compiled schema did not register');
  const ok = validate(out) as boolean;
  if (!ok) {
    const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
    assert.fail(`the compiled deck failed its schema: ${errors}`);
  }
});

// ─── hand-built source decks ─────────────────────────────────────────────────
//
// The committed pptx fixture carries no oversized table, no composed mirror and
// no picture ground, so the compile's answers to those get their own inputs: a
// `SourceDeckV1` is a plain record, so one can be written here directly.

function object(over: Partial<SourceObjectV1> & Pick<SourceObjectV1, 'id' | 'kind'>): SourceObjectV1 {
  return {
    fingerprint: `fp:${over.id}`,
    box: { x: 0, y: 0, w: 100, h: 100, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    ...over,
  };
}

function deckOf(slide: Partial<SlideSourceV1> & { objects: SourceObjectV1[] }): SourceDeckV1 {
  return {
    version: 1,
    source: { kind: 'pptx', hash: `sha256:${'2'.repeat(64)}`, lineageId: 'lin', instanceId: 'inst', pageCount: 1 },
    slides: [
      {
        id: 'ppt/slides/slide1.xml',
        index: 0,
        width: 1280,
        height: 720,
        background: {},
        readingOrder: slide.objects.map((o) => o.id),
        warnings: [],
        origin: { kind: 'pptx' },
        ...slide,
      },
    ],
    fonts: [],
    warnings: [],
    reader: { name: 'pptx-read', version: 'test' },
  };
}

test('a table past the compile cap is truncated AND reported, never silently', () => {
  const rows = Array.from({ length: 30 }, (_, r) => Array.from({ length: 20 }, (_, c) => `r${r}c${c}`));
  const out = compileFaithful(deckOf({ objects: [object({ id: 'o1', kind: 'table', table: rows })] }));

  const cells = (out.frames[0]?.layers ?? []).filter((row) => String(row.name).startsWith('o1 r'));
  assert.equal(cells.length, 20 * 12, 'the cap is 20 rows by 12 columns');

  const cap = out.report.entries.find((e) => e.code === 'source.cap-reached' && e.objectId === 'o1');
  assert.ok(cap, 'the dropped cells must be recorded');
  assert.match(cap.message, /30 by 20/);
  assert.match(cap.message, /360 cell\(s\) did not travel/);
  assert.equal(cap.disposition, undefined, 'a cap entry states no disposition, so the accounting still balances');

  const carried = out.report.entries.find((e) => e.code === 'object.transformed' && e.objectId === 'o1');
  assert.ok(carried);
  assert.match(carried.message, /first 20 row\(s\) and 12 column\(s\)/);
  assert.equal(carried.fidelity, 'approximate');
  assert.equal(carried.reason, 'cap-reached');
});

test('a table inside the cap still reads as a plain carry-over', () => {
  const rows = [['a', 'b'], ['c', 'd']];
  const out = compileFaithful(deckOf({ objects: [object({ id: 'o1', kind: 'table', table: rows })] }));
  assert.equal(out.report.entries.some((e) => e.code === 'source.cap-reached'), false);
  const carried = out.report.entries.find((e) => e.code === 'object.transformed');
  assert.equal(carried?.message, 'The table on slide 1 was carried over as one text layer per cell.');
  assert.equal(carried?.fidelity, 'editable');
});

test('an object with nothing to draw is a placeholder and reads as unresolved', () => {
  const out = compileFaithful(deckOf({ objects: [object({ id: 'o1', kind: 'unknown' })] }));
  const frame = out.frames[0];
  assert.ok(frame);
  assert.equal(frame.placeholderLayerIds.length, 2, 'a muted box and its label');
  const entry = out.report.entries.find((e) => e.objectId === 'o1' && e.disposition);
  assert.equal(entry?.disposition, 'unresolved');
  assert.equal(entry?.code, 'object.unresolved');
  assert.equal(
    out.report.entries.some((e) => e.code === 'object.retained'),
    false,
    'an empty box may never be reported as content that was carried over',
  );

  // A picture whose media ref went missing takes the same path.
  const pic = compileFaithful(deckOf({ objects: [object({ id: 'o2', kind: 'pic', fidelity: { state: 'raster-preserved' } })] }));
  assert.equal(pic.report.counts.objects.unresolved, 1);
  assert.equal(pic.report.counts.objects.retained, 0);
});

test('a slide ground picture becomes a full-frame image layer behind the objects', () => {
  const out = compileFaithful(
    deckOf({ background: { media: 'user/media/ground' }, objects: [object({ id: 'o1', kind: 'text', text: { paras: [{ runs: [{ text: 'hi' }] }] } })] }),
  );
  const frame = out.frames[0];
  assert.ok(frame);
  const ground = frame.layers[1];
  assert.ok(ground, 'the ground sits right after the frame row');
  assert.equal(ground.kind, 'image');
  assert.equal(ground.image, 'user/media/ground');
  assert.equal(ground.w, frame.width);
  assert.equal(ground.h, frame.height);
  const content = frame.layers.find((row) => row.name === 'o1');
  assert.ok(content);
  assert.equal(Number(content.order) > Number(ground.order), true, 'the ground must paint behind the slide content');
  assert.equal(out.lineage.backward.some((e) => e.layerId === ground.id), true);
});

test('a mirrored object keeps its mirror', () => {
  const flipped = object({ id: 'o1', kind: 'pic', media: 'user/media/a', fidelity: { state: 'raster-preserved' }, transform: [-1, 0, 0, 1, 60, 10] });
  const out = compileFaithful(deckOf({ objects: [flipped] }));
  const row = (out.frames[0]?.layers ?? []).find((r) => r.name === 'o1');
  assert.ok(row);
  assert.equal(row.flipH, true, 'dropping the affine would place a mirrored picture the right way round');
  assert.equal(row.flipV, undefined);

  const straight = compileFaithful(deckOf({ objects: [object({ id: 'o1', kind: 'pic', media: 'user/media/a', fidelity: { state: 'raster-preserved' } })] }));
  const plain = (straight.frames[0]?.layers ?? []).find((r) => r.name === 'o1');
  assert.equal(plain?.flipH, undefined, 'an object with no affine gains no mirror');
});

test('carried furniture stays nameable after the compile', () => {
  const out = compileFaithful(
    deckOf({
      objects: [
        object({ id: 'o1', kind: 'text', origin: 'master', text: { paras: [{ runs: [{ text: 'Confidential' }] }] } }),
        object({ id: 'o2', kind: 'text', text: { paras: [{ runs: [{ text: 'Body' }] }] } }),
      ],
    }),
  );
  const frame = out.frames[0];
  assert.ok(frame);
  assert.equal(frame.furnitureLayerIds.length, 1);
  const furniture = frame.layers.find((row) => row.id === frame.furnitureLayerIds[0]);
  assert.equal(furniture?.name, 'o1');
});

test('a warning that is not a cap is not reported as one', () => {
  const deck = deckOf({
    warnings: [{ code: 'gradient-flattened', message: 'a ramp was read as one stop' }],
    objects: [object({ id: 'o1', kind: 'text', text: { paras: [{ runs: [{ text: 'hi' }] }] } })],
  });
  deck.warnings = [{ code: 'group-transform-approximated', message: 'a group states a placement a box cannot hold' }];
  const out = compileFaithful(deck);
  for (const code of ['gradient-flattened', 'group-transform-approximated']) {
    const entry = out.report.entries.find((e) => e.reason === code);
    assert.ok(entry, `the ${code} warning should reach the report`);
    assert.notEqual(entry.code, 'source.cap-reached', 'nothing may be described to a person as a cap it was not');
  }

  const capped = deckOf({
    warnings: [{ code: 'nodes-truncated', message: 'a slide states more nodes than the reader carries' }],
    objects: [object({ id: 'o1', kind: 'text', text: { paras: [{ runs: [{ text: 'hi' }] }] } })],
  });
  const out2 = compileFaithful(capped);
  assert.equal(out2.report.entries.find((e) => e.reason === 'nodes-truncated')?.code, 'source.cap-reached');
});
