// SPDX-License-Identifier: MPL-2.0
/**
 * The renovate compile (plan 274 work package 5): the adversarial fixture read
 * into a `SourceDeckV1`, compiled against a hand-built plan onto the lolly-start
 * slide master.
 *
 * The plan is written out here rather than generated, because the plan stage is
 * another work package and this suite is about what the compile does with an
 * accepted plan, not about what a first pass would propose. Every field it uses
 * comes from `RenovationPlanV1` in packages/core/src/rebrand-v1.ts, and
 * tests/fixtures/rebrand/samples/plan.json is the shape it follows.
 *
 * What the suite pins:
 *
 *   - one frame per included slide, plus the continuation frames that carry what
 *     fit no slot of its own slide, and the slide counts that go with them;
 *   - the title goes into the master's own title slot at the ARCHETYPE's size, not
 *     the source's;
 *   - the chart nothing can be shown for becomes an authored placeholder layer the
 *     report names as unresolved, and never a picture of the source;
 *   - a removed decoration produces no layer at all and one removed entry;
 *   - a mark replaced by the brand's own maps its lineage to the master's furniture
 *     logo layer;
 *   - text on a master slot takes the master's ink, never a source mapping; a
 *     mapping reaches editable objects off the master, a text set wholly in one
 *     accent keeps it while it stays readable, and nothing reaches an image;
 *   - an unreviewed proposal to remove is compiled as keep when the caller did not
 *     ask for unreviewed proposals, with nothing reported as applied unreviewed;
 *     one flagged for attention stays held back unless the caller asks for the
 *     flagged ones too, and then it is reported as applied without a review;
 *   - placement order: the archetype slot for the role, a compatible slot (a
 *     second body text joins the body, a note closes the body or takes the
 *     master's footer), a continuation frame whose archetype has the role, and
 *     the tray only for what no layout of the master can hold, with the reason;
 *   - a continuation frame is numbered within its own slide, repeats the slide's
 *     title and names what moved to it;
 *   - every colour use is reported once, the first write to a field keeps it, and
 *     a plan resolved against another token pack or master is refused;
 *   - the accounting balances, two runs are identical, and the result validates
 *     against schemas/rebrand-compiled-v1.schema.json.
 *
 * Run with: node --test "tests/rebrand-compile.test.ts"
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
import {
  archetypeIdFor,
  compileFaithful,
  compileRenovated,
  deckContinuationLimit,
  DESIGN_LINE_HEIGHT,
  designTextFit,
  DOCUMENT_PATH_CHARS,
  framePosition,
  INCIDENTAL_PICTURE_SHARE,
  MAX_CONTINUATION_FRAMES,
  MAX_GRID_PICTURES,
  pictureGrid,
  type CompileRenovatedOptsV1,
} from '../engine/src/deck-compile.ts';
import { seedFrame } from '../engine/src/slide-master.ts';
import { finalizeReport } from '../engine/src/rebrand-report.ts';
import { plainOfDesignText } from '../engine/src/design-text.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import type {
  ArchetypeIdV1,
  ArchetypeRefV1,
  CompiledDeckV1,
  DesignBoxRowV1,
  ObjectPlanV1,
  RenovationPlanV1,
  SourceDeckV1,
  SourceObjectV1,
} from '../packages/core/src/rebrand-v1.ts';
import type { SlideMasterFileV1, SlideMasterV1 } from '../packages/core/src/slide-master-v1.ts';
import { readFixture } from './helpers/rebrand-fixtures.ts';
import { svgItemsOf, vectorRowsPathChars } from '../engine/src/svg-items.ts';
import { deflateRawSync } from 'node:zlib';
import type { ColorMappingV1, VectorItemsV1 } from '../packages/core/src/rebrand-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

// ─── the pieces the compile needs ────────────────────────────────────────────

/** The neutral master the public clone ships, which is what a lolly-start build renovates onto. */
function master(): SlideMasterV1 {
  const file = JSON.parse(
    readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/slides/masters.json'), 'utf8'),
  ) as SlideMasterFileV1;
  const first = file.masters[0];
  assert.ok(first, 'the lolly-start pack should ship at least one slide master');
  return first;
}

/** Token values for the paths this master and this plan name. */
const TOKENS: Readonly<Record<string, string>> = {
  'color.semantic.text': '#11201c',
  'color.semantic.surface': '#ffffff',
  'color.semantic.muted': '#6b7280',
  'color.ramp.neutral.8': '#e7e7e7',
  'color.brand.ink': '#123456',
  'color.brand.accent': '#d65a28',
};

const DESIGN_SYSTEM = {
  snapshot: {
    id: 'lolly-start',
    masterId: 'lolly/slides/neutral',
    masterVersion: '1.0.0',
    tokenHash: `sha256:${'b'.repeat(64)}`,
    fontHashes: { Outfit: `sha256:${'c'.repeat(64)}` },
    assetHashes: { 'lolly/logo/primary': `sha256:${'d'.repeat(64)}` },
  },
  tokens: (path: string): string | undefined => TOKENS[path],
  logos: { onLight: 'lolly/logo/primary', onDark: 'lolly/logo/on-dark' },
};

let cached: Promise<SourceDeckV1> | null = null;

function source(): Promise<SourceDeckV1> {
  cached ??= (async (): Promise<SourceDeckV1> => {
    const bytes = readFixture('adversarial.pptx');
    const parts = await inflatePptx(bytes);
    return sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'renovate-1',
      name: 'adversarial.pptx',
      bytes: bytes.byteLength,
      sink: async (_bytes: Uint8Array, _mime: string, hint: string): Promise<string> => `user/media/${hint.slice(0, 16)}`,
      reader: { name: 'pptx-read', version: 'test' },
    });
  })();
  return cached;
}

/** One object row of the hand-built plan, with the fields this suite leaves alone defaulted. */
function obj(id: string, over: Partial<ObjectPlanV1> & Pick<ObjectPlanV1, 'class'>): ObjectPlanV1 {
  return { id, evidence: [], proposal: 'keep', review: 'accepted', author: 'user', ...over };
}

const S1 = 'ppt/slides/slide1.xml';
const S2 = 'ppt/slides/slide2.xml';
const S3 = 'ppt/slides/slide3.xml';

/**
 * The plan this suite compiles.
 *
 * Slide 1 is the title slide: its master line proposes removal but nobody has
 * reviewed that, its partner mark is replaced by the brand's own, its orange band
 * is an accepted removal, and everything else fits no role and waits in the tray.
 * Slide 2 puts the unreadable chart in the visual slot, so the placeholder stands
 * where the picture would have been. Slide 3 sends two body lines to continuation
 * slides and replaces one recurring line with a catalog asset, so the image guard
 * on the colour pass has an editable object that became a picture.
 */
async function plan(): Promise<RenovationPlanV1> {
  const deck = await source();
  return {
    version: 1,
    source: { lineageId: deck.source.lineageId, hash: deck.source.hash, instanceId: deck.source.instanceId },
    revision: 3,
    presetId: 'preset/house-renovation',
    designSystem: DESIGN_SYSTEM.snapshot,
    algorithms: { reader: deck.reader.version, census: 'test-census', plan: 'test-plan' },
    mode: 'renovate',
    slides: [
      {
        id: S1,
        include: true,
        layout: 'title' as ArchetypeIdV1,
        layoutSource: 'proposed',
        objects: [
          obj(`${S1}.0`, { class: 'recurring-text', proposal: 'remove', review: 'unreviewed', author: 'rule' }),
          obj(`${S1}.1`, { class: 'title', role: 'title' }),
          obj(`${S1}.2`, {
            class: 'logo-candidate',
            proposal: 'replace',
            proposalReplacement: { kind: 'brand-logo', variant: 'auto' },
            scope: 'group/partner-mark',
          }),
          obj(`${S1}.3`, { class: 'footer' }),
          obj(`${S1}.4`, { class: 'body', role: 'subtitle' }),
          obj(`${S1}.5`, { class: 'decoration', proposal: 'remove' }),
          obj(`${S1}.6`, { class: 'body' }),
          obj(`${S1}.7`, { class: 'body' }),
        ],
        order: 0,
      },
      {
        id: S2,
        include: true,
        layout: 'visual' as ArchetypeIdV1,
        layoutSource: 'proposed',
        objects: [
          obj(`${S2}.0`, { class: 'recurring-text', proposal: 'remove' }),
          obj(`${S2}.1`, { class: 'title', role: 'title' }),
          obj(`${S2}.2`, { class: 'logo-candidate', proposal: 'replace', proposalReplacement: { kind: 'brand-logo', variant: 'auto' } }),
          obj(`${S2}.3`, { class: 'recurring-text' }),
          obj(`${S2}.4`, { class: 'footer' }),
          obj(`${S2}.5`, { class: 'body' }),
          obj(`${S2}.6`, { class: 'chart', role: 'visual' }),
        ],
        order: 1,
      },
      {
        id: S3,
        include: true,
        layout: 'content' as ArchetypeIdV1,
        layoutSource: 'user',
        objects: [
          obj(`${S3}.0`, { class: 'recurring-text', proposal: 'remove' }),
          obj(`${S3}.1`, { class: 'title', role: 'title' }),
          obj(`${S3}.2`, { class: 'body', role: 'body', surplus: 'continuation' }),
          obj(`${S3}.3`, { class: 'table' }),
          obj(`${S3}.4`, { class: 'logo-candidate', proposal: 'replace', proposalReplacement: { kind: 'brand-logo', variant: 'auto' } }),
          obj(`${S3}.5`, {
            class: 'recurring-text',
            proposal: 'replace',
            proposalReplacement: { kind: 'asset', id: 'lolly/pattern/key' },
          }),
          obj(`${S3}.6`, { class: 'footer' }),
          obj(`${S3}.7`, { class: 'body' }),
          obj(`${S3}.8`, { class: 'chart' }),
          obj(`${S3}.9`, { class: 'body', role: 'body', surplus: 'continuation' }),
          obj(`${S3}.10`, { class: 'body', role: 'body', surplus: 'continuation' }),
        ],
        order: 2,
      },
    ],
    colors: [
      {
        useId: 'use/ink/title',
        from: '#000000',
        scheme: 'tx1',
        role: 'ink',
        toPath: 'color.brand.ink',
        affects: [`${S1}.1`, `${S3}.1`],
      },
      {
        // The partner mark and the chart picture are raster, so nothing here may
        // reach them. The contract says a raster is never in this list; the compile
        // must hold even when a caller puts one there anyway.
        useId: 'use/bg/mark',
        from: '#FFFFFF',
        role: 'bg',
        to: '#ff0000',
        affects: [`${S1}.2`, `${S3}.8`],
      },
      {
        // An editable object the plan turned into a picture. Only the image guard
        // stops this one, because the object itself is editable.
        useId: 'use/bg/key',
        from: '#FFFFFF',
        role: 'bg',
        to: '#00ff00',
        affects: [`${S3}.5`],
      },
      {
        useId: 'use/series/chart',
        from: '#5194D5',
        role: 'series',
        unresolved: 'palette-too-small',
        affects: [`${S2}.6`],
      },
    ],
    fonts: [{ from: 'Calibri', to: 'Outfit', source: 'alias' }],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [],
  };
}

async function compiled(opts: CompileRenovatedOptsV1 = {}): Promise<CompiledDeckV1> {
  return compileRenovated({
    source: await source(),
    plan: await plan(),
    master: master(),
    designSystem: DESIGN_SYSTEM,
    opts,
  });
}

function rowStr(row: DesignBoxRowV1 | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === 'string' ? value : '';
}

function layerById(deck: CompiledDeckV1, id: string): DesignBoxRowV1 | undefined {
  for (const frame of deck.frames) for (const row of frame.layers) if (row.id === id) return row;
  return undefined;
}

/** The slide's own frame, not a continuation. */
function primary(deck: CompiledDeckV1, slideId: string): CompiledDeckV1['frames'][number] {
  const frame = deck.frames.find((f) => f.sourceSlideId === slideId && !f.continuation);
  assert.ok(frame, `no frame for ${slideId}`);
  return frame;
}

// ─── the suite ───────────────────────────────────────────────────────────────

test('one frame per included slide, plus the continuations for what fit no slot of its own slide', async () => {
  const out = await compiled();
  // Slide 1 is on the title layout, which has no body: its body line continues on a
  // content slide. Slide 3 is on the content layout: its table continues on a
  // table slide, words before pictures. A deck of three slides adds at most two
  // continuations, so its chart picture and its replaced key wait in the tray.
  assert.deepEqual(out.frames.map((f) => f.sourceSlideId), [S1, S1, S2, S3, S3]);
  assert.deepEqual(out.frames.map((f) => f.archetype), ['title', 'content', 'visual', 'content', 'table']);
  assert.deepEqual(out.frames.map((f) => f.continuation ?? false), [false, true, false, false, true]);
  assert.deepEqual(out.report.counts.slides, { source: 3, included: 3, excluded: 0, continuation: 2 });
  assert.equal(
    out.report.entries.filter((e) => e.code === 'slide.continuation-added').length,
    2,
    'an added slide moves the numbering, so each one is reported',
  );
  const trayed = out.report.entries.filter((e) => e.code === 'object.surplus-tray');
  assert.deepEqual(trayed.map((e) => [e.objectId, e.reason]), [[`${S3}.8`, 'deck-continuation-limit'], [`${S3}.5`, 'deck-continuation-limit']],
    'in reading order');
  assert.match(String(trayed[0]?.message), /the renovated deck already has 2 continuation slides/);
  for (const frame of out.frames) {
    assert.equal(frame.masterId, 'lolly/slides/neutral');
    assert.equal(rowStr(frame.layers[0], 'kind'), 'frame');
    assert.equal(frame.layers[0]?.id, frame.id);
    assert.equal(frame.width, 1280);
    assert.equal(frame.height, 720);
  }
});

test('the title goes into the master title slot at the archetype size', async () => {
  const out = await compiled();
  const titleFrame = primary(out, S1);
  const contentFrame = primary(out, S3);

  const forward = new Map(out.lineage.forward.map((e) => [e.sourceObjectId, e.layerIds]));
  const first = forward.get(`${S1}.1`);
  assert.deepEqual(first, [`${titleFrame.id}.title`, `${titleFrame.id}.c1.title`],
    'the title takes the seeded title slot, and the continuation repeats it');

  const row = layerById(out, `${titleFrame.id}.title`);
  assert.ok(row);
  assert.equal(row.role, 'title');
  assert.equal(row.text, 'Quarterly review');
  assert.equal(row.fontSize, 69, "the title archetype states its own size, and the source's 36 pt has no say");
  assert.equal(row.master, 'lolly/slides/neutral');

  const third = layerById(out, `${contentFrame.id}.title`);
  assert.ok(third);
  assert.equal(third.text, 'Regional detail');
  assert.equal(third.fontSize, 37, 'the content archetype takes the type scale, not the source size');
});

