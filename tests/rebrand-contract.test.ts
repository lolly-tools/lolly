// SPDX-License-Identifier: MPL-2.0
/**
 * The rebrand renovation contracts (plan 274, WP 0): six JSON schemas under
 * schemas/rebrand-*.schema.json against the TypeScript they mirror in
 * packages/core/src/rebrand-v1.ts.
 *
 * Two copies of one vocabulary drift the moment nobody compares them. Each
 * exported const array in rebrand-v1.ts has one named $defs entry holding its
 * enum, so this file can hold the pair together element by element and in order.
 * A new array with no schema enum fails here rather than shipping as a union the
 * schemas do not know. A second walk refuses the same list written out again
 * anywhere else in a schema, because an inline copy is a copy no test can see.
 *
 * Shared sub-shapes are copied into each schema that needs them, so each document
 * schema stands on its own (the one cross-file reference is the compiled deck
 * pointing at the report, because a compiled deck carries a whole report). The
 * copies are held together the same way: a $defs name that appears in more than
 * one file must be the same definition in every file.
 *
 * The sample documents under tests/fixtures/rebrand/samples are authored by hand
 * and read as one journey over one deck: an unavailable native chart beside a
 * second chart the file did carry an image for, a decision that overrides its
 * proposal, an unresolved colour use, a continuation frame holding the content it
 * was added for, and lineage in both directions. Three walks keep them honest:
 * the census classifies every source object, the report accounts for every source
 * object once and its entries tally with its counts, and every Design box row in
 * the compiled deck uses field ids and kinds the design tool actually declares.
 *
 * Plan 275 (section 2.5 and section 7.2 step 3) appends fields to every document
 * and to the slide master: open archetype ids, the layout read's units and match,
 * the deck theme and a slide's ground, and the run and paragraph formatting the
 * reader will carry. The last part of this file pins each one: typed against the
 * module, optional in the schema, valid when written and refused when malformed.
 *
 * Run with: node --test "tests/rebrand-contract.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import * as rebrand from '../packages/core/src/rebrand-v1.ts';
import type {
  ArchetypeRefV1,
  ColorMappingV1,
  DeckThemeV1,
  LayoutFeaturesV1,
  RenovationPresetV1,
  ReviewMessageV1,
  SlideOcrV1,
  SlidePlanV1,
  SlideRecoveryV1,
  SlideSourceV1,
  SourceObjectV1,
  SourceParaV1,
  SourceRunV1,
  VectorItemsV1,
} from '../packages/core/src/rebrand-v1.ts';
import { VECTOR_DECK_ITEMS_MAX, VECTOR_ITEMS_MAX } from '../packages/core/src/rebrand-v1.ts';
import type { ArchetypeV1, PlaceholderLayerV1, SlideMasterFileV1 } from '../packages/core/src/slide-master-v1.ts';
import type { PlanRowsTouchedV1, RenovationPresetV1 as EnginePresetV1, ReviewMessageV1 as EngineReviewMessageV1 } from '../engine/src/index.ts';
import { libraryStructureIds, slideMasterProblems, type SlideMasterFileLike } from '../scripts/lib/slide-master-rules.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type Json = Record<string, unknown>;

/** The six documents, by the short name used in both file names. */
const DOCUMENTS = ['source', 'census', 'plan', 'compiled', 'report', 'project'] as const;
type DocumentName = (typeof DOCUMENTS)[number];

const schemaId = (name: DocumentName): string => `https://lolly.tools/schemas/rebrand-${name}-v1.schema.json`;

function readJson(rel: string): Json {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;
}

const SCHEMAS = new Map<DocumentName, Json>(
  DOCUMENTS.map((name) => [name, readJson(`schemas/rebrand-${name}-v1.schema.json`)]),
);

const SAMPLES = new Map<DocumentName, Json>(
  DOCUMENTS.map((name) => [name, readJson(`tests/fixtures/rebrand/samples/${name}.json`)]),
);

function schemaOf(name: DocumentName): Json {
  const doc = SCHEMAS.get(name);
  assert.ok(doc, `schemas/rebrand-${name}-v1.schema.json is missing`);
  return doc;
}

function sampleOf(name: DocumentName): Json {
  const doc = SAMPLES.get(name);
  assert.ok(doc, `tests/fixtures/rebrand/samples/${name}.json is missing`);
  return structuredClone(doc);
}

function defsOf(name: DocumentName): Record<string, Json> {
  return (schemaOf(name).$defs ?? {}) as Record<string, Json>;
}

/** One ajv holding all six, so the compiled deck can point at the report by $id. */
function compiledAjv(): InstanceType<typeof Ajv> {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of DOCUMENTS) ajv.addSchema(schemaOf(name));
  return ajv;
}

function validatorFor(ajv: InstanceType<typeof Ajv>, name: DocumentName): (doc: unknown) => boolean {
  const validate = ajv.getSchema(schemaId(name));
  assert.ok(validate, `${schemaId(name)} did not register`);
  return (doc: unknown) => {
    const ok = validate(doc) as boolean;
    if (!ok) {
      const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
      assert.fail(`${name} sample failed its schema: ${errors}`);
    }
    return ok;
  };
}

/** True when the document is refused, with no assertion message of its own. */
function refuses(ajv: InstanceType<typeof Ajv>, name: DocumentName, doc: unknown): boolean {
  const validate = ajv.getSchema(schemaId(name));
  assert.ok(validate, `${schemaId(name)} did not register`);
  return !validate(doc);
}

// ─── where each exported vocabulary lives in the schemas ─────────────────────

/** Exported const array name to the schema and $defs entry holding its enum. */
const ENUM_HOMES: Record<string, { doc: DocumentName; def: string }> = {
  SOURCE_KINDS: { doc: 'source', def: 'sourceKind' },
  SOURCE_OBJECT_KINDS: { doc: 'source', def: 'sourceObjectKind' },
  SOURCE_ORIGINS: { doc: 'source', def: 'sourceOrigin' },
  FIDELITY_STATES: { doc: 'source', def: 'fidelityState' },
  FIDELITY_REASONS: { doc: 'source', def: 'fidelityReason' },
  PLACEHOLDER_TYPES: { doc: 'source', def: 'placeholderType' },
  OCR_STATES: { doc: 'source', def: 'ocrState' },
  SOURCE_WARNING_CODES: { doc: 'source', def: 'sourceWarningCode' },
  SOURCE_ROLE_ESTIMATES: { doc: 'source', def: 'sourceRoleEstimate' },
  VECTOR_OMIT_REASONS: { doc: 'source', def: 'vectorOmitReason' },
  SLIDE_ARRANGEMENTS: { doc: 'plan', def: 'slideArrangement' },
  OBJECT_CLASSES: { doc: 'census', def: 'objectClass' },
  EVIDENCE_SIGNALS: { doc: 'census', def: 'evidenceSignal' },
  PLAN_ACTIONS: { doc: 'plan', def: 'planAction' },
  REVIEW_STATES: { doc: 'plan', def: 'reviewState' },
  DECISION_AUTHORS: { doc: 'plan', def: 'decisionAuthor' },
  ARCHETYPE_ROLES: { doc: 'plan', def: 'archetypeRole' },
  ARCHETYPE_IDS: { doc: 'plan', def: 'archetypeId' },
  KNOWN_ARCHETYPE_IDS: { doc: 'plan', def: 'archetypeId' },
  LAYOUT_UNIT_KINDS: { doc: 'census', def: 'layoutUnitKind' },
  LAYOUT_MATCH_BANDS: { doc: 'plan', def: 'layoutMatchBand' },
  SLIDE_GROUNDS: { doc: 'plan', def: 'slideGround' },
  DECK_THEME_IDS: { doc: 'plan', def: 'deckThemeId' },
  COLOR_UNRESOLVED_REASONS: { doc: 'plan', def: 'colorUnresolvedReason' },
  DISPOSITIONS: { doc: 'report', def: 'disposition' },
  REPORT_CODES: { doc: 'report', def: 'reportCode' },
  FILE_OUTCOMES: { doc: 'report', def: 'fileOutcome' },
  REBRAND_ERROR_CODES: { doc: 'report', def: 'rebrandErrorCode' },
  PROJECT_STAGES: { doc: 'project', def: 'projectStage' },
  PROJECT_PART_KINDS: { doc: 'project', def: 'projectPartKind' },
  PROJECT_WRITE_REFUSALS: { doc: 'project', def: 'projectWriteRefusal' },
};

