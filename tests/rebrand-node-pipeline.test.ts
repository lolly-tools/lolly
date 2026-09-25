// SPDX-License-Identifier: MPL-2.0
/**
 * The node renovation pipeline (`packages/node-shell/src/rebrand/pipeline.ts` and
 * `design-system.ts`), the one path `lolly rebrand`, `scripts/rebrand-eval.ts` and
 * `tests/helpers/rebrand-pipeline.ts` share.
 *
 * The first case is the switch itself: before the helper moved onto this module it
 * ran the stages inline, and that inline run is written out again here, so the
 * pipeline is compared against it rather than against itself. The one intended
 * difference is the media ref, which is now the whole content hash rather than its
 * first sixteen characters, so both sides are compared with refs and the census
 * group ids built from them put into one spelling.
 *
 * Run with: node --test tests/rebrand-node-pipeline.test.ts
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { zipSync } from 'fflate';

import { censusDeck } from '../engine/src/deck-census.ts';
import { CENSUS_RULES } from '../engine/src/deck-census-rules.ts';
import { compileRenovated } from '../engine/src/deck-compile.ts';
import { PLAN_RULES, firstPass } from '../engine/src/rebrand-plan.ts';
import { resolveRebrandDesignSystem } from '../engine/src/rebrand-design-system.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { readZip } from '../engine/src/zip.ts';
import type { RenovationPlanV1, SourceDeckV1 } from '../packages/core/src/index.ts';
import { contentRoots, contentUrlFile, readAssetIndex } from '../packages/node-shell/src/content-roots.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';
import { inflatePptx } from '../packages/node-shell/src/pptx.ts';
import {
  RebrandPipelineError,
  buildDesignLolly,
  compileDeck,
  compiledDeckToPptx,
  designSessionFromCompiled,
  mediaRefFor,
  outcomeCounts,
  outcomeOf,
  planDeck,
  planSourceProblems,
  planProblems,
  readDeck,
  resolveProfileDesignSystem,
  sourceDeckFromPptx,
  sourceHashOf,
} from '../packages/node-shell/src/rebrand/index.ts';
import { readFixture, type SyntheticFixtureName } from './helpers/rebrand-fixtures.ts';
import {
  STARTER_COLORS,
  STARTER_DESIGN_SYSTEM,
  STARTER_MASTER,
  parsePipelineXml,
} from './helpers/rebrand-pipeline.ts';
import { readActiveDesignSystem } from '../shells/web/src/lib/rebrand/design-system.ts';

const DECKS: SyntheticFixtureName[] = ['simple.pptx', 'adversarial.pptx', 'palette.pptx'];
const INSTANCE = 'rebrand-pipeline';

// ─── the run the helper made before it moved onto the pipeline ───────────────

async function inlineRun(name: string, bytes: Uint8Array) {
  const parts = await inflatePptx(bytes);
  const deck = await sourceDeckFromPptx(parts, parsePipelineXml, {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    instanceId: INSTANCE,
    name,
    bytes: bytes.byteLength,
    sink: async (_media: Uint8Array, _mime: string, hint: string): Promise<string> => `user/media/${hint.slice(0, 16)}`,
    reader: { name: 'pptx-read', version: 'pipeline' },
  });
  const census = censusDeck(deck);
  const plan = firstPass({
    source: deck,
    census,
    designSystem: STARTER_DESIGN_SYSTEM.firstPass,
    algorithms: { reader: 'pptx-read/pipeline', census: CENSUS_RULES.version, plan: PLAN_RULES.version },
  });
  const compiled = compileRenovated({
    source: deck,
    census,
    plan,
    master: STARTER_MASTER,
    designSystem: STARTER_DESIGN_SYSTEM.compile,
    opts: { applyUnreviewed: false },
  });
  return { deck, census, plan, compiled };
}

/**
 * One spelling for both runs: a media ref cut to its first sixteen hex digits, each
 * census group id named by its sorted members, and the reader identity left out.
 */
function canonical(value: unknown, groupIds: Map<string, string>): unknown {
  let text = JSON.stringify(value);
  text = text.replace(/user\/media\/([0-9a-f]{16})[0-9a-f]*/g, 'user/media/$1');
  for (const [id, name] of groupIds) text = text.split(id).join(name);
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(node)) {
      if (key === 'reader') continue;
      out[key] = strip(inner);
    }
    return out;
  };
  const stripped = strip(parsed) as Record<string, unknown>;
  if (Array.isArray(stripped.groups)) {
    stripped.groups = [...(stripped.groups as Array<{ id: string }>)].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  return stripped;
}

