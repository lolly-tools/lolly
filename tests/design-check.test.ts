// SPDX-License-Identifier: MPL-2.0
/**
 * The engine half of `lolly check` (plan 291, W1): Verify pages built from a
 * Design document's geometry, the mappers that turn every checker's finding into
 * a `CheckFindingV1`, and the fidelity comparison against a source inventory.
 *
 * The trap fixture (tests/fixtures/check/trap.boxes.json) holds one of each
 * pattern the run met: a rounded card with a thin saturated top strip, a 20px
 * line above a 64px heading, three cards labelled 01, 02 and 03, a pale caption
 * on a flat box, a caption over a photo and a headline too long for its box. The
 * last three need the mounted audit, so they are here for the browser-tier test
 * and must not trip anything in Node. A plain box running off the artboard's edge
 * gives `lolly check` a structure finding (tests/check-cli.test.ts).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-check.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import { designForensicPages, designCornerRadius, forensicReport, type ForensicFinding } from '../engine/src/forensic.ts';
import {
  checkFindingFromBrand,
  checkFindingFromDesign,
  checkFindingFromHouseRule,
  checkFindingFromMounted,
  checkFindingsFromForensic,
  checkFindingsFromHouseRules,
  designLayerLookup,
  verifyDesignDocument,
  type HouseRuleFindingInput,
} from '../engine/src/design-check.ts';
import { checkFidelity, normaliseFidelityText } from '../engine/src/check-fidelity.ts';
import { checkBrandDesign } from '../engine/src/brand-check.ts';
import type { HouseRuleFinding } from '../engine/src/design-house-rules.ts';
import { inspectDesignV1 } from '../packages/core/src/design-v1.ts';
import { CHECK_CODE_PATTERN, type CheckFindingV1, type CheckReportV1 } from '../packages/core/src/check-v1.ts';
import type { ContentInventoryV1 } from '../packages/core/src/content-inventory-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRAP = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/check/trap.boxes.json'), 'utf8')) as Record<string, unknown>[];

const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'schemas/check-report-v1.schema.json'), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validateReport = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);
const CODE = new RegExp(CHECK_CODE_PATTERN);

/** A whole report around the findings, so every mapped finding is held to the published schema. */
function assertValidFindings(findings: CheckFindingV1[], fidelity?: CheckReportV1['fidelity']): void {
  for (const f of findings) assert.match(f.code, CODE, `code ${f.code}`);
  const tally = (s: string) => findings.filter((f) => f.severity === s).length;
  const counts = { error: tally('error'), warn: tally('warn'), info: tally('info') };
  const zero = { error: 0, warn: 0, info: 0 };
  const families = Object.fromEntries(
    (['structure', 'render', 'brand', 'verify', 'fidelity'] as const).map((family) => {
      const own = findings.filter((f) => f.family === family);
      const n = (s: string) => own.filter((f) => f.severity === s).length;
      return [family, own.length ? { state: 'ran', error: n('error'), warn: n('warn'), info: n('info') } : { state: 'skipped', ...zero }];
    })
  );
  const refused = counts.error > 0;
  const review = !refused && counts.warn > 0;
  const report = {
    format: 'lolly-check',
    version: 1,
    input: { kind: 'design', name: 'trap.boxes.json' },
    outcome: refused ? 'refused' : review ? 'review' : 'clean',
    exitCode: refused ? 4 : review ? 5 : 0,
    strict: false,
    families,
    summary: counts,
    findings,
    ...(fidelity ? { fidelity } : {}),
    designSystem: null,
  };
  assert.equal(validateReport(JSON.parse(JSON.stringify(report))), true, JSON.stringify(validateReport.errors, null, 2));
}