/** Every `{ pointer, node }` pair in a schema, the document itself included. */
function walkSchema(node: unknown, pointer = ''): Array<{ pointer: string; node: Json }> {
  if (Array.isArray(node)) {
    return node.flatMap((child, i) => walkSchema(child, `${pointer}/${i}`));
  }
  if (!node || typeof node !== 'object') return [];
  const here = { pointer, node: node as Json };
  const below = Object.entries(node as Json).flatMap(([key, child]) =>
    walkSchema(child, `${pointer}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`),
  );
  return [here, ...below];
}

/** Every exported const array of strings in rebrand-v1.ts, by export name. */
function exportedStringArrays(): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const [name, value] of Object.entries(rebrand as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')) {
      out.set(name, value as readonly string[]);
    }
  }
  return out;
}

// ─── the vocabularies ────────────────────────────────────────────────────────

test('every exported vocabulary in rebrand-v1.ts has one home in the schemas', () => {
  const arrays = exportedStringArrays();
  assert.ok(arrays.size >= 23, `expected at least 23 exported vocabularies, found ${arrays.size}`);
  for (const name of arrays.keys()) {
    assert.ok(ENUM_HOMES[name], `${name} is exported from rebrand-v1.ts but no schema enum mirrors it`);
  }
  for (const name of Object.keys(ENUM_HOMES)) {
    assert.ok(arrays.has(name), `ENUM_HOMES names ${name}, which rebrand-v1.ts does not export as a string array`);
  }
});

test('each schema enum matches its const array element by element and in order', () => {
  const arrays = exportedStringArrays();
  for (const [name, home] of Object.entries(ENUM_HOMES)) {
    const values = arrays.get(name);
    assert.ok(values, `${name} is not exported`);
    const def = defsOf(home.doc)[home.def];
    assert.ok(def, `schemas/rebrand-${home.doc}-v1.schema.json has no $defs/${home.def}`);
    assert.deepEqual(def.enum, [...values], `$defs/${home.def} in the ${home.doc} schema has drifted from ${name}`);
    assert.deepEqual(Object.keys(def), ['enum'], `$defs/${home.def} should be a bare enum`);
  }
});

test('no vocabulary is written out a second time outside the $defs entry that owns it', () => {
  const arrays = exportedStringArrays();
  const allowedPointer = new Map<string, string>();
  for (const [name, home] of Object.entries(ENUM_HOMES)) {
    const values = arrays.get(name);
    assert.ok(values, `${name} is not exported`);
    allowedPointer.set(JSON.stringify([...values]), `/$defs/${home.def}`);
  }
  for (const doc of DOCUMENTS) {
    for (const { pointer, node } of walkSchema(schemaOf(doc))) {
      const values = node.enum;
      if (!Array.isArray(values) || !values.every((v) => typeof v === 'string')) continue;
      const allowed = allowedPointer.get(JSON.stringify(values));
      if (!allowed) continue;
      assert.equal(
        pointer,
        allowed,
        `the ${doc} schema writes a known vocabulary out at ${pointer}; point it at ${allowed} instead, so the drift test above can see it`,
      );
    }
  }
});

test('the report schema publishes the surface contracts no document property uses', () => {
  const defs = defsOf('report');
  for (const name of ['fileOutcome', 'rebrandErrorCode', 'rebrandCapabilities']) {
    assert.ok(defs[name], `schemas/rebrand-report-v1.schema.json should define $defs/${name}`);
  }
  const capabilities = defs.rebrandCapabilities;
  assert.ok(capabilities);
  assert.deepEqual(
    (capabilities.required as string[]).slice().sort(),
    ['bytes', 'designDocument', 'limits', 'nativePptx', 'ocr', 'rasterFallback', 'surface'],
    'the capabilities contract should require every field RebrandCapabilitiesV1 declares as required',
  );
});

test('the contract version is the version const in all six schemas', () => {
  for (const name of DOCUMENTS) {
    const version = (schemaOf(name).properties as Record<string, Json>).version;
    assert.ok(version, `the ${name} schema has no version property`);
    assert.equal(version.const, rebrand.REBRAND_CONTRACT_VERSION, `the ${name} schema pins a different contract version`);
  }
});

test('the reference resolution every box is expressed in is stated in the schema', () => {
  const box = defsOf('source').box;
  assert.ok(box, 'the source schema has no $defs/box');
  const description = String(box.description ?? '');
  assert.ok(
    description.includes(String(rebrand.REBRAND_REFERENCE_DPI)),
    `$defs/box should name the reference resolution ${rebrand.REBRAND_REFERENCE_DPI}, so changing REBRAND_REFERENCE_DPI forces a schema edit and a version decision; it reads "${description}"`,
  );
});

/** One ceiling for how many objects a deck carries through the whole journey. */
const OBJECT_CEILING = 200000;

test('one object ceiling governs the census, the lineage and the report', () => {
  const census = (schemaOf('census').properties as Record<string, Json>).objects;
  const report = (schemaOf('report').properties as Record<string, Json>).entries;
  const lineage = defsOf('compiled').lineage;
  assert.ok(census && report && lineage);
  const lineageProps = lineage.properties as Record<string, Json>;
  const capped: Array<[string, Json | undefined]> = [
    ['census objects', census],
    ['report entries', report],
    ['lineage forward', lineageProps.forward],
    ['lineage backward', lineageProps.backward],
  ];
  for (const [what, node] of capped) {
    assert.ok(node, `${what} is missing`);
    assert.equal(node.maxItems, OBJECT_CEILING, `${what} should carry the shared per-deck object ceiling`);
    assert.ok(
      String(node.description ?? '').includes(String(OBJECT_CEILING)),
      `${what} should state the ceiling it carries, so the four caps stay one number rather than four hand-picked ones`,
    );
  }
  const slides = (schemaOf('source').properties as Record<string, Json>).slides;
  assert.ok(slides);
  assert.ok(
    String(slides.description ?? '').includes(String(OBJECT_CEILING)),
    'the source schema should state the same ceiling, so a reader truncates with a warning rather than writing a deck stage 2 refuses',
  );
});

test('a $defs name used by more than one schema is the same definition in each', () => {
  const byName = new Map<string, Array<{ doc: DocumentName; def: Json }>>();
  for (const doc of DOCUMENTS) {
    for (const [defName, def] of Object.entries(defsOf(doc))) {
      const seen = byName.get(defName) ?? [];
      seen.push({ doc, def });
      byName.set(defName, seen);
    }
  }
  let shared = 0;
  for (const [defName, copies] of byName) {
    if (copies.length < 2) continue;
    shared++;
    const first = copies[0];
    assert.ok(first);
    for (const other of copies.slice(1)) {
      assert.deepEqual(other.def, first.def, `$defs/${defName} differs between the ${first.doc} and ${other.doc} schemas`);
    }
  }
  assert.ok(shared >= 10, `expected at least ten shared definitions, found ${shared}`);
});

test('every schema declares the 2020-12 dialect, an $id and a closed top level', () => {
  for (const name of DOCUMENTS) {
    const doc = schemaOf(name);
    assert.equal(doc.$schema, 'https://json-schema.org/draft/2020-12/schema', `${name} declares the wrong dialect`);
    assert.equal(doc.$id, schemaId(name), `${name} has the wrong $id`);
    assert.equal(doc.title, `rebrand-${name}-v1`, `${name} has the wrong title`);
    assert.equal(doc.type, 'object');
    assert.equal(doc.additionalProperties, false, `${name} leaves its top level open`);
    assert.ok(typeof doc.description === 'string' && doc.description.length > 40, `${name} needs a description`);
  }
});

// ─── the samples ─────────────────────────────────────────────────────────────

test('one authored sample per schema validates', () => {
  const ajv = compiledAjv();
  for (const name of DOCUMENTS) {
    const validate = validatorFor(ajv, name);
    assert.ok(validate(sampleOf(name)), `${name} sample should validate`);
  }
});

test('the compiled sample carries a whole report, which validates on its own too', () => {
  const ajv = compiledAjv();
  const compiled = sampleOf('compiled');
  const report = compiled.report;
  assert.ok(report && typeof report === 'object', 'the compiled sample has no report');
  assert.ok(validatorFor(ajv, 'report')(report), 'the report inside the compiled sample should validate');
});