function groupNames(census: { groups: Array<{ id: string; members: string[] }> }): Map<string, string> {
  return new Map(census.groups.map((group) => [group.id, `group[${[...group.members].sort().join(',')}]`]));
}

for (const name of DECKS) {
  test(`${name}: planDeck then compileDeck match the inline run the helper made before`, async () => {
    const bytes = readFixture(name);
    const before = await inlineRun(name, bytes);
    const planned = await planDeck({ bytes, name, parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM, instanceId: INSTANCE });
    const { compiled } = await compileDeck({ source: planned.source, census: planned.census, plan: planned.plan, system: STARTER_DESIGN_SYSTEM });

    const oldNames = groupNames(before.census);
    const newNames = groupNames(planned.census);
    assert.deepEqual(canonical(planned.source, newNames), canonical(before.deck, oldNames), 'the source deck');
    assert.deepEqual(canonical(planned.census, newNames), canonical(before.census, oldNames), 'the census');
    assert.deepEqual(canonical(planned.plan, newNames), canonical(before.plan, oldNames), 'the plan');
    assert.deepEqual(canonical(compiled, newNames), canonical(before.compiled, oldNames), 'the compiled deck');
  });
}

// ─── a pptx slide the reader marks flattened ─────────────────────────────────

/**
 * The simple deck with its second slide made one picture of the whole slide, so
 * the pptx reader marks it flattened. `xfrm` adds attributes to the picture's
 * placement (a turn), and `media` replaces the picture's bytes.
 */