test('the unreadable chart is a placeholder layer the report names as unresolved', async () => {
  const out = await compiled();
  const frame = primary(out, S2);
  const boxId = `${frame.id}.visual`;
  assert.deepEqual(frame.placeholderLayerIds, [boxId, `${boxId}.label`]);

  const box = layerById(out, boxId);
  const label = layerById(out, `${boxId}.label`);
  assert.ok(box);
  assert.ok(label);
  assert.equal(box.kind, 'box');
  assert.equal(box.image, undefined, 'a placeholder is never a picture of the source');
  assert.equal(label.text, 'Chart could not be read');

  const entry = out.report.entries.find((e) => e.objectId === `${S2}.6` && e.disposition);
  assert.ok(entry);
  assert.equal(entry.code, 'object.unresolved');
  assert.equal(entry.disposition, 'unresolved');
  assert.equal(entry.fidelity, 'unavailable');
  assert.equal(entry.reason, 'native-chart-no-fallback');
  assert.equal(entry.layerId, boxId);
  assert.equal(
    out.report.entries.some((e) => e.code === 'object.placeholder-authored' && e.objectId === `${S2}.6`),
    true,
  );
  const backward = new Map(out.lineage.backward.map((e) => [e.layerId, e]));
  assert.equal(backward.get(boxId)?.derived, 'placeholder');

  // The chart whose fallback picture the file does carry is a real image instead.
  // The content layout has no picture slot and the deck has added its two
  // continuations, so it waits in the tray as that picture.
  const carried = out.tray.find((item) => item.sourceObjectId === `${S3}.8`)?.layer;
  assert.ok(carried, 'it fit no slot on the content archetype and past the deck bound it waits in the tray');
  assert.equal(carried.kind, 'image');
  assert.equal(carried.image, 'user/media/c6de6034ed7f8be7');
  assert.equal(out.report.entries.find((e) => e.code === 'object.surplus-tray' && e.objectId === `${S3}.8`)?.layerId, carried.id);
});

test('a removed decoration produces no layer and one removed entry', async () => {
  const out = await compiled();
  const removed = `${S1}.5`;

  assert.equal(out.lineage.forward.some((e) => e.sourceObjectId === removed), false);
  assert.equal(out.lineage.backward.some((e) => e.sourceObjectIds.includes(removed)), false);
  assert.equal(out.tray.some((t) => t.sourceObjectId === removed), false);

  const entries = out.report.entries.filter((e) => e.objectId === removed && e.disposition);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.code, 'object.removed');
  assert.equal(entries[0]?.disposition, 'removed');
  assert.equal(out.report.counts.byClass.decoration?.removed, 1);
});

test('a mark replaced by the brand one maps its lineage to the furniture logo layer', async () => {
  const out = await compiled();
  const frame = out.frames[0];
  assert.ok(frame);
  const logoId = `${frame.id}.logo-hero`;
  assert.equal(frame.furnitureLayerIds.includes(logoId), true);

  const logo = layerById(out, logoId);
  assert.ok(logo);
  assert.equal(logo.kind, 'image');
  assert.equal(logo.image, 'lolly/logo/on-dark', 'the title archetype states a dark ground, so the reverse mark is the one');

  const forward = new Map(out.lineage.forward.map((e) => [e.sourceObjectId, e.layerIds]));
  assert.deepEqual(forward.get(`${S1}.2`), [logoId]);
  const backward = new Map(out.lineage.backward.map((e) => [e.layerId, e]));
  assert.deepEqual(backward.get(logoId)?.sourceObjectIds, [`${S1}.2`]);
  assert.equal(backward.get(logoId)?.derived, 'furniture');

  const entry = out.report.entries.find((e) => e.objectId === `${S1}.2` && e.disposition);
  assert.equal(entry?.code, 'object.replaced-logo');
  assert.equal(entry?.disposition, 'transformed');
  assert.equal(out.report.counts.logosReplaced, 3, 'the same mark sits on all three slides');
});

test('text on a master slot keeps the master ink, and no mapping reaches an image layer', async () => {
  const out = await compiled();

  // The title archetype sets its title in the surface colour on the dark ground,
  // the content one in the text colour on the light ground. The source's black
  // title ink maps to color.brand.ink in the plan, and that mapping does not
  // reach a layer the master colours.
  const title = layerById(out, `${primary(out, S1).id}.title`);
  assert.equal(title?.fg, TOKENS['color.semantic.surface']);
  const thirdTitle = layerById(out, `${primary(out, S3).id}.title`);
  assert.equal(thirdTitle?.fg, TOKENS['color.semantic.text']);

  // Every mapping the plan answered is counted as assigned, with the reason when
  // it reached no layer, so coloursUnresolved is the plan's own unresolved count.
  const assigned = out.report.entries.filter((e) => e.code === 'colour.assigned');
  assert.deepEqual(assigned.map((e) => e.reason), ['master-ink', 'no-editable-layer', 'no-editable-layer']);
  assert.match(String(assigned[0]?.message), /names text the slide master sets/);
  assert.equal(out.report.counts.coloursAssigned, 3);

  // The raster mark and the raster chart are not editable, so the mapping that
  // names them assigns nothing and is not reported as an assignment.
  for (const frame of out.frames) {
    for (const row of frame.layers) assert.notEqual(row.bg, '#ff0000');
  }
  for (const item of out.tray) assert.notEqual(item.layer.bg, '#ff0000');

  // The recurring line IS editable, and the plan turned it into a picture. A kept
  // picture keeps its own colours, so the image guard is what stops this one.
  const keyId = out.lineage.forward.find((e) => e.sourceObjectId === `${S3}.5`)?.layerIds[0];
  const key = keyId ? (layerById(out, keyId) ?? out.tray.find((item) => item.layer.id === keyId)?.layer) : undefined;
  assert.ok(key);
  assert.equal(key.kind, 'image');
  assert.equal(key.image, 'lolly/pattern/key');
  assert.equal(key.bg, undefined);

  // Every mapping says what became of it. One has no target at all; the other two
  // resolve and reach nothing, which is a fact about the deck and not a silence.
  const unresolved = out.report.entries.filter((e) => e.code === 'colour.unresolved');
  assert.deepEqual(unresolved.map((e) => e.reason), ['palette-too-small']);
  assert.equal(out.report.counts.coloursUnresolved, 1);
  assert.equal(out.report.counts.coloursUnresolved, (await plan()).colors.filter((row) => row.unresolved !== undefined || (!row.to && !row.toPath)).length,
    'the report counts what the plan could not answer, and nothing else');
  assert.equal(
    out.report.entries.filter((e) => e.code === 'colour.assigned' || e.code === 'colour.unresolved').length,
    4,
    'one entry per colour mapping in the plan, no more and no fewer',
  );
  assert.match(
    String(assigned[1]?.message),
    /no editable layer could take it, so nothing was recoloured/,
  );

  assert.equal(out.report.counts.fontsSubstituted, 1);
  assert.equal(
    out.report.entries.some((e) => e.code === 'text.font-substituted' && e.message.includes('Outfit')),
    true,
  );
});

test('an unreviewed proposal to remove is compiled as keep unless the caller asks', async () => {
  const held = await compiled();
  const confidential = `${S1}.0`;

  const entry = held.report.entries.find((e) => e.objectId === confidential && e.disposition);
  assert.equal(entry?.disposition, 'retained', 'nobody reviewed the removal, so the line stays');
  assert.equal(entry?.reason, 'unreviewed-proposal-held');
  assert.equal(held.report.entries.some((e) => e.code === 'review.applied-unreviewed'), false);
  assert.equal(held.report.counts.appliedUnreviewed, 0);
  assert.ok(entry?.layerId, 'it is kept, so it is somewhere');
  assert.match(String(layerById(held, String(entry.layerId))?.text), /Confidential/,
    'the title layout has no footer and no body, so the kept line closes its subtitle');

  const applied = await compiled({ applyUnreviewed: true });
  const after = applied.report.entries.find((e) => e.objectId === confidential && e.disposition);
  assert.equal(after?.disposition, 'removed');
  assert.equal(applied.report.counts.appliedUnreviewed, 1);
  const flagged = applied.report.entries.find((e) => e.code === 'review.applied-unreviewed');
  assert.equal(flagged?.objectId, confidential);
  assert.equal(flagged?.review, 'unreviewed');
  assert.equal(flagged?.action, 'remove');
});

test('every source object is accounted for exactly once, and lineage runs both ways', async () => {
  const deck = await source();
  const out = await compiled();
  const ids = deck.slides.flatMap((s) => s.objects).map((o) => o.id);

  const dispositions = out.report.entries.filter((e) => e.disposition);
  assert.equal(dispositions.length, ids.length);
  finalizeReport(out.report, ids);
  assert.throws(() => finalizeReport(out.report, [...ids, `${S1}.99`]), /does not account for every source object/);

  const layerIds = out.frames.flatMap((f) => f.layers.map((row) => String(row.id)));
  assert.equal(new Set(layerIds).size, layerIds.length, 'layer ids are unique across the document');
  const backward = new Map(out.lineage.backward.map((e) => [e.layerId, e]));
  for (const id of layerIds) assert.equal(backward.has(id), true, `no backward lineage for layer ${id}`);
  for (const item of out.tray) assert.equal(backward.has(String(item.layer.id)), true);

  const known = new Set([...layerIds, ...out.tray.map((t) => String(t.layer.id))]);
  for (const entry of out.lineage.forward) {
    for (const id of entry.layerIds) assert.equal(known.has(id), true, `${id} is not a layer of this document`);
  }
  assert.deepEqual(
    out.lineage.forward.map((e) => e.sourceObjectId),
    [...out.lineage.forward.map((e) => e.sourceObjectId)].sort(),
  );
  assert.deepEqual(out.lineage.backward.map((e) => e.layerId), [...backward.keys()].sort());
});

test('the renovate compile is a function of its input alone', async () => {
  const first = await compiled();
  const second = await compiled();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.notEqual(JSON.stringify(first), JSON.stringify(await compiled({ idPrefix: 'z' })));
  assert.equal(first.planRevision, 3);
  assert.equal(first.algorithms.compile, 'renovate-2026-09-25.1');
  assert.equal(first.designSystem.id, 'lolly-start');
});

test('a plan for other bytes is refused', async () => {
  const deck = await source();
  const other = await plan();
  other.source = { ...other.source, hash: `sha256:${'9'.repeat(64)}` };
  assert.throws(
    () => compileRenovated({ source: deck, plan: other, master: master(), designSystem: DESIGN_SYSTEM }),
    /a plan for other bytes/,
  );
});

test('a frame size other than the master size takes the master fractions against it', async () => {
  const out = await compiled({ frameSize: { width: 1920, height: 1080 } });
  const frame = out.frames[0];
  assert.ok(frame);
  assert.equal(frame.width, 1920);
  assert.equal(frame.height, 1080);
  const title = layerById(out, `${frame.id}.title`);
  assert.ok(title);
  assert.equal(title.w, Math.round((0.0341 + 0.723) * 1920) - Math.round(0.0341 * 1920));
  assert.equal(title.fontSize, round2(69 * 1.5));
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

// ─── a hand-built source, for the answers the committed fixture cannot ask ───

function synthetic(text: string): { deck: SourceDeckV1; plan: RenovationPlanV1 } {
  const hash = `sha256:${'7'.repeat(64)}`;
  const deck: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash, lineageId: 'lin', instanceId: 'inst', pageCount: 1 },
    slides: [
      {
        id: 'slide1',
        index: 0,
        width: 1280,
        height: 720,
        background: {},
        objects: [
          {
            id: 'o1',
            fingerprint: 'fp:o1',
            kind: 'text',
            box: { x: 0, y: 0, w: 400, h: 200, rot: 0 },
            origin: 'slide',
            fidelity: { state: 'editable' },
            text: { paras: [{ runs: [{ text }] }] },
          },
        ],
        readingOrder: ['o1'],
        warnings: [],
        origin: { kind: 'pptx' },
      },
    ],
    fonts: [],
    warnings: [],
    reader: { name: 'pptx-read', version: 'test' },
  };
  const plan: RenovationPlanV1 = {
    version: 1,
    source: { lineageId: 'lin', hash, instanceId: 'inst' },
    revision: 1,
    designSystem: DESIGN_SYSTEM.snapshot,
    algorithms: { reader: 'test', census: 'test', plan: 'test' },
    mode: 'renovate',
    slides: [
      {
        id: 'slide1',
        include: true,
        layout: 'content' as ArchetypeIdV1,
        layoutSource: 'proposed',
        objects: [obj('o1', { class: 'body', role: 'body' })],
      },
    ],
    colors: [],
    fonts: [],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [],
  };
  return { deck, plan };
}

test('text longer than its slot is reported as an estimate, not as a measurement', () => {
  const long = synthetic('word '.repeat(2000));
  const over = compileRenovated({ source: long.deck, plan: long.plan, master: master(), designSystem: DESIGN_SYSTEM });
  const overflow = over.report.entries.filter((e) => e.code === 'text.overflow');
  assert.equal(overflow.length, 1);
  assert.equal(overflow[0]?.reason, 'estimate');
  assert.equal(overflow[0]?.layerId, `${over.frames[0]?.id}.body`);
  assert.match(String(overflow[0]?.message), /This is an estimate from an average glyph width, not shaped text/);

  const short = synthetic('One line.');
  const fits = compileRenovated({ source: short.deck, plan: short.plan, master: master(), designSystem: DESIGN_SYSTEM });
  assert.equal(fits.report.entries.some((e) => e.code === 'text.overflow'), false);
});

test('a slide the plan never mentions is excluded, and its objects still have a disposition', () => {
  const { deck, plan: base } = synthetic('Body');
  const plan: RenovationPlanV1 = { ...base, slides: [] };
  const out = compileRenovated({ source: deck, plan, master: master(), designSystem: DESIGN_SYSTEM });
  assert.equal(out.frames.length, 0);
  assert.deepEqual(out.report.counts.slides, { source: 1, included: 0, excluded: 1, continuation: 0 });
  const entry = out.report.entries.find((e) => e.objectId === 'o1' && e.disposition);
  assert.equal(entry?.disposition, 'removed');
  assert.equal(entry?.reason, 'not-in-plan');
  finalizeReport(out.report, ['o1']);
});

// ─── the review's own questions: who gets a slot, and what the report says ───

/** One text object of a hand-built slide, at a place the slot competition can be read from. */
function text(id: string, body: string, over: Partial<SourceObjectV1> = {}): SourceObjectV1 {
  return {
    id,
    fingerprint: `fp:${id}`,
    kind: 'text',
    box: { x: 0, y: 0, w: 400, h: 60, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs: [{ text: body }] }] },
    ...over,
  };
}

/** A one-slide source and a plan over it, so a case can state only what it is about. */
function bench(
  objects: SourceObjectV1[],
  entries: ObjectPlanV1[],
  layout: ArchetypeRefV1 = 'content',
): { deck: SourceDeckV1; plan: RenovationPlanV1 } {
  const hash = `sha256:${'4'.repeat(64)}`;
  return {
    deck: {
      version: 1,
      source: { kind: 'pptx', hash, lineageId: 'lin', instanceId: 'inst', pageCount: 1 },
      slides: [{
        id: 'slide1',
        index: 0,
        width: 1280,
        height: 720,
        background: {},
        objects,
        readingOrder: objects.map((o) => o.id),
        warnings: [],
        origin: { kind: 'pptx' },
      }],
      fonts: [],
      warnings: [],
      reader: { name: 'pptx-read', version: 'test' },
    },
    plan: {
      version: 1,
      source: { lineageId: 'lin', hash, instanceId: 'inst' },
      revision: 1,
      designSystem: DESIGN_SYSTEM.snapshot,
      algorithms: { reader: 'test', census: 'test', plan: 'test' },
      mode: 'renovate',
      slides: [{ id: 'slide1', include: true, layout, layoutSource: 'proposed', objects: entries }],
      colors: [],
      fonts: [],
      logo: { policy: 'brand', variantByBackground: true },
      decisions: [],
    },
  };
}