test('the trap fixture gives one Verify page per artboard with frame-local geometry and layer refs', () => {
  const built = designForensicPages(TRAP);
  assert.equal(built.pages.length, 1);
  assert.deepEqual(built.artboardIds, ['slide']);
  const page = built.pages[0]!;
  assert.equal(page.layoutMethod, 'source-geometry');
  assert.equal(page.source, 'digital');
  assert.equal(page.complete, true);
  assert.equal(page.width, 1920);
  // One card has a strip; the other two are plain rounded panels.
  assert.equal(page.shapes.length, 1);
  const card = page.shapes[0]!;
  assert.deepEqual(card.accent, { edge: 'top', width: 8, colour: '#2563eb' });
  assert.equal(card.radius, 24);
  assert.deepEqual(built.refs.get(card.box), { layerIds: ['card-1', 'card-1-strip'], artboardId: 'slide', kind: 'shape' });
  // Every line is in the page text, in reading order, and leads back to its layer.
  let offset = 0;
  for (const line of page.lines) {
    const at = page.text.indexOf(line.text, offset);
    assert.ok(at >= 0, `line "${line.text}" is in the page text`);
    offset = at + line.text.length;
    assert.equal(built.refs.get(line.box)?.kind, 'line');
  }
  const eyebrow = page.lines.find((l) => l.text === 'QUARTERLY REVIEW')!;
  assert.deepEqual(eyebrow.box, { x: 120, y: 96, width: 16 * 20 * 0.55, height: 24 });
  assert.equal(eyebrow.size, 20);
  assert.deepEqual(built.refs.get(eyebrow.box)?.layerIds, ['eyebrow']);
  assert.ok(page.text.startsWith('QUARTERLY REVIEW\n'));
  assert.equal(built.coverage.find((c) => c.collector === 'design-geometry')?.state, 'completed');
});

test('the trap fixture yields the fingernail card, the eyebrow and the decorative numbering through the forensic rules', async () => {
  const built = designForensicPages(TRAP);
  const report = await forensicReport(new TextEncoder().encode('trap'), built.pages, built.coverage, [], [], [], 'unknown');
  const rules = report.findings.map((f) => f.rule).sort();
  assert.deepEqual(rules, ['decorative-numbering', 'eyebrow-heading', 'fingernail-card']);
  for (const f of report.findings) {
    assert.equal(f.contribution, 'weak-clue', f.rule);
    assert.equal(f.method, f.rule === 'decorative-numbering' ? 'original-text' : 'source-geometry');
  }
  const layers = (f: ForensicFinding) => f.locations.flatMap((l) => (l.box ? built.refs.get(l.box)?.layerIds ?? [] : []));
  assert.deepEqual(layers(report.findings.find((f) => f.rule === 'fingernail-card')!), ['card-1', 'card-1-strip']);
  assert.deepEqual(layers(report.findings.find((f) => f.rule === 'eyebrow-heading')!), ['eyebrow', 'heading']);
  assert.deepEqual(layers(report.findings.find((f) => f.rule === 'decorative-numbering')!), ['card-1-label', 'card-2-label', 'card-3-label']);
});

test('verifyDesignDocument maps each observation to a check finding on its layers, and strict makes a clue an error', async () => {
  const { findings, complete } = await verifyDesignDocument(TRAP);
  assert.equal(complete, true);
  const byCode = new Map(findings.map((f) => [f.code, f]));
  assert.deepEqual([...byCode.keys()].sort(), ['verify.decorative-numbering', 'verify.eyebrow-heading', 'verify.fingernail-card']);
  const card = byCode.get('verify.fingernail-card')!;
  assert.equal(card.family, 'verify');
  assert.equal(card.severity, 'warn');
  assert.equal(card.needs, 'review');
  assert.equal(card.layerId, 'card-1');
  assert.equal(card.artboardId, 'slide');
  assert.equal(card.page, '1');
  assert.deepEqual(card.box, { x: 120, y: 360, width: 480, height: 300 });
  assert.equal(card.evidence?.layers, 'card-1,card-1-strip');
  assert.equal(card.evidence?.edge, 'top');
  assert.equal(card.message, 'Rounded card with a coloured edge: A rounded container has a solid accent on its top edge.');
  assert.deepEqual(card.origin, { checker: 'forensic', id: 'fingernail-card', method: 'source-geometry', confidence: 0.9, contribution: 'weak-clue' });
  assert.equal(byCode.get('verify.eyebrow-heading')!.layerId, 'eyebrow');
  assert.equal(byCode.get('verify.decorative-numbering')!.layerId, 'card-1-label');
  assertValidFindings(findings);
  const strict = await verifyDesignDocument(TRAP, { strict: true });
  assert.ok(strict.findings.every((f) => f.severity === 'error'));
});