test('the samples reach the parts a plain fixture would skip', () => {
  const source = sampleOf('source');
  const slides = source.slides as Json[];
  const unavailable = slides.flatMap((s) => s.objects as Json[]).filter((o) => (o.fidelity as Json).state === 'unavailable');
  assert.ok(unavailable.length > 0, 'the source sample should hold an object nothing could be shown for');

  const plan = sampleOf('plan');
  const objects = (plan.slides as Json[]).flatMap((s) => s.objects as Json[]);
  assert.ok(objects.some((o) => o.decision && o.decision !== o.proposal), 'the plan sample should hold a decision that overrides its proposal');
  assert.ok((plan.colors as Json[]).some((c) => typeof c.unresolved === 'string'), 'the plan sample should hold an unresolved colour use');

  const source2 = sampleOf('source');
  const withFallback = (source2.slides as Json[])
    .flatMap((s) => s.objects as Json[])
    .filter((o) => typeof (o.fidelity as Json).fallbackAssetRef === 'string');
  assert.ok(withFallback.length > 0, 'the source sample should hold an unsupported object the file carried a real fallback image for');

  const compiled = sampleOf('compiled');
  const lineage = compiled.lineage as Json;
  assert.ok((lineage.forward as Json[]).length > 0 && (lineage.backward as Json[]).length > 0, 'lineage should run both ways');

  const continuation = (compiled.frames as Json[]).filter((f) => f.continuation === true);
  assert.equal(continuation.length, 1, 'the compiled sample should hold a continuation frame');
  const backwardIds = new Set((lineage.backward as Json[]).map((row) => row.layerId as string));
  for (const frame of continuation) {
    const layers = frame.layers as Json[];
    assert.ok(layers.length > 0, 'a continuation frame exists to hold surplus content, so an empty one is a state the compile should never produce');
    for (const layer of layers) {
      assert.ok(backwardIds.has(layer.id as string), `the continuation layer ${String(layer.id)} has no backward lineage entry`);
    }
  }
  const derived = (lineage.backward as Json[]).map((row) => row.derived);
  assert.ok(derived.includes('continuation'), 'the backward lineage should say which layer came from a continuation');
});

test('the six samples read as one journey over one deck', () => {
  const source = sampleOf('source');
  const sourceIds = (source.slides as Json[]).flatMap((s) => (s.objects as Json[]).map((o) => o.id as string));
  assert.equal(new Set(sourceIds).size, sourceIds.length, 'the source sample reuses an object id');

  const census = sampleOf('census');
  const censusIds = (census.objects as Json[]).map((o) => o.id as string);
  assert.deepEqual(
    [...censusIds].sort(),
    [...sourceIds].sort(),
    'the census classifies every source object and invents none; a plan that cites a class the census never produced is not one journey',
  );

  const plan = sampleOf('plan');
  const plannedIds = (plan.slides as Json[]).flatMap((s) => (s.objects as Json[]).map((o) => o.id as string));
  assert.deepEqual([...plannedIds].sort(), [...sourceIds].sort(), 'the plan should hold one entry per source object');

  const compiled = sampleOf('compiled');
  assert.deepEqual(compiled.report, sampleOf('report'), 'the report inside the compiled sample and the standalone report sample should be the same document');
});

test('the report sample accounts for every source object once, and its entries tally with its counts', () => {
  const sourceIds = (sampleOf('source').slides as Json[]).flatMap((s) => (s.objects as Json[]).map((o) => o.id as string));
  const report = sampleOf('report');
  const accounted = (report.entries as Json[]).filter((e) => typeof e.disposition === 'string');
  const accountedIds = accounted.map((e) => e.objectId as string);
  assert.deepEqual(
    [...accountedIds].sort(),
    [...sourceIds].sort(),
    'every source object is accounted for as retained, transformed, removed or unresolved, exactly once',
  );

  const counts = report.counts as Json;
  const tally: Record<string, number> = { retained: 0, transformed: 0, removed: 0, unresolved: 0 };
  const byClass: Record<string, Record<string, number>> = {};
  for (const entry of accounted) {
    const disposition = entry.disposition as string;
    tally[disposition] = (tally[disposition] ?? 0) + 1;
    const cls = entry.class as string | undefined;
    assert.ok(cls, `the entry for ${String(entry.objectId)} should name the class it was accounted for under`);
    let row = byClass[cls];
    if (!row) {
      row = { retained: 0, transformed: 0, removed: 0, unresolved: 0 };
      byClass[cls] = row;
    }
    row[disposition] = (row[disposition] ?? 0) + 1;
  }
  assert.deepEqual(counts.objects, tally, 'counts.objects should be the tally of the entries, not a separate walk');
  assert.deepEqual(counts.byClass, byClass, 'counts.byClass should be the per-class tally of the entries');
});

// ─── the mutations ───────────────────────────────────────────────────────────

test('an unknown fidelity state is refused', () => {
  const ajv = compiledAjv();
  const source = sampleOf('source');
  const slide = (source.slides as Json[])[0];
  assert.ok(slide);
  const object = (slide.objects as Json[])[0];
  assert.ok(object);
  (object.fidelity as Json).state = 'best-effort';
  assert.ok(refuses(ajv, 'source', source), 'a fidelity state outside FIDELITY_STATES should be refused');
});

test('a report entry with an unknown code is refused', () => {
  const ajv = compiledAjv();
  const report = sampleOf('report');
  const entry = (report.entries as Json[])[0];
  assert.ok(entry);
  entry.code = 'object.vanished';
  assert.ok(refuses(ajv, 'report', report), 'a report code outside REPORT_CODES should be refused');
});

test('a plan whose effective action is missing is refused', () => {
  const ajv = compiledAjv();
  const plan = sampleOf('plan');
  const slide = (plan.slides as Json[])[0];
  assert.ok(slide);
  const object = (slide.objects as Json[])[0];
  assert.ok(object);
  delete object.proposal;
  delete object.decision;
  assert.ok(refuses(ajv, 'plan', plan), 'an object plan with neither a proposal nor a decision should be refused');
});

test('a decision alone does not stand in for the proposal it overrode', () => {
  const ajv = compiledAjv();
  const plan = sampleOf('plan');
  const slide = (plan.slides as Json[])[0];
  assert.ok(slide);
  const object = (slide.objects as Json[])[0];
  assert.ok(object);
  delete object.proposal;
  object.decision = 'remove';
  assert.ok(refuses(ajv, 'plan', plan), 'a plan must record what was proposed as well as what was decided');
});

test('an unknown key is refused wherever the shape is closed', () => {
  const ajv = compiledAjv();
  const census = sampleOf('census');
  const entry = (census.objects as Json[])[0];
  assert.ok(entry);
  entry.hypothesisConfidence = 0.9;
  assert.ok(refuses(ajv, 'census', census), 'a misspelled key should be refused, not ignored');
});

test('an unknown object class and an unknown archetype are refused', () => {
  const ajv = compiledAjv();
  const census = sampleOf('census');
  const entry = (census.objects as Json[])[0];
  assert.ok(entry);
  (entry.hypothesis as Json).class = 'watermark';
  assert.ok(refuses(ajv, 'census', census), 'a class outside OBJECT_CLASSES should be refused');

  // From plan 275 the archetype ids are open: a library id is a well-formed id the
  // master may or may not carry, and one not written the way an id is written is refused.
  const compiled = sampleOf('compiled');
  const frame = (compiled.frames as Json[])[0];
  assert.ok(frame);
  frame.archetype = 'Mood board';
  assert.ok(refuses(ajv, 'compiled', compiled), 'an archetype id not written the way STRUCTURE_ID_PATTERN writes one should be refused');
});

test('a replacement branch with the wrong field for its kind is refused', () => {
  const ajv = compiledAjv();
  const plan = sampleOf('plan');
  const slide = (plan.slides as Json[])[0];
  assert.ok(slide);
  const object = (slide.objects as Json[])[1];
  assert.ok(object);
  object.proposalReplacement = { kind: 'brand-logo', label: 'Logo' };
  assert.ok(refuses(ajv, 'plan', plan), 'a brand-logo replacement needs a variant, not a label');
});