function run(made: { deck: SourceDeckV1; plan: RenovationPlanV1 }, opts: CompileRenovatedOptsV1 = {}): CompiledDeckV1 {
  return compileRenovated({ source: made.deck, plan: made.plan, master: master(), designSystem: DESIGN_SYSTEM, opts });
}

test('an object the plan does not list never takes the slot from the object it assigned', () => {
  const made = bench(
    [
      text('ghost', 'INHERITED MASTER HEADING', { origin: 'master', readingIndex: 0, placeholder: 'title' }),
      text('t', 'The title', { readingIndex: 1, placeholder: 'title' }),
      text('b', 'The planned body copy', { readingIndex: 2 }),
    ],
    [obj('t', { class: 'title', role: 'title' }), obj('b', { class: 'body', role: 'body' })],
  );
  const out = run(made);
  const frame = out.frames[0];
  assert.ok(frame);
  assert.equal(layerById(out, `${frame.id}.title`)?.text, 'The title', 'the listed title keeps the title slot');
  // The unplanned heading has no title slot left, so it leads the body in reading order.
  assert.equal(layerById(out, `${frame.id}.body`)?.text, 'INHERITED MASTER HEADING\nThe planned body copy');
  assert.equal(out.tray.length, 0, 'it is kept, and a kept heading has a place in the body');
  const entry = out.report.entries.find((e) => e.objectId === 'ghost' && e.disposition);
  assert.equal(entry?.disposition, 'retained');
  assert.equal(entry?.review, 'unreviewed');
  assert.equal(entry?.layerId, `${frame.id}.body`);
});

test('a derived role the archetype cannot hold falls back to the body slot', () => {
  const made = bench([text('n', '42%')], [obj('n', { class: 'body' })]);
  const out = run(made);
  const frame = out.frames[0];
  assert.ok(frame);
  assert.equal(layerById(out, `${frame.id}.body`)?.text, '42%', 'a lone figure keeps its slide');
  assert.equal(out.tray.length, 0);

  // A big number the archetype does carry still reads as one.
  const big = run(bench([text('n', '42%')], [obj('n', { class: 'body' })], 'big-number'));
  assert.equal(layerById(big, `${big.frames[0]?.id}.number`)?.text, '42%');

  // A role the plan stated that the archetype has no slot for takes a compatible
  // slot on the same frame: the body, rather than the tray.
  const stated = run(bench([text('n', 'A line')], [obj('n', { class: 'body', role: 'number' })]));
  assert.equal(stated.tray.length, 0);
  assert.equal(layerById(stated, `${stated.frames[0]?.id}.body`)?.text, 'A line');
});

test('a kept shape has no place on any layout, so it waits in the tray with that reason', () => {
  const shape: SourceObjectV1 = {
    id: 's', fingerprint: 'fp:s', kind: 'shape', box: { x: 0, y: 0, w: 200, h: 100, rot: 0 },
    origin: 'slide', fidelity: { state: 'editable' }, fill: { hex: '#d65a28' },
  };
  const out = run(bench([text('t', 'The title'), shape], [obj('t', { class: 'title', role: 'title' }), obj('s', { class: 'unknown' })]));
  assert.equal(out.frames.length, 1, 'no continuation for what no layout can hold');
  assert.deepEqual(out.tray.map((t) => t.sourceObjectId), ['s']);
  const entry = out.report.entries.find((e) => e.code === 'object.surplus-tray');
  assert.equal(entry?.reason, 'no-role-in-master');
  assert.match(String(entry?.message), /no layout of the slide master has a place for it/);
});

test('a second body text joins the body while the estimate allows, and continues when it does not', () => {
  const short = run(bench(
    [text('b1', 'First body line'), text('b2', 'Second body line')],
    [obj('b1', { class: 'body', role: 'body' }), obj('b2', { class: 'body', role: 'body' })],
  ));
  assert.deepEqual(short.frames.map((f) => f.id), ['r.slide1']);
  assert.equal(layerById(short, 'r.slide1.body')?.text, 'First body line\nSecond body line');

  const tall = (id: string): SourceObjectV1 => text(id, `${id} ${'word '.repeat(220)}`.trim());
  const long = run(bench(
    [tall('b1'), tall('b2')],
    [obj('b1', { class: 'body', role: 'body' }), obj('b2', { class: 'body', role: 'body' })],
  ));
  assert.deepEqual(long.frames.map((f) => f.id), ['r.slide1', 'r.slide1.c1'],
    'the default surplus is a continuation, not the tray');
  assert.equal(long.tray.length, 0);
});

test('a note closes the body, and a kept footer line takes the master footer', () => {
  const made = bench(
    [
      text('t', 'Revenue', { readingIndex: 0 }),
      text('src', 'Source: report 2021', { readingIndex: 1 }),
      text('b', 'Revenue held in every region.', { readingIndex: 2 }),
      text('conf', 'Confidential - internal use only', { readingIndex: 3, origin: 'master' }),
      text('unit', '', { readingIndex: 4, text: { paras: [{ runs: [{ text: 'Figures in EUR millions', sizePt: 7 }] }] } }),
    ],
    [
      obj('t', { class: 'title', role: 'title' }),
      obj('src', { class: 'body', role: 'body', author: 'rule' }),
      obj('b', { class: 'body', role: 'body', author: 'rule' }),
      obj('conf', { class: 'recurring-text', role: 'caption', review: 'needs-attention', author: 'rule' }),
      obj('unit', { class: 'body', role: 'body', author: 'rule' }),
    ],
  );
  const out = run(made);
  assert.equal(out.frames.length, 1);
  assert.equal(layerById(out, 'r.slide1.body')?.text, 'Revenue held in every region.\nSource: report 2021\nFigures in EUR millions',
    'the body text first, the citation and the unit line after it in reading order');
  assert.equal(layerById(out, 'r.slide1.footer')?.text, 'Confidential - internal use only');
  const backward = new Map(out.lineage.backward.map((e) => [e.layerId, e]));
  assert.deepEqual(backward.get('r.slide1.footer')?.sourceObjectIds, ['conf']);
  assert.equal(backward.get('r.slide1.footer')?.derived, 'furniture');
  assert.equal(layerById(out, 'r.slide1.page-number')?.text, '1', 'the master page number reads the frame position');
});

test('a continuation frame is numbered within its own slide and names what moved to it', () => {
  const tall = (id: string): SourceObjectV1 => text(id, `${id} ${'word '.repeat(220)}`.trim());
  const made = bench(
    [text('t', 'The title'), tall('b1'), tall('b2')],
    [
      obj('t', { class: 'title', role: 'title' }),
      obj('b1', { class: 'body', role: 'body', surplus: 'continuation' }),
      obj('b2', { class: 'body', role: 'body', surplus: 'continuation' }),
    ],
  );
  const out = run(made);
  assert.deepEqual(out.frames.map((f) => f.id), ['r.slide1', 'r.slide1.c1']);
  assert.equal(out.frames[1]?.continuation, true);
  assert.match(String(layerById(out, 'r.slide1.c1.body')?.text), /^b2 word/);
  // Plan 275 section 7.2: the continuation names the title it continues, marked
  // "(continued)", rather than repeating the heading as if it were a new slide.
  assert.equal(layerById(out, 'r.slide1.c1.title')?.text, 'The title (continued)', 'the continuation names the title it continues');

  const moved = out.report.entries.filter((e) => e.code === 'object.surplus-continuation');
  assert.equal(moved.length, 1);
  assert.equal(moved[0]?.objectId, 'b2');
  assert.equal(moved[0]?.layerId, 'r.slide1.c1.body');
  assert.equal(moved[0]?.disposition, undefined, 'it moved, so it is not a second disposition');
  finalizeReport(out.report, ['t', 'b1', 'b2']);
});

test('a proposal flagged for attention is held back even when the caller asks for the unreviewed ones', () => {
  const made = bench(
    [text('x', 'A line somebody should look at')],
    [{ id: 'x', class: 'body', evidence: [], proposal: 'remove', review: 'needs-attention', author: 'rule', role: 'body' }],
  );
  const out = run(made, { applyUnreviewed: true });
  const entry = out.report.entries.find((e) => e.objectId === 'x' && e.disposition);
  assert.equal(entry?.disposition, 'retained');
  assert.equal(entry?.reason, 'needs-attention-held');
  assert.equal(out.report.counts.appliedUnreviewed, 0);
  assert.equal(layerById(out, `${out.frames[0]?.id}.body`)?.text, 'A line somebody should look at');
});

test('applyNeedsAttention applies a flagged proposal as proposed and reports it', () => {
  const made = bench(
    [text('x', 'A line somebody should look at'), text('y', 'A second line')],
    [
      { id: 'x', class: 'body', evidence: [], proposal: 'remove', review: 'needs-attention', author: 'rule', role: 'body' },
      { id: 'y', class: 'body', evidence: [], proposal: 'keep', review: 'needs-attention', author: 'rule', role: 'body' },
    ],
  );
  const without = run(made);
  assert.equal(without.report.entries.find((e) => e.objectId === 'x' && e.disposition)?.disposition, 'retained',
    'without the option nothing changes');

  const out = run(made, { applyNeedsAttention: true });
  const entry = out.report.entries.find((e) => e.objectId === 'x' && e.disposition);
  assert.equal(entry?.disposition, 'removed');
  const applied = out.report.entries.filter((e) => e.code === 'review.applied-unreviewed');
  assert.deepEqual(applied.map((e) => [e.objectId, e.review, e.action]), [['x', 'needs-attention', 'remove']]);
  assert.equal(out.report.counts.appliedUnreviewed, 1);
  assert.equal(layerById(out, `${out.frames[0]?.id}.body`)?.text, 'A second line');
});

test('two colour uses reaching one field: the first keeps it, and both are reported honestly', () => {
  const shape: SourceObjectV1 = {
    id: 's', fingerprint: 'fp:s', kind: 'shape', box: { x: 0, y: 0, w: 200, h: 100, rot: 0 },
    origin: 'slide', fidelity: { state: 'editable' }, fill: { hex: '#000000' },
  };
  const made = bench([shape], [obj('s', { class: 'unknown' })]);
  made.plan.colors = [
    { useId: 'u1', from: '#000000', role: 'bg', to: '#ff0000', affects: ['s'] },
    { useId: 'u2', from: '#000000', role: 'bg', to: '#00ff00', affects: ['s'] },
  ];
  const out = run(made);
  const row = out.tray.find((t) => t.sourceObjectId === 's')?.layer;
  assert.equal(row?.bg, '#ff0000', 'the first use keeps the field it wrote');

  const colours = out.report.entries.filter((e) => e.code === 'colour.assigned' || e.code === 'colour.unresolved');
  assert.deepEqual(colours.map((e) => e.code), ['colour.assigned', 'colour.assigned']);
  assert.equal(colours[1]?.reason, 'claimed-by-another-use');
  assert.match(String(colours[1]?.message), /already carries a colour from another colour mapping/);
  assert.doesNotMatch(String(colours[1]?.message), /\bu[12]\b/, 'a use id is a machine name, not words a person reads');
});

test('a figure set wholly in one accent keeps the mapped accent only while it stays readable, and body text never does', () => {
  const accent = (id: string, words: string): SourceObjectV1 =>
    text(id, '', { text: { paras: [{ runs: [{ text: words, color: { hex: '#D65A28' } }] }] } });

  // Body text takes the placeholder's ink whatever colour its source runs were.
  const body = bench([accent('x', 'Growth held')], [obj('x', { class: 'body', role: 'body' })]);
  body.plan.colors = [{ useId: 'u', from: '#d65a28', role: 'accent', to: '#1f4fd1', affects: ['x'] }];
  const plain = run(body);
  assert.equal(layerById(plain, 'r.slide1.body')?.fg, TOKENS['color.semantic.text'], 'body text keeps the master ink');
  assert.equal(plain.report.entries.find((e) => e.code === 'colour.assigned')?.reason, 'master-ink');

  // A big figure is where colour is the point, so a readable accent stays.
  const figure = bench([accent('n', '42%')], [obj('n', { class: 'body' })], 'big-number');
  figure.plan.colors = [{ useId: 'u', from: '#d65a28', role: 'accent', to: '#1f4fd1', affects: ['n'] }];
  const kept = run(figure);
  assert.equal(layerById(kept, 'r.slide1.number')?.fg, '#1f4fd1', 'a readable accent on white stays the emphasis');
  assert.equal(kept.report.entries.find((e) => e.code === 'colour.assigned')?.reason, undefined);

  // A pale accent would be unreadable, and a grey target is not an accent at all:
  // either way the figure is not recoloured by the mapping.
  for (const to of ['#f4f4a0', '#6f6f6f']) {
    const other = bench([accent('n', '42%')], [obj('n', { class: 'body' })], 'big-number');
    other.plan.colors = [{ useId: 'u', from: '#d65a28', role: 'accent', to, affects: ['n'] }];
    const guarded = run(other);
    assert.notEqual(layerById(guarded, 'r.slide1.number')?.fg, to, `${to} is not taken as the emphasis`);
    assert.equal(guarded.report.entries.find((e) => e.code === 'colour.assigned')?.reason, 'master-ink');
  }
});

test('a master ink under the contrast floor is replaced by a design-system ink and reported once', () => {
  // A master whose big-number slot sets its figure in the surface colour on the
  // surface ground, which reads as nothing at all. The shipped masters no longer
  // do this (tests/slide-master.test.ts checks every ink), so the defect is made
  // here on purpose to keep the guard honest for a pack that still has one.
  const flawed = master();
  for (const archetype of flawed.archetypes) {
    if (archetype.id !== 'big-number') continue;
    for (const slot of archetype.placeholders) {
      if (slot.role === 'number' && slot.style) slot.style.fgTokenPath = 'color.semantic.surface';
    }
  }
  const made = bench([text('n', '42%'), text('c', 'Share of revenue')],
    [obj('n', { class: 'body' }), obj('c', { class: 'body' })], 'big-number');
  const out = compileRenovated({ source: made.deck, plan: made.plan, master: flawed, designSystem: DESIGN_SYSTEM, opts: {} });
  const number = layerById(out, 'r.slide1.number');
  assert.equal(number?.text, '42%');
  assert.equal(number?.fg, TOKENS['color.semantic.text']);
  const guard = out.report.entries.filter((e) => e.code === 'colour.contrast-below-minimum');
  assert.equal(guard.length, 1);
  assert.equal(guard[0]?.layerId, 'r.slide1.number');
  assert.equal(guard[0]?.reason, 'master-ink-below-floor');
});

test('a plan slide the source does not have is reported rather than dropped', () => {
  const made = bench([text('x', 'A line')], [obj('x', { class: 'body', role: 'body' })]);
  made.plan.slides.push({ id: 'slide9', include: true, layout: 'content', layoutSource: 'proposed', objects: [] });
  const out = run(made);
  assert.equal(out.frames.length, 1);
  const entry = out.report.entries.find((e) => e.reason === 'source-slide-missing');
  assert.ok(entry, 'a plan and a source that have drifted is the one case worth saying out loud');
  assert.equal(entry.code, 'slide.excluded');
  assert.equal(entry.slideId, 'slide9');
  finalizeReport(out.report, ['x']);
});