test('renderer defaults apply where a row leaves a field out', () => {
  const built = designForensicPages([
    { id: 'f', kind: 'frame', x: 1000, y: 0, w: 800, h: 600 },
    // No size, padding, line height or alignment: 48px, 8px, 1.12, centred, middle.
    { id: 't', kind: 'text', frame: 'f', x: 1100, y: 100, w: 400, h: 200, text: 'Hi' },
    // A rect with a radius draws square; only rounded and pill shapes have corners.
    { id: 'square', kind: 'box', frame: 'f', x: 1000, y: 300, w: 300, h: 200, shape: 'rect', radius: 16, bg: '#eeeeee' },
    { id: 'square-strip', kind: 'box', frame: 'f', x: 1000, y: 300, w: 300, h: 6, bg: '#ff0000' },
  ]);
  const line = built.pages[0]!.lines[0]!;
  const width = 2 * 48 * 0.55;
  const height = 48 * 1.12;
  assert.deepEqual(line.box, { x: 100 + (400 - width) / 2, y: 100 + (200 - height) / 2, width, height });
  assert.equal(line.size, 48);
  assert.equal(built.pages[0]!.shapes.length, 0);
  assert.equal(designCornerRadius({ shape: 'rect', radius: 16 }), 0);
  assert.equal(designCornerRadius({ shape: 'rounded', radius: 16 }), 16);
  assert.equal(designCornerRadius({ shape: 'rounded' }), 0);
  assert.equal(designCornerRadius({ shape: 'pill', w: 200, h: 40 }), 20);
});

test('strips are found on all four edges, from boxes and straight rules, and a hidden or translucent row is left out', () => {
  const panel = { kind: 'box', frame: 'f', x: 100, y: 100, w: 400, h: 300, shape: 'rounded', radius: 20, bg: '#ffffff' };
  const pages = (strip: Record<string, unknown>) =>
    designForensicPages([{ id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600 }, { id: 'p', ...panel }, { id: 's', frame: 'f', ...strip }]).pages[0]!.shapes;
  assert.equal(pages({ kind: 'box', x: 100, y: 394, w: 400, h: 6, bg: '#e11d48' })[0]?.accent?.edge, 'bottom');
  assert.equal(pages({ kind: 'box', x: 100, y: 100, w: 6, h: 300, bg: '#e11d48' })[0]?.accent?.edge, 'left');
  assert.equal(pages({ kind: 'box', x: 494, y: 100, w: 6, h: 300, bg: '#e11d48' })[0]?.accent?.edge, 'right');
  // A straight rule (a path one unit tall) with a saturated stroke along the top edge.
  assert.deepEqual(pages({ kind: 'path', x: 100, y: 100, w: 400, h: 1, stroke: '#e11d48', strokeW: 6, path: '1!line!0_0!0_1!0' })[0]?.accent, { edge: 'top', width: 3.5, colour: '#e11d48' });
  // A grey strip is not an accent, nor is one hidden or fully transparent.
  assert.equal(pages({ kind: 'box', x: 100, y: 100, w: 400, h: 6, bg: '#888888' }).length, 0);
  assert.equal(pages({ kind: 'box', x: 100, y: 100, w: 400, h: 6, bg: '#e11d48', hidden: true }).length, 0);
  assert.equal(pages({ kind: 'box', x: 100, y: 100, w: 400, h: 6, bg: '#e11d48', opacity: 0 }).length, 0);
  // A strip painted under the panel is covered by the panel.
  const under = designForensicPages([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600 },
    { id: 's', kind: 'box', frame: 'f', x: 100, y: 100, w: 400, h: 6, bg: '#e11d48' },
    { id: 'p', ...panel },
  ]);
  assert.equal(under.pages[0]!.shapes.length, 0);
  // A token colour resolves through the caller.
  const token = designForensicPages(
    [{ id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600 }, { id: 'p', ...panel }, { id: 's', kind: 'box', frame: 'f', x: 100, y: 100, w: 400, h: 6, bg: '{color.accent}' }],
    { resolveColor: (v) => (v === '{color.accent}' ? '#2563eb' : null) }
  );
  assert.equal(token.pages[0]!.shapes[0]?.accent?.colour, '#2563eb');
});

