// SPDX-License-Identifier: MPL-2.0
/**
 * `checkFile` (packages/node-shell/src/check.ts), the work behind `lolly check` and
 * `lolly_check` (plan 291 W1): routing by input kind, the five families and their
 * states, the exit code each outcome carries, and the report held to
 * schemas/check-report-v1.schema.json.
 *
 * The render family's page hook is replaced by a stub here, so these tests need no
 * web shell; tests/check-render.browser.test.ts drives the real one.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/check-file.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { strToU8, zipSync } from 'fflate';

import {
  checkFile,
  CheckInputError,
  checkInputKind,
  inventoryAsBoxes,
  type CheckFileOptionsV1,
  type CheckRenderAnswerV1,
  type CheckRenderSessionV1,
} from '../packages/node-shell/src/check.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';
import { readContentInventory } from '../packages/node-shell/src/content-inventory.ts';
import { readToolManifest } from '../packages/node-shell/src/content-roots.ts';
import { CHECK_OUTCOME_EXIT_CODES, type CheckReportV1 } from '../packages/core/src/check-v1.ts';
import type { ContentInventoryV1 } from '../packages/core/src/content-inventory-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (rel: string): Uint8Array => new Uint8Array(readFileSync(join(ROOT, rel)));
const TRAP_BYTES = fixture('tests/fixtures/check/trap.boxes.json');
const TRAP = JSON.parse(new TextDecoder().decode(TRAP_BYTES)) as Record<string, unknown>[];
const TOKENS = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/design-brief/tokens.json'), 'utf8')) as Record<string, unknown>;
const DESIGN_MANIFEST = readToolManifest('design', undefined);

const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'schemas/check-report-v1.schema.json'), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

function assertReport(report: CheckReportV1): void {
  assert.ok(validate(report), JSON.stringify(validate.errors, null, 2));
  assert.ok(CHECK_OUTCOME_EXIT_CODES[report.outcome].includes(report.exitCode), `${report.outcome} with exit ${report.exitCode}`);
  for (const family of Object.values(report.families)) assert.ok(family.state);
}

/** The page answer the web shell gives for the trap: the three traps the mounted audit sees. */
function trapAnswer(overrides: Record<string, unknown> = {}): CheckRenderAnswerV1 {
  const finding = (id: string, layerId: string, field: string, evidence: Record<string, string>, severity = 'warn') => ({
    id, severity, path: `/boxes/${TRAP.findIndex((r) => r.id === layerId)}/${field}`, evidence, message: 'English fallback', layerId,
  });
  return {
    kind: 'answered',
    value: {
      format: 'lolly-design-check-page',
      version: 1,
      toolId: 'design',
      layers: TRAP.length,
      painted: TRAP.length,
      structure: [],
      settled: true,
      mounted: {
        findings: [
          finding('design.text.contrast-low', 'caption-low', 'fg', { name: 'Figures are unaudited estimates', ratio: '1.5', minimum: '4.5' }),
          // The photo is not in the input, so the browser tier painted it empty: a ratio was read.
          finding('design.text.contrast-low', 'caption-photo', 'fg', { name: 'Our team in the field', ratio: '1.0', minimum: '4.5' }),
          finding('design.text.overflow', 'overflow', 'text', { name: 'An unexpectedly long headline' }),
        ],
        checked: { overflow: 11, contrast: 11, fonts: 11 },
        manualContrastReview: 0,
      },
      ...overrides,
    },
  };
}

const withTokens = (extra: CheckFileOptionsV1 = {}): CheckFileOptionsV1 => ({
  designSystem: { doc: TOKENS, origin: 'file' },
  designManifest: DESIGN_MANIFEST,
  renderChecks: async () => trapAnswer(),
  ...extra,
});