test('the overflow estimate measures the tray, where the longest text usually is', () => {
  const made = bench(
    [
      text('t', 'The title'),
      text('long', '', { text: { paras: [{ runs: [{ text: 'word '.repeat(400), sizePt: 18 }] }] } }),
    ],
    [obj('t', { class: 'title', role: 'title' }), obj('long', { class: 'body', role: 'data', surplus: 'tray' })],
  );
  const out = run(made);
  const trayed = out.tray.find((t) => t.sourceObjectId === 'long');
  assert.ok(trayed, 'a surplus the plan sent to the tray waits there');
  assert.equal(out.report.entries.find((e) => e.code === 'object.surplus-tray')?.reason, 'plan-asked');
  const overflow = out.report.entries.filter((e) => e.code === 'text.overflow');
  assert.equal(overflow.some((e) => e.layerId === String(trayed.layer.id)), true);
  assert.equal(overflow.every((e) => e.reason === 'estimate'), true);
});

test('a plan resolved against another token pack is refused', () => {
  const made = bench([text('x', 'A line')], [obj('x', { class: 'body', role: 'body' })]);
  made.plan.designSystem = { ...DESIGN_SYSTEM.snapshot, tokenHash: `sha256:${'e'.repeat(64)}` };
  assert.throws(() => run(made), /a plan for another pack/);

  const other = bench([text('x', 'A line')], [obj('x', { class: 'body', role: 'body' })]);
  other.plan.designSystem = { ...DESIGN_SYSTEM.snapshot, masterId: 'lolly/slides/other' };
  assert.throws(() => run(other), /a plan for another master/);
});

test('a kept mark takes a free picture slot on its own slide, else the tray, never a slide of its own', () => {
  const mark: SourceObjectV1 = {
    id: 'm', fingerprint: 'fp:m', kind: 'pic', box: { x: 1100, y: 20, w: 120, h: 40, rot: 0 },
    origin: 'slide', fidelity: { state: 'raster-preserved' }, media: 'user/media/mark',
  };
  const entries = [obj('t', { class: 'title', role: 'title' }), obj('m', { class: 'logo-candidate', decision: 'keep' })];
  const content = run(bench([text('t', 'Partners'), mark], entries));
  assert.equal(content.frames.length, 1);
  assert.deepEqual(content.tray.map((item) => item.sourceObjectId), ['m']);
  assert.equal(content.report.entries.find((e) => e.code === 'object.surplus-tray')?.reason, 'mark-without-slot');

  const visual = run(bench([text('t', 'Partners'), mark], entries, 'visual'));
  assert.equal(visual.tray.length, 0);
  assert.equal(layerById(visual, 'r.slide1.visual')?.image, 'user/media/mark');
});

// ─── bounds, small pictures, the footer, inks and words (review round 2) ─────

/** Every layer id the forward lineage names is a layer of some frame or of the tray. */
function assertForwardLayersExist(out: CompiledDeckV1): void {
  const known = new Set([
    ...out.frames.flatMap((f) => f.layers.map((row) => String(row.id))),
    ...out.tray.map((t) => String(t.layer.id)),
  ]);
  for (const entry of out.lineage.forward) {
    for (const id of entry.layerIds) assert.equal(known.has(id), true, `${id} names no layer of this document`);
  }
}

test('a slide of many small pictures and bodies adds at most two continuations and trays no words', () => {
  // A diagram slide as decks draw one: 36 icons, each a small fraction of the slide,
  // and 8 labelled bodies of a few sentences.
  const icons: SourceObjectV1[] = Array.from({ length: 36 }, (_, i) => ({
    id: `icon${i}`, fingerprint: `fp:icon${i}`, kind: 'pic', box: { x: 40 + (i % 12) * 100, y: 200 + Math.floor(i / 12) * 100, w: 48, h: 48, rot: 0 },
    origin: 'slide', fidelity: { state: 'raster-preserved' }, media: `user/media/icon${i}`, readingIndex: 1 + i * 2,
  }));
  const bodies: SourceObjectV1[] = Array.from({ length: 8 }, (_, i) =>
    text(`b${i}`, `Label ${i}. ${'The platform runs the same way on every host it meets. '.repeat(3)}`.trim(), { readingIndex: 2 + i * 9 }));
  const objects = [text('t', 'Where it runs', { readingIndex: 0 }), ...icons, ...bodies];
  const entries = [
    obj('t', { class: 'title', role: 'title' }),
    ...icons.map((icon) => obj(icon.id, { class: 'unknown', review: 'needs-attention', author: 'rule' })),
    ...bodies.map((body) => obj(body.id, { class: 'body', role: 'body', author: 'rule' })),
  ];
  assert.ok((48 * 48) / (1280 * 720) < INCIDENTAL_PICTURE_SHARE, 'each icon is under the floor');
  const out = run(bench(objects, entries), { applyUnreviewed: true, applyNeedsAttention: true });

  const continuations = out.frames.filter((f) => f.continuation).length;
  assert.ok(continuations <= 2, `${continuations} continuation slides for one slide of icons and labels`);
  assert.ok(continuations <= deckContinuationLimit(1));
  assert.equal(out.tray.filter((t) => t.layer.kind === 'text').length, 0, 'no words wait in the tray');
  const trayed = out.report.entries.filter((e) => e.code === 'object.surplus-tray');
  assert.equal(trayed.length, 36, 'the icons wait in the tray');
  assert.ok(trayed.every((e) => e.reason === 'small-pictures'));
  assert.match(String(trayed[0]?.message), /with the other small pictures of its slide/);
  assert.equal(out.frames.some((f) => f.continuation && f.archetype === 'visual'), false, 'no slide is spent on one icon');
  assertForwardLayersExist(out);
});

test('the deck adds at most its bound of continuations, and pictures reach the bound before words', () => {
  assert.equal(deckContinuationLimit(0), 2);
  assert.equal(deckContinuationLimit(3), 2);
  assert.equal(deckContinuationLimit(20), 10);
  assert.ok(MAX_CONTINUATION_FRAMES <= 3);

  // One slide whose leftovers are two tall bodies and two large pictures: the
  // words take the continuations and the pictures wait in the tray.
  const tall = (id: string, reading: number): SourceObjectV1 => text(id, `${id} ${'word '.repeat(220)}`.trim(), { readingIndex: reading });
  const photo = (id: string, reading: number): SourceObjectV1 => ({
    id, fingerprint: `fp:${id}`, kind: 'pic', box: { x: 0, y: 0, w: 640, h: 360, rot: 0 },
    origin: 'slide', fidelity: { state: 'raster-preserved' }, media: `user/media/${id}`, readingIndex: reading,
  });
  const made = bench(
    [text('t', 'The title', { readingIndex: 0 }), photo('p1', 1), photo('p2', 2), tall('b1', 3), tall('b2', 4), tall('b3', 5)],
    [
      obj('t', { class: 'title', role: 'title' }),
      obj('p1', { class: 'photo', role: 'visual' }),
      obj('p2', { class: 'photo', role: 'visual' }),
      obj('b1', { class: 'body', role: 'body' }),
      obj('b2', { class: 'body', role: 'body' }),
      obj('b3', { class: 'body', role: 'body' }),
    ],
  );
  const out = run(made);
  assert.equal(out.frames.filter((f) => f.continuation).length, 2);
  assert.deepEqual(out.frames.filter((f) => f.continuation).map((f) => f.archetype), ['content', 'content'], 'words first');
  const trayed = out.report.entries.filter((e) => e.code === 'object.surplus-tray');
  assert.deepEqual(trayed.map((e) => [e.objectId, e.reason]), [['p1', 'deck-continuation-limit'], ['p2', 'deck-continuation-limit']]);
  assertForwardLayersExist(out);
});

test('a line the footer already carries is not joined to it a second time', () => {
  const line = (id: string, words: string, reading: number): SourceObjectV1 =>
    text(id, words, { readingIndex: reading, origin: 'layout' });
  const made = bench(
    [
      text('t', 'The title', { readingIndex: 0 }),
      line('c1', 'Copyright © SUSE 2022 ', 1),
      line('c2', 'Copyright  ©  SUSE 2022', 2),
    ],
    [
      obj('t', { class: 'title', role: 'title' }),
      obj('c1', { class: 'recurring-text', role: 'caption', review: 'needs-attention', author: 'rule' }),
      obj('c2', { class: 'recurring-text', role: 'caption', review: 'needs-attention', author: 'rule' }),
    ],
  );
  const out = run(made);
  const footer = layerById(out, 'r.slide1.footer');
  assert.equal(String(footer?.text).replace(/\s+/g, ' ').trim(), 'Copyright © SUSE 2022', 'one copy of the line');
  const backward = new Map(out.lineage.backward.map((e) => [e.layerId, e]));
  assert.deepEqual(backward.get('r.slide1.footer')?.sourceObjectIds, ['c1', 'c2'], 'both copies trace to the one footer');
  const forward = new Map(out.lineage.forward.map((e) => [e.sourceObjectId, e.layerIds]));
  assert.deepEqual(forward.get('c2'), ['r.slide1.footer']);
});

test('every role-bound text row keeps the ink its placeholder states, unless the contrast guard names it', async () => {
  const deck = await source();
  const accented = await plan();
  // A mapping that would move every text object to a chromatic accent, and one
  // to a grey: neither may reach a title, a body, a caption or the furniture.
  const textIds = deck.slides.flatMap((slide) => slide.objects).filter((o) => o.kind === 'text').map((o) => o.id);
  accented.colors = [
    ...accented.colors,
    { useId: 'use/accent/all', from: '#000000', role: 'accent', to: '#1f4fd1', affects: textIds },
    { useId: 'use/ink/grey', from: '#000000', role: 'ink', to: '#6f6f6f', affects: textIds },
  ];
  const out = compileRenovated({ source: deck, plan: accented, master: master(), designSystem: DESIGN_SYSTEM, opts: { applyUnreviewed: true, applyNeedsAttention: true } });
  const guarded = new Set(out.report.entries.filter((e) => e.code === 'colour.contrast-below-minimum').map((e) => String(e.layerId)));
  let checked = 0;
  for (const frame of out.frames) {
    const seeded = seedFrame(master(), frame.archetype, {
      frameId: frame.id, x: Number(frame.layers[0]?.x ?? 0), y: 0, resolveToken: DESIGN_SYSTEM.tokens,
    });
    assert.ok(seeded);
    const inks = new Map(seeded.layers.map((row) => [String(row.id), row.fg]));
    for (const row of frame.layers) {
      if (row.kind !== 'text' || !(row.role || row.furniture)) continue;
      if (['number', 'quote'].includes(String(row.role))) continue;
      const id = String(row.id);
      if (!inks.has(id) || guarded.has(id)) continue;
      assert.equal(row.fg, inks.get(id), `${id} takes the ink its placeholder states`);
      checked += 1;
    }
  }
  assert.ok(checked >= 5, `only ${checked} role-bound rows were checked`);
});

test('report sentences name objects in words, never by class id, kind, frame id or use id', async () => {
  const out = await compiled({ applyUnreviewed: true, applyNeedsAttention: true });
  const machine = /[a-z]+-[a-z]+ on slide|r\.ppt-|\bpic\b|:text|:fill|use\/|ppt\/slides/;
  for (const entry of out.report.entries) {
    // A source warning is the reader's own sentence, carried as it stands.
    if (entry.reason && entry.code.startsWith('source.')) continue;
    assert.doesNotMatch(entry.message, machine, `${entry.code}: ${entry.message}`);
  }
});

// ─── several pictures on one slide (milestone 4) ─────────────────────────────

/** A kept photo at a box of its own, so its aspect is the box's. */
function photoAt(id: string, reading: number, w: number, h: number): SourceObjectV1 {
  return {
    id, fingerprint: `fp:${id}`, kind: 'pic', box: { x: 40 + reading * 10, y: 40, w, h, rot: 0 },
    origin: 'slide', fidelity: { state: 'raster-preserved' }, media: `user/media/${id}`, readingIndex: reading,
  };
}

/** The image layers that carry a picture on one frame, in paint order, furniture left out. */
function pictureLayers(frame: CompiledDeckV1['frames'][number]): DesignBoxRowV1[] {
  return frame.layers.filter((row) => row.kind === 'image' && !row.furniture && typeof row.image === 'string' && row.image.startsWith('user/media/'));
}

test('pictureGrid lays pictures out in reading order, inside the box, at their own aspect, with equal gutters', () => {
  const box = { x: 100, y: 50, w: 1000, h: 500 };
  const cells = pictureGrid(box, [1, 1, 1, 1], 20);
  assert.equal(cells.length, 4);
  for (const cell of cells) {
    assert.ok(cell.x >= box.x && cell.y >= box.y, 'inside the box');
    assert.ok(cell.x + cell.w <= box.x + box.w && cell.y + cell.h <= box.y + box.h, 'inside the box');
    assert.ok(Math.abs(cell.w - cell.h) <= 1, `a square picture stays square: ${cell.w} by ${cell.h}`);
  }
  // Four squares in a 2:1 box with a 20 px gutter show the most as two rows of two
  // (240 px each) rather than one row of four (235 px each), centred in the box.
  const [a, b, c, d] = cells as [typeof cells[number], typeof cells[number], typeof cells[number], typeof cells[number]];
  assert.equal(a.y, b.y, 'reading order runs along a row first');
  assert.equal(c.y, d.y);
  assert.equal(b.x - (a.x + a.w), 20, 'the gutter between two pictures is the gutter');
  assert.equal(c.y - (a.y + a.h), 20, 'across rows too');
  assert.equal(a.x - box.x, box.x + box.w - (b.x + b.w), 'the block is centred');

  // Three wide pictures in a squarish box stack; three tall ones sit side by side.
  const wide = pictureGrid({ x: 0, y: 0, w: 600, h: 600 }, [3, 3, 3], 16);
  assert.ok(wide.every((c) => c.x === wide[0]?.x), 'wide pictures stack in one column');
  const tall = pictureGrid({ x: 0, y: 0, w: 600, h: 600 }, [1 / 3, 1 / 3, 1 / 3], 16);
  assert.ok(tall.every((c) => c.y === tall[0]?.y), 'tall pictures sit in one row');

  // A short last row is centred under the rows above it.
  const five = pictureGrid({ x: 0, y: 0, w: 900, h: 600 }, [1, 1, 1, 1, 1], 0);
  const rows = [...new Set(five.map((c) => c.y))];
  assert.equal(rows.length, 2);
  const last = five.filter((c) => c.y === rows[1]);
  const left = (last[0]?.x ?? 0);
  const right = 900 - ((last[last.length - 1]?.x ?? 0) + (last[last.length - 1]?.w ?? 0));
  assert.ok(Math.abs(left - right) <= 1, `the short last row is centred: ${left} and ${right}`);

  assert.deepEqual(pictureGrid(box, [], 20), []);
  assert.deepEqual(pictureGrid(box, [0, Number.NaN], 20).length, 2, 'an unknown aspect is drawn square');
});