test('pages follow artboard order, skip rows outside their artboard, and say when text could not be read', () => {
  const built = designForensicPages(
    [
      { id: 'b', kind: 'frame', x: 2000, y: 0, w: 800, h: 600, order: 1 },
      { id: 'a', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0 },
      { id: 'in', kind: 'text', frame: 'a', x: 10, y: 10, w: 300, h: 60, text: 'Inside' },
      { id: 'out', kind: 'text', frame: 'a', x: 900, y: 10, w: 300, h: 60, text: 'Outside' },
      { id: 'loose', kind: 'text', x: 10, y: 10, w: 300, h: 60, text: 'Loose' },
      { id: 'story', kind: 'text', frame: 'b', x: 2010, y: 10, w: 300, h: 60, text: '', textStory: 'st', textFrame: '{}' },
      { id: 'turned', kind: 'text', frame: 'b', x: 2010, y: 200, w: 300, h: 60, rot: 30, text: 'Turned' },
    ],
    { pageCap: 5 }
  );
  assert.deepEqual(built.artboardIds, ['a', 'b']);
  assert.equal(built.pages[0]!.text, 'Inside');
  assert.equal(built.pages[1]!.complete, false, 'a composed story with no text document is not read as empty');
  assert.equal(built.pages[1]!.lines.find((l) => l.text === 'Turned')?.confidence, 0.5, 'a rotated line is read, not measured');
  assert.equal(built.coverage.find((c) => c.page === '2')?.state, 'partial');
  const withStory = designForensicPages(
    [
      { id: 'b', kind: 'frame', x: 0, y: 0, w: 800, h: 600 },
      { id: 'story', kind: 'text', frame: 'b', x: 10, y: 10, w: 700, h: 60, text: '', textStory: 'st', textFrame: '{}' },
    ],
    { textDocument: { version: 1, stories: [{ id: 'st', source: 'From the story', frameIds: ['story'] }], styles: [], fonts: [] } }
  );
  assert.equal(withStory.pages[0]!.text, 'From the story');
  assert.equal(withStory.pages[0]!.complete, true);
  const capped = designForensicPages([
    { id: 'a', kind: 'frame', x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', kind: 'frame', x: 20, y: 0, w: 10, h: 10 },
  ], { pageCap: 1 });
  assert.equal(capped.pages.length, 1);
  assert.equal(capped.coverage.find((c) => c.collector === 'pages')?.state, 'partial');
  assert.equal(designForensicPages('nope').coverage[0]?.state, 'failed');
  // Without artboards the whole document is one page in its own coordinates.
  const loose = designForensicPages([{ id: 't', kind: 'text', x: 50, y: 60, w: 300, h: 60, text: 'Free', align: 'left', valign: 'top', pad: 0 }]);
  assert.deepEqual(loose.artboardIds, ['']);
  assert.equal(loose.pages[0]!.lines[0]!.box.x, 50);
});

test('Design markup is drawn text: emphasis and spans go, list numbers stay', () => {
  const built = designForensicPages([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 1200, h: 600 },
    { id: 't', kind: 'text', frame: 'f', x: 0, y: 0, w: 1200, h: 600, text: '**Bold** and {#ff0000|red}\n1. First\n2. Second\n- Point', align: 'left', valign: 'top' },
  ]);
  assert.equal(built.pages[0]!.text, 'Bold and red\n1. First\n2. Second\nPoint');
});