test('the input kind comes from the file name', () => {
  assert.equal(checkInputKind('deck.lolly'), 'lolly');
  assert.equal(checkInputKind('boxes.JSON'), 'design');
  assert.equal(checkInputKind('a.pdf'), 'pdf');
  assert.equal(checkInputKind('a.pptx'), 'pptx');
  for (const name of ['a.png', 'a.jpg', 'a.jpeg', 'a.webp', 'a.svg']) assert.equal(checkInputKind(name), 'image');
  assert.equal(checkInputKind('a.docx'), null);
});

test('the trap document reports structure, render, brand and Verify findings on their layers', async () => {
  let session: CheckRenderSessionV1 | undefined;
  const report = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ renderChecks: async (s) => { session = s; return trapAnswer(); } }));
  assertReport(report);
  assert.equal(report.input.kind, 'design');
  assert.equal(report.input.artboards, 1);
  assert.match(report.input.sha256 ?? '', /^[0-9a-f]{64}$/);
  assert.deepEqual(report.designSystem, { origin: 'file' });
  for (const family of ['structure', 'render', 'brand', 'verify'] as const) assert.equal(report.families[family].state, 'ran', family);
  assert.equal(report.families.fidelity.state, 'skipped');

  const layerOf = (code: string) => report.findings.filter((f) => f.code === code).map((f) => f.layerId);
  assert.deepEqual(layerOf('design.layer.outside-artboard'), ['bleed']);
  assert.deepEqual(layerOf('design.text.contrast-low'), ['caption-low']);
  assert.deepEqual(layerOf('design.text.overflow'), ['overflow']);
  // Text over a picture the input does not carry is a visual check, as over any picture.
  const photo = report.findings.find((f) => f.layerId === 'caption-photo' && f.family === 'render')!;
  assert.equal(photo.code, 'design.text.contrast-review');
  assert.equal(photo.severity, 'info');
  assert.equal(photo.needs, 'visual-check');
  assert.match(report.families.render.reason ?? '', /1 uploaded picture/);
  assert.deepEqual(layerOf('verify.fingernail-card'), ['card-1']);
  assert.deepEqual(layerOf('verify.eyebrow-heading'), ['eyebrow']);
  assert.deepEqual(layerOf('verify.decorative-numbering'), ['card-1-label']);
  assert.ok(report.findings.some((f) => f.family === 'brand' && f.code.startsWith('brand.rule.')), 'house rules ran');
  // The fixture's rules are drafts: a required one broken is a warning until approved.
  assert.ok(report.findings.filter((f) => f.origin.checker === 'house-rules').every((f) => f.severity !== 'error'));
  assert.ok(report.findings.some((f) => f.origin.checker === 'house-rules' && f.evidence?.review === 'draft'));
  // A rule kind this build has no checker for is listed, never passed.
  assert.ok(report.findings.some((f) => f.code === 'brand.rule.unknown' && f.evidence?.rule === 'clear-space'));
  for (const f of report.findings) if (f.family !== 'brand' || f.code !== 'brand.rule.unknown') assert.ok(f.layerId, `${f.code} has a layer`);

  assert.equal(report.outcome, 'review');
  assert.equal(report.exitCode, 5);
  assert.deepEqual(report.summary, {
    error: report.findings.filter((f) => f.severity === 'error').length,
    warn: report.findings.filter((f) => f.severity === 'warn').length,
    info: report.findings.filter((f) => f.severity === 'info').length,
  });
  // The document went to the page as a saved session (plan 291 W9), never in its URL.
  assert.ok(session, 'the page hook ran');
  assert.match(session.name, /\.lolly$/);
  const opened = readLollyFile(session.bytes);
  assert.equal((opened.session.boxes as unknown[]).length, TRAP.length);
  assert.equal(session.tokenSelection, undefined);
});

test('the render family opens the session in the theme the check is for', async () => {
  const doc = { ...structuredClone(TOKENS), $themes: [{ name: 'light' }, { name: 'dark' }] };
  let session: CheckRenderSessionV1 | undefined;
  await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ designSystem: { doc, origin: 'file' }, theme: 'dark', renderChecks: async (s) => { session = s; return trapAnswer(); } }));
  assert.deepEqual(session?.tokenSelection, { '': 'dark' });
});