test('several pictures share the visual slot as one grid, with no continuation slide', () => {
  const photos = [photoAt('p1', 1, 400, 300), photoAt('p2', 2, 400, 300), photoAt('p3', 3, 300, 400), photoAt('p4', 4, 400, 400)];
  const made = bench(
    [text('t', 'The booth', { readingIndex: 0 }), ...photos],
    [obj('t', { class: 'title', role: 'title' }), ...photos.map((p) => obj(p.id, { class: 'photo' }))],
    'visual',
  );
  const out = run(made);
  assert.equal(out.frames.length, 1, 'one slide of pictures stays one slide');
  const frame = out.frames[0];
  assert.ok(frame);
  const slot = frame.layers.find((row) => row.id === 'r.slide1.visual');
  assert.ok(slot);
  const pictures = pictureLayers(frame);
  assert.deepEqual(pictures.map((row) => row.image), photos.map((p) => `user/media/${p.id}`), 'every picture, in reading order');
  assert.equal(pictures[0]?.id, 'r.slide1.visual', 'the first cell is the bound slot');
  assert.equal(pictures[0]?.role, 'visual');
  assert.deepEqual(pictures.slice(1).map((row) => row.id), ['r.slide1.visual.cell-2', 'r.slide1.visual.cell-3', 'r.slide1.visual.cell-4']);
  for (const row of pictures) {
    assert.equal(row.fit, 'contain');
    assert.equal(row.frame, 'r.slide1');
  }
  assert.equal(out.tray.length, 0);
  assert.equal(out.report.entries.filter((e) => e.code === 'slide.continuation-added').length, 0);
  for (const p of photos) {
    const forward = out.lineage.forward.find((f) => f.sourceObjectId === p.id);
    assert.equal(forward?.layerIds.length, 1, `${p.id} names its one cell`);
    assert.equal(out.report.entries.filter((e) => e.objectId === p.id && e.disposition).length, 1, `${p.id} is accounted for once`);
  }
  assertForwardLayersExist(out);
  finalizeReport(out.report, ['t', ...photos.map((p) => p.id)]);
});

test('pictures past a full grid go to one continuation with a grid of its own, then the tray', () => {
  const photos = Array.from({ length: 14 }, (_, i) => photoAt(`p${i + 1}`, i + 1, 400, 300));
  const made = bench(
    [text('t', 'Every product', { readingIndex: 0 }), ...photos],
    [obj('t', { class: 'title', role: 'title' }), ...photos.map((p) => obj(p.id, { class: 'photo' }))],
    'split',
  );
  const out = run(made);
  const continuations = out.frames.filter((f) => f.continuation);
  assert.equal(continuations.length, 1, 'never one frame per picture');
  assert.equal(continuations[0]?.archetype, 'visual');
  assert.equal(continuations[0]?.name, 'Every product (2)', 'named for its slide and its place, with no English word');
  const own = out.frames.find((f) => !f.continuation);
  assert.ok(own);
  // Plan 275 decision 30: every box takes content before a continuation, so the
  // split layout's free body box holds a seventh picture beside the grid of six.
  assert.equal(pictureLayers(own).length, MAX_GRID_PICTURES + 1);
  assert.equal(pictureLayers(continuations[0] as CompiledDeckV1['frames'][number]).length, MAX_GRID_PICTURES);
  const trayed = out.report.entries.filter((e) => e.code === 'object.surplus-tray');
  assert.deepEqual(trayed.map((e) => [e.objectId, e.reason]), [['p14', 'picture-grid-full']]);
  assert.match(String(trayed[0]?.message), /already show 6 pictures each/);
  const moved = out.report.entries.filter((e) => e.code === 'object.surplus-continuation').map((e) => e.objectId);
  assert.equal(moved.length, MAX_GRID_PICTURES, 'each picture on the continuation is reported as moved there');
  assert.equal(out.report.entries.filter((e) => e.code === 'slide.continuation-added').length, 1);
  assertForwardLayersExist(out);
  finalizeReport(out.report, ['t', ...photos.map((p) => p.id)]);
});

test('a layout with no picture slot sends its pictures to one continuation grid', () => {
  const photos = Array.from({ length: 3 }, (_, i) => photoAt(`q${i + 1}`, i + 2, 300, 300));
  const made = bench(
    [text('t', 'Three shots', { readingIndex: 0 }), text('b', 'Some words about them.', { readingIndex: 1 }), ...photos],
    [obj('t', { class: 'title', role: 'title' }), obj('b', { class: 'body', role: 'body' }), ...photos.map((p) => obj(p.id, { class: 'photo' }))],
  );
  const out = run(made);
  assert.deepEqual(out.frames.map((f) => [f.archetype, f.continuation ?? false]), [['content', false], ['visual', true]]);
  assert.equal(pictureLayers(out.frames[1] as CompiledDeckV1['frames'][number]).length, 3);
  assert.equal(out.tray.length, 0);
  assertForwardLayersExist(out);
});

test('a picture slot too small for a grid places no picture in silence', () => {
  // pictureGrid gives no cells when the gutters leave no room, and the pictures
  // that were to join the grid were taken off the queue anyway: reported as
  // retained, on no frame. Each one now ends on a layer or in the tray with a reason.
  const base = master();
  const tiny = { x: 0.4, y: 0.4, w: 0.005, h: 0.005 };
  const small: SlideMasterV1 = {
    ...base,
    archetypes: base.archetypes.map((archetype) => ({
      ...archetype,
      placeholders: archetype.placeholders.map((ph) => (ph.kind === 'image' ? { ...ph, box: tiny } : ph)),
    })),
  };
  const photos = Array.from({ length: 3 }, (_, i) => photoAt(`g${i + 1}`, i + 1, 400, 300));
  const made = bench(
    [text('t', 'Three shots', { readingIndex: 0 }), ...photos],
    [obj('t', { class: 'title', role: 'title' }), ...photos.map((p) => obj(p.id, { class: 'photo' }))],
    'visual',
  );
  const out = compileRenovated({ source: made.deck, plan: made.plan, master: small, designSystem: DESIGN_SYSTEM, opts: {} });
  const layerIds = new Set([...out.frames.flatMap((frame) => frame.layers.map((row) => String(row.id))), ...out.tray.map((item) => String(item.layer.id))]);
  for (const p of photos) {
    const entry = out.report.entries.find((e) => e.objectId === p.id && e.disposition);
    assert.ok(entry?.layerId, `${p.id} names the layer it went to`);
    assert.ok(layerIds.has(entry.layerId), `${p.id} sits on a frame or in the tray`);
  }
  const trayed = out.report.entries.filter((e) => e.code === 'object.surplus-tray');
  assert.ok(trayed.length > 0, 'the pictures a grid could not show wait in the tray');
  for (const entry of trayed) {
    assert.equal(entry.reason, 'picture-grid-no-room');
    assert.match(entry.message, /too small to show it beside the others/);
  }
  assertForwardLayersExist(out);
  finalizeReport(out.report, ['t', ...photos.map((p) => p.id)]);
});


// ─── plan 275: formatting, any content in any box, the pour ──────────────────

/** A text object whose paragraphs are stated in full. */
function rich(id: string, paras: NonNullable<SourceObjectV1['text']>['paras'], over: Partial<SourceObjectV1> = {}): SourceObjectV1 {
  return { ...text(id, ''), text: { paras }, ...over };
}

test('plan 275: the renovated body carries bold lead-ins, an italic citation, a three-level list and a numbered list', () => {
  const body = rich('b', [
    { runs: [{ text: 'Scope:', bold: true }, { text: ' what changes' }], bullet: 'bullet' },
    { runs: [{ text: 'Second level' }], bullet: 'bullet', lvl: 1 },
    { runs: [{ text: 'Third level' }], bullet: 'bullet', lvl: 2 },
    { runs: [{ text: 'Source: the survey', italic: true }] },
    { runs: [{ text: 'Agree' }], bullet: 'number' },
    { runs: [{ text: 'Review' }], bullet: 'number' },
  ]);
  const out = run(bench([text('t', 'Lists'), body], [obj('t', { class: 'title', role: 'title' }), obj('b', { class: 'body', role: 'body' })]));
  const row = layerById(out, 'r.slide1.body');
  assert.equal(row?.text, '- **Scope:** what changes\n  - Second level\n    - Third level\n*Source: the survey*\n1. Agree\n2. Review');
  assert.equal(row?.weight, '400', 'the row states the regular weight, so only the marked runs are bold');
  assert.equal(plainOfDesignText(String(row?.text)), 'Scope: what changes\nSecond level\nThird level\nSource: the survey\nAgree\nReview');
  assert.equal(out.report.entries.some((e) => e.code === 'text.overflow'), false, 'the estimate measures words, not markers');
  finalizeReport(out.report, ['t', 'b']);
});

test('plan 275: what Design text has no token for is reported once per object, and a corrected text replaces the reading', () => {
  const noted = rich('b', [{ runs: [{ text: 'E=mc' }, { text: '2', baseline: 'super' }, { text: ' and ' }, { text: 'a link', href: 'https://example.invalid/' }] }]);
  const out = run(bench([text('t', 'Title'), noted], [obj('t', { class: 'title', role: 'title' }), obj('b', { class: 'body', role: 'body' })]));
  const entries = out.report.entries.filter((e) => e.code === 'text.formatting-not-carried');
  assert.deepEqual(entries.map((e) => [e.objectId, e.reason]), [['b', 'superscript,links']]);
  assert.match(String(entries[0]?.message), /without its superscript and links/);

  const listed = rich('c', [{ runs: [{ text: 'Frist' }], bullet: 'bullet' }, { runs: [{ text: 'Secnod' }], bullet: 'bullet' }]);
  const fixed = run(bench([text('t', 'Title'), listed], [obj('t', { class: 'title', role: 'title' }), obj('c', { class: 'body', role: 'body', textOverride: 'First\nSecond *really*' })]));
  assert.equal(layerById(fixed, 'r.slide1.body')?.text, '- First\n- Second \\*really\\*', 'plain words, the list kind kept, markers escaped');
  const corrected = fixed.report.entries.filter((e) => e.code === 'text.corrected');
  assert.deepEqual(corrected.map((e) => [e.objectId, e.layerId, e.author]), [['c', 'r.slide1.body', 'user']]);
  assert.equal(fixed.report.entries.some((e) => e.code === 'text.formatting-not-carried' && e.objectId === 'c'), false, 'a plain source loses nothing to a correction');
  finalizeReport(fixed.report, ['t', 'c']);

  // A correction is plain words: the bold lead-ins and the italic it replaced are named.
  const formatted = rich('d', [
    { runs: [{ text: 'Scope:', bold: true }, { text: ' what chnages' }, { text: '\n' }, { text: 'on a second line' }], bullet: 'bullet' },
    { runs: [{ text: 'Owner:', bold: true }, { text: ' the team', italic: true }], bullet: 'bullet' },
  ]);
  const typo = run(bench([text('t', 'Title'), formatted], [obj('t', { class: 'title', role: 'title' }),
    obj('d', { class: 'body', role: 'body', textOverride: 'Scope: what changes\non a second line\nOwner: the team' })]));
  assert.equal(layerById(typo, 'r.slide1.body')?.text, '- Scope: what changes\n  on a second line\n- Owner: the team', 'the soft break stays in the first item');
  const lost = typo.report.entries.filter((e) => e.code === 'text.formatting-not-carried' && e.objectId === 'd');
  assert.deepEqual(lost.map((e) => e.reason), ['bold,italic']);
  assert.match(String(lost[0]?.message), /The corrected text on slide 1 is plain words, so the bold and italic the source text carried did not travel\./);
  finalizeReport(typo.report, ['t', 'd']);
});

test('plan 275 decision 30: a picture takes the body box when the layout has no picture box, and text takes a picture box', () => {
  const photo: SourceObjectV1 = {
    id: 'p', fingerprint: 'fp:p', kind: 'pic', box: { x: 100, y: 200, w: 600, h: 400, rot: 0 },
    origin: 'slide', fidelity: { state: 'raster-preserved' }, media: 'user/media/p',
  };
  const out = run(bench([text('t', 'A picture'), photo], [obj('t', { class: 'title', role: 'title' }), obj('p', { class: 'photo' })]));
  assert.equal(out.frames.length, 1, 'no continuation while a box is free');
  const body = layerById(out, 'r.slide1.body');
  assert.equal(body?.kind, 'image', 'the body box became a picture layer');
  assert.equal(body?.image, 'user/media/p');
  assert.equal(body?.fit, 'contain', 'a text box fits a picture whole');
  assert.equal(body?.role, 'body', 'the box keeps its master binding');
  assert.equal(body?.fontSize, undefined, 'no type is left on a picture layer');

  const words = run(bench(
    [text('t', 'Words'), text('b1', 'The first text'), text('b2', 'A second text for the picture box')],
    [obj('t', { class: 'title', role: 'title' }), obj('b1', { class: 'body', role: 'body' }), obj('b2', { class: 'body', role: 'body' })],
    'visual',
  ));
  const visual = layerById(words, 'r.slide1.visual');
  assert.equal(visual?.kind, 'text', 'the picture box became a text layer');
  assert.match(String(visual?.text), /The first text|A second text/);
  assert.equal(visual?.image, undefined);
  assert.equal(words.frames.length, 1, 'both texts are on the slide');
});

/** MEDDPICC slide 3's shape: eight rows of a letter and a line with a bold lead-in. */
function lettered(): { objects: SourceObjectV1[]; entries: ObjectPlanV1[] } {
  const rows = [['M', 'METRICS'], ['E', 'ECONOMIC BUYER'], ['D', 'DECISION CRITERIA'], ['D', 'DECISION PROCESS'],
    ['P', 'PAPER PROCESS'], ['I', 'IDENTIFY PAIN'], ['C', 'CHAMPION'], ['C', 'COMPETITION']];
  const objects: SourceObjectV1[] = [];
  const entries: ObjectPlanV1[] = [];
  rows.forEach(([letter, lead], i) => {
    const y = 60 + i * 78;
    objects.push(text(`l${i}`, letter as string, { box: { x: 240, y, w: 70, h: 70, rot: 0 }, readingIndex: i * 2 }));
    objects.push(rich(`r${i}`, [{ runs: [{ text: `${lead} - `, bold: true }, { text: 'what a seller learns and does at this step' }] }],
      { box: { x: 354, y, w: 626, h: 70, rot: 0 }, readingIndex: i * 2 + 1 }));
    entries.push(obj(`l${i}`, { class: 'body' }), obj(`r${i}`, { class: 'body' }));
  });
  return { objects, entries };
}

test('plan 275 F9: eight lettered rows pour four and four into Numbered list, letters kept, bold lead-ins bold', () => {
  const { objects, entries } = lettered();
  const out = run(bench(objects, entries, 'numbered-rows'));
  assert.deepEqual(out.frames.map((f) => [f.archetype, f.continuation ?? false]), [['numbered-rows', false], ['numbered-rows', true]]);
  for (const [f, frame] of out.frames.entries()) {
    const numbers = frame.layers.filter((row) => row.role === 'number').map((row) => row.text);
    const bodies = frame.layers.filter((row) => row.role === 'body').map((row) => String(row.text));
    assert.deepEqual(numbers, f === 0 ? ['M', 'E', 'D', 'D'] : ['P', 'I', 'C', 'C'], 'each letter in its row\'s number box');
    assert.equal(bodies.length, 4);
    for (const body of bodies) assert.match(body, /^\*\*[A-Z ]+ -\*\* what a seller/, 'the lead-in stays bold');
  }
  assert.equal(layerById(out, 'r.slide1.body')?.text, '**METRICS -** what a seller learns and does at this step');
  const poured = out.report.entries.filter((e) => e.code === 'layout.poured-to-continuation');
  assert.equal(poured.length, 1);
  assert.match(String(poured[0]?.message), /8 boxes of content on slide 1 poured into Numbered list, which holds 4; the rest continue on slide 2\./);
  assert.equal(out.tray.length, 0);
  finalizeReport(out.report, objects.map((o) => o.id));
});