test('each checker maps to a schema-valid check finding with a stable code, its layer and the app message', () => {
  const boxes = [
    { id: 'f', kind: 'frame', name: 'One', x: 1000, y: 0, w: 800, h: 600 },
    { id: 'a', kind: 'text', frame: 'f', x: 1100, y: 50, w: 300, h: 60, text: 'Hi', bg: '#ca3020', font: 'Other Sans' },
    { id: 'b', kind: 'text', frame: 'f', x: 1100, y: 150, w: 300, h: 60, text: '' },
  ];
  const lookup = designLayerLookup(boxes);
  assert.deepEqual(lookup.get('a'), { index: 1, artboardId: 'f', box: { x: 100, y: 50, width: 300, height: 60 } });

  const structure = inspectDesignV1(boxes).findings.map(checkFindingFromDesign);
  const empty = structure.find((f) => f.code === 'design.text.empty')!;
  assert.deepEqual(empty, { code: 'design.text.empty', family: 'structure', severity: 'warn', message: 'Text layer is empty.', path: '/boxes/2/text', layerId: 'b', origin: { checker: 'design-v1', id: 'design.text.empty' } });

  const mounted = [
    checkFindingFromMounted({ id: 'design.text.overflow', severity: 'warn', path: '/boxes/1/text', evidence: { name: 'Hi' }, message: 'x', layerId: 'a' }, lookup),
    checkFindingFromMounted({ id: 'design.text.contrast-review', severity: 'info', path: '/boxes/1/fg', evidence: { name: 'Hi', reason: 'complex-background' }, message: 'x', layerId: 'a' }, lookup),
  ];
  assert.equal(mounted[0]!.message, 'Text in “Hi” is clipped at the current size.');
  assert.equal(mounted[0]!.artboardId, 'f');
  assert.equal(mounted[1]!.needs, 'visual-check');
  assert.equal(mounted[1]!.severity, 'info');

  const doc = { color: { red: { $type: 'color', $value: '#CC3322' } }, font: { brand: { $type: 'fontFamily', $value: 'Example Sans' } } };
  const brand = checkBrandDesign(boxes, doc).findings.map((f) => checkFindingFromBrand(f, lookup));
  const colour = brand.find((f) => f.code === 'brand.color.review')!;
  assert.equal(colour.severity, 'warn');
  assert.equal(colour.needs, 'review');
  assert.equal(colour.layerId, 'a');
  assert.equal(colour.path, '/boxes/1/bg');
  assert.equal(colour.origin.id, 'brand.color.a.bg');
  assert.equal(colour.suggestion?.toLowerCase(), '#cc3322');
  assert.deepEqual(colour.fix, { layerId: 'a', field: 'bg', before: '#ca3020', after: '{color.red}' });
  assert.equal(colour.message, `“Hi”: fill #ca3020 is outside this design system. Suggested: ${colour.suggestion}.`);
  const font = brand.find((f) => f.code === 'brand.font.review')!;
  assert.deepEqual(font.fix, { layerId: 'a', field: 'font', before: 'Other Sans', after: 'sans' });
  // An unset field is written as null so the `before` key survives JSON.
  const unsetFix = checkFindingFromBrand({ id: 'brand.font.x.font', kind: 'font', status: 'review', layerId: 'x', label: 'X', field: 'font', fix: { layerId: 'x', field: 'font', before: undefined, after: 'sans' } });
  assert.equal(unsetFix.fix?.before, null);
  const unknown = checkFindingFromBrand({ id: 'brand.document', kind: 'coverage', status: 'unknown', label: 'No readable composition.' });
  assert.deepEqual([unknown.code, unknown.severity, unknown.needs, unknown.path], ['brand.coverage.unknown', 'info', 'unknown', '/boxes']);

  const rule: HouseRuleFindingInput = { ruleId: 'suse.headline-weight', kind: 'text-weight', layerId: 'a', field: 'weight', value: '700', expected: '500', message: 'Headlines use weight 500: this title uses 700.', requirement: 'required' };
  const house = checkFindingFromHouseRule(rule, lookup);
  assert.deepEqual(
    [house.code, house.severity, house.path, house.artboardId, house.suggestion, house.origin.id],
    ['brand.rule.text-weight', 'error', '/boxes/1/weight', 'f', '500', 'suse.headline-weight']
  );
  assert.equal(checkFindingFromHouseRule({ ...rule, requirement: 'advisory' }, lookup).severity, 'warn');
  const batch = checkFindingsFromHouseRules({ findings: [rule], unknown: ['pack.mystery'] }, lookup);
  assert.deepEqual(batch.map((f) => [f.code, f.severity]), [['brand.rule.text-weight', 'error'], ['brand.rule.unknown', 'info']]);
  // The engine's own house-rule finding fits the mapper's input as it stands.
  const fromEngine: HouseRuleFinding = rule;
  assert.ok(checkFindingFromHouseRule(fromEngine));

  assertValidFindings([...structure, ...mounted, ...brand, unsetFix, unknown, ...batch]);
});