test('strict turns Verify clues into errors and refuses on any warning', async () => {
  const report = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ strict: true }));
  assertReport(report);
  assert.equal(report.strict, true);
  assert.ok(report.findings.filter((f) => f.family === 'verify').every((f) => f.severity === 'error'));
  assert.equal(report.outcome, 'refused');
  assert.equal(report.exitCode, 4);
});

test('an approved required house rule is an error and refuses the check', async () => {
  const doc = structuredClone(TOKENS) as { $extensions: Record<string, { brandSystem: { rules: Array<{ id: string; review: unknown }> } }> };
  const rule = doc.$extensions['com.suse.lolly']!.brandSystem.rules.find((r) => r.id === 'rounded-edges')!;
  rule.review = { state: 'approved', authority: 'fixture' };
  const report = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ designSystem: { doc, origin: 'file' }, browser: 'off' }));
  assertReport(report);
  const errors = report.findings.filter((f) => f.severity === 'error');
  assert.ok(errors.length > 0);
  assert.deepEqual(errors.map((f) => [f.origin.id, f.layerId]), [['rounded-edges', 'card-1-strip']]);
  assert.equal(report.exitCode, 4);
});

test('with no design system the brand family is unavailable and the rest still run', async () => {
  const report = await checkFile(TRAP_BYTES, 'trap.boxes.json', { browser: 'off' });
  assertReport(report);
  assert.equal(report.families.brand.state, 'unavailable');
  assert.equal(report.designSystem, null);
  assert.equal(report.families.render.state, 'skipped');
  assert.equal(report.families.verify.state, 'ran');
  assert.ok(!report.findings.some((f) => f.family === 'brand'));
});

test('a render tier that cannot answer is unavailable, and `require` makes that exit 3', async () => {
  const noHook = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ renderChecks: async () => ({ kind: 'no-hook', reason: 'an older shell' }) }));
  assertReport(noHook);
  assert.equal(noHook.families.render.state, 'unavailable');
  // The tier's own reason leads; the text-measure checker (plan 291 W5) adds what it predicted after that reason.
  assert.match(noHook.families.render.reason ?? '', /^an older shell\. Clipping was predicted from font metrics/);
  assert.equal(noHook.exitCode, 5);

  const thrown = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ renderChecks: async () => { throw new Error('Chromium is missing'); } }));
  assert.equal(thrown.families.render.state, 'unavailable');
  assert.match(thrown.families.render.reason ?? '', /Chromium is missing/);

  const required = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ browser: 'require', renderChecks: async () => ({ kind: 'no-hook', reason: 'none' }) }));
  assertReport(required);
  assert.deepEqual([required.outcome, required.exitCode], ['failed', 3]);

  const wrongTool = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ renderChecks: async () => ({ kind: 'answered', value: null }) }));
  assert.equal(wrongTool.families.render.state, 'unavailable');
});

test('a document far past the old URL budget still reaches the page, as a session (plan 291 W9)', async () => {
  const big = [...TRAP, ...Array.from({ length: 40 }, (_, i) => ({
    id: `filler-${i}`, kind: 'text', frame: 'slide', x: 0, y: 0, w: 10, h: 10,
    text: Array.from({ length: 900 }, (_, j) => `w${(i * 7919 + j * 104729) % 1000003}`).join(' '),
  }))];
  let called = false;
  const report = await checkFile(new TextEncoder().encode(JSON.stringify(big)), 'big.json', withTokens({ renderChecks: async () => { called = true; return trapAnswer(); } }));
  assert.equal(called, true);
  assert.equal(report.families.render.state, 'ran');
  assert.doesNotMatch(report.families.render.reason ?? '', /URL|W9/);
});