test('a source hash that is not a sha256 reference is refused', () => {
  const ajv = compiledAjv();
  const report = sampleOf('report');
  report.sourceHash = 'deadbeef';
  assert.ok(refuses(ajv, 'report', report), 'a bare hex digest should be refused');
});

test('a project checkpoint at an unknown stage is refused', () => {
  const ajv = compiledAjv();
  const project = sampleOf('project');
  (project.checkpoint as Json).stage = 'exported';
  assert.ok(refuses(ajv, 'project', project), 'a stage outside PROJECT_STAGES should be refused');
});

test('a compiled layer with no id is refused, on a frame and in the tray', () => {
  const ajv = compiledAjv();
  const frame = sampleOf('compiled');
  const first = (frame.frames as Json[])[0];
  assert.ok(first);
  const layer = (first.layers as Json[])[0];
  assert.ok(layer);
  delete layer.id;
  assert.ok(refuses(ajv, 'compiled', frame), 'the furniture lists, the tray and both lineage directions are keyed on layer ids, so a row without one is not a layer');

  const tray = sampleOf('compiled');
  const trayRow = (tray.tray as Json[])[0];
  assert.ok(trayRow);
  delete (trayRow.layer as Json).id;
  assert.ok(refuses(ajv, 'compiled', tray), 'a tray layer needs an id too, because the lineage names it');

  const noFrame = sampleOf('compiled');
  const frameOne = (noFrame.frames as Json[])[0];
  assert.ok(frameOne);
  const frameLayer = (frameOne.layers as Json[])[0];
  assert.ok(frameLayer);
  delete frameLayer.frame;
  assert.ok(refuses(ajv, 'compiled', noFrame), 'a frame layer states the frame it sits in');
});

test('an asset ref that cannot travel is refused', () => {
  const ajv = compiledAjv();
  const cases: Array<[DocumentName, string, (doc: Json, value: string) => void]> = [
    ['source', 'blob:https://lolly.tools/9f0c-4a1e', (doc, value) => {
      const slide = (doc.slides as Json[])[0];
      const object = slide ? (slide.objects as Json[])[1] : undefined;
      if (object) object.media = value;
    }],
    ['source', 'data:image/png;base64,iVBORw0KGgo=', (doc, value) => {
      const slide = (doc.slides as Json[])[0];
      if (slide?.preview) (slide.preview as Json).assetRef = value;
    }],
    ['plan', '/Users/andy/Desktop/logo.png', (doc, value) => {
      const slide = (doc.slides as Json[])[0];
      const object = slide ? (slide.objects as Json[])[1] : undefined;
      if (object) object.decisionReplacement = { kind: 'supplied-picture', assetRef: value };
    }],
    ['project', '../outside/the/store', (doc, value) => {
      (doc.source as Json).bytesAssetRef = value;
    }],
  ];
  for (const [name, value, apply] of cases) {
    const doc = sampleOf(name);
    apply(doc, value);
    assert.ok(refuses(ajv, name, doc), `${name} should refuse the asset ref ${value}, which does not survive a reload, a device or a shell`);
  }
});

test('a state that knows nothing carries no evidence', () => {
  const ajv = compiledAjv();
  const objectOf = (doc: Json, slide: number, index: number): Json => {
    const slides = doc.slides as Json[];
    const one = slides[slide];
    assert.ok(one);
    const object = (one.objects as Json[])[index];
    assert.ok(object);
    return object;
  };

  const notRun = sampleOf('source');
  objectOf(notRun, 0, 1).ocr = {
    state: 'not-run',
    lines: [{ text: 'CONFIDENTIAL', confidence: 0.98, box: { x: 0, y: 0, w: 120, h: 24, rot: 0 } }],
    textDensity: 42,
  };
  assert.ok(refuses(ajv, 'source', notRun), 'a pass that officially never ran cannot hand back recognised lines');

  const unavailable = sampleOf('source');
  objectOf(unavailable, 1, 0).fidelity = { state: 'unavailable', fallbackAssetRef: 'user/media/x', fallbackSource: 'local-renderer' };
  assert.ok(refuses(ajv, 'source', unavailable), 'unavailable means nothing to show, so it carries no fallback bytes');

  const dangling = sampleOf('source');
  objectOf(dangling, 0, 1).fidelity = { state: 'raster-preserved', fallbackSource: 'local-renderer' };
  assert.ok(refuses(ajv, 'source', dangling), 'a fallback source with no fallback ref names where nothing came from');
});

test('a theme colour takes the same form as every other colour in the document', () => {
  const ajv = compiledAjv();
  const source = sampleOf('source');
  ((source.theme as Json).colors as Record<string, string>).accent1 = '0C322C';
  assert.ok(refuses(ajv, 'source', source), 'the theme table is normalised to #RRGGBB, so a census can compare a run colour to a slot');
});

test('a census font use states the roles it was used for', () => {
  const ajv = compiledAjv();
  const census = sampleOf('census');
  const font = (census.fonts as Json[])[0];
  assert.ok(font);
  delete font.roles;
  assert.ok(refuses(ajv, 'census', census), 'FontUseV1.roles is required in the module, so the schema requires it too');
});

// ─── the flattened-slide fields (plan 274 section 6), added append-only ──────

/**
 * The three fields a flattened slide writes, typed against the module, so a
 * rename on either side fails here: the TypeScript at typecheck, the schema below.
 */
const RECOVERY: SlideRecoveryV1 = { assetRef: 'user/media/slide1-page', fromObjectId: 'ppt/slides/slide1.xml.7' };
const SLIDE_OCR: SlideOcrV1 = { state: 'text-found', model: 'ppocr-v5-mobile' };
const ROLE: NonNullable<SourceObjectV1['roleEstimate']> = 'title';

/**
 * The same rule the schema's `slideOcr` if/then states, held by the type: a
 * state that says nothing ran names no model. Each line fails the typecheck
 * when the type starts accepting it. An empty model string is refused by the
 * schema alone (below), since the type cannot count characters.
 */
const SLIDE_OCR_REFUSED_BY_TYPE: SlideOcrV1[] = [
  // @ts-expect-error a pass that never ran cannot name the model that ran it
  { state: 'not-run', model: 'ppocr-v5-mobile' },
  // @ts-expect-error a host with no OCR names no model either
  { state: 'unavailable', model: 'ppocr-v5-mobile' },
];

/** The source sample with the flattened fields written onto its first slide and that slide's text object. */
function flattenedSample(edit?: (slide: Json, text: Json) => void): Json {
  const source = sampleOf('source');
  const slide = (source.slides as Json[])[0];
  assert.ok(slide);
  const text = (slide.objects as Json[]).find((o) => o.kind === 'text');
  assert.ok(text, 'the first sample slide holds a text object');
  const fields: Pick<SlideSourceV1, 'recovery' | 'ocr'> = { recovery: { ...RECOVERY }, ocr: { ...SLIDE_OCR } };
  Object.assign(slide, structuredClone(fields));
  text.roleEstimate = ROLE;
  edit?.(slide, text);
  return source;
}

test('the flattened fields are optional in the schema and validate when written', () => {
  const defs = defsOf('source');
  const slideSource = defs.slideSource;
  const sourceObject = defs.sourceObject;
  assert.ok(slideSource && sourceObject);
  const slideProps = slideSource.properties as Record<string, Json>;
  const objectProps = sourceObject.properties as Record<string, Json>;
  assert.deepEqual(slideProps.recovery, { $ref: '#/$defs/slideRecovery' });
  assert.deepEqual(slideProps.ocr, { $ref: '#/$defs/slideOcr' });
  assert.equal(objectProps.roleEstimate?.$ref, '#/$defs/sourceRoleEstimate');
  for (const key of ['recovery', 'ocr', 'preview']) {
    assert.ok(!(slideSource.required as string[]).includes(key), `slideSource.${key} is optional, so a deck written before it still validates`);
  }
  assert.ok(!(sourceObject.required as string[]).includes('roleEstimate'), 'roleEstimate is optional');
  assert.deepEqual(
    (defs.slideRecovery?.required as string[] | undefined) ?? [],
    ['assetRef'],
    'a recovery option is nothing without its picture',
  );
  assert.deepEqual(Object.keys((defs.slideOcr?.properties as Json | undefined) ?? {}).sort(), ['model', 'state'], 'the slide OCR state holds a state and a model, and no clock reading');

  const ajv = compiledAjv();
  assert.ok(validatorFor(ajv, 'source')(flattenedSample()), 'a flattened slide with all three fields validates');
  for (const state of rebrand.OCR_STATES) {
    const doc = flattenedSample((slide) => {
      slide.ocr = state === 'not-run' || state === 'unavailable' ? { state } : { state, model: 'ppocr-v5-mobile' };
    });
    assert.ok(validatorFor(ajv, 'source')(doc), `slide OCR state ${state} validates`);
  }
});