test('a Verify finding from an export maps without refs, and a clue the context explains is info', () => {
  const finding: ForensicFinding = {
    id: '2:eyebrow:0', rule: 'redundant-eyebrow', family: 'eyebrow-heading', version: 'v', modality: 'layout',
    label: 'Eyebrow', detail: '“Growth” precedes “Our growth”.', method: 'decoded-pixels', confidence: 0.7,
    confidenceBasis: 'heuristic', contribution: 'context-excluded', alternatives: ['A kicker can introduce a heading.'],
    locations: [{ page: '2', box: { x: 1, y: 2, width: 3, height: 4 } }], measurements: { sizeRatio: 2 },
  };
  const [mapped] = checkFindingsFromForensic(finding);
  assert.equal(mapped!.code, 'verify.redundant-eyebrow');
  assert.equal(mapped!.severity, 'info');
  assert.equal(mapped!.needs, undefined);
  assert.equal(mapped!.page, '2');
  assert.equal(mapped!.layerId, undefined);
  assert.equal(mapped!.message, 'Eyebrow: “Growth” precedes “Our growth”.');
  assert.equal(checkFindingsFromForensic(finding, { strict: true })[0]!.severity, 'info', 'strict promotes clues, not excluded matches');
  assertValidFindings([mapped!]);
});

// ─── fidelity ────────────────────────────────────────────────────────────────

const text = (objectId: string, plain: string, extra: Partial<ContentInventoryV1['slides'][number]['text'][number]> = {}) => ({
  objectId, role: 'body' as const, class: 'body', box: { x: 0, y: 0, width: 1, height: 0.1 },
  paragraphs: plain.split('\n').map((line) => ({ runs: [{ text: line }] })), plain, ...extra,
});
const slide = (number: number, texts: ReturnType<typeof text>[], notes: string[][] | null = null): ContentInventoryV1['slides'][number] => ({
  number, id: `s${number}`, text: texts,
  notes: notes ? { text: notes.map((p) => p.join('\n')).join('\n'), paragraphs: notes.map((lines) => ({ lines })) } : null,
  pictures: [], tables: [], charts: [], objects: [],
});
const INVENTORY: ContentInventoryV1 = {
  version: 'lolly/content-inventory-v1',
  source: { name: 'source.pptx', sha256: '0'.repeat(64), bytes: 1, kind: 'pptx', slides: 2, width: 1280, height: 720 },
  slides: [
    slide(1, [
      text('t1', 'Growth that compounds', { role: 'title', class: 'title', readingIndex: 0 }),
      text('t2', 'Quarterly review\nOrganization-wide gains', { readingIndex: 1 }),
      text('pn', '3', { role: 'page-number', class: 'page-number' }),
      text('ft', 'Confidential draft', { role: 'footer', class: 'footer' }),
    ], [['OPENING', 'Open with the numbers.']]),
    slide(2, [
      text('t3', 'Three bets we are making'),
      text('t4', 'Our roadmap for 2027'),
    ], [['Close on the roadmap.'], ['Then take questions.']]),
  ],
  media: [],
  warnings: [],
};
const RESULT = [
  { id: 's1', kind: 'frame', name: 'Opening', x: 0, y: 0, w: 1920, h: 1080, order: 0, notes: 'OPENING\nOpen with the numbers.' },
  { id: 's1-title', kind: 'text', frame: 's1', x: 120, y: 120, w: 1200, h: 100, text: 'Growth that **compounds**' },
  { id: 's1-kicker', kind: 'text', frame: 's1', x: 120, y: 60, w: 600, h: 40, text: 'QUARTERLY REVIEW' },
  { id: 's1-body', kind: 'text', frame: 's1', x: 120, y: 260, w: 1200, h: 100, text: 'Organisation-wide gains' },
  { id: 's2', kind: 'frame', name: 'Bets', x: 2000, y: 0, w: 1920, h: 1080, order: 1 },
  { id: 's2-title', kind: 'text', frame: 's2', x: 2120, y: 120, w: 1200, h: 100, text: 'Three bets\nwe are making' },
];