test('a JSON document with an inline picture hands the page that picture as an upload', async () => {
  const png = readFileSync(join(ROOT, 'shells/web/public/icons/icon-192.png'));
  const rows = TRAP.map((row) => (row.id === 'photo' ? { ...row, image: `data:image/png;base64,${png.toString('base64')}` } : row));
  let session: CheckRenderSessionV1 | undefined;
  const report = await checkFile(new TextEncoder().encode(JSON.stringify(rows)), 'inline.json', withTokens({ renderChecks: async (s) => { session = s; return trapAnswer(); } }));
  const opened = readLollyFile(session!.bytes);
  const photo = (opened.session.boxes as Array<Record<string, unknown>>).find((r) => r.id === 'photo')!;
  assert.match(String((photo.image as { id?: unknown }).id ?? photo.image), /^user\/media\/[0-9a-f]{64}$/);
  assert.equal([...opened.files.keys()].filter((k) => k.startsWith('assets/')).length, 1);
  // The picture is painted, so the page's own answer stands: no "painted empty" note.
  assert.doesNotMatch(report.families.render.reason ?? '', /painted/);
});

test('a .lolly is read through its manifest and handed to the page as it is, its uploads with it', async () => {
  const hex = 'ab'.repeat(32);
  const boxes = TRAP.map((row) => (row.id === 'photo' ? { ...row, image: { id: `user/media/${hex}`, source: 'user' } } : row));
  const session = { boxes, __toolId: 'design' };
  const manifest = { format: 'lolly-share', formatVersion: 1, minReader: 1, kind: 'session', tool: { id: 'design', version: '1' } };
  const bytes = zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'session.json': strToU8(JSON.stringify(session)),
    [`assets/uploads/${hex}.jpg`]: new Uint8Array(2048),
  });
  let called = false;
  let handed: Uint8Array | undefined;
  const report = await checkFile(bytes, 'trap.lolly', withTokens({ browser: 'require', renderChecks: async (s) => { called = true; handed = s.bytes; return trapAnswer(); } }));
  assertReport(report);
  assert.equal(report.input.kind, 'lolly');
  // The file itself goes to the page (plan 291 W9), so its upload is painted and the
  // page's answer for the text over that picture stands as the page gave the answer.
  assert.equal(called, true);
  assert.deepEqual(handed, bytes);
  assert.equal(report.families.render.state, 'ran');
  assert.doesNotMatch(report.families.render.reason ?? '', /painted|URL/);
  assert.notEqual(report.exitCode, 3);
  const overPhoto = report.findings.find((f) => f.layerId === 'caption-photo' && f.family === 'render');
  assert.deepEqual([overPhoto?.code, overPhoto?.severity], ['design.text.contrast-low', 'warn']);
  assert.equal(report.families.structure.state, 'ran');
  assert.ok(report.findings.some((f) => f.code === 'verify.fingernail-card'));

  const other = zipSync({
    'manifest.json': strToU8(JSON.stringify({ ...manifest, tool: { id: 'qr-code', version: '1' } })),
    'session.json': strToU8('{}'),
  });
  await assert.rejects(checkFile(other, 'qr.lolly'), (err: unknown) => err instanceof CheckInputError && err.code === 'input.unsupported');
});