test('the flattened fields refuse what they cannot mean', () => {
  const ajv = compiledAjv();
  const cases: Array<[string, (slide: Json, text: Json) => void]> = [
    ['a slide OCR pass that never ran cannot name the model that ran it', (slide) => { slide.ocr = { state: 'not-run', model: 'ppocr-v5-mobile' }; }],
    ['a host with no OCR names no model either', (slide) => { slide.ocr = { state: 'unavailable', model: 'ppocr-v5-mobile' }; }],
    ['an empty model name', (slide) => { slide.ocr = { state: 'text-found', model: '' }; }],
    ['the slide OCR state records no time, because the contract holds no clock readings', (slide) => { slide.ocr = { state: 'text-found', ranAt: '2026-09-24T10:00:00Z' }; }],
    ['recognised lines live on the region objects, not on the slide', (slide) => {
      slide.ocr = { state: 'text-found', lines: [{ text: 'Revenue', confidence: 0.9, box: { x: 0, y: 0, w: 10, h: 10, rot: 0 } }] };
    }],
    ['an OCR state outside OCR_STATES', (slide) => { slide.ocr = { state: 'partly-run' }; }],
    ['a recovery option with no picture', (slide) => { slide.recovery = { fromObjectId: 'ppt/slides/slide1.xml.7' }; }],
    ['a recovery picture that cannot travel', (slide) => { slide.recovery = { assetRef: 'blob:https://lolly.tools/9f0c-4a1e' }; }],
    ['an unknown key on the recovery option', (slide) => { slide.recovery = { assetRef: 'user/media/x', fidelity: 'raster-preserved' }; }],
    ['a role estimate outside SOURCE_ROLE_ESTIMATES', (_slide, text) => { text.roleEstimate = 'subtitle'; }],
  ];
  for (const [what, edit] of cases) {
    assert.ok(refuses(ajv, 'source', flattenedSample(edit)), `the source schema should refuse ${what}`);
  }
  // What the type refuses, the schema refuses too.
  for (const ocr of SLIDE_OCR_REFUSED_BY_TYPE) {
    assert.ok(refuses(ajv, 'source', flattenedSample((slide) => { slide.ocr = { ...ocr }; })), `the source schema should refuse ${JSON.stringify(ocr)}`);
  }
});

// ─── the Design wire contract the compiled deck writes into ──────────────────

test('every Design box row in the compiled sample uses field ids design:boxes declares', () => {
  const wire = readJson('schemas/blocks-wire-order.json');
  const fieldIds = ((wire.inputs as Record<string, string[]>)['design:boxes'] ?? []);
  assert.ok(fieldIds.length > 0, 'schemas/blocks-wire-order.json has no design:boxes field order');
  const declared = new Set(fieldIds);

  const tool = readJson('community/design/tool.json');
  const boxes = (tool.inputs as Json[]).find((input) => input.id === 'boxes');
  assert.ok(boxes, 'the design tool has no boxes input');
  const kindField = (boxes.fields as Json[]).find((field) => field.id === 'kind');
  assert.ok(kindField, 'the design tool boxes input has no kind field');
  const kinds = new Set((kindField.options as Json[]).map((option) => option.value as string));

  const compiled = sampleOf('compiled');
  const rows: Array<{ where: string; row: Json }> = [];
  for (const frame of compiled.frames as Json[]) {
    for (const layer of frame.layers as Json[]) rows.push({ where: `frame ${String(frame.id)}`, row: layer });
  }
  for (const entry of compiled.tray as Json[]) rows.push({ where: `tray entry ${String(entry.sourceObjectId)}`, row: entry.layer as Json });

  assert.ok(rows.length > 0, 'the compiled sample carries no Design box rows to check');
  for (const { where, row } of rows) {
    for (const key of Object.keys(row)) {
      assert.ok(declared.has(key), `${where} writes "${key}", which design:boxes does not declare; the field order is a frozen positional URL contract, so a row with an invented key never decodes`);
    }
    assert.ok(kinds.has(row.kind as string), `${where} writes kind "${String(row.kind)}", which the design tool cannot render`);
  }
});

// ─── plan 275: append-only fields ────────────────────────────────────────────

/**
 * Every plan 275 field typed against the module, so a rename on either side fails:
 * the TypeScript at typecheck, the schema in the tests below.
 */
const RUN_275: Required<Pick<SourceRunV1, 'underlineStyle' | 'strike' | 'baseline' | 'case'>> = {
  underlineStyle: 'dbl',
  strike: true,
  baseline: 'super',
  case: 'small-caps',
};
const PARA_275: Required<Pick<SourceParaV1, 'bulletChar' | 'numberStyle' | 'numberStart' | 'spaceBeforePt' | 'spaceAfterPt' | 'lineSpacingPct' | 'indentPx' | 'firstIndentPx' | 'bullet' | 'align' | 'lvl'>> = {
  bullet: 'number',
  bulletChar: '•',
  numberStyle: 'arabicPeriod',
  numberStart: 3,
  spaceBeforePt: 12,
  spaceAfterPt: 6,
  lineSpacingPct: 150,
  indentPx: 36,
  firstIndentPx: -18,
  align: 'justify',
  lvl: 1,
};
const LAYOUT_NAME: NonNullable<SlideSourceV1['origin']['layoutName']> = 'Title and Content';
const UNITS: Required<Pick<LayoutFeaturesV1, 'units' | 'containers'>> = {
  units: [
    { id: 'ppt/slides/slide1.xml.4', kind: 'text', box: { x: 0.05, y: 0.3, w: 0.28, h: 0.5 }, words: 24, maxPt: 18 },
    { id: 'ppt/slides/slide1.xml.9', kind: 'card', box: { x: 0.36, y: 0.3, w: 0.28, h: 0.5 }, words: 30, maxPt: 18, members: ['ppt/slides/slide1.xml.10'] },
  ],
  containers: [{ id: 'ppt/slides/slide1.xml.9', kind: 'shape', box: { x: 0.36, y: 0.3, w: 0.28, h: 0.5 }, words: 0, maxPt: 0 }],
};
const REASON: ReviewMessageV1 = { code: 'layout.row', params: { count: 3, spread: 0.09 }, text: 'Three text boxes side by side, about the same width and lined up.' };
const SLIDE_275: Required<Pick<SlidePlanV1, 'layoutReasons' | 'layoutMatch' | 'ground'>> & { layout: ArchetypeRefV1; layoutAlternative: ArchetypeRefV1 } = {
  layout: 'columns-3',
  layoutAlternative: 'content',
  layoutReasons: [REASON],
  layoutMatch: { structure: 'columns-3', confidence: 0.94, coverage: 1, band: 'clear', signature: 'row:3|pic:none' },
  ground: 'dark',
};
const BY_GROUND: NonNullable<ColorMappingV1['byGround']> = { dark: { to: '#f5f5f5', toPath: 'color.semantic.surface' } };
const THEME: DeckThemeV1 = { id: 'dark', mode: 'dark', remap: [{ from: 'color.semantic.surface', to: 'color.semantic.text' }], flipDark: true };
const TOUCHED: PlanRowsTouchedV1 = { slideIds: ['s1'], useIds: ['u1'], theme: true };
const PRESET: RenovationPresetV1 = {
  id: 'library',
  layout: { bySourceLayout: { 'ppt/slideLayouts/slideLayout2.xml': 'two-column' }, bySourceLayoutName: { 'Three Column': 'columns-3' }, byStructure: { 'row:3|pic:none': 'columns-3' }, fallback: 'title-body' },
};

// The engine re-exports the two moved types unchanged: each direction assigns.
const ENGINE_PRESET: EnginePresetV1 = PRESET;
const CORE_REVIEW: ReviewMessageV1 = REASON satisfies EngineReviewMessageV1;