test('fidelity reports a missing string, lists edited ones and finds a missing speaker note', () => {
  const { fidelity, findings, mapping } = checkFidelity(INVENTORY, RESULT);
  assert.deepEqual(mapping, ['s1', 's2']);
  assert.deepEqual(fidelity.slides, { source: 2, result: 2 });
  assert.deepEqual(fidelity.missingStrings, ['Our roadmap for 2027']);
  assert.deepEqual(fidelity.editedStrings, [
    { source: 'Quarterly review', result: 'QUARTERLY REVIEW' },
    { source: 'Organization-wide gains', result: 'Organisation-wide gains' },
  ]);
  assert.deepEqual(fidelity.notes, { carried: 1, missing: 1 });
  const codes = findings.map((f) => `${f.code}:${f.severity}`).sort();
  assert.deepEqual(codes, ['fidelity.notes.missing:warn', 'fidelity.text.edited:info', 'fidelity.text.edited:info', 'fidelity.text.missing:warn']);
  const missing = findings.find((f) => f.code === 'fidelity.text.missing')!;
  assert.equal(missing.message, '“Our roadmap for 2027” from slide 2 is not in the result.');
  assert.equal(missing.artboardId, 's2');
  const note = findings.find((f) => f.code === 'fidelity.notes.missing')!;
  assert.equal(note.path, '/boxes/4/notes');
  assert.equal(note.message, 'The speaker notes of slide 2 are not in the notes of artboard “Bets”.');
  assertValidFindings(findings, fidelity);
});

test('fidelity says when slides are dropped or reordered, and decoration never counts', () => {
  const reordered = RESULT.map((row) => (row.id === 's1' ? { ...row, order: 2 } : row));
  const order = checkFidelity(INVENTORY, reordered);
  assert.deepEqual(order.mapping, ['s1', 's2']);
  assert.ok(order.findings.some((f) => f.code === 'fidelity.slides.order'));
  const dropped = checkFidelity(INVENTORY, RESULT.filter((row) => row.id === 's1' || row.frame === 's1'));
  assert.deepEqual(dropped.fidelity.slides, { source: 2, result: 1 });
  assert.ok(dropped.findings.some((f) => f.code === 'fidelity.slides.count'));
  assert.ok(dropped.fidelity.missingStrings.includes('Three bets we are making'));
  assert.ok(!JSON.stringify(dropped).includes('Confidential'), 'a footer is never reported');
  assert.equal(normaliseFidelityText('  “Smart” quotes – and   dashes… '), '"Smart" quotes - and dashes...');
});

// ─── the delivered Sleepwalking documents (private, gated) ──────────────────

const DELIVERED = (process.env.LOLLY_CHECK_DELIVERED ?? '').trim();
const deliveredSkip =
  DELIVERED && existsSync(join(DELIVERED, 'light.lolly.boxes.json')) && existsSync(join(DELIVERED, 'dark.lolly.boxes.json'))
    ? false
    : 'the delivered Sleepwalking design fixture is not on this machine (set LOLLY_CHECK_DELIVERED)';

test('the delivered Sleepwalking documents show no card, eyebrow or numbering pattern', { skip: deliveredSkip }, async () => {
  for (const name of ['light.lolly.boxes.json', 'dark.lolly.boxes.json']) {
    const boxes = JSON.parse(readFileSync(join(DELIVERED, name), 'utf8')) as unknown;
    const { findings } = await verifyDesignDocument(boxes);
    const layout = findings.filter((f) => /^verify\.(fingernail-card|eyebrow-heading|redundant-eyebrow|decorative-numbering)/.test(f.code));
    assert.deepEqual(layout, [], name);
  }
});