test('fidelity lists missing strings, deliberate edits and notes against a source inventory', async () => {
  const text = (objectId: string, plain: string, role = 'body') => ({
    objectId, role, class: 'body', readingIndex: 0, box: { x: 0, y: 0, width: 1, height: 0.1 },
    paragraphs: [{ runs: [{ text: plain }] }], plain,
  });
  const inventory = {
    version: 'lolly/content-inventory-v1',
    source: { name: 'source.pptx', sha256: '0'.repeat(64), bytes: 1, kind: 'pptx', slides: 1, width: 1920, height: 1080 },
    slides: [{
      number: 1, id: 's1',
      text: [text('a', 'Quarterly review'), text('b', 'Growth that compounds'), text('c', 'Our roadmap for 2027'), text('d', 'east', 'other')],
      notes: { text: 'Open with the quarterly numbers.', paragraphs: [{ lines: ['Open with the quarterly numbers.'] }] },
      pictures: [], tables: [], charts: [], objects: [],
    }],
    media: [], warnings: [],
  } as unknown as ContentInventoryV1;
  const report = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ browser: 'off', source: inventory }));
  assertReport(report);
  assert.equal(report.families.fidelity.state, 'ran');
  assert.deepEqual(report.fidelity?.missingStrings, ['Our roadmap for 2027']);
  assert.deepEqual(report.fidelity?.editedStrings, [{ source: 'Quarterly review', result: 'QUARTERLY REVIEW' }]);
  assert.deepEqual(report.fidelity?.notes, { carried: 1, missing: 0 });
  assert.deepEqual(report.fidelity?.slides, { source: 1, result: 1 });
  const edited = report.findings.find((f) => f.code === 'fidelity.text.edited')!;
  assert.equal(edited.severity, 'info');
  assert.equal(report.findings.find((f) => f.code === 'fidelity.text.missing')?.severity, 'warn');

  // A source given as an inventory file, or as a deck, reads the same way.
  const fromJson = await checkFile(TRAP_BYTES, 'trap.boxes.json', { browser: 'off', source: { bytes: strToU8(JSON.stringify(inventory)), name: 'inventory.json' } });
  assert.deepEqual(fromJson.fidelity, report.fidelity);
  await assert.rejects(
    checkFile(TRAP_BYTES, 'trap.boxes.json', { browser: 'off', source: { bytes: strToU8('{"not":"an inventory"}'), name: 'x.json' } }),
    (err: unknown) => err instanceof CheckInputError && err.code === 'source.unreadable'
  );
});