/** The first paragraph of the first text object on the first slide of a source document. */
function firstPara(doc: Json): Json {
  const slide = (doc.slides as Json[])[0];
  assert.ok(slide);
  const text = (slide.objects as Json[]).find((o) => o.kind === 'text');
  assert.ok(text, 'the first sample slide holds a text object');
  const para = ((text.text as Json).paras as Json[])[0];
  assert.ok(para);
  return para;
}

/** The first run of that paragraph. */
function firstRun(doc: Json): Json {
  const run = (firstPara(doc).runs as Json[])[0];
  assert.ok(run);
  return run;
}

/** A sample with the plan 275 fields written onto it. */
function with275(name: DocumentName): Json {
  const doc = sampleOf(name);
  if (name === 'source') {
    const slide = (doc.slides as Json[])[0];
    assert.ok(slide);
    (slide.origin as Json).layoutName = LAYOUT_NAME;
    Object.assign(firstPara(doc), structuredClone(PARA_275));
    Object.assign(firstRun(doc), structuredClone(RUN_275));
  }
  if (name === 'census') {
    const layout = (doc.layouts as Json[])[0];
    assert.ok(layout);
    Object.assign(layout, structuredClone(UNITS));
  }
  if (name === 'plan') {
    const slide = (doc.slides as Json[])[0];
    assert.ok(slide);
    Object.assign(slide, structuredClone(SLIDE_275));
    const colour = (doc.colors as Json[])[0];
    assert.ok(colour);
    colour.byGround = structuredClone(BY_GROUND);
    (doc.designSystem as Json).theme = structuredClone(THEME);
  }
  if (name === 'compiled') {
    const frame = (doc.frames as Json[])[0];
    assert.ok(frame);
    frame.archetype = 'columns-3';
    (doc.designSystem as Json).theme = structuredClone(THEME);
  }
  if (name === 'report') {
    const entries = doc.entries as Json[];
    entries.push({ code: 'text.formatting-not-carried', message: 'Per-run size and a link were not carried.', slideId: 's1' });
    entries.push({ code: 'layout.poured-to-continuation', message: 'Five boxes poured into Four boxes; the fifth continues on slide 12.', slideId: 's1' });
  }
  if (name === 'project') (doc.designSystem as Json).theme = structuredClone(THEME);
  return doc;
}

test('plan 275: every document validates with its new fields written', () => {
  const ajv = compiledAjv();
  for (const name of DOCUMENTS) assert.ok(validatorFor(ajv, name)(with275(name)), `${name} with the plan 275 fields validates`);
});

test('plan 275: every new field is optional, so a file written before it still reads', () => {
  const optional: Array<[DocumentName, string, string[]]> = [
    ['source', 'sourceRun', ['underlineStyle', 'strike', 'baseline', 'case']],
    ['source', 'sourcePara', ['bulletChar', 'numberStyle', 'numberStart', 'spaceBeforePt', 'spaceAfterPt', 'lineSpacingPct', 'indentPx', 'firstIndentPx']],
    ['census', 'layoutFeatures', ['units', 'containers']],
    ['plan', 'slidePlan', ['layoutReasons', 'layoutMatch', 'ground']],
    ['plan', 'colorMapping', ['byGround']],
    ['plan', 'designSystemSnapshot', ['theme']],
  ];
  for (const [doc, def, keys] of optional) {
    const node = defsOf(doc)[def];
    assert.ok(node, `${doc} $defs/${def}`);
    const props = node.properties as Record<string, Json>;
    const required = (node.required as string[] | undefined) ?? [];
    for (const key of keys) {
      assert.ok(props[key], `${doc} $defs/${def} declares ${key}`);
      assert.ok(!required.includes(key), `${doc} $defs/${def}.${key} is optional`);
    }
  }
  const slideSource = defsOf('source').slideSource;
  assert.ok(slideSource);
  const origin = (slideSource.properties as Record<string, Json>).origin;
  assert.ok(origin);
  assert.ok((origin.properties as Record<string, Json>).layoutName, 'origin.layoutName is declared');
  assert.ok(!((origin.required as string[] | undefined) ?? []).includes('layoutName'));
  // A plan written before plan 275 still validates, which is the sample as it stands.
  const ajv = compiledAjv();
  for (const name of DOCUMENTS) assert.ok(validatorFor(ajv, name)(sampleOf(name)), `${name} from before plan 275 validates`);
});

test('plan 275: the new fields refuse what they cannot mean', () => {
  const ajv = compiledAjv();
  const cases: Array<[DocumentName, string, (doc: Json) => void]> = [
    ['plan', 'a layout id with capitals and a space', (doc) => { ((doc.slides as Json[])[0] as Json).layout = 'Three Boxes'; }],
    ['plan', 'a layout id past 41 characters', (doc) => { ((doc.slides as Json[])[0] as Json).layout = `a${'b'.repeat(41)}`; }],
    ['plan', 'a confidence over 1', (doc) => { (((doc.slides as Json[])[0] as Json).layoutMatch as Json).confidence = 1.5; }],
    ['plan', 'a band outside LAYOUT_MATCH_BANDS', (doc) => { (((doc.slides as Json[])[0] as Json).layoutMatch as Json).band = 'maybe'; }],
    ['plan', 'a ground outside SLIDE_GROUNDS', (doc) => { ((doc.slides as Json[])[0] as Json).ground = 'grey'; }],
    ['plan', 'a reason with no text', (doc) => { ((doc.slides as Json[])[0] as Json).layoutReasons = [{ code: 'layout.row', params: {} }]; }],
    ['plan', 'a reason parameter that is not a string or a number', (doc) => { ((doc.slides as Json[])[0] as Json).layoutReasons = [{ code: 'layout.row', params: { widths: [0.3] }, text: 'Three boxes.' }]; }],
    ['plan', 'a light target in byGround, which is the deck target itself', (doc) => { ((doc.colors as Json[])[0] as Json).byGround = { light: { to: '#ffffff' } }; }],
    ['plan', 'a theme outside DECK_THEME_IDS', (doc) => { (doc.designSystem as Json).theme = { id: 'sepia', remap: [] }; }],
    ['plan', 'a theme with no remap list', (doc) => { (doc.designSystem as Json).theme = { id: 'dark' }; }],
    ['compiled', 'a frame archetype with capitals', (doc) => { ((doc.frames as Json[])[0] as Json).archetype = 'Columns-3'; }],
    ['census', 'a unit kind outside LAYOUT_UNIT_KINDS', (doc) => { (((doc.layouts as Json[])[0] as Json).units as Json[]).push({ id: 'x', kind: 'blob', box: { x: 0, y: 0, w: 0.1, h: 0.1 }, words: 0, maxPt: 0 }); }],
    ['census', 'a unit box outside the slide', (doc) => { (((doc.layouts as Json[])[0] as Json).units as Json[]).push({ id: 'x', kind: 'text', box: { x: 0, y: 0, w: 1.4, h: 0.1 }, words: 0, maxPt: 0 }); }],
    ['source', 'a baseline other than super or sub', (doc) => { firstRun(doc).baseline = 'up'; }],
    ['source', 'a letter case other than upper or small-caps', (doc) => { firstRun(doc).case = 'title'; }],
    ['source', 'an empty bullet glyph', (doc) => { firstPara(doc).bulletChar = ''; }],
    ['source', 'a line spacing of zero', (doc) => { firstPara(doc).lineSpacingPct = 0; }],
    ['report', 'a report code still outside REPORT_CODES', (doc) => { ((doc.entries as Json[])[0] as Json).code = 'text.formatting-lost'; }],
  ];
  for (const [name, what, edit] of cases) {
    const doc = with275(name);
    edit(doc);
    assert.ok(refuses(ajv, name, doc), `the ${name} schema should refuse ${what}`);
  }
});