test('plan 275 review: letters the census took for decoration reach the number boxes, even after Accept all', () => {
  // The real census reads MEDDPICC's letters, each a separate text box, as decoration
  // and proposes removing them. Accept all answers that proposal as it stands.
  const { objects, entries } = lettered();
  const asDecoration = (review: ObjectPlanV1['review'], accepted: boolean): ObjectPlanV1[] => entries.map((e) => (e.id.startsWith('l')
    ? { ...e, class: 'decoration', proposal: 'remove', review, author: 'user', ...(accepted ? { decision: 'remove' } : {}) } as ObjectPlanV1
    : e));
  for (const [label, rows] of [['after Accept all', asDecoration('accepted', true)], ['unreviewed', asDecoration('unreviewed', false)]] as const) {
    const out = run(bench(objects, rows, 'numbered-rows'), { applyUnreviewed: true });
    const numbers = out.frames.map((frame) => frame.layers.filter((row) => row.role === 'number').map((row) => row.text));
    assert.deepEqual(numbers, [['M', 'E', 'D', 'D'], ['P', 'I', 'C', 'C']], `${label}: each letter in its row's number box`);
    const kept = out.report.entries.filter((e) => e.reason === 'row-marker-kept');
    assert.equal(kept.length, 8, `${label}: the report names every letter it kept`);
    assert.match(String(kept[0]?.message), /The marker "M" on slide 1 was kept in its row's number box/);
    finalizeReport(out.report, objects.map((o) => o.id));
  }

  // A layout with no number box leaves the decision as it stands.
  const content = run(bench(objects, asDecoration('accepted', true), 'content'));
  assert.equal(content.report.entries.filter((e) => e.reason === 'row-marker-kept').length, 0);
  assert.equal(content.report.entries.filter((e) => e.objectId?.startsWith('l') && e.disposition === 'removed').length, 8);

  // An answer someone gave against the proposal is theirs: a letter a person removed is not rescued.
  const replaced = asDecoration('accepted', true).map((e) => (e.id === 'l0' ? { ...e, proposal: 'keep', decision: 'remove' } as ObjectPlanV1 : e));
  const answered = run(bench(objects, replaced, 'numbered-rows'));
  assert.equal(answered.report.entries.find((e) => e.objectId === 'l0' && e.disposition)?.disposition, 'removed');
});

test('plan 275 F9: two peer body boxes share the rows four and four, each letter kept with its line', () => {
  const { objects, entries } = lettered();
  const out = run(bench(objects, entries, 'two-column'));
  assert.equal(out.frames.length, 1);
  const left = String(layerById(out, 'r.slide1.body')?.text).split('\n');
  const right = String(layerById(out, 'r.slide1.body-2')?.text).split('\n');
  assert.equal(left.length, 8, 'four rows of a letter and a line');
  assert.equal(right.length, 8);
  assert.deepEqual(left.filter((_, i) => i % 2 === 0), ['M', 'E', 'D', 'D']);
  assert.deepEqual(right.filter((_, i) => i % 2 === 0), ['P', 'I', 'C', 'C']);
  assert.equal(layerById(out, 'r.slide1.title')?.text, '', 'none of eight like rows is taken for a heading');
  finalizeReport(out.report, objects.map((o) => o.id));
});

test('plan 275 F17: frames are laid out four to a row on the Design canvas', () => {
  assert.deepEqual([0, 3, 4, 9].map((i) => framePosition(i, 1280, 720)), [
    { x: 0, y: 0 }, { x: 4080, y: 0 }, { x: 0, y: 800 }, { x: 1360, y: 1600 },
  ]);
  const hash = `sha256:${'4'.repeat(64)}`;
  const slides = Array.from({ length: 5 }, (_, i) => ({
    id: `s${i}`, index: i, width: 1280, height: 720, background: {}, objects: [text(`t${i}`, `Slide ${i}`)],
    readingOrder: [`t${i}`], warnings: [], origin: { kind: 'pptx' as const },
  }));
  const faithful = compileFaithful({
    version: 1, source: { kind: 'pptx', hash, lineageId: 'lin', instanceId: 'inst', pageCount: 5 },
    slides, fonts: [], warnings: [], reader: { name: 'pptx-read', version: 'test' },
  });
  assert.deepEqual(faithful.frames.map((f) => [f.layers[0]?.x, f.layers[0]?.y]), [[0, 0], [1360, 0], [2720, 0], [4080, 0], [0, 800]]);
});

test('plan 275 section 6.2: a slide on a Dark ground compiles on the layout\'s dark variant', () => {
  const m = master();
  assert.equal(archetypeIdFor({ layout: 'content' }, m), 'content');
  assert.equal(archetypeIdFor({ layout: 'content', ground: 'dark' }, m), 'content-dark');
  assert.equal(archetypeIdFor({ layout: 'quote', ground: 'dark' }, m), 'quote', 'a layout with no dark variant keeps its own');
  const made = bench([text('t', 'Dark'), text('b', 'On a dark ground')], [obj('t', { class: 'title', role: 'title' }), obj('b', { class: 'body', role: 'body' })]);
  const slide = made.plan.slides[0];
  assert.ok(slide);
  slide.ground = 'dark';
  assert.equal(run(made).frames[0]?.archetype, 'content-dark');
});

// ─── plan 275 decision 32: drawings compile to shapes, grouped ───────────────

/** A chart the way the chart tool writes one: two bar colours, gridlines, outlined labels. */
const CHART_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><title>bar chart</title><desc>Source: test data.</desc>'
  + '<rect width="400" height="200" fill="none"/>'
  + [100, 200, 300].map((x) => `<line x1="${x}" y1="10" x2="${x}" y2="170" stroke="#999999" opacity="0.3"/>`).join('')
  + [50, 100].map((y) => `<path transform="translate(10,${y})" d="M0 0h40v10h-40z" fill="#141414" opacity="0.8"/>`).join('')
  + '<rect x="100" y="40" width="200" height="30" rx="4" fill="#1f4e79" data-recolor="A"/>'
  + '<rect x="100" y="90" width="120" height="30" rx="4" fill="#1f4e79" data-recolor="B"/>'
  + '<rect x="100" y="140" width="60" height="30" rx="4" fill="#d65a28" data-recolor="C"/></svg>';

const svgParse = (xml: string) => domParser.parseFromString(xml, 'image/svg+xml');
const CHART_ITEMS: VectorItemsV1 = svgItemsOf(CHART_SVG, svgParse);

/** A chart object read from an SVG picture, with its PNG as media. */
function chartObject(id: string, over: Partial<SourceObjectV1> = {}): SourceObjectV1 {
  return {
    id,
    fingerprint: `vector:${id}`,
    kind: 'vector',
    box: { x: 100, y: 150, w: 800, h: 400, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    media: 'user/media/chart-png',
    mediaMime: 'image/png',
    vector: CHART_SVG,
    vectorItems: CHART_ITEMS,
    readingIndex: 1,
    ...over,
  };
}

const chartBench = (objects: SourceObjectV1[], layout: ArchetypeRefV1 = 'visual') => bench(
  [text('t', 'Revenue by region', { readingIndex: 0, placeholder: 'title' }), ...objects],
  [obj('t', { class: 'title', role: 'title' }), ...objects.map((o) => obj(o.id, { class: 'chart' }))],
  layout,
);

test('plan 275: a chart compiles to one group of box and path rows in the picture slot, with no picture layer', () => {
  const out = run(chartBench([chartObject('c')]));
  const frame = out.frames[0]!;
  assert.equal(frame.layers.some((row) => row.kind === 'image' && row.image === 'user/media/chart-png'), false, 'no PNG layer');
  const rows = frame.layers.filter((row) => String(row.group ?? '').startsWith('vector:'));
  assert.equal(rows.length, CHART_ITEMS.items.length);
  assert.equal(new Set(rows.map((row) => row.group)).size, 1, 'one group');
  assert.deepEqual([...new Set(rows.map((row) => row.kind))].sort(), ['box', 'path']);
  assert.equal(rows.filter((row) => row.kind === 'box').length, 3, 'the bars are boxes');
  const forward = out.lineage.forward.find((edge) => edge.sourceObjectId === 'c');
  assert.deepEqual(forward?.layerIds, rows.map((row) => row.id), 'one object to every row');
  for (const row of rows) {
    assert.deepEqual(out.lineage.backward.find((edge) => edge.layerId === row.id)?.sourceObjectIds, ['c'], 'each row back to the chart');
  }
  const entry = out.report.entries.find((e) => e.objectId === 'c' && e.disposition);
  assert.equal(entry?.code, 'object.transformed');
  assert.equal(CHART_ITEMS.items.length, 8, 'three gridlines, two labels and three bars; the empty background is no part');
  assert.match(String(entry?.message), /carried over as 8 editable shapes in one group\. It credits its source: Source: test data\./);
  // Contained in the slot the chart took: the slot row itself is gone.
  const slotRow = seedFrame(master(), 'visual', { frameId: frame.id, x: 0, y: 0, name: 'x', order: 0, resolveToken: DESIGN_SYSTEM.tokens })!
    .layers.find((row) => row.role === 'visual')!;
  assert.equal(frame.layers.some((row) => row.id === `${frame.id}.visual`), false, 'the slot row is replaced');
  const originX = Number(frame.layers[0]!.x);
  for (const row of rows) {
    assert.ok(Number(row.x) >= originX + Number(slotRow.x) - 1 && Number(row.x) + Number(row.w) <= originX + Number(slotRow.x) + Number(slotRow.w) + 1, `${row.id} sits in the slot`);
  }
});

test('plan 275: a colour mapping writes a chart row only where the row holds its source colour', () => {
  const made = chartBench([chartObject('c')]);
  const mapping = (useId: string, from: string, to: string, role: ColorMappingV1['role']): ColorMappingV1 => ({ useId, from, to, role, affects: ['c'] });
  made.plan.colors = [
    mapping('c:series:1', '#1f4e79', '#aa0000', 'series'),
    mapping('c:series:2', '#d65a28', '#00aa00', 'series'),
    mapping('c:stroke:999999', '#999999', '#555555', 'stroke'),
    mapping('c:text:141414', '#141414', '#fafafa', 'ink'),
  ];
  const out = run(made);
  const rows = out.frames[0]!.layers.filter((row) => String(row.group ?? '').startsWith('vector:'));
  const bars = rows.filter((row) => row.kind === 'box');
  assert.deepEqual(bars.map((row) => row.bg), ['#aa0000', '#aa0000', '#00aa00'], 'the two series stay apart');
  const lines = rows.filter((row) => row.name === 'Line');
  assert.ok(lines.every((row) => row.stroke === '#555555' && row.bg === ''), 'a stroke mapping reaches strokes and paints no fill onto a line');
  const labels = rows.filter((row) => row.kind === 'path' && row.name !== 'Line');
  assert.ok(labels.every((row) => row.bg === '#fafafa'), 'an ink mapping reaches the outlined labels');
  assert.equal(out.report.entries.filter((e) => e.code === 'colour.assigned' && /already wrote/.test(String(e.message))).length, 0, 'no mapping collides with another');
});

test('plan 275: a drawing whose reading was refused stays its picture, and the report says why', () => {
  const refused = chartObject('big', {
    fidelity: { state: 'raster-preserved', fallbackAssetRef: 'user/media/chart-png', fallbackSource: 'embedded' },
    vectorItems: { version: 1, viewBox: { x: 0, y: 0, w: 400, h: 200 }, items: [], omitted: [{ reason: 'cap-reached', count: 2001 }] },
  });
  const renovated = run(chartBench([refused]));
  assert.ok(renovated.frames[0]!.layers.some((row) => row.kind === 'image' && row.image === 'user/media/chart-png'));
  const kept = renovated.report.entries.find((e) => e.code === 'vector.kept-as-picture');
  assert.equal(kept?.reason, 'cap-reached');
  const faithful = compileFaithful(chartBench([refused]).deck);
  const row = faithful.frames[0]!.layers.find((one) => one.name === 'big');
  assert.equal(row?.kind, 'image', 'the faithful compile draws the PNG, not a bare box');
  assert.equal(row?.image, 'user/media/chart-png');
});

test('plan 275: the faithful compile places a drawing at its own place, turned and mirrored with it', () => {
  const posed = chartObject('p', { box: { x: 100, y: 100, w: 400, h: 200, rot: 90 }, transform: [0, -1, -1, 0, 400, 400] });
  const out = compileFaithful(chartBench([posed]).deck);
  const rows = out.frames[0]!.layers.filter((row) => String(row.group ?? '').startsWith('vector:'));
  assert.equal(rows.length, CHART_ITEMS.items.length);
  assert.ok(rows.every((row) => row.rot === 90), 'every row takes the turn');
  assert.ok(rows.every((row) => row.flipH === true || row.flipV === true), 'and the mirror');
});

test('plan 275: more rows than a frame holds keep the later drawings as pictures', () => {
  const rects = Array.from({ length: 350 }, (_, i) => `<rect x="${i % 35}" y="${Math.floor(i / 35)}" width="1" height="1" fill="#000"/>`).join('');
  const items = svgItemsOf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 10">${rects}</svg>`, svgParse);
  const objects = [0, 1, 2, 3].map((i) => chartObject(`d${i}`, { vectorItems: items, readingIndex: i + 1 }));
  const out = compileFaithful(chartBench(objects).deck);
  const kept = out.report.entries.filter((e) => e.code === 'vector.kept-as-picture');
  assert.deepEqual(kept.map((e) => [e.objectId, e.reason]), [['d3', 'frame-cap']], '1,050 rows fit 1,200 and the fourth drawing does not');
});

/** Outlined label glyphs: many short curves per part, the weight a real chart deck carries. */
function heavyGlyphs(seed: number): string {
  let d = `M${seed % 7} ${seed % 5}`;
  for (let i = 0; i < 200; i++) {
    const x = 2 + i * 1.7 + Math.sin(seed + i) * 0.37;
    const y = 5 + Math.cos(seed * 3 + i) * 4.13;
    d += `C${(x - 0.61).toFixed(3)} ${(y + 1.19).toFixed(3)} ${(x - 0.29).toFixed(3)} ${(y - 1.43).toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  return `${d}Z`;
}

/** A deck of `count` slides, one heavy chart on each, compiled faithfully. */
function heavyChartDeck(count: number): ReturnType<typeof compileFaithful> {
  const heavy = (n: number): VectorItemsV1 => ({
    version: 1,
    viewBox: { x: 0, y: 0, w: 400, h: 200 },
    items: Array.from({ length: 20 }, (_, i) => ({
      kind: 'path' as const,
      d: heavyGlyphs(n * 31 + i),
      box: { x: 0, y: 0, w: 345, h: 10 },
      fill: { hex: '#141414' },
    })),
  });
  const hash = `sha256:${'5'.repeat(64)}`;
  const slides = Array.from({ length: count }, (_, i) => ({
    id: `s${i}`, index: i, width: 1280, height: 720, background: {},
    objects: [chartObject(`c${i}`, { vectorItems: heavy(i), readingIndex: 0 })],
    readingOrder: [`c${i}`], warnings: [], origin: { kind: 'pptx' as const },
  }));
  return compileFaithful({
    version: 1, source: { kind: 'pptx', hash, lineageId: 'lin', instanceId: 'heavy', pageCount: count },
    slides, fonts: [], warnings: [], reader: { name: 'pptx-read', version: 'test' },
  });
}

test('close-out 9.3: a deck of 31 heavy charts stays shapes, and deflates inside one history snapshot', () => {
  const out = heavyChartDeck(31);
  const rows = out.frames.flatMap((f) => f.layers);
  assert.ok(vectorRowsPathChars(rows) <= DOCUMENT_PATH_CHARS, 'the path data stays inside the cap');
  assert.equal(out.report.entries.filter((e) => e.code === 'vector.kept-as-picture').length, 0, 'no chart stays a picture for size alone');
  assert.equal(out.report.entries.filter((e) => e.code === 'object.transformed').length, 31);
  const deflated = deflateRawSync(Buffer.from(JSON.stringify(out.frames)), { level: 6 }).byteLength;
  assert.ok(deflated < 4 * 1024 * 1024, `the frames deflate to ${deflated} bytes, inside a 4 MiB history snapshot`);
});

test('close-out 9.3: past the cap, the later drawings stay pictures in deck order, and the report says why', () => {
  const out = heavyChartDeck(64);
  const rows = out.frames.flatMap((f) => f.layers);
  assert.ok(vectorRowsPathChars(rows) <= DOCUMENT_PATH_CHARS, 'the path data stays inside the cap');
  const kept = out.report.entries.filter((e) => e.code === 'vector.kept-as-picture');
  const carried = out.report.entries.filter((e) => e.code === 'object.transformed');
  assert.ok(kept.length > 0 && carried.length > 0, `the early charts are shapes and the later ones pictures (${carried.length} and ${kept.length})`);
  assert.equal(kept.length + carried.length, 64);
  assert.ok(kept.every((e) => e.reason === 'document-cap'), 'the report says why');
  assert.ok(Number(kept[0]!.objectId!.slice(1)) > Number(carried.at(-1)!.objectId!.slice(1)), 'the budget is spent in deck order');
  for (const entry of kept) {
    assert.ok(out.frames.some((f) => f.layers.some((row) => row.kind === 'image' && row.name === entry.objectId)), `${entry.objectId} keeps its picture`);
  }
  const deflated = deflateRawSync(Buffer.from(JSON.stringify(out.frames)), { level: 6 }).byteLength;
  assert.ok(deflated < 4 * 1024 * 1024, `a document at the cap deflates to ${deflated} bytes, inside a 4 MiB history snapshot`);
});

test('plan 275: a drawing sent to the tray waits there as its picture', () => {
  const made = bench(
    [text('t', 'Title', { readingIndex: 0, placeholder: 'title' }), chartObject('c')],
    [obj('t', { class: 'title', role: 'title' }), obj('c', { class: 'chart', surplus: 'tray' })],
    'title-only',
  );
  const out = run(made);
  const tray = out.tray.find((item) => item.sourceObjectId === 'c');
  assert.equal(tray?.layer.kind, 'image');
  assert.equal(out.report.entries.find((e) => e.code === 'vector.kept-as-picture')?.reason, 'tray');
});

test('plan 275: the vector fixture compiles faithfully to the rows its labels state', async () => {
  const bytes = new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/rebrand/vector.pptx')));
  const deck = await sourceDeckFromPptx(await inflatePptx(bytes), parseXml, {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, instanceId: 'vector', reader: { name: 'pptx-read', version: 'test' },
    sink: async (_b: Uint8Array, _m: string, hint: string): Promise<string> => `user/media/${hint.slice(0, 16)}`,
  });
  const labels = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/rebrand/vector.labels.json'), 'utf8')) as {
    slides: Array<{ index: number; objects: Array<{ authored: string; boxPx: { x: number; y: number }; kind: string; vector?: { rows?: { box: number; path: number; text: number }; keptAsPicture?: string } }> }>;
  };
  const out = compileFaithful(deck);
  let checked = 0;
  for (const slideLabel of labels.slides) {
    const slide = deck.slides[slideLabel.index]!;
    for (const label of slideLabel.objects) {
      if (!label.vector) continue;
      // The two lockup parts share one box and one expectation, so the first found stands for both.
      const object = slide.objects.find((o) => o.origin === 'slide' && o.kind === label.kind && Math.abs(o.box.x - label.boxPx.x) < 1 && Math.abs(o.box.y - label.boxPx.y) < 1);
      assert.ok(object, label.authored);
      const layerIds = out.lineage.forward.filter((edge) => edge.sourceObjectId === object.id).flatMap((edge) => edge.layerIds);
      const rows = out.frames.flatMap((frame) => frame.layers).filter((row) => layerIds.includes(String(row.id)));
      if (label.vector.rows) {
        const count = (kind: string): number => rows.filter((row) => row.kind === kind).length;
        const want = label.vector.rows;
        if (label.kind === 'shape') {
          assert.equal(rows.length, want.path, `${label.authored}: one path row`);
        } else {
          assert.deepEqual({ box: count('box'), path: count('path'), text: count('text') }, want, `${label.authored}: row kinds`);
          assert.equal(new Set(rows.map((row) => row.group)).size, 1, `${label.authored}: one group`);
        }
      }
      if (label.vector.keptAsPicture) {
        assert.deepEqual(rows.map((row) => row.kind), ['image'], `${label.authored}: the picture stays`);
        assert.equal(out.report.entries.find((e) => e.code === 'vector.kept-as-picture' && e.objectId === object.id)?.reason, label.vector.keptAsPicture);
      }
      checked += 1;
    }
  }
  assert.equal(checked, 6);
  assert.ok(out.report.entries.some((e) => e.code === 'vector.items-omitted' && e.slideId === deck.slides[1]!.id), 'the graded bar is reported as left out');
  assert.ok(out.report.entries.some((e) => e.code === 'vector.metafile-not-converted'), 'the metafile is reported');
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of ['report', 'compiled']) {
    ajv.addSchema(JSON.parse(readFileSync(join(ROOT, `schemas/rebrand-${name}-v1.schema.json`), 'utf8')) as object);
  }
  const validate = ajv.getSchema('https://lolly.tools/schemas/rebrand-compiled-v1.schema.json');
  assert.ok(validate);
  assert.equal(validate(out), true, JSON.stringify(validate.errors ?? []));
});

// ─── plan 275 section 4: a slide in its original arrangement, or kept as a picture ───

/** The rows of a frame that the master's furniture seeded. */
function furnitureRows(frame: CompiledDeckV1['frames'][number]): DesignBoxRowV1[] {
  return frame.layers.filter((row) => rowStr(row, 'furniture') !== '');
}

test('plan 275: original arrangement keeps the kept objects at their places, restyled, under the title-only furniture', () => {
  const made = bench(
    [
      text('t', 'Heading', { box: { x: 100, y: 40, w: 600, h: 80, rot: 0 }, text: { paras: [{ runs: [{ text: 'Heading', sizePt: 30, color: { hex: '#d65a28' } }] }] } }),
      { id: 'panel', fingerprint: 'fp:panel', kind: 'shape', box: { x: 700, y: 200, w: 400, h: 300, rot: 0 }, origin: 'slide', fidelity: { state: 'editable' }, fill: { hex: '#1f4e79' } },
      text('old', 'Old mark', { box: { x: 1100, y: 650, w: 120, h: 40, rot: 0 } }),
    ],
    [
      obj('t', { class: 'title', role: 'title' }),
      obj('panel', { class: 'decoration' }),
      obj('old', { class: 'decoration', proposal: 'remove' }),
    ],
    'two-column',
  );
  const slide = made.plan.slides[0];
  assert.ok(slide);
  slide.arrangement = 'original';
  made.plan.colors = [
    { useId: 'use/ink/t', from: '#d65a28', role: 'ink', to: '#123456', affects: ['t'] },
    { useId: 'use/fill/panel', from: '#1f4e79', role: 'accent', to: '#00aa00', affects: ['panel'] },
  ];
  const out = run(made);
  assert.equal(out.frames.length, 1);
  const frame = out.frames[0];
  assert.ok(frame);
  assert.equal(frame.archetype, 'title-only', 'the frame sits under the title-only furniture');
  assert.equal(frame.layers.filter((row) => rowStr(row, 'role') !== '').length, 0, 'no content boxes are seeded');
  const kinds = furnitureRows(frame).map((row) => rowStr(row, 'furniture')).sort();
  assert.deepEqual(kinds, ['footer', 'logo', 'page-number']);
  const title = layerById(out, 'r.t');
  assert.ok(title, 'the title is its own row');
  assert.deepEqual([title.x, title.y, title.w, title.h], [100, 40, 600, 80], 'at its source place');
  assert.equal(title.fg, '#123456', 'its colour takes the mapping');
  assert.equal(layerById(out, 'r.panel')?.bg, '#00aa00', 'a kept shape takes its fill mapping');
  assert.equal(layerById(out, 'r.old'), undefined, 'a removal still removes');
  // The content sits over the master's ground and under its mark, footer and number.
  const at = (id: string): number => frame.layers.findIndex((row) => row.id === id);
  assert.ok(at('r.t') < at(`${frame.id}.logo`));
  assert.ok(out.report.entries.some((e) => e.code === 'slide.original-arrangement' && e.slideId === 'slide1'));
  assert.equal(made.plan.slides[0]?.layout, 'two-column', 'the layout stays on the plan row');
  // Switching back gives the layout compile again.
  const back = bench(made.deck.slides[0]!.objects, slide.objects, 'two-column');
  back.plan.colors = made.plan.colors;
  assert.equal(run(back).frames[0]?.archetype, 'two-column');
});

test('plan 275: a slide kept as a picture with a recovery picture is that picture, and its objects stay part of it', () => {
  const made = bench(
    [text('t', 'Read title'), text('b', 'Read body', { box: { x: 0, y: 100, w: 400, h: 60, rot: 0 } })],
    [obj('t', { class: 'title', role: 'title' }), obj('b', { class: 'body', role: 'body' })],
  );
  made.deck.slides[0]!.recovery = { assetRef: 'user/media/slide-picture' };
  made.plan.slides[0]!.arrangement = 'picture';
  const out = run(made);
  const frame = out.frames[0];
  assert.ok(frame);
  const content = frame.layers.slice(1).filter((row) => rowStr(row, 'furniture') === '');
  assert.equal(content.length, 1, 'one picture');
  const picture = content[0];
  assert.equal(picture?.image, 'user/media/slide-picture');
  assert.deepEqual([picture?.w, picture?.h], [frame.width, frame.height], 'in the place of the whole slide');
  // A picture whose proportions differ from the slide's is set whole and centred in that
  // place, the way the Original pane sets it, never stretched to it.
  assert.equal(picture?.fit, 'contain');
  for (const id of ['t', 'b']) {
    const entry = out.report.entries.find((e) => e.objectId === id && e.disposition);
    assert.equal(entry?.disposition, 'transformed');
    assert.equal(entry?.layerId, picture?.id);
    assert.deepEqual(out.lineage.forward.find((edge) => edge.sourceObjectId === id)?.layerIds, [picture?.id]);
  }
  assert.equal(out.report.entries.find((e) => e.code === 'slide.kept-as-picture')?.reason, 'recovery-picture');
});

test('plan 275: a slide kept as a picture with no recovery picture keeps its objects as one group, with no mapping', async () => {
  const deck = await source();
  const base = await plan();
  const kept: RenovationPlanV1 = { ...base, slides: base.slides.map((one) => (one.id === S3 ? { ...one, arrangement: 'picture' as const } : one)) };
  const out = compileRenovated({ source: deck, plan: kept, master: master(), designSystem: DESIGN_SYSTEM });
  const frames = out.frames.filter((frame) => frame.sourceSlideId === S3);
  assert.equal(frames.length, 1, 'no continuation for a slide kept as it was');
  const frame = frames[0];
  assert.ok(frame);
  const content = frame.layers.slice(1).filter((row) => rowStr(row, 'furniture') === '');
  assert.ok(content.length > 0);
  assert.equal(new Set(content.map((row) => row.group)).size, 1, 'one group');
  assert.equal(content[0]?.group, `picture:${frame.id}`);
  assert.equal(content.some((row) => row.bg === '#00ff00' || row.fg === '#123456'), false, 'no colour mapping reaches it');
  const s3 = deck.slides.find((one) => one.id === S3);
  assert.ok(s3);
  for (const object of s3.objects) {
    const entry = out.report.entries.find((e) => e.objectId === object.id && e.disposition);
    assert.ok(entry, `${object.id} is accounted for`);
    assert.notEqual(entry.disposition, 'removed', `${object.id} is kept as it was, proposals or not`);
  }
  assert.equal(out.report.entries.find((e) => e.code === 'slide.kept-as-picture')?.reason, 'source-objects');
  assert.equal(out.tray.some((item) => item.sourceObjectId.startsWith(`${S3}.`)), false);
  // Every layer of the frame has lineage, and every forward edge names a layer that exists.
  const ids = new Set(out.frames.flatMap((one) => one.layers.map((row) => String(row.id))));
  for (const row of frame.layers) assert.ok(out.lineage.backward.some((edge) => edge.layerId === row.id), `${String(row.id)} has lineage`);
  for (const edge of out.lineage.forward) for (const id of edge.layerIds) assert.ok(ids.has(id) || out.tray.some((item) => item.layer.id === id), `${id} exists`);
  // The same slide poured into its layout is what switching back gives.
  const again = compileRenovated({ source: deck, plan: base, master: master(), designSystem: DESIGN_SYSTEM });
  assert.equal(again.frames.find((one) => one.sourceSlideId === S3 && !one.continuation)?.archetype, 'content');
});

// ─── close-out 9.2: the design system's face on every renovated text ──────────

/** Every text row of a compiled deck, frames and tray. */
function textRowsOf(out: CompiledDeckV1): DesignBoxRowV1[] {
  return [...out.frames.flatMap((frame) => frame.layers), ...out.tray.map((item) => item.layer)].filter((row) => row.kind === 'text');
}

test('close-out 9.2: every renovated text states no family, and mono only for code with a mono face', () => {
  const inFace = (id: string, body: string, font: string, over: Partial<SourceObjectV1> = {}): SourceObjectV1 =>
    text(id, body, { ...over, text: { paras: [{ runs: [{ text: body, font }] }] } });
  const svgText = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect x="10" y="10" width="200" height="40" fill="#1f4e79"/>'
    + '<text x="20" y="120" font-family="Georgia" font-size="20" fill="#141414">North region</text></svg>';
  const made = bench(
    [
      inFace('t', 'The title', 'Georgia', { readingIndex: 0, placeholder: 'title' }),
      inFace('b', 'const answer = 42;', 'Consolas', { readingIndex: 1 }),
      inFace('n', 'A note set in a display face', 'Comic Sans MS', { readingIndex: 2 }),
      chartObject('c', { vectorItems: svgItemsOf(svgText, svgParse), readingIndex: 3 }),
    ],
    [
      obj('t', { class: 'title', role: 'title' }),
      obj('b', { class: 'body', role: 'body' }),
      obj('n', { class: 'body', surplus: 'tray' }),
      obj('c', { class: 'chart', role: 'visual' }),
    ],
    'visual',
  );
  made.plan.fonts = [
    { from: 'Georgia', to: 'SUSE', source: 'class' },
    { from: 'Consolas', to: 'SUSE Mono', source: 'alias' },
    { from: 'Comic Sans MS', to: 'SUSE', source: 'class' },
  ];
  const stated = (out: CompiledDeckV1): string[] => textRowsOf(out).map((row) => String(row.font ?? ''));

  const withMono = run(made, { faces: { brand: 'SUSE', mono: 'SUSE Mono' } });
  assert.ok(textRowsOf(withMono).length >= 3, 'the title, the code, the note and the chart label are text rows');
  assert.ok(stated(withMono).every((font) => font === '' || font === 'mono'), `every text row is in a design system face: ${stated(withMono).join(', ')}`);
  const code = textRowsOf(withMono).find((row) => String(row.text ?? '').includes('answer'));
  assert.equal(code?.font, 'mono', 'the run the source set in a code face takes the mono face');
  const label = textRowsOf(withMono).find((row) => String(row.text ?? '').includes('North region'));
  assert.ok(label, 'the chart label is a text row');
  assert.equal(label.font, undefined, 'the chart\'s own family does not reach the renovated row');

  const noMono = run(made, { faces: { brand: 'SUSE' } });
  assert.ok(stated(noMono).every((font) => font === ''), 'with no mono face in the design system, code is set in the brand face too');
  const entries = withMono.report.entries.filter((entry) => entry.code === 'text.font-substituted').length;
  assert.equal(entries, noMono.report.entries.filter((entry) => entry.code === 'text.font-substituted').length, 'the rule adds nothing to the report');
});

// ─── close-out CP12: a deck theme in the compile ──────────────────────────────

test('decision 33c: under a deck theme a locked colour keeps the hex it was locked at, and an unlocked one follows its token', () => {
  const dark: NonNullable<RenovationPlanV1['designSystem']['theme']> = { id: 'dark', mode: 'dark', remap: [] };
  const themeSource = {
    colors: { ...TOKENS },
    darkColors: { ...TOKENS, 'color.semantic.surface': '#101418', 'color.semantic.text': '#f4f4f4', 'color.brand.accent': '#ff66cc' },
    master: master(),
  };
  const barsOf = (locked: boolean): unknown[] => {
    const made = chartBench([chartObject('c')]);
    made.plan.designSystem = { ...made.plan.designSystem, theme: dark };
    made.plan.colors = [{ useId: 'c:series:1', from: '#1f4e79', to: '#d65a28', toPath: 'color.brand.accent', role: 'series', affects: ['c'], ...(locked ? { locked: true } : {}) }];
    const out = run(made, { themeSource });
    return out.frames[0]!.layers.filter((row) => String(row.group ?? '').startsWith('vector:') && row.kind === 'box').map((row) => row.bg);
  };
  assert.deepEqual(barsOf(true).slice(0, 2), ['#d65a28', '#d65a28'], 'the lock holds the hex it was locked at');
  assert.deepEqual(barsOf(false).slice(0, 2), ['#ff66cc', '#ff66cc'], 'an unlocked use takes its token under the Dark theme');
});

// ─── close-out CP13: text fits before it is called cut ────────────────────────

/** The smallest size the master sets a role at, across its layouts. */
function smallestSize(role: string): number {
  const m = master();
  const sizes = m.archetypes.flatMap((a) => a.placeholders.filter((ph) => ph.role === role && ph.kind === 'text')
    .map((ph) => ph.style?.fontSize ?? (Object.entries(m.typeScale).find(([key]) => key === role)?.[1]) ?? m.typeScale.body));
  return Math.min(...sizes);
}

test('CP13: a title two lines long in a one-line box grows into the room under it rather than being cut', () => {
  // The data deck's survey question: two lines at the smallest title size, in a title box
  // a line and a bit tall, over a body box with room between them.
  const question = 'Which of the following best describes your organization\'s primary industry? A question of about two lines';
  const out = run(bench([text('t', question), text('b', 'A short body.')], [obj('t', { class: 'title', role: 'title' }), obj('b', { class: 'body', role: 'body' })]));
  const title = layerById(out, 'r.slide1.title');
  assert.ok(title);
  const fit = designTextFit(title);
  assert.equal(fit.lines, 2, 'two lines at the master size');
  assert.equal(title.fontSize, smallestSize('title'), 'already the smallest title size, so it does not shrink');
  assert.ok(Number(title.h) + 0.01 >= 2 * Number(title.fontSize) * DESIGN_LINE_HEIGHT && Number(title.h) > 80, 'the box grew to hold both lines');
  const body = layerById(out, 'r.slide1.body');
  assert.ok(Number(title.y) + Number(title.h) < Number(body?.y), 'and stops short of the body under it');
  assert.equal(fit.wordsCut, 0);
  assert.equal(out.report.entries.some((e) => e.code === 'text.overflow'), false, 'nothing is called cut');
});

test('CP13: a title too long for a large title box shrinks, never under the master\'s smallest title size', () => {
  const long = 'A cover title that is far too long to sit in the cover title box at the size the cover sets it at';
  const out = run(bench([text('t', long)], [obj('t', { class: 'title', role: 'title' })], 'title'));
  const title = layerById(out, 'r.slide1.title');
  assert.ok(title);
  const seeded = master().archetypes.find((a) => a.id === 'title')?.placeholders.find((ph) => ph.role === 'title')?.style?.fontSize;
  assert.ok(typeof seeded === 'number' && Number(title.fontSize) < seeded, `the title shrank from ${seeded} to ${String(title.fontSize)}`);
  assert.ok(Number(title.fontSize) >= smallestSize('title'));
  assert.equal(designTextFit(title).wordsCut, 0, 'and fits its box');
  assert.equal(out.report.entries.some((e) => e.code === 'text.overflow'), false);
});

test('CP13: text that fits at no size and in no room is reported with the words Design clips', () => {
  const long = synthetic('word '.repeat(2000));
  const out = compileRenovated({ source: long.deck, plan: long.plan, master: master(), designSystem: DESIGN_SYSTEM });
  const body = layerById(out, `${out.frames[0]?.id}.body`);
  assert.ok(body);
  assert.equal(body.fontSize, smallestSize('body'), 'at the smallest body size the master sets');
  const fit = designTextFit(body);
  assert.ok(fit.wordsCut > 0 && fit.wordsCut < 2000);
  const entry = out.report.entries.find((e) => e.code === 'text.overflow');
  assert.match(String(entry?.message), new RegExp(`${fit.wordsCut} words are cut`), 'the report names the words the box clips');
  assert.match(String(entry?.message), /the smallest size the slide master sets for it, with no room under it in the layout/);
});

test('CP13 F2: the source slide number never lands in the footer beside the master\'s own number', () => {
  const out = run(bench(
    [text('t', 'A slide'), text('n', '7', { box: { x: 600, y: 680, w: 40, h: 20, rot: 0 } })],
    [obj('t', { class: 'title', role: 'title' }), obj('n', { class: 'footer' })],
  ));
  const frame = out.frames[0];
  assert.ok(frame);
  const texts = frame.layers.filter((row) => row.kind === 'text').map((row) => plainOfDesignText(String(row.text ?? '')));
  assert.equal(texts.includes('7'), false, 'the old number is not drawn');
  const number = frame.layers.find((row) => String(row.id).endsWith('page-number'));
  assert.equal(number?.text, '1', 'the master numbers the slide');
  const entry = out.report.entries.find((e) => e.objectId === 'n' && e.disposition);
  assert.ok(entry?.layerId?.endsWith('page-number'), 'its lineage is the page number');
  finalizeReport(out.report, ['t', 'n']);
});

test('CP13: a card\'s heading fills its cell\'s label box and the lines under it the body box', () => {
  const card = (id: string, x: number, head: string, sub: string, bold = false) => rich(id, [
    { runs: [{ text: head, sizePt: bold ? 18 : 34, ...(bold ? { bold: true } : {}) }], align: 'center' },
    { runs: [{ text: sub, sizePt: 18 }], align: 'center' },
  ], { box: { x, y: 420, w: 300, h: 80, rot: 0 } });
  const objects = [text('t', 'Choose your job'), card('a', 80, 'Everyday Needs', '(Families & Students)'),
    card('b', 490, 'Storytellers', '(Journalists & Creators)'), card('c', 900, 'The Experts', '(Marketers & Brand Managers)', true)];
  const entries = [obj('t', { class: 'title', role: 'title' }), ...['a', 'b', 'c'].map((id) => obj(id, { class: 'body' }))];
  const out = run(bench(objects, entries, 'icon-columns-3'));
  const frame = out.frames[0];
  assert.ok(frame);
  const labels = frame.layers.filter((row) => row.role === 'label').map((row) => plainOfDesignText(String(row.text ?? '')).trim());
  const bodies = frame.layers.filter((row) => row.role === 'body').map((row) => plainOfDesignText(String(row.text ?? '')).trim());
  assert.deepEqual(labels, ['Everyday Needs', 'Storytellers', 'The Experts'], 'each card keeps its title, a bold one too');
  assert.deepEqual(bodies, ['(Families & Students)', '(Journalists & Creators)', '(Marketers & Brand Managers)']);
  for (const row of frame.layers.filter((one) => one.role === 'label')) assert.equal(String(row.text).startsWith(' '), false, 'a label is never a list level');
  const lineage = out.lineage.forward.find((edge) => edge.sourceObjectId === 'a');
  assert.deepEqual(lineage?.layerIds.map((id) => id.split('.').pop()), ['label', 'body'], 'one object, two boxes, both in its lineage');
  finalizeReport(out.report, objects.map((o) => o.id));
});

test('CP13: a run\'s emphasis colour stays readable on the ground its row sits on, and keeps a colour', () => {
  // A white title with a mint question mark, rebuilt onto a panel: the plan solved the mint
  // against the deck's light ground and wrote a dark ink, which vanishes on a dark panel.
  const title = rich('t', [{ runs: [{ text: 'Do you own it at all', color: { hex: '#fcfefd' } }, { text: '?', color: { hex: '#a8ecc6' } }] }]);
  const body = text('b', 'A line under it.');
  const made = bench([title, body], [obj('t', { class: 'title', role: 'title' }), obj('b', { class: 'body', role: 'body' })], 'split');
  made.plan.colors = [
    { useId: 't:ink:a8ecc6', from: '#a8ecc6', to: '#123456', toPath: 'color.brand.ink', role: 'ink', affects: ['t'] },
    { useId: 'b:ink:0f0f0f', from: '#0f0f0f', to: '#d65a28', toPath: 'color.brand.accent', role: 'ink', affects: ['b'] },
  ];
  const out = run(made);
  const frame = out.frames[0];
  assert.ok(frame);
  const index = frame.layers.findIndex((row) => row.id === 'r.slide1.title');
  const row = frame.layers[index];
  assert.ok(row);
  const colours = [...String(row.text).matchAll(/\{#([0-9a-f]{6})\|/g)].map((m) => `#${m[1]}`);
  assert.equal(colours.length, 1, 'the question mark keeps a colour of its own');
  // The ground under the title: the frame, or the last filled box drawn under it.
  const under = frame.layers.slice(0, index).filter((one) => (one.kind === 'frame' || one.kind === 'box') && typeof one.bg === 'string'
    && Number(one.x) <= Number(row.x) && Number(one.x) + Number(one.w) >= Number(row.x) + Number(row.w)
    && Number(one.y) <= Number(row.y) && Number(one.y) + Number(one.h) >= Number(row.y) + Number(row.h));
  const ground = String(under[under.length - 1]?.bg);
  for (const colour of colours) {
    assert.ok(contrastRatio(colour, ground) >= 3, `${colour} reads on ${ground}`);
  }
  // A run whose source colour is grey carries no emphasis: it takes the row's ink.
  const plain = bench([rich('t', [{ runs: [{ text: 'Grey', color: { hex: '#fcfefd' } }, { text: ' words', color: { hex: '#808080' } }] }])],
    [obj('t', { class: 'title', role: 'title' })], 'split');
  plain.plan.colors = [{ useId: 't:ink:808080', from: '#808080', to: '#123456', toPath: 'color.brand.ink', role: 'ink', affects: ['t'] }];
  const grey = layerById(run(plain), 'r.slide1.title');
  for (const m of String(grey?.text).matchAll(/\{#([0-9a-f]{6})\|/g)) {
    assert.ok(contrastRatio(`#${m[1]}`, ground) >= 3, 'no run is left unreadable');
  }
});

test('CP13: the before keeps a line the source set on one line on one line', () => {
  const hash = `sha256:${'5'.repeat(64)}`;
  const line = (id: string, h: number): SourceObjectV1 => ({
    id, fingerprint: id, kind: 'text', box: { x: 100, y: 100, w: 600, h, rot: 0 }, origin: 'raster-region',
    fidelity: { state: 'approximate' }, text: { paras: [{ runs: [{ text: 'Choose your job. Keep your data, and your tools.', sizePt: 36 }] }] },
  });
  const deck: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash, lineageId: 'lin', instanceId: 'inst', pageCount: 1 },
    slides: [{ id: 's', index: 0, width: 1280, height: 720, background: {}, objects: [line('one', 50), line('two', 150)], readingOrder: ['one', 'two'], warnings: [], origin: { kind: 'pptx' } }],
    fonts: [],
    warnings: [],
    reader: { name: 'pptx-read', version: 'test' },
  };
  const out = compileFaithful(deck);
  const rows = new Map(out.frames[0]!.layers.map((row) => [String(row.name), row]));
  const one = rows.get('one');
  assert.ok(one);
  assert.equal(designTextFit(one).lines, 1, 'a one-line box draws one line');
  assert.ok(Number(one.w) > 600, 'by widening to the width the estimate needs');
  assert.equal(one.pad, 0, 'text read from a picture has no inset of its own');
  assert.equal(one.valign, 'top');
  assert.equal(rows.get('two')?.w, 600, 'a box that holds two lines keeps its width');
});

test('CP13: a slide read as Text with a callout pours the takeaway into the callout box and the rows into the wide box', () => {
  const rowText = (id: string, y: number, body: string) => text(id, body, { box: { x: 200, y, w: 520, h: 90, rot: 0 }, groupPath: [`row-${id}`] });
  const icon = (id: string, y: number): SourceObjectV1 => ({
    id, fingerprint: `fp:${id}`, kind: 'pic', box: { x: 90, y, w: 60, h: 60, rot: 0 }, origin: 'slide',
    fidelity: { state: 'raster-preserved' }, media: `user/media/${id}`, groupPath: [`row-${id.replace('i', 'r')}`],
  });
  const objects = [
    text('t', 'The hidden cost of an 11-second task'),
    rowText('r1', 200, 'Upload a confidential contract to compress a PDF.'), icon('i1', 210),
    rowText('r2', 330, 'Hand unreleased screenshots to a server that scrapes them.'), icon('i2', 340),
    rowText('r3', 460, 'Give two private documents to a third party to merge.'), icon('i3', 470),
    text('c1', 'We did this easily. Because the incentives pointed one way.', { box: { x: 780, y: 240, w: 420, h: 120, rot: 0 }, groupPath: ['box'] }),
    text('c2', 'It was survival.', { box: { x: 780, y: 420, w: 420, h: 60, rot: 0 }, groupPath: ['box'] }),
  ];
  const entries = [obj('t', { class: 'title', role: 'title' }),
    ...['r1', 'r2', 'r3', 'c1', 'c2'].map((id) => obj(id, { class: 'body' })),
    ...['i1', 'i2', 'i3'].map((id) => obj(id, { class: 'unknown' }))];
  const made = bench(objects, entries, 'chart-and-callout');
  const slidePlan = made.plan.slides[0];
  assert.ok(slidePlan);
  slidePlan.layoutMatch = { structure: 'text-and-callout', band: 'likely', confidence: 0.9, coverage: 1, signature: 'callout:right' };
  const out = run(made);
  const frame = out.frames[0];
  assert.ok(frame);
  const plain = (row: DesignBoxRowV1 | undefined): string => plainOfDesignText(String(row?.text ?? ''));
  const callout = frame.layers.filter((row) => row.role === 'body' || row.role === 'label').map(plain).filter(Boolean).join('\n');
  assert.equal(callout, 'We did this easily. Because the incentives pointed one way.\nIt was survival.', 'the takeaway fills the callout box');
  const wide = frame.layers.find((row) => row.role === 'data');
  assert.equal(wide?.kind, 'text', 'the wide box took the rows as text, no icon took it first');
  assert.equal(plain(wide).split('\n').length, 3);
  assert.match(plain(wide), /^Upload/);
  finalizeReport(out.report, objects.map((o) => o.id));
});