async function flattenedPptx(opts: { xfrm?: string; media?: Uint8Array } = {}): Promise<Uint8Array> {
  const parts = await inflatePptx(readFixture('simple.pptx'));
  const xml = new TextDecoder().decode(parts['ppt/slides/slide2.xml']);
  const pic = `<p:pic><p:nvPicPr><p:cNvPr id="5" name="scan"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm${opts.xfrm ?? ''}><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  const start = xml.indexOf('<p:grpSpPr/>') + '<p:grpSpPr/>'.length;
  const end = xml.indexOf('</p:spTree>');
  assert.ok(start > 0 && end > start, 'the fixture slide has a shape tree');
  parts['ppt/slides/slide2.xml'] = new TextEncoder().encode(`${xml.slice(0, start)}${pic}${xml.slice(end)}`);
  if (opts.media) parts['ppt/media/image2_1.png'] = opts.media;
  return zipSync(parts);
}

/** A PNG header claiming `width` by `height`, with a few bytes of image data that are never read. */
function claimedPng(width: number, height: number): Uint8Array {
  const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (type: string, body: number[]): number[] => [...u32(body.length), ...Array.from(type, (ch) => ch.charCodeAt(0)), ...body, 0, 0, 0, 0];
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...u32(width), ...u32(height), 8, 6, 0, 0, 0]),
    ...chunk('IDAT', [0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]),
    ...chunk('IEND', []),
  ]);
}

test('a flattened pptx slide kept by default reads as the reader gave it, with only its OCR state added', async () => {
  // The web reader has no flattened handling yet, so the node source deck for
  // such a slide carries `ocr: { state: 'not-run' }` where the web's has none.
  // That one field is the intended difference, and nothing else moves.
  const bytes = await flattenedPptx();
  const before = await inlineRun('flattened.pptx', bytes);
  const flagged = before.deck.slides.filter((slide) => slide.origin.flattened === true);
  assert.deepEqual(flagged.map((slide) => slide.index), [1], 'the pptx reader marks the second slide flattened');
  const expected = { ...before.deck, slides: before.deck.slides.map((slide) => (slide.origin.flattened ? { ...slide, ocr: { state: 'not-run' as const } } : slide)) };

  const read = await readDeck({ bytes, name: 'flattened.pptx', parseXml: parsePipelineXml, instanceId: INSTANCE });
  assert.deepEqual(canonical(read.source, new Map()), canonical(expected, new Map()), 'the source deck');
  assert.equal(read.flattened.length, 1);
  assert.equal(read.flattened[0]?.outcome, 'kept');
  assert.equal(read.flattened[0]?.reason, 'asked');
  assert.deepEqual(read.read, { flattened: 'keep', ocr: false });
});

test('a turned whole-slide picture is not cut, and the kept slide carries no recovery picture and holds no crop', async () => {
  const bytes = await flattenedPptx({ xfrm: ' rot="600000"' });
  const kept = await readDeck({ bytes, name: 'turned.pptx', parseXml: parsePipelineXml, instanceId: INSTANCE });
  const read = await readDeck({ bytes, name: 'turned.pptx', parseXml: parsePipelineXml, instanceId: INSTANCE, flattened: 'rebuild' });
  const report = read.flattened[0];
  assert.equal(report?.outcome, 'kept');
  assert.equal(report?.reason, 'not-cut');
  assert.equal(report?.recovery, undefined);
  const slide = read.source.slides.find((one) => one.id === report?.slideId);
  assert.ok(slide);
  assert.equal(slide.recovery, undefined, 'a kept slide has nothing to recover');
  assert.ok(slide.warnings.some((w) => /turned or mirrored/.test(w.message)));
  assert.deepEqual([...read.media.keys()].sort(), [...kept.media.keys()].sort(), 'nothing new is held');
});

test('a flattened picture whose header claims more than the pixel limit is kept as too-large without decoding it', async () => {
  const bytes = await flattenedPptx({ media: claimedPng(30_000, 30_000) });
  let decoded = 0;
  const read = await readDeck({
    bytes, name: 'claimed.pptx', parseXml: parsePipelineXml, flattened: 'rebuild',
    decodePicture: async () => {
      decoded++;
      return null;
    },
  });
  assert.equal(decoded, 0, 'the decoder is never called');
  assert.equal(read.flattened[0]?.outcome, 'kept');
  assert.equal(read.flattened[0]?.reason, 'too-large');
});

test('a pptx read stops between slides when its signal is aborted', async () => {
  const controller = new AbortController();
  const stop = new Error('stopped by the test');
  const parseXml = (xml: string): Document => {
    controller.abort(stop);
    return parsePipelineXml(xml);
  };
  await assert.rejects(
    readDeck({ bytes: readFixture('simple.pptx'), name: 'simple.pptx', parseXml, signal: controller.signal }),
    (err: unknown) => err === stop,
  );
});

// ─── media refs ──────────────────────────────────────────────────────────────

test('media refs are the content hash, the same on every run', async () => {
  const bytes = readFixture('simple.pptx');
  const one = await readDeck({ bytes, name: 'simple.pptx', parseXml: parsePipelineXml });
  const two = await readDeck({ bytes, name: 'simple.pptx', parseXml: parsePipelineXml });
  assert.ok(one.media.size > 0, 'the simple deck holds pictures');
  assert.deepEqual([...one.media.keys()], [...two.media.keys()]);
  for (const [ref, held] of one.media) {
    assert.equal(ref, mediaRefFor(createHash('sha256').update(held.bytes).digest('hex')));
  }
  const refsOf = (deck: SourceDeckV1): string[] => deck.slides.flatMap((slide) => slide.objects).flatMap((object) => (object.media ? [object.media] : []));
  assert.deepEqual(refsOf(one.source), refsOf(two.source));
  for (const ref of refsOf(one.source)) assert.ok(one.media.has(ref), `${ref} is held`);
  assert.notEqual(one.source.source.instanceId, two.source.source.instanceId, 'two imports of one file are two instances');
});

test('a PDF is read, and an unreadable file and an encrypted package fail with their codes', async () => {
  const pdf = readFixture('flattened.pdf');
  const codeOf = async (bytes: Uint8Array): Promise<string> => {
    try {
      await readDeck({ bytes, name: 'x', parseXml: parsePipelineXml });
    } catch (err) {
      assert.ok(err instanceof RebrandPipelineError);
      return err.code;
    }
    return 'no error';
  };
  assert.equal(await codeOf(pdf), 'no error', 'a PDF reads through sourceDeckFromPdf (tests/rebrand-node-pdf.test.ts)');
  assert.equal(await codeOf(new TextEncoder().encode('not a deck')), 'source.unreadable');
  assert.equal(await codeOf(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])), 'source.encrypted');
});

// ─── answering the review ────────────────────────────────────────────────────

test('acceptSuggestions answers the unreviewed rows and leaves the rows flagged for a person, as the web does', async () => {
  const bytes = readFixture('adversarial.pptx');
  const planned = await planDeck({ bytes, name: 'adversarial.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  const rows = planned.plan.slides.flatMap((slide) => slide.objects);
  const open = rows.filter((row) => row.decision === undefined && row.locked !== true && row.review === 'unreviewed');
  const flagged = rows.filter((row) => row.review === 'needs-attention');
  assert.ok(flagged.length > 0, 'the adversarial deck has rows flagged for a person');

  const result = await compileDeck({ ...planned, acceptSuggestions: true });
  assert.deepEqual(result.appliedUnreviewed.map((one) => one.id).sort(), open.map((row) => row.id).sort());
  const counts = outcomeCounts(result.plan, result.compiled);
  assert.equal(counts.pending, 0);
  assert.equal(counts.attention, flagged.length, 'a flagged row stays flagged');
  assert.equal(outcomeOf(result.plan, result.compiled), 'needs-review');
  const moved = result.appliedUnreviewed.length > 0 ? 1 : 0;
  assert.equal(result.plan.revision, planned.plan.revision + moved, 'the revision moves only when a row was answered');
  assert.deepEqual(await compileDeck({ ...planned, acceptSuggestions: 'unreviewed' }).then((one) => one.appliedUnreviewed), result.appliedUnreviewed);
});

test('acceptSuggestions all answers every open row and the report names each one unreviewed', async () => {
  const bytes = readFixture('adversarial.pptx');
  const planned = await planDeck({ bytes, name: 'adversarial.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  const before = new Map(planned.plan.slides.flatMap((slide) => slide.objects).map((row) => [row.id, row]));
  const open = [...before.values()].filter((row) => row.decision === undefined && row.locked !== true
    && (row.review === 'unreviewed' || row.review === 'needs-attention'));
  assert.ok(open.some((row) => row.review === 'needs-attention'), 'the adversarial deck has rows flagged for a person');

  const result = await compileDeck({ ...planned, acceptSuggestions: 'all' });
  assert.deepEqual(result.appliedUnreviewed.map((one) => one.id).sort(), open.map((row) => row.id).sort());
  for (const one of result.appliedUnreviewed) assert.equal(one.review, before.get(one.id)?.review);

  const marked = result.report.entries.filter((entry) => entry.code === 'review.applied-unreviewed');
  assert.deepEqual(marked.map((entry) => entry.objectId).sort(), open.map((row) => row.id).sort());
  for (const entry of marked) {
    const was = before.get(entry.objectId ?? '')?.review;
    assert.equal(entry.review, was === 'needs-attention' ? 'needs-attention' : 'unreviewed');
  }
  assert.equal(result.report.counts.appliedUnreviewed, open.length);

  const after = result.plan.slides.flatMap((slide) => slide.objects);
  for (const row of after) {
    if (open.some((one) => one.id === row.id)) assert.equal(row.decision, row.proposal, `${row.id} decided as proposed`);
  }
  const counts = outcomeCounts(result.plan, result.compiled);
  assert.equal(counts.pending, 0);
  assert.equal(counts.attention, 0);
  assert.equal(result.plan.revision, planned.plan.revision + 1, 'an answered plan is the next revision');
  assert.equal(result.compiled.planRevision, result.plan.revision, 'the document names the answered revision');
});

test('without acceptSuggestions nothing is answered and a first pass needs review', async () => {
  const bytes = readFixture('simple.pptx');
  const planned = await planDeck({ bytes, name: 'simple.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  const result = await compileDeck(planned);
  assert.deepEqual(result.appliedUnreviewed, []);
  assert.equal(result.report.entries.filter((entry) => entry.code === 'review.applied-unreviewed').length, 0);
  assert.equal(result.plan, planned.plan, 'the plan compiled is the plan passed in');
  assert.equal(outcomeOf(result.plan, result.compiled), 'needs-review');

  const answered = await compileDeck({ ...planned, acceptSuggestions: 'all' });
  const counts = outcomeCounts(answered.plan, answered.compiled);
  assert.equal(counts.tray, answered.compiled.tray.length);
  const expected = counts.unresolvedObjects === 0 && counts.unresolvedColours === 0 && counts.tray === 0 ? 'ready' : 'needs-review';
  assert.equal(outcomeOf(answered.plan, answered.compiled), expected);
});

test('a kept object in the tray keeps the deck from being ready', async () => {
  // Every kept object of the simple deck has a place on some layout, so the tray is
  // reached the one way it still is: a kept shape no layout holds. A person keeps
  // the repeated band on slide 1.
  const bytes = readFixture('simple.pptx');
  const planned = await planDeck({ bytes, name: 'simple.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  const plan = structuredClone(planned.plan);
  const band = plan.slides[0]?.objects.find((row) => row.class === 'decoration');
  assert.ok(band, 'the simple deck states a repeated band on slide 1');
  Object.assign(band, { decision: 'keep', author: 'user', review: 'accepted' });
  const answered = await compileDeck({ ...planned, plan, acceptSuggestions: 'all' });
  assert.deepEqual(answered.compiled.tray.map((item) => item.sourceObjectId), [band.id]);
  assert.equal(outcomeCounts(answered.plan, answered.compiled).tray, answered.compiled.tray.length);
  assert.equal(outcomeOf(answered.plan, answered.compiled), 'needs-review');
});

test('a plan that does not match the deck one to one is refused with plan.invalid', async () => {
  const planned = await planDeck({ bytes: readFixture('simple.pptx'), name: 'simple.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  assert.deepEqual(planSourceProblems(planned.plan, planned.source), []);
  const isInvalid = (err: unknown): boolean => err instanceof RebrandPipelineError && err.code === 'plan.invalid';

  const dropped = structuredClone(planned.plan);
  const lost = dropped.slides[1]?.objects.pop();
  assert.ok(lost);
  await assert.rejects(compileDeck({ ...planned, plan: dropped, acceptSuggestions: 'all' }), isInvalid);

  const bogus = structuredClone(planned.plan);
  const first = bogus.slides[0]?.objects[0];
  assert.ok(first);
  bogus.slides[0]?.objects.push({ ...first, id: 'no/such/object' });
  await assert.rejects(compileDeck({ ...planned, plan: bogus }), isInvalid);

  const doubled = structuredClone(planned.plan);
  const slide = doubled.slides[0];
  assert.ok(slide);
  doubled.slides.push(structuredClone(slide));
  await assert.rejects(compileDeck({ ...planned, plan: doubled }), isInvalid);
});

test('a plan for other bytes or another token pack is refused with its code', async () => {
  const simple = await planDeck({ bytes: readFixture('simple.pptx'), name: 'simple.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  const palette = await planDeck({ bytes: readFixture('palette.pptx'), name: 'palette.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  await assert.rejects(
    compileDeck({ source: simple.source, census: simple.census, plan: palette.plan, system: STARTER_DESIGN_SYSTEM }),
    (err: unknown) => err instanceof RebrandPipelineError && err.code === 'plan.hash-mismatch',
  );
  const otherPack: RenovationPlanV1 = { ...simple.plan, designSystem: { ...simple.plan.designSystem, tokenHash: 'sha256:other' } };
  await assert.rejects(
    compileDeck({ source: simple.source, census: simple.census, plan: otherPack, system: STARTER_DESIGN_SYSTEM }),
    (err: unknown) => err instanceof RebrandPipelineError && err.code === 'plan.design-system-mismatch',
  );
});

test('planProblems accepts a first-pass plan and names what is wrong with a broken one', async () => {
  const planned = await planDeck({ bytes: readFixture('simple.pptx'), name: 'simple.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  assert.deepEqual(await planProblems(JSON.parse(JSON.stringify(planned.plan))), []);
  assert.ok((await planProblems({ version: 1 })).length > 0);
  assert.ok((await planProblems('a plan')).length > 0);
  const badAction = structuredClone(planned.plan);
  const row = badAction.slides[0]?.objects[0];
  assert.ok(row);
  (row as { proposal: string }).proposal = 'shred';
  assert.ok((await planProblems(badAction)).length > 0, 'an action outside the vocabulary is refused');
});

// ─── the Design document ─────────────────────────────────────────────────────

test('the .lolly session reads back with its pictures carried and its refs rekeyable', async () => {
  const bytes = readFixture('adversarial.pptx');
  const planned = await planDeck({ bytes, name: 'adversarial.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  const { compiled } = await compileDeck(planned);
  const session = designSessionFromCompiled(compiled, { label: 'Adversarial', projectId: 'cli:test' });
  assert.ok(session.mediaRefs.length > 0, 'the adversarial compile keeps a picture on a frame');
  const lolly = await buildDesignLolly({ session, media: planned.media, name: 'adversarial', exportedAt: '2026-09-24T00:00:00.000Z' });
  assert.deepEqual(lolly.missingMedia, []);

  const read = readLollyFile(lolly.bytes);
  assert.equal(read.manifest.tool.id, 'design');
  assert.equal(read.session.__toolId, 'design');
  const boxes = read.session.boxes as Array<Record<string, unknown>>;
  const frameRows = compiled.frames.reduce((sum, frame) => sum + frame.layers.length, 0);
  assert.equal(boxes.length, frameRows, 'every compiled row is on the canvas');
  for (const ref of session.mediaRefs) {
    const row = boxes.find((box) => (box.image as { id?: string } | undefined)?.id === ref);
    assert.deepEqual(row?.image, { id: ref, source: 'user' });
    const entry = (read.manifest.assets ?? []).find((asset) => asset.id === ref);
    assert.ok(entry && typeof entry.path === 'string', `${ref} travels as bytes`);
    assert.deepEqual(read.files.get(entry.path as string), planned.media.get(ref)?.bytes);
  }
  const marker = read.session.__rebrandHandoff as { idsKept: boolean; report: { sourceHash: string }; lineage: unknown };
  assert.equal(marker.idsKept, true);
  assert.equal(marker.report.sourceHash, sourceHashOf(bytes));
  assert.ok(marker.lineage);
});

test('compiledDeckToPptx writes a PowerPoint package', async () => {
  const bytes = readFixture('simple.pptx');
  const planned = await planDeck({ bytes, name: 'simple.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM });
  const { compiled } = await compileDeck(planned);
  const pptx = await compiledDeckToPptx({ compiled, system: planned.system, media: planned.media, now: '2026-09-24T00:00:00.000Z' });
  const names = readZip(pptx.bytes).map((entry) => entry.name);
  assert.ok(names.includes('[Content_Types].xml'));
  assert.equal(names.filter((one) => /^ppt\/slides\/slide\d+\.xml$/.test(one)).length, compiled.frames.length);
});

// ─── the profile's design system ─────────────────────────────────────────────

test('resolveProfileDesignSystem reads the starter pack the way the harness states it', async () => {
  const resolved = await resolveProfileDesignSystem({ profile: 'lolly-start' });
  assert.ok(resolved);
  assert.equal(resolved.profile, 'lolly-start');
  assert.equal(resolved.neutralMaster, false);
  assert.equal(resolved.input.master.id, STARTER_MASTER.id);
  assert.deepEqual(resolved.input.colors, Object.fromEntries(STARTER_COLORS));
  assert.equal(resolved.system.snapshot.tokenHash, STARTER_DESIGN_SYSTEM.snapshot.tokenHash);
  assert.equal(resolved.input.id, 'shipped');
  // The web's logo rule: the light side's tags plus `mono` name no asset in this
  // pack, so only the dark side has a mono mark.
  assert.deepEqual(resolved.input.logos, { onLight: 'lolly/logo/primary', onDark: 'lolly/logo/reverse', monoOnDark: 'lolly/logo/mono-reverse' });
  assert.deepEqual(resolved.input.fonts, { brand: 'SUSE', mono: 'SUSE Mono' });
  assert.deepEqual(Object.keys(resolved.input.assetHashes ?? {}), ['lolly/slides/masters']);
  assert.match(resolved.input.assetHashes?.['lolly/slides/masters'] ?? '', /^sha256:[0-9a-f]{64}$/, 'the master file is pinned by the hash of its bytes');
});

/**
 * A web host over one profile's catalog on disk: `assets.query` answers the way the
 * web's asset store does (every tag present, deprecated left out, id order) and
 * `tokens.get` is the engine token set over the brand token file.
 */
function catalogHost(profile: string) {
  const roots = contentRoots({ profile });
  const assets = (readAssetIndex(roots).assets ?? []) as Array<{ id: string; type?: string; tags?: string[]; deprecated?: boolean; formats?: Array<{ url?: string }> }>;
  const urlOf = (id: string): string | undefined => assets.find((asset) => asset.id === id)?.formats?.[0]?.url;
  const fileOf = (url: string): string => {
    const file = contentUrlFile(url, roots);
    assert.ok(file, `${url} is on disk`);
    return file;
  };
  const tokenDoc = (): unknown => {
    const entry = assets.find((asset) => asset.type === 'tokens' && (asset.tags ?? []).includes('brand'));
    assert.ok(entry?.formats?.[0]?.url);
    return JSON.parse(readFileSync(fileOf(entry.formats[0].url), 'utf8'));
  };
  return {
    assets: {
      query: async (filter: { type?: string; tags?: string[] }) => assets
        .filter((asset) => asset.deprecated !== true && (!filter.type || asset.type === filter.type)
          && (filter.tags ?? []).every((tag) => (asset.tags ?? []).includes(tag)))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((asset) => ({ id: asset.id, url: urlOf(asset.id) })),
      get: async (id: string) => ({ id, url: urlOf(id) }),
      bytes: async (target: unknown) => new Uint8Array(readFileSync(fileOf(typeof target === 'string' ? target : String((target as { url?: string }).url)))),
    },
    tokens: {
      get: async (opts: { theme?: string } = {}) => createTokenSet(tokenDoc(), opts),
      themes: async () => createTokenSet(tokenDoc()).themes(),
    },
  };
}

for (const profile of ['lolly-start', 'suse']) {
  test(`the ${profile} design system resolves to the same snapshot here and on the web`, async (t) => {
    let host: ReturnType<typeof catalogHost>;
    try {
      host = catalogHost(profile);
    } catch {
      t.skip(`brands/${profile} is not checked out, so the ${profile} profile cannot be resolved here`);
      return;
    }
    const web = await readActiveDesignSystem(host);
    assert.ok(web);
    const cli = await resolveProfileDesignSystem({ profile });
    assert.ok(cli);
    // The two inputs differ only where a surface knows something the other cannot:
    // the display name, the families this device can draw, and the looks saved on it
    // (close-out CP12: the dark mode is read the same way on both).
    const { name: _webName, fonts: webFonts, ...webInput } = web.resolved.input;
    const webRest = Object.fromEntries(Object.entries(webInput).filter(([key]) => key !== 'looks'));
    const { name: _cliName, fonts: cliFonts, ...cliRest } = cli.input;
    assert.deepEqual(cliRest, webRest);
    const { available: _available, ...webFaces } = webFonts ?? {};
    assert.deepEqual(cliFonts, webFaces);
    const webSystem = await resolveRebrandDesignSystem({ ...web.resolved.input, fonts: cliFonts ?? {} });
    assert.deepEqual(cli.system.snapshot, webSystem.snapshot);
  });
}

test('a profile with no slide master gets the neutral master and says so', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-rebrand-profile-'));
  mkdirSync(join(root, 'tools'), { recursive: true });
  mkdirSync(join(root, 'cat', 'assets', 'x', 'tokens'), { recursive: true });
  writeFileSync(join(root, 'profiles.json'), JSON.stringify({ default: 'bare', profiles: { bare: { tools: ['tools'], catalog: 'cat' } } }));
  writeFileSync(join(root, 'cat', 'assets', 'x', 'tokens', 'brand.json'), JSON.stringify({
    $metadata: { tokenSetOrder: ['base', 'light'] },
    $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } }],
    base: { color: { $type: 'color', ink: { $value: '#101010' } }, font: { $type: 'fontFamily', brand: { $value: 'Inter' } } },
    light: { color: { $type: 'color', semantic: { text: { $value: '{color.ink}' }, surface: { $value: '#fafafa' } } } },
  }));
  writeFileSync(join(root, 'cat', 'assets', 'index.json'), JSON.stringify({
    version: 1,
    assets: [{ id: 'x/tokens/brand', type: 'tokens', tags: ['tokens', 'brand'], formats: [{ format: 'json', url: '/catalog/assets/x/tokens/brand.json' }] }],
  }));
  const resolved = await resolveProfileDesignSystem({ root });
  assert.ok(resolved);
  assert.equal(resolved.neutralMaster, true);
  assert.equal(resolved.input.neutralMaster, true);
  assert.equal(resolved.input.master.id, 'lolly/slides/neutral');
  assert.deepEqual(resolved.input.colors, { 'color.ink': '#101010', 'color.semantic.text': '#101010', 'color.semantic.surface': '#fafafa' });
  assert.deepEqual(resolved.input.fonts, { brand: 'Inter' });
  assert.deepEqual(resolved.input.logos, {});
  assert.ok(resolved.notes.some((line) => /neutral master/.test(line)));
});

// ─── plan 275: Auto-match through the pipeline, and a picture page on a template ──

const STRUCTURES_BYTES = (): Uint8Array => new Uint8Array(readFileSync(new URL('./fixtures/rebrand/structures.pptx', import.meta.url)));

test('planDeck with autoMatch sets only the slides whose layout it changes, and the report counts them per band', async () => {
  const bytes = STRUCTURES_BYTES();
  const plain = await planDeck({ bytes, name: 'structures.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM, instanceId: INSTANCE });
  assert.deepEqual(plain.autoMatched, []);
  assert.ok(plain.plan.slides.every((slide) => slide.layoutSource === 'proposed'), 'off by default');

  // The first pass already sets every clear read, and the one likely read's layout is
  // the plainer pick's too, so Auto-match has nothing to change on this fixture. A
  // proposal stays a proposal, so a later re-plan may still change it.
  const all = await planDeck({ bytes, name: 'structures.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM, instanceId: INSTANCE, autoMatch: 'all' });
  assert.deepEqual(all.autoMatched, []);
  assert.ok(all.plan.slides.every((slide) => slide.layoutSource === 'proposed'));

  // Over a plan whose layouts are all the plainest, every read changes a layout.
  const flat: RenovationPlanV1 = { ...plain.plan, slides: plain.plan.slides.map((slide) => ({ ...slide, layout: 'content' })) };
  const matched = await compileDeck({ source: plain.source, census: plain.census, plan: flat, system: plain.system, autoMatch: 'all' });
  assert.equal(matched.autoMatched.length, 8, 'every slide the matcher named');
  const entries = matched.report.entries.filter((entry) => entry.code === 'layout.auto-matched');
  assert.equal(entries.length, 8);
  assert.equal(entries.filter((entry) => entry.reason?.endsWith(':clear')).length, 7);
  assert.equal(entries.filter((entry) => entry.reason?.endsWith(':likely')).length, 1);
  const clear = await compileDeck({ source: plain.source, census: plain.census, plan: flat, system: plain.system, autoMatch: 'clear' });
  assert.equal(clear.autoMatched.length, 7, 'the seven clear reads');
  assert.ok(!clear.autoMatched.includes('ppt/slides/slide7.xml'), 'the likely read is left for a person');
});

test('compileDeck with autoMatch answers the plan it compiles, moves the revision once, and never over a person\'s layout', async () => {
  const bytes = STRUCTURES_BYTES();
  const planned = await planDeck({ bytes, name: 'structures.pptx', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM, instanceId: INSTANCE });
  const mine: RenovationPlanV1 = { ...planned.plan, slides: planned.plan.slides.map((slide, i) => (i === 0 ? { ...slide, layout: 'content', layoutSource: 'user' } : { ...slide, layout: 'content' })) };
  const result = await compileDeck({ source: planned.source, census: planned.census, plan: mine, system: planned.system, autoMatch: 'all', acceptSuggestions: 'all' });
  assert.equal(result.autoMatched.length, 7);
  assert.equal(result.plan.slides[0]!.layout, 'content', 'the person\'s layout stands');
  assert.equal(result.plan.revision, mine.revision + 1, 'one write for both answers');
  assert.equal(result.report.entries.filter((entry) => entry.code === 'layout.auto-matched').length, 7);
  const none = await compileDeck({ source: planned.source, census: planned.census, plan: planned.plan, system: planned.system });
  assert.deepEqual(none.autoMatched, []);
  assert.equal(none.report.entries.filter((entry) => entry.code === 'layout.auto-matched').length, 0);
});

test('a page that is one picture of a slide on a template page is flattened, its footer bars, mark and page number round it', async () => {
  const { buildProbePdf } = await import('../scripts/build-rebrand-pdf-fixtures.ts');
  const { zlibCompress } = await import('../engine/src/deflate.ts');
  const picture = { width: 4, height: 4, data: zlibCompress(new Uint8Array(4 * 4 * 3).fill(128)) };
  // Page 7 of the Self Assessment Explainer, drawn small: a picture over 93% of the
  // page, four footer bars, a corner mark and the page number, all in the edge band.
  const furniture = [
    '0.2 0.8 0.4 rg 360 6 130 6 re f', '0.9 0.5 0.1 rg 490 6 50 6 re f', '0.1 0.3 0.9 rg 540 6 30 6 re f', '0.2 0.8 0.4 rg 570 6 150 6 re f',
    '0 0.5 0.3 rg 15 8 100 18 re f',
    'BT /F1 6 Tf 338 8 Td (7) Tj ET',
  ].join('\n');
  const deckOf = async (content: string) => {
    const bytes = await buildProbePdf([{ content, images: { Im0: picture } }]);
    return (await readDeck({ bytes, name: 'template-page.pdf', parseXml: parsePipelineXml })).source;
  };
  const onTemplate = await deckOf(`q 720 0 0 377 0 14 cm /Im0 Do Q\n${furniture}`);
  assert.equal(onTemplate.slides[0]!.origin.flattened, true, 'the picture of the slide is the page');
  assert.deepEqual(onTemplate.slides[0]!.objects.map((object) => object.kind), ['pic']);
  // The same picture with words set over it inside the page, as live text, is an editable page.
  const worded = await deckOf(`q 720 0 0 377 0 14 cm /Im0 Do Q\n${furniture}\nBT /F1 14 Tf 200 200 Td (The words of the page, set as text) Tj ET`);
  assert.equal(worded.slides[0]!.origin.flattened, undefined);
});