test('plan 275: the twelve keep a name, and every one is written the way an open id is', () => {
  assert.deepEqual([...rebrand.KNOWN_ARCHETYPE_IDS], [...rebrand.ARCHETYPE_IDS]);
  for (const id of rebrand.KNOWN_ARCHETYPE_IDS) {
    assert.ok(rebrand.STRUCTURE_ID_PATTERN.test(id), `${id} matches STRUCTURE_ID_PATTERN`);
    assert.ok(rebrand.isArchetypeRef(id) && rebrand.isKnownArchetypeId(id));
  }
  for (const id of ['columns-3', 'grid-2x2', 'full-image-plain', 'title-only']) {
    assert.ok(rebrand.isArchetypeRef(id), `${id} is an archetype ref`);
    assert.equal(rebrand.isKnownArchetypeId(id), false, `${id} is not one of the twelve`);
  }
  for (const bad of ['', 'x', 'Columns-3', '3-columns', 'columns 3', 'columns_3', `a${'b'.repeat(41)}`, 7, null]) {
    assert.equal(rebrand.isArchetypeRef(bad), false, `${JSON.stringify(bad)} is refused`);
  }
  // One pattern in the module and in every schema that holds an archetype or structure id.
  const pattern = rebrand.STRUCTURE_ID_PATTERN.source;
  for (const [doc, def] of [['plan', 'archetypeRef'], ['plan', 'structureId'], ['compiled', 'archetypeRef']] as const) {
    assert.equal(defsOf(doc)[def]?.pattern, pattern, `${doc} $defs/${def} carries STRUCTURE_ID_PATTERN`);
  }
  const master = readJson('schemas/slide-master-v1.schema.json').$defs as Record<string, Json>;
  assert.equal(master.archetypeId?.pattern, pattern);
  assert.equal(master.structureId?.pattern, pattern);
  assert.deepEqual(master.knownArchetypeId?.enum, [...rebrand.KNOWN_ARCHETYPE_IDS]);
});

test('plan 275: a build from before the open ids refuses a newer plan with its own message, never misreads it', () => {
  // The plan schema as it stood before plan 275 held its layouts in the closed enum.
  // Rebuilding that form from today's schema pins the forward-compatibility policy:
  // the older check refuses a library id, and a plan of the twelve passes both.
  const older = structuredClone(schemaOf('plan'));
  const slide = ((older.$defs as Record<string, Json>).slidePlan?.properties ?? {}) as Record<string, Json>;
  slide.layout = { $ref: '#/$defs/archetypeId' };
  slide.layoutAlternative = { $ref: '#/$defs/archetypeId' };
  delete slide.layoutReasons;
  delete slide.layoutMatch;
  delete slide.ground;
  older.$id = 'https://lolly.tools/schemas/rebrand-plan-v1-before-275.schema.json';
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateOlder = ajv.compile(older);
  assert.ok(validateOlder(sampleOf('plan')), 'a plan of the twelve reads in the older build');
  const newer = sampleOf('plan');
  ((newer.slides as Json[])[0] as Json).layout = 'columns-3';
  assert.equal(validateOlder(newer), false, 'the older build refuses a library id');
  assert.ok((validateOlder.errors ?? []).some((e) => e.keyword === 'enum'), 'with its own "must be equal to one of the allowed values" message');
  assert.ok(validatorFor(compiledAjv(), 'plan')(newer), 'the current build reads it');
});

test('plan 275: the report codes are appended, never inserted', () => {
  const tail = [
    'text.formatting-not-carried', 'layout.poured-to-continuation', 'layout.auto-matched', 'text.corrected',
    'vector.items-omitted', 'vector.kept-as-picture', 'vector.metafile-not-converted', 'slide.original-arrangement', 'slide.kept-as-picture',
  ];
  assert.deepEqual(rebrand.REPORT_CODES.slice(-tail.length), tail, 'each wave appends after the last');
  assert.equal(rebrand.REPORT_CODES.indexOf('export.not-verified'), rebrand.REPORT_CODES.length - tail.length - 1, 'the codes before them keep their places');
});

test('plan 275: a corrected text and an auto-matched layout are appended fields', () => {
  const plan = sampleOf('plan');
  const slide = (plan.slides as Json[])[0] as Json;
  slide.layoutSource = 'auto';
  ((slide.objects as Json[])[0] as Json).textOverride = 'Corrected text';
  assert.ok(validatorFor(compiledAjv(), 'plan')(plan), 'the plan schema reads both');
});

test('plan 275: vector items and slide arrangements are appended fields', () => {
  const deck = sampleOf('source');
  const object = (((deck.slides as Json[])[0] as Json).objects as Json[])[0] as Json;
  const items: VectorItemsV1 = {
    version: 1,
    viewBox: { x: 0, y: 0, w: 400, h: 200 },
    items: [
      { kind: 'path', d: 'M0 0L10 0L10 10L0 10Z', box: { x: 0, y: 0, w: 10, h: 10 }, shape: 'rect', rx: 2, fill: { hex: '#30ba78' }, series: 'Yes', groups: ['bars'] },
      { kind: 'path', d: 'M0 0L0 100', box: { x: 0, y: 0, w: 0, h: 100 }, shape: 'line', fill: { none: true }, stroke: { color: { hex: '#000000' }, width: 1, opacity: 0.1, cap: 'butt', join: 'miter', dash: [4, 2] } },
      { kind: 'text', text: 'Yes', x: 20, y: 30, anchor: 'middle', size: 12, font: 'SUSE', bold: true, fill: { hex: '#0c322c' }, opacity: 0.8 },
    ],
    omitted: [{ reason: 'unsupported-paint', count: 1 }],
    title: 'bar chart',
    desc: 'Source: a survey, CDLA-Permissive-2.0',
  };
  object.vectorItems = items;
  (deck.warnings as Json[]).push({ code: 'metafile-not-converted', message: 'An EMF picture stayed a picture.' });
  assert.ok(validatorFor(compiledAjv(), 'source')(deck), 'the source schema reads vector items and the new warning');

  object.vectorItems = { ...items, omitted: [{ reason: 'invisible', count: 1 }] };
  assert.equal(compiledAjv().getSchema(schemaId('source'))!(deck), false, 'an invisible item is dropped without a record, so it is not a reason');

  const plan = sampleOf('plan');
  const slides = plan.slides as Json[];
  (slides[0] as Json).arrangement = 'picture';
  if (slides[1]) (slides[1] as Json).arrangement = 'original';
  assert.ok(validatorFor(compiledAjv(), 'plan')(plan), 'the plan schema reads an arrangement');
  assert.ok(VECTOR_ITEMS_MAX >= 400 && VECTOR_DECK_ITEMS_MAX > VECTOR_ITEMS_MAX, 'the per-object bound fits inside the per-deck budget');
});

test('plan 275: the moved types and the touched rows are the contract the engine uses', () => {
  assert.equal(ENGINE_PRESET.layout?.byStructure?.['row:3|pic:none'], 'columns-3');
  assert.equal(CORE_REVIEW.text.includes('%'), false, 'a reason sentence carries no measured number');
  assert.equal(TOUCHED.theme, true);
});

// ─── plan 275: the slide master contract and the validate:catalog rules ──────

const MASTER_SCHEMA = readJson('schemas/slide-master-v1.schema.json');
const PACK_MASTERS = [
  'brands/lolly-start/catalog/assets/lolly/slides/masters.json',
  'brands/suse/catalog/assets/suse/slides/masters.json',
].filter((rel) => {
  try {
    readFileSync(join(ROOT, rel));
    return true;
  } catch {
    return false;
  }
});

/** A master archetype carrying every plan 275 field, typed against the module. */
const LIBRARY_ARCHETYPE: ArchetypeV1 = {
  id: 'columns-3',
  name: 'Three boxes',
  structure: 'columns-3',
  section: 'boxes',
  repeat: { count: 3, across: 3, cell: ['label:0.2', 'body:0.8'], cellCols: [0, 12], fit: 'cover', inset: 0.1, rule: { y: 0.36, h: 0.004 } },
  variants: { dark: 'columns-3' },
  variantOf: 'columns-3',
  placeholders: [
    { role: 'title', box: { x: 0.05, y: 0.06, w: 0.9, h: 0.14 }, kind: 'text', style: { weight: '700' } },
    ...[0, 1, 2].flatMap((index): PlaceholderLayerV1[] => [
      { role: 'label', box: { x: 0.05 + index * 0.31, y: 0.24, w: 0.28, h: 0.12 }, kind: 'text', style: { weight: '700' }, group: `cell-${index}`, index, optional: true },
      { role: 'body', box: { x: 0.05 + index * 0.31, y: 0.37, w: 0.28, h: 0.5 }, kind: 'text', style: { weight: '400' }, group: `cell-${index}`, index },
    ]),
  ],
};