test('an export runs Verify alone, from the file, with OCR off', async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#ffffff"/>
    <rect x="100" y="100" width="400" height="300" rx="24" fill="#f2f3f5"/>
    <rect x="100" y="100" width="400" height="8" fill="#2563eb"/>
    <text x="140" y="200" font-size="36">A card with an edge</text>
  </svg>`;
  const report = await checkFile(strToU8(svg), 'card.svg');
  assertReport(report);
  assert.equal(report.input.kind, 'image');
  for (const family of ['structure', 'render', 'brand'] as const) assert.equal(report.families[family].state, 'skipped', family);
  assert.equal(report.families.verify.state, 'ran');
  assert.match(report.families.verify.reason ?? '', /OCR and the text classifier off/);
  assert.equal(report.designSystem, undefined);
  const card = report.findings.find((f) => f.code === 'verify.fingernail-card');
  assert.ok(card, 'the card is found from the SVG geometry');
  assert.equal(card.page, '1');
  assert.ok(card.box);
  assert.equal(report.exitCode, 5);
});

test('a deck checked against itself carries every string and note', async () => {
  const deck = fixture('tests/fixtures/rebrand/notes.pptx');
  const report = await checkFile(deck, 'notes.pptx', { source: { bytes: deck, name: 'notes.pptx' } });
  assertReport(report);
  assert.equal(report.families.fidelity.state, 'ran');
  assert.deepEqual(report.fidelity?.missingStrings, []);
  assert.equal(report.fidelity?.notes.missing, 0);
  assert.ok((report.fidelity?.notes.carried ?? 0) > 0);
  const own = (await readContentInventory({ bytes: deck, name: 'notes.pptx' })).inventory;
  const rows = inventoryAsBoxes(own);
  assert.equal(rows.filter((r) => r.kind === 'frame').length, own.slides.length);
});

test('inputs it cannot read are refused with a stable code', async () => {
  await assert.rejects(checkFile(new Uint8Array(1), 'notes.docx'), (err: unknown) => err instanceof CheckInputError && err.code === 'input.unsupported');
  await assert.rejects(checkFile(strToU8('{'), 'x.json'), (err: unknown) => err instanceof CheckInputError && err.code === 'input.unreadable');
  await assert.rejects(checkFile(strToU8('{"values":{}}'), 'x.json'), (err: unknown) => err instanceof CheckInputError && err.code === 'input.unsupported');
  await assert.rejects(checkFile(TRAP_BYTES, 'trap.json', { pageCap: 0 }), (err: unknown) => err instanceof CheckInputError);
  // The accepted Design shapes: a boxes array, {boxes} and {values:{boxes}}.
  for (const shape of [{ boxes: TRAP }, { values: { boxes: TRAP } }]) {
    const report = await checkFile(strToU8(JSON.stringify(shape)), 'shape.json', { browser: 'off' });
    assert.equal(report.input.artboards, 1);
  }
});

// Plan 291 acceptance on the delivered decks. Private: the folder with the two
// delivered .lolly files, and optionally the source deck through LOLLY_SLEEPWALKING_DECK.
const DELIVERED = (process.env.LOLLY_CHECK_SLEEPWALKING ?? '').trim();
const deliveredSkip = DELIVERED && existsSync(join(DELIVERED, 'Sleepwalking SUSE light.lolly'))
  ? false
  : 'the delivered Sleepwalking deck fixture is not on this machine (set LOLLY_CHECK_SLEEPWALKING)';

test('the delivered Sleepwalking decks check with no error finding, and list their wording edits against the source', { skip: deliveredSkip, timeout: 120_000 }, async () => {
  const { readProfileBriefCatalog, readProfileTokenDocument } = await import('../packages/node-shell/src/design-brief.ts');
  const tokens = readProfileTokenDocument();
  const sourcePath = (process.env.LOLLY_SLEEPWALKING_DECK ?? '').trim();
  const source = sourcePath && existsSync(sourcePath) ? { bytes: new Uint8Array(readFileSync(sourcePath)), name: 'deck.pptx' } : undefined;
  for (const theme of ['light', 'dark']) {
    const name = `Sleepwalking SUSE ${theme}.lolly`;
    const report = await checkFile(new Uint8Array(readFileSync(join(DELIVERED, name))), name, {
      browser: 'off',
      designSystem: tokens ? { doc: tokens.doc, origin: 'profile', profile: tokens.profile, tokensAsset: tokens.tokensAsset } : null,
      catalog: readProfileBriefCatalog(),
      ...(source ? { source } : {}),
    });
    assertReport(report);
    assert.equal(report.summary.error, 0, `${name}: ${JSON.stringify(report.findings.filter((f) => f.severity === 'error').slice(0, 3))}`);
    assert.ok([0, 5].includes(report.exitCode), `${name} exits ${report.exitCode}`);
    assert.equal(report.input.artboards, 16);
    if (source) {
      assert.equal(report.families.fidelity.state, 'ran');
      assert.deepEqual(report.fidelity?.slides, { source: 16, result: 16 });
      assert.equal(report.fidelity?.notes.missing, 0);
      assert.ok((report.fidelity?.editedStrings.length ?? 0) > 0, 'the deliberate wording edits are listed');
    }
  }
});

// ── Review fixes: nothing reads as clean that was not assessed ─────────────────

const EDITABLE_PDF = fixture('tests/fixtures/rebrand-pdf/editable.pdf');

test('an image that cannot be decoded fails the check (exit 1), never reads as clean', async () => {
  for (const [label, bytes, name] of [
    ['zero bytes', new Uint8Array(0), 'empty.png'],
    ['garbage', strToU8('garbage'), 'garbage.png'],
    ['a PDF named .png', EDITABLE_PDF, 'renamed.png'],
  ] as const) {
    const report = await checkFile(bytes, name);
    assertReport(report);
    assert.deepEqual([report.outcome, report.exitCode], ['failed', 1], label);
    assert.equal(report.families.verify.state, 'failed', label);
    assert.match(report.families.verify.reason ?? '', /could be decoded/, label);
  }
});

test('an export page with no text layer, read with OCR off, is a warning that says the text went unread', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#ffffff"/><circle cx="60" cy="60" r="30" fill="#2563eb"/></svg>';
  const report = await checkFile(strToU8(svg), 'shapes.svg');
  assertReport(report);
  const unread = report.findings.find((f) => f.code === 'verify.text.unread');
  assert.ok(unread, 'the unread page is a finding');
  assert.deepEqual([unread.severity, unread.needs, unread.page], ['warn', 'unknown', '1']);
  assert.match(unread.message, /--ocr/);
  assert.equal(report.exitCode, 5);
  // Over MCP the same finding points at no CLI flag.
  const mcp = await checkFile(strToU8(svg), 'shapes.svg', { surface: 'mcp' });
  assert.doesNotMatch(mcp.findings.find((f) => f.code === 'verify.text.unread')?.message ?? '', /--ocr\b(?! on the CLI)/);
  // A page whose text was read raises nothing.
  const words = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#ffffff"/><text x="20" y="60" font-size="24">Plain words on a page</text></svg>';
  const read = await checkFile(strToU8(words), 'words.svg');
  assert.deepEqual([read.outcome, read.exitCode], ['clean', 0]);
});

test('a page cap is a warning, and input.pages is the document\'s own page count', async () => {
  const capped = await checkFile(EDITABLE_PDF, 'editable.pdf', { pageCap: 1 });
  assertReport(capped);
  assert.equal(capped.input.pages, 3);
  const finding = capped.findings.find((f) => f.code === 'verify.pages-capped');
  assert.ok(finding);
  assert.deepEqual(finding.evidence, { read: 1, total: 3 });
  assert.equal(capped.exitCode, 5);
  const whole = await checkFile(EDITABLE_PDF, 'editable.pdf');
  assert.equal(whole.input.pages, 3);
  assert.ok(!whole.findings.some((f) => f.code === 'verify.pages-capped'));
  assert.equal(whole.exitCode, 0);
});

test('`require` applies to a document\'s render family only, never to an export', async () => {
  const pdf = await checkFile(EDITABLE_PDF, 'editable.pdf', { browser: 'require' });
  assertReport(pdf);
  assert.deepEqual([pdf.outcome, pdf.exitCode], ['clean', 0]);
  assert.equal(pdf.families.render.state, 'skipped');
  assert.match(pdf.families.render.reason ?? '', /required.*document only/);

  const missing = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ browser: 'require', renderChecks: async () => ({ kind: 'no-hook', reason: 'No browser here.' }) }));
  assert.equal(missing.exitCode, 3);
  assert.match(missing.families.render.reason ?? '', /No browser here\. The browser tier was required, so the check exits 3\./);
});

test('--source takes what `lolly read --json` wrote and what lolly_read returned, and holds an inventory to its shape', async () => {
  const deck = fixture('tests/fixtures/rebrand/notes.pptx');
  const inventory = (await readContentInventory({ bytes: deck, name: 'notes.pptx' })).inventory;
  const direct = await checkFile(deck, 'notes.pptx', { source: inventory });
  const envelope = { schemaVersion: 1, command: 'read', ok: true, error: null, warnings: [], result: inventory };
  const fromEnvelope = await checkFile(deck, 'notes.pptx', { source: { bytes: strToU8(JSON.stringify(envelope)), name: 'old.inventory.json' } });
  assert.deepEqual(fromEnvelope.fidelity, direct.fidelity);
  const structured = { source: inventory.source, counts: {}, inventoryDelivery: { mode: 'inline', bytes: 1 }, inventory, media: [], warnings: [], ocr: false };
  const fromTool = await checkFile(deck, 'notes.pptx', { source: structured as unknown as ContentInventoryV1 });
  assert.deepEqual(fromTool.fidelity, direct.fidelity);

  // Shallow look-alikes are refused with source.unreadable and the paths at fault, never a crash.
  for (const bad of [{ version: 'lolly/content-inventory-v1', slides: [] }, { ...inventory, slides: [{ number: 1, text: [{ plain: 1 }] }] }]) {
    await assert.rejects(
      checkFile(TRAP_BYTES, 'trap.boxes.json', { browser: 'off', source: { bytes: strToU8(JSON.stringify(bad)), name: 'inv.json' } }),
      (err: unknown) => err instanceof CheckInputError && err.code === 'source.unreadable' && /\/(source|slides\/0)/.test(err.message)
    );
  }
});

test('a theme the design system does not declare is refused; one it declares is used', async () => {
  await assert.rejects(
    checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ browser: 'off', theme: 'nope-theme' })),
    (err: unknown) => err instanceof CheckInputError && err.code === 'input.unsupported' && /nope-theme.*light, dark/.test(err.message)
  );
  const dark = await checkFile(TRAP_BYTES, 'trap.boxes.json', withTokens({ browser: 'off', theme: 'dark' }));
  assert.match(dark.families.brand.reason ?? '', /Theme: dark\./);
});

test('family reasons name the arguments of the surface asking', async () => {
  const cli = await checkFile(TRAP_BYTES, 'trap.boxes.json', { browser: 'off' });
  assert.match(cli.families.fidelity.reason ?? '', /--source/);
  assert.match(cli.families.brand.reason ?? '', /--file/);
  const mcp = await checkFile(TRAP_BYTES, 'trap.boxes.json', { browser: 'off', surface: 'mcp' });
  for (const family of ['fidelity', 'brand'] as const) assert.doesNotMatch(mcp.families[family].reason ?? '', /--|terminal/, family);
  assert.match(mcp.families.fidelity.reason ?? '', /source.*inventory/);
});

test('an export split into one row per line, its columns interleaved, carries its source strings', async () => {
  const frame = (objectId: string, plain: string, readingIndex: number, y: number, x = 0.1) => ({
    objectId, role: 'body', class: 'body', readingIndex, box: { x, y, width: 0.3, height: 0.05 }, paragraphs: [{ runs: [{ text: plain }] }], plain,
  });
  const inv = (kind: 'pptx' | 'pdf', text: ReturnType<typeof frame>[]) => ({
    version: 'lolly/content-inventory-v1',
    source: { name: `deck.${kind}`, sha256: '0'.repeat(64), bytes: 1, kind, slides: 1, width: 1920, height: 1080 },
    slides: [{ number: 1, id: 's1', text, notes: kind === 'pptx' ? { text: 'Say hello.', paragraphs: [{ lines: ['Say hello.'] }] } : null, pictures: [], tables: [], charts: [], objects: [] }],
    media: [], warnings: [],
  }) as unknown as ContentInventoryV1;
  const source = inv('pptx', [
    frame('t', 'Are we building our next bridge on sand?', 0, 0.1),
    frame('l', 'Harbour Plan for the river towns', 1, 0.3),
    frame('r', 'Robin Vale', 2, 0.3, 0.6),
  ]);
  // The PDF reader's lines: the right column's line sits between the left column's
  // lines by height, and the reader's order keeps each column together.
  const result = inv('pdf', [
    frame('a', 'Are we', 0, 0.1), frame('b', 'building', 1, 0.12), frame('c', 'our next bridge', 2, 0.14), frame('d', 'on sand?', 3, 0.16),
    frame('e', 'Harbour', 4, 0.3), frame('g', 'Robin Vale', 6, 0.31, 0.6), frame('f', 'Plan for the river towns', 5, 0.32),
  ]);
  const rows = inventoryAsBoxes(result);
  assert.equal(rows.find((r) => r.id === 'page-1-a')?.readingIndex, 0);
  const { checkFidelity } = await import('../engine/src/check-fidelity.ts');
  const compared = checkFidelity(source, rows, { notes: false });
  assert.deepEqual(compared.fidelity.missingStrings, []);
  assert.deepEqual(compared.fidelity.editedStrings, []);
  // A PDF cannot carry speaker notes: they are not compared, so none is missing.
  assert.deepEqual(compared.fidelity.notes, { carried: 0, missing: 0 });
  assert.ok(!compared.findings.some((f) => f.code === 'fidelity.notes.missing'));
});