function masterFile(rel: string): SlideMasterFileV1 {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as SlideMasterFileV1;
}

test('plan 275: both pack masters validate against the widened slide master schema', () => {
  assert.ok(PACK_MASTERS.length >= 1, 'at least the lolly-start master is on disk');
  const validate = new Ajv({ allErrors: true, strict: false }).compile(MASTER_SCHEMA);
  for (const rel of PACK_MASTERS) assert.ok(validate(masterFile(rel)), `${rel}: ${JSON.stringify(validate.errors)}`);
});

test('plan 275: a master with library archetypes and every new field validates, and a malformed one is refused', () => {
  const validate = new Ajv({ allErrors: true, strict: false }).compile(MASTER_SCHEMA);
  const base = masterFile('brands/lolly-start/catalog/assets/lolly/slides/masters.json');
  const file: SlideMasterFileV1 = { ...structuredClone(base), library: { id: 'lolly/slide-structures', version: '1' } };
  const first = file.masters[0];
  assert.ok(first);
  first.archetypes.push(structuredClone(LIBRARY_ARCHETYPE));
  // Room for 128: the built master already carries the library's first structures and their dark variants.
  for (let i = first.archetypes.length; i < 128; i++) first.archetypes.push({ ...structuredClone(LIBRARY_ARCHETYPE), id: `generated-${i}`, variants: {} });
  assert.ok(validate(file), JSON.stringify(validate.errors));
  const masterDef = (MASTER_SCHEMA.$defs as Record<string, Json>).master;
  assert.ok(masterDef);
  assert.equal((masterDef.properties as Record<string, Json>).archetypes?.maxItems, 128);

  const refused: Array<[string, (a: Json) => void]> = [
    ['an archetype id with capitals', (a) => { a.id = 'Columns-3'; }],
    ['a structure id with a space', (a) => { a.structure = 'columns 3'; }],
    ['a repeat cell with an unknown role', (a) => { (a.repeat as Json).cell = ['heading:0.2', 'body:0.8']; }],
    ['a repeat cell share over 1', (a) => { (a.repeat as Json).cell = ['label:1.2']; }],
    ['a repeat cell share of 0', (a) => { (a.repeat as Json).cell = ['label:0', 'body:1']; }],
    ['a repeat cell share of 0.0', (a) => { (a.repeat as Json).cell = ['body:0.0']; }],
    ['a variantOf id with capitals', (a) => { a.variantOf = 'Columns-3'; }],
    ['a grid span of three numbers', (a) => { (a.repeat as Json).cellCols = [0, 6, 1]; }],
    ['a group id with capitals', (a) => { ((a.placeholders as Json[])[1] as Json).group = 'Cell-0'; }],
    ['a negative index', (a) => { ((a.placeholders as Json[])[1] as Json).index = -1; }],
    ['an unknown variant', (a) => { a.variants = { light: 'content' }; }],
  ];
  for (const [what, edit] of refused) {
    const bad = structuredClone(file);
    const archetype = bad.masters[0]?.archetypes.find((a) => a.id === 'columns-3');
    assert.ok(archetype);
    edit(archetype as unknown as Json);
    assert.equal(validate(bad), false, `the slide master schema should refuse ${what}`);
  }
  const tooMany = structuredClone(file);
  for (let i = 0; i < 40; i++) tooMany.masters[0]?.archetypes.push({ ...structuredClone(LIBRARY_ARCHETYPE), id: `more-${i}`, variants: {} });
  assert.equal(validate(tooMany), false, 'a master past 128 archetypes is refused');
});

test('plan 275: the master rules pass on both built masters, and refuse a hand-written one that leaves out a weight or an overlay', () => {
  for (const rel of PACK_MASTERS) {
    const built = masterFile(rel);
    assert.ok(built.library, `${rel} names the library the build expanded it from`);
    const found = slideMasterProblems(built as SlideMasterFileLike, rel, null);
    assert.deepEqual(found.errors, [], `${rel} passes`);
    assert.deepEqual(found.warnings, [], `${rel} states every weight and marks its overlays`);

    // The same master as a hand-written file from a third-party pack: no library, a
    // tuned body with no weight and the big-number caption unmarked. Both are errors,
    // because a pack nobody built is where a body would otherwise come out bold.
    const handWritten = structuredClone(built) as SlideMasterFileV1;
    delete handWritten.library;
    const master = handWritten.masters[0];
    assert.ok(master);
    const content = master.archetypes.find((a) => a.id === 'content');
    const body = content?.placeholders.find((ph) => ph.role === 'body');
    assert.ok(body?.style);
    delete body.style.weight;
    const caption = master.archetypes.find((a) => a.id === 'big-number')?.placeholders.find((ph) => ph.role === 'caption');
    assert.ok(caption);
    delete caption.overlay;
    const refused = slideMasterProblems(handWritten as SlideMasterFileLike, rel, null);
    assert.deepEqual(refused.warnings, [], `${rel}: nothing is left as a warning`);
    assert.ok(refused.errors.some((line) => /states? no weight/.test(line)), `${rel}: the missing weight is an error`);
    assert.ok(refused.errors.some((line) => /big-number number #1 and caption #2/.test(line)), `${rel}: the big-number overlap is an error`);
    assert.ok(refused.errors.every((line) => !/full-image /.test(line)), `${rel}: a caption over a full-bleed picture is allowed`);

    // A variant that names a base the master does not hold is refused too.
    const orphan = structuredClone(built) as SlideMasterFileV1;
    const variant = orphan.masters[0]?.archetypes.find((a) => a.variantOf !== undefined);
    assert.ok(variant, `${rel} marks its dark variants`);
    variant.variantOf = 'no-such-archetype';
    assert.ok(slideMasterProblems(orphan as SlideMasterFileLike, rel, null).errors.some((line) => /no-such-archetype/.test(line)));
  }
});

test('plan 275: a generated master fails on a missing weight, an unmarked overlap, an unknown structure or dark variant', () => {
  const rel = 'brands/lolly-start/catalog/assets/lolly/slides/masters.json';
  const built = masterFile(rel);
  assert.ok(built.library, 'the lolly-start master is a built file');
  // Undo what the build states on two archetypes: a weight and the big-number overlay.
  const generated = structuredClone(built);
  for (const archetype of generated.masters[0]?.archetypes ?? []) {
    for (const ph of archetype.placeholders) {
      if (archetype.id === 'content' && ph.role === 'body' && ph.style) delete ph.style.weight;
      if (archetype.id === 'big-number' && ph.role === 'caption') delete ph.overlay;
    }
  }
  const found = slideMasterProblems(generated as SlideMasterFileLike, rel, null);
  assert.ok(found.errors.some((line) => /states? no weight/.test(line)), 'the weight rule is an error for a generated file');
  assert.ok(found.errors.some((line) => /overlap/.test(line)), 'the overlap rule is an error for a generated file');

  // Stated weights and an overlay flag are what clears both.
  const fixed = structuredClone(generated) as SlideMasterFileV1;
  for (const master of fixed.masters) {
    for (const archetype of master.archetypes) {
      for (const ph of archetype.placeholders) {
        if (ph.kind !== 'image') ph.style = { ...(ph.style ?? {}), weight: ph.style?.weight ?? '400' };
        if (archetype.id === 'big-number' && ph.role === 'caption') ph.overlay = true;
      }
    }
  }
  assert.deepEqual(slideMasterProblems(fixed as SlideMasterFileLike, rel, null).errors, []);

  const withLibrary = structuredClone(fixed);
  const first = withLibrary.masters[0];
  assert.ok(first);
  first.archetypes.push({ ...structuredClone(LIBRARY_ARCHETYPE), structure: 'columns-9', variants: { dark: 'columns-9-dark' } });
  const library = libraryStructureIds({ structures: [{ id: 'columns-3' }, { id: 'title-body' }] });
  const errors = slideMasterProblems(withLibrary as SlideMasterFileLike, rel, library).errors;
  assert.ok(errors.some((line) => /structure "columns-9", which the layout library does not hold/.test(line)));
  assert.ok(errors.some((line) => /dark variant "columns-9-dark"/.test(line)));
  assert.equal(libraryStructureIds({ nope: [] }), null);
});
