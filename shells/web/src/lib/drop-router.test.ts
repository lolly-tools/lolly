// SPDX-License-Identifier: MPL-2.0
// Tests for the pure helpers in lib/drop-router.ts: the share-chunk assembly
// step, and the two design-system sniffs (plan 97 section 8) that decide whether the
// chooser offers "Use as the design system". Everything else in the module is
// DOM/navigation and belongs to a browser.
//
// Tests for the pure share-chunk assembly helper in lib/drop-router.ts - the
// decode/concat step between the Android `LollyShare` JS interface's base64
// chunks and the File handed to the drop chooser. The interface itself (poll/
// consumed, warm-share events) only exists inside the Android WebView, so the
// pure part is what a node test can pin down.
// The tests tsconfig includes only *.test.ts + jsdom.d.ts; drop-router's lazy
// `import('../views/picker.ts')` pulls bridge/export.ts (and its vendor
// modules) into this program, so their ambient declarations must come along.
/// <reference path="../vendor.d.ts" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { readFileSync } from 'node:fs';
import {
  assembleShareChunks,
  looksLikeTokenDoc,
  zipListsDesignSystemParts,
  dropChooserChoices,
  dropChooserMessage,
  lollyIntakeChoices,
  setPendingRebrandFile,
  setPendingRebrandFiles,
  takePendingRebrandFile,
  takePendingRebrandFiles,
  deckKindOf,
} from './drop-router.ts';
import type { Sniff, ChooserContext } from './drop-router.ts';
import { classifyLollyManifest, describeRenovation } from './lolly-intake.ts';
import { LOLLY_RENOVATION_TOOL_ID } from './lolly-pack.ts';
import { PROJECT_STAGES } from '@lolly-tools/core';

const b64 = (s: string): string => Buffer.from(s, 'latin1').toString('base64');

test('assembleShareChunks: concatenates chunks in order', () => {
  const chunks = [b64('hello '), b64('shared '), b64('world')];
  const out = assembleShareChunks(chunks.length, (i) => chunks[i]!);
  assert.equal(Buffer.from(out).toString('latin1'), 'hello shared world');
});

test('assembleShareChunks: zero chunks → empty buffer, reader never called', () => {
  const out = assembleShareChunks(0, () => { throw new Error('must not read'); });
  assert.equal(out.length, 0);
});

test('assembleShareChunks: binary bytes survive the round-trip', () => {
  const bytes = Uint8Array.from({ length: 4096 }, (_, i) => (i * 7 + 13) % 256);
  const chunk = Buffer.from(bytes).toString('base64');
  assert.deepEqual(assembleShareChunks(1, () => chunk), bytes);
});

test('assembleShareChunks: tolerates android Base64.DEFAULT line wraps', () => {
  // android.util.Base64.DEFAULT inserts "\n" every 76 chars (and a trailing one).
  const wrapped = `${Buffer.from('wrapped-payload-bytes').toString('base64').replace(/(.{8})/g, '$1\n')}\n`;
  assert.equal(Buffer.from(assembleShareChunks(1, () => wrapped)).toString(), 'wrapped-payload-bytes');
});

test("assembleShareChunks: '' chunk (the bridge's out-of-range answer) adds nothing", () => {
  const out = assembleShareChunks(2, (i) => (i === 0 ? b64('data') : ''));
  assert.equal(Buffer.from(out).toString(), 'data');
});

test('assembleShareChunks: uneven chunk sizes keep byte offsets exact', () => {
  const parts = ['a', 'bb', 'ccc', '', 'ddddd'];
  const out = assembleShareChunks(parts.length, (i) => b64(parts[i]!));
  assert.equal(Buffer.from(out).toString('latin1'), parts.join(''));
});

// ── design-system sniffs (plan 97 section 8) ────────────────────────────────────────

test('looksLikeTokenDoc: Tokens-Studio container keys are enough on their own', () => {
  assert.equal(looksLikeTokenDoc({ $themes: [], $metadata: { tokenSetOrder: ['core'] } }), true);
  assert.equal(looksLikeTokenDoc({ $metadata: { tokenSetOrder: [] } }), true);
});

test('looksLikeTokenDoc: a nested DTCG $value leaf', () => {
  const doc = { color: { brand: { primary: { $value: '#0c322c', $type: 'color' } } } };
  assert.equal(looksLikeTokenDoc(doc), true);
});

test('looksLikeTokenDoc: the legacy Tokens-Studio { value, type } leaf', () => {
  assert.equal(looksLikeTokenDoc({ colors: { red: { value: '#f00', type: 'color' } } }), true);
  // `value` without a string `type` is just data, not a token.
  assert.equal(looksLikeTokenDoc({ settings: { volume: { value: 3 } } }), false);
});

test('looksLikeTokenDoc: a Lottie-shaped document is not a token document', () => {
  // The case coerceTokensDoc alone answers wrongly: it accepts ANY JSON object.
  const lottie = { v: '5.7.4', fr: 30, w: 512, h: 512, layers: [{ ty: 4, nm: 'shape' }] };
  assert.equal(looksLikeTokenDoc(lottie), false);
});

test('looksLikeTokenDoc: arrays and primitives are refused outright', () => {
  assert.equal(looksLikeTokenDoc([{ $value: '#f00' }]), false);
  assert.equal(looksLikeTokenDoc('#f00'), false);
  assert.equal(looksLikeTokenDoc(null), false);
});

test('looksLikeTokenDoc: an INHERITED value/type never stands in for a token leaf', () => {
  assert.equal(looksLikeTokenDoc({ a: { b: {} } }), false);
  const inherited = { tokens: Object.create({ $value: '#f00', value: '#f00', type: 'color' }) as object };
  assert.equal(looksLikeTokenDoc(inherited), false);
});

test('looksLikeTokenDoc: a set literally named __proto__ is still a set', () => {
  // JSON.parse makes "__proto__" an OWN enumerable key, and the engine's
  // assembleTokenSetFiles already treats such a set as real - the sniff agrees.
  assert.equal(looksLikeTokenDoc(JSON.parse('{"__proto__":{"red":{"$value":"#f00"}}}')), true);
});

test('looksLikeTokenDoc: the walk is bounded, so a deep leaf past the budget is missed', () => {
  // Documented behaviour, not an accident: the budget is what keeps the sniff
  // affordable on a huge unrelated JSON drop.
  let deep: Record<string, unknown> = { $value: '#f00' };
  for (let i = 0; i < 20; i++) deep = { nest: deep };
  assert.equal(looksLikeTokenDoc(deep), false);
  assert.equal(looksLikeTokenDoc(deep, 4000, 32), true);
});

test('zipListsDesignSystemParts: a Lolly pack names manifest.json + tokens.json', () => {
  // Local file headers keep entry names in the clear even when bodies deflate.
  const head = 'PK\u0000manifest.json{binary}PK\u0000tokens.json';
  assert.equal(zipListsDesignSystemParts(head), true);
});

test('zipListsDesignSystemParts: a loose token-set export needs only its metadata files', () => {
  assert.equal(zipListsDesignSystemParts('PK$metadata.json'), true);
  assert.equal(zipListsDesignSystemParts('PK$themes.json'), true);
});

// ── what the chooser offers, and what it says ────────────────────────────────

const NOTHING: Sniff = {
  design: false, pdf: false, pptx: false, media: false,
  c2pa: false, layers: false, archive: false, designSystem: false, lolly: false,
  textDoc: false,
};
const sniff = (over: Partial<Sniff>): Sniff => ({ ...NOTHING, ...over });
const ctx = (over: Partial<ChooserContext> = {}): ChooserContext => ({
  single: true, count: 1, allIngestable: false, has: () => true, ...over,
});
const leader = (list: ReturnType<typeof dropChooserChoices>): string | undefined =>
  list.find((c) => c.primary)?.id;

test('a plain zip still leads with unpack', () => {
  const s = sniff({ archive: true, design: true });
  const list = dropChooserChoices(s, ctx());
  assert.equal(list[0]?.id, 'unpack');
  assert.equal(leader(list), 'unpack');
  assert.equal(dropChooserMessage(s, 'photos.zip', ctx()), '“photos.zip” is an archive.');
});

test('a design-system pack zip leads with the studio, and unpack stays underneath', () => {
  // Unpacking a pack shreds it into loose library assets - the opposite of
  // installing it - so the route the sniff positively identified goes first.
  const s = sniff({ archive: true, design: true, designSystem: true });
  const list = dropChooserChoices(s, ctx());
  assert.equal(list[0]?.id, 'design-system');
  assert.equal(leader(list), 'design-system');
  assert.equal(list.filter((c) => c.primary).length, 1, 'exactly one route leads');
  const unpack = list.find((c) => c.id === 'unpack');
  assert.ok(unpack, 'unpack is still offered');
  assert.ok(!unpack.primary);
  // …and the studio door is offered exactly once, not once per branch.
  assert.equal(list.filter((c) => c.id === 'design-system').length, 1);
});

test('a design-system pack zip is named, never announced as just "an archive"', () => {
  const s = sniff({ archive: true, design: true, designSystem: true });
  assert.equal(
    dropChooserMessage(s, 'pack.zip', ctx()),
    '“pack.zip” can open in Design or install as the design system.',
  );
  // With no Layout Studio in the build there is one door, and it is still named.
  assert.equal(
    dropChooserMessage(s, 'pack.zip', ctx({ has: () => false })),
    '“pack.zip” looks like a design system.',
  );
});

test('a .penpot keeps its pair: Layout Studio leads, the studio sits beside it', () => {
  // `archive` is false for a .penpot (PURE_DESIGN_EXT_RE excludes it), so this
  // path is untouched by the pack-zip rule above.
  const list = dropChooserChoices(sniff({ design: true, designSystem: true }), ctx());
  assert.deepEqual(list.map((c) => c.id), ['design', 'design-rules', 'design-system', 'sequence', 'exports']);
  assert.equal(leader(list), 'design');
});

test('a token .json offers the studio alone, and leads with it', () => {
  const list = dropChooserChoices(sniff({ designSystem: true }), ctx());
  assert.deepEqual(list.map((c) => c.id), ['design-system', 'verify']);
  assert.equal(leader(list), 'design-system');
});

test('a PDF offers the studio beside its own routes, and never leads with it', () => {
  // Plan 97 M5: a guidelines PDF is design-system material (colours, marks,
  // embedded faces), but a PDF's first meaning is still a document - the sniff
  // cannot tell guidelines from an invoice, so Layout Studio keeps the lead and
  // the studio door sits with the other "what is inside this document" routes,
  // above the transform utility.
  const s = sniff({ pdf: true });
  const list = dropChooserChoices(s, ctx());
  assert.deepEqual(list.map((c) => c.id), ['design', 'design-rules', 'sequence', 'rebrand', 'library', 'design-system', 'compress']);
  assert.equal(leader(list), 'design');
  // …and the sentence still names the file for what it is.
  assert.equal(dropChooserMessage(s, 'guidelines.pdf', ctx()), '“guidelines.pdf” is a PDF or Illustrator document.');
});

test('a PDF in a build with no other PDF tools still reaches the studio', () => {
  const list = dropChooserChoices(sniff({ pdf: true }), ctx({ has: () => false }));
  assert.deepEqual(list.map((c) => c.id), ['rebrand', 'library', 'design-system']);
});

test('the studio door is offered once even if a file sniffs as both PDF and tokens', () => {
  // sniffFile never reports both (designSystem is computed `!pdf`), so this pins
  // the defensive guard in the PDF branch rather than a reachable state.
  const list = dropChooserChoices(sniff({ pdf: true, designSystem: true }), ctx());
  assert.equal(list.filter((c) => c.id === 'design-system').length, 1);
  assert.equal(leader(list), 'design');
});

test('zipListsDesignSystemParts: a manifest alone is not a design system', () => {
  // Plenty of zips carry a manifest.json (extensions, web apps); without the
  // token half they keep the plain unpack/Layout Studio routes only.
  assert.equal(zipListsDesignSystemParts('PKmanifest.json'), false);
  assert.equal(zipListsDesignSystemParts('PKphoto.jpg\u0000notes.txt'), false);
});

// A plain-text / markdown / code document ingests to the library as a type:'text'
// asset. Before this, only media offered "Add to your library", so a dragged .txt
// looked unsupported (only a verify route, or nothing).
test('a text document offers "Add to your library" AND the verify/AI-signals route', () => {
  const base: Sniff = {
    design: false, pdf: false, pptx: false, media: false, c2pa: false,
    layers: false, archive: false, designSystem: false, lolly: false, textDoc: false,
  };
  const ctx: ChooserContext = { single: true, count: 1, allIngestable: true, has: () => false };
  const ids = dropChooserChoices({ ...base, textDoc: true }, ctx).map((c) => c.id);
  assert.ok(ids.includes('library'), 'a .txt/.md drop must offer the library route');
  assert.ok(ids.includes('verify'), 'and the verify / AI-signals route');
  // A plain-text doc is NOT "unknown", so it should not read as an unsupported file.
  assert.ok(!ids.includes('design') && !ids.includes('unpack'));
});

test('isBrandPackParts: routes by manifest format, exactly', async () => {
  const { isBrandPackParts } = await import('./drop-router.ts');
  assert.ok(isBrandPackParts({ format: 'lolly-brand' }));
  assert.ok(!isBrandPackParts({ format: 'lolly-session' }), 'a saved session stays on the session path');
  assert.ok(!isBrandPackParts({}));
  assert.ok(!isBrandPackParts(null));
});

// Office files: one sheet, every route (plans/139 WP3 follow-up). The deck ingest's
// own slides-vs-content chooser is suppressed on this path (chooser: false), so a
// dropped .pptx never shows two dialogs in a row. Since 2026-09-02 a deck is a design
// document first: the Design doors (edit as artboards / make a video) lead exactly as
// they do for a PDF, and the pictures + content routes follow.
test('a deck offers Design first, then its slides AND content extraction, in the same sheet', () => {
  const list = dropChooserChoices(sniff({ pptx: true }), ctx());
  assert.deepEqual(list.map((c) => c.id).slice(0, 4), ['design', 'design-rules', 'sequence', 'rebrand']);
  assert.deepEqual(list.map((c) => c.id).slice(4, 6), ['library', 'extract']);
  assert.equal(leader(list), 'design', 'a deck edits like a PDF does');
});

// ── a zipped tool folder (the sideload route) ────────────────────────────────

const MANIFEST = {
  id: 'my-tool', name: 'My Tool', description: 'A tool.', version: '1.0.0',
  engineVersion: '^1.0.0', category: 'utility', status: 'community',
  inputs: [], render: { width: 512, height: 512, formats: ['svg'] },
};
const toolZip = (files: Record<string, string>): Uint8Array =>
  zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

test('a tool zip leads with Install this tool, and unpack stays underneath', () => {
  // A tool zip sniffs as an archive too (PK magic); unpacking one scatters a
  // template and a hooks file into the asset library, so the install door leads.
  const s = sniff({ tool: true, archive: true, design: true });
  const list = dropChooserChoices(s, ctx());
  assert.equal(list[0]?.id, 'install-tool');
  assert.equal(leader(list), 'install-tool');
  assert.equal(list.filter((c) => c.primary).length, 1, 'exactly one route leads');
  assert.ok(!list.find((c) => c.id === 'unpack')?.primary, 'unpack is still offered, underneath');
  assert.equal(dropChooserMessage(s, 'my-tool.zip', ctx()), '“my-tool.zip” looks like a Lolly tool folder.');
});

test('readToolZip: tool.json at the archive root', async () => {
  const { readToolZip } = await import('./drop-router.ts');
  const out = await readToolZip(toolZip({
    'tool.json': JSON.stringify(MANIFEST),
    'template.html': '<p>{{x}}</p>',
    'assets/logo.svg': '<svg/>',
  }));
  assert.equal(out.manifest.id, 'my-tool');
  assert.deepEqual(Object.keys(out.files).sort(), ['assets/logo.svg', 'template.html', 'tool.json']);
});

test('readToolZip: the "zip the folder" shape, prefix stripped', async () => {
  const { readToolZip } = await import('./drop-router.ts');
  const out = await readToolZip(toolZip({
    'my-tool/tool.json': JSON.stringify(MANIFEST),
    'my-tool/hooks.js': 'return {};',
    // A macOS-made zip carries these beside every real file; unfiltered they would
    // read as a second top-level folder and sink the whole archive.
    '__MACOSX/my-tool/._tool.json': 'x',
    'my-tool/.DS_Store': 'x',
  }));
  assert.deepEqual(Object.keys(out.files).sort(), ['hooks.js', 'tool.json']);
});

test('readToolZip: two top-level folders, or no tool.json, is not a tool folder', async () => {
  const { readToolZip } = await import('./drop-router.ts');
  await assert.rejects(
    readToolZip(toolZip({ 'a/tool.json': JSON.stringify(MANIFEST), 'b/tool.json': JSON.stringify(MANIFEST) })),
    /isn’t a tool folder/,
  );
  await assert.rejects(
    readToolZip(toolZip({ 'notes.txt': 'hello', 'pics/cat.png': 'x' })),
    /isn’t a tool folder/,
  );
});

test('readToolZip: a traversing or absolute path refuses the whole archive', async () => {
  const { readToolZip } = await import('./drop-router.ts');
  await assert.rejects(
    readToolZip(toolZip({ 'tool.json': JSON.stringify(MANIFEST), '../evil.js': 'x' })),
    /unsafe file path/,
  );
  await assert.rejects(
    readToolZip(toolZip({ 'tool.json': JSON.stringify(MANIFEST), '/etc/passwd': 'x' })),
    /unsafe file path/,
  );
});

test('readToolZip: an engineVersion this build refuses is refused in the loader’s words', async () => {
  const { readToolZip } = await import('./drop-router.ts');
  const { ENGINE_VERSION } = await import('@lolly/engine');
  await assert.rejects(
    readToolZip(toolZip({ 'tool.json': JSON.stringify({ ...MANIFEST, engineVersion: '^99.0.0' }) })),
    new RegExp(`"my-tool" requires engine \\^99\\.0\\.0, but this build implements ${ENGINE_VERSION.replace(/\./g, '\\.')} - refusing to load`),
  );
});

test('readToolZip: a manifest the schema rejects never reaches the installer', async () => {
  const { readToolZip } = await import('./drop-router.ts');
  const { id: _drop, ...noId } = MANIFEST;
  await assert.rejects(readToolZip(toolZip({ 'tool.json': JSON.stringify(noId) })), /failed validation/);
});

test('a Word document leads with content extraction and never reaches Design', () => {
  const s = sniff({ docx: true });
  const list = dropChooserChoices(s, ctx());
  assert.equal(leader(list), 'extract');
  assert.ok(!list.some((c) => c.id === 'design'), 'a .docx is a zip, but Design cannot open one');
  assert.equal(dropChooserMessage(s, 'report.docx', ctx()), '“report.docx” is a Word document.');
});

// ── the chooser's doors for a deck ─────────────────────────────────────────────

const deckSniff = (o: Partial<Sniff> = {}): Sniff => ({
  design: false, pdf: false, pptx: false, media: false, c2pa: false, layers: false, archive: false,
  textDoc: false, designSystem: false, lolly: false, ...o,
});
const deckCtx = (tools: string[]): ChooserContext => ({ single: true, count: 1, allIngestable: true, has: (id) => tools.includes(id) });

test('a .pptx gets the Design doors a PDF gets - edit as artboards, or make a video - and Design leads', () => {
  const choices = dropChooserChoices(deckSniff({ pptx: true }), deckCtx(['design']));
  const ids = choices.map((c) => c.id);
  assert.ok(ids.includes('design'), 'Edit in Design');
  assert.ok(ids.includes('sequence'), 'Make a video from its frames');
  assert.ok(ids.includes('library'), 'the slides-as-pictures route is still there');
  assert.deepEqual(choices.filter((c) => c.primary).map((c) => c.id), ['design'], 'exactly one primary, and it is Design');
  assert.match(dropChooserMessage(deckSniff({ pptx: true }), 'deck.pptx', deckCtx(['design'])), /PowerPoint deck/);
});

test('without Design in the build, a deck’s library route leads as it always did', () => {
  const choices = dropChooserChoices(deckSniff({ pptx: true }), deckCtx([]));
  assert.equal(choices.some((c) => c.id === 'design'), false);
  assert.deepEqual(choices.filter((c) => c.primary).map((c) => c.id), ['library']);
});


// ── the Rebrand door (plan 274 section 2.1) ───────────────────────────────────

test('a .pptx offers the Rebrand door beside Design, sequence and library, and it never leads', () => {
  const choices = dropChooserChoices(deckSniff({ pptx: true }), deckCtx(['design']));
  const rebrand = choices.find((c) => c.id === 'rebrand');
  assert.ok(rebrand, 'the door is on offer');
  assert.equal(rebrand.label, 'Rebrand');
  assert.equal(rebrand.primary, undefined, 'a dropped deck is first a document, so Design keeps the lead');
  const ids = choices.map((c) => c.id);
  assert.ok(ids.indexOf('rebrand') > ids.indexOf('sequence') && ids.indexOf('rebrand') < ids.indexOf('library'),
    'it sits between the Design doors and the library');
  assert.match(dropChooserMessage(deckSniff({ pptx: true }), 'deck.pptx', deckCtx(['design'])),
    /Rebrand moves its slides onto the design system\./, 'the sheet says in one line what the door does');
});

test('the Rebrand door needs no tool in the build, because #/rebrand is a view', () => {
  const choices = dropChooserChoices(deckSniff({ pptx: true }), deckCtx([]));
  assert.ok(choices.some((c) => c.id === 'rebrand'));
  assert.deepEqual(choices.filter((c) => c.primary).map((c) => c.id), ['library'], 'library still leads without Design');
});

test('the Rebrand door is for decks, and never for other files', () => {
  assert.equal(dropChooserChoices(deckSniff({ pptx: true }), { ...deckCtx(['design']), single: false, count: 2 })
    .some((c) => c.id === 'rebrand'), false, 'a mixed multi-file drop keeps only the batch routes');
  for (const kind of ['docx', 'design', 'media'] as const) {
    assert.equal(dropChooserChoices(deckSniff({ [kind]: true }), deckCtx(['design'])).some((c) => c.id === 'rebrand'), false, kind);
  }
});

test('a dropped renovation opens where it lives, now that #/rebrand exists', () => {
  // openRenovationDrop runs the whole pack reader and the store, which need a browser;
  // what it does at the end is the part this pins: it navigates to the route
  // openRenovationFile returned instead of only saying where the project went.
  const src = readFileSync(new URL('./drop-router.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('async function openRenovationDrop('), src.indexOf('async function openRenovationDrop(') + 4000);
  assert.match(body, /routeToConsumer\(opened\.route, onRebrandRoute\(\)\)/);
  assert.ok(body.indexOf('noticeDialog') < body.indexOf('routeToConsumer(opened.route'),
    'what did not travel is said before the view changes');
});

test('several decks dropped together go to Rebrand as one read, and the library keeps the lead', () => {
  const ctx: ChooserContext = { ...deckCtx(['design']), single: false, count: 3, allDecks: true };
  const choices = dropChooserChoices(deckSniff({ pptx: true }), ctx);
  const rebrand = choices.find((c) => c.id === 'rebrand');
  assert.ok(rebrand, 'the door is on offer for a drop of decks alone');
  assert.equal(rebrand.label, 'Rebrand 3 decks');
  assert.equal(rebrand.primary, undefined);
  assert.deepEqual(choices.filter((c) => c.primary).map((c) => c.id), ['library'], 'exactly one primary');
  assert.match(dropChooserMessage(deckSniff({ pptx: true }), 'a.pptx', ctx), /3 PowerPoint decks\. Add them to your library, or rebrand them onto the design system, one project each\./);
  // The router reads every file, not just the first, before it offers the door.
  const src = readFileSync(new URL('./drop-router.ts', import.meta.url), 'utf8');
  assert.match(src, /deckKindOf\(files, picker\.isPptxUpload, picker\.isPdfUpload\)/);
  assert.match(src, /setPendingRebrandFiles\(files\.filter\(\(f\) => picker\.isPptxUpload\(f\) \|\| picker\.isPdfUpload\(f\)\)\)/);
});

test('a PDF deck gets the Rebrand door too, beside the Design doors, and it never leads', () => {
  const choices = dropChooserChoices(deckSniff({ pdf: true }), deckCtx(['design']));
  const rebrand = choices.find((c) => c.id === 'rebrand');
  assert.ok(rebrand, 'the door is on offer for a PDF');
  assert.equal(rebrand.primary, undefined, 'Design keeps the lead');
  const ids = choices.map((c) => c.id);
  assert.ok(ids.indexOf('rebrand') > ids.indexOf('sequence') && ids.indexOf('rebrand') < ids.indexOf('library'),
    'it sits between the Design doors and the library, as it does for a pptx');
});

test('several PDF decks go to Rebrand together, and a mixed drop of pptx and PDF does not', () => {
  const pptx = new File([new Uint8Array([0x50, 0x4b])], 'a.pptx');
  const pdf = new File([new TextEncoder().encode('%PDF-1.7')], 'b.pdf', { type: 'application/pdf' });
  const isPptx = (f: File): boolean => /\.pptx$/i.test(f.name);
  const isPdf = (f: File): boolean => /\.pdf$/i.test(f.name);
  assert.equal(deckKindOf([pptx, pptx], isPptx, isPdf), 'pptx');
  assert.equal(deckKindOf([pdf, pdf], isPptx, isPdf), 'pdf');
  assert.equal(deckKindOf([pptx, pdf], isPptx, isPdf), null, 'decks of two kinds are not one read');
  assert.equal(deckKindOf([], isPptx, isPdf), null);

  const ctx: ChooserContext = { ...deckCtx(['design']), single: false, count: 2, allDecks: true, deckKind: 'pdf' };
  const choices = dropChooserChoices(deckSniff({ pdf: true }), ctx);
  assert.equal(choices.find((c) => c.id === 'rebrand')?.label, 'Rebrand 2 decks');
  assert.match(dropChooserMessage(deckSniff({ pdf: true }), 'b.pdf', ctx), /^2 PDF decks\. Add them to your library, or rebrand them onto the design system, one project each\.$/);
});

test('several decks wait for #/rebrand together, taken once', () => {
  const a = new File([new Uint8Array([0x50, 0x4b])], 'a.pptx');
  const b = new File([new Uint8Array([0x50, 0x4b])], 'b.pptx');
  setPendingRebrandFiles([a, b]);
  assert.deepEqual(takePendingRebrandFiles(), [a, b]);
  assert.deepEqual(takePendingRebrandFiles(), [], 'a second mount finds nothing');
  setPendingRebrandFile(a);
  assert.deepEqual(takePendingRebrandFiles(), [a], 'one deck handed over the old way reads the same');
});

test('no model download sheet opens over an import the router runs', () => {
  const src = readFileSync(new URL('./drop-router.ts', import.meta.url), 'utf8');
  const chooser = src.slice(src.indexOf('export async function openDropChooser('));
  const hold = chooser.indexOf('const releaseOffers = await holdOffers();');
  assert.ok(hold > 0 && hold < chooser.indexOf('switch (chosen)'), 'the hold is taken before the chosen import runs');
  assert.ok(chooser.indexOf('releaseOffers();') > chooser.indexOf('switch (chosen)'), 'and released once it is over');
  const lolly = src.slice(src.indexOf('export async function openLollyFile('), src.indexOf('const importLollyDrop'));
  assert.match(lolly, /const releaseOffers = await holdOffers\(\);[\s\S]*finally \{\s*releaseOffers\(\);/);
  assert.match(src, /import\('\.\/model-offer\.ts'\)\)\.holdModelOffers\(\)/);
  const intake = readFileSync(new URL('./lolly-intake.ts', import.meta.url), 'utf8');
  const load = intake.slice(intake.indexOf('export async function loadLollyFile('));
  assert.match(load, /const release = await holdOffers\(\);[\s\S]*finally \{\s*release\(\);/);
});

test('the Rebrand handoff is one-shot: taken once, then empty', () => {
  assert.equal(takePendingRebrandFile(), null, 'nothing is waiting before a door is chosen');
  const deck = new File([new Uint8Array([0x50, 0x4b])], 'deck.pptx');
  setPendingRebrandFile(deck);
  assert.equal(takePendingRebrandFile(), deck);
  assert.equal(takePendingRebrandFile(), null, 'a second mount finds nothing');
});

// ── the data route (plans/87): a table of data charts itself ──────────────────
const NO_SNIFF: Sniff = {
  design: false, pdf: false, pptx: false, media: false, c2pa: false, layers: false,
  archive: false, textDoc: false, designSystem: false, lolly: false,
};
const oneFile = (has: (id: string) => boolean): ChooserContext => ({ single: true, count: 1, allIngestable: false, has });

test('a data file leads with Spreadsheet, keeps Chart as an option, and never offers a credentials check', () => {
  const choices = dropChooserChoices({ ...NO_SNIFF, data: true }, oneFile((id) => id === 'chart'));
  assert.deepEqual(choices.map((c) => c.id), ['spreadsheet', 'chart']);
  assert.equal(choices[0]!.primary, true);
  assert.equal(dropChooserMessage({ ...NO_SNIFF, data: true }, 'sales.csv', oneFile(() => true)), '“sales.csv” is a table of data.');
});

test('a data file in a build without Chart still opens in the on-device spreadsheet', () => {
  const choices = dropChooserChoices({ ...NO_SNIFF, data: true }, oneFile(() => false));
  assert.deepEqual(choices.map((c) => c.id), ['spreadsheet']);
  assert.equal(choices[0]!.primary, true);
});

test('a multi-file drop keeps the batch routes only - the chart route is a single-file journey', () => {
  const choices = dropChooserChoices({ ...NO_SNIFF, data: true }, { single: false, count: 2, allIngestable: false, has: () => true });
  assert.ok(!choices.some((c) => c.id === 'spreadsheet'));
  assert.ok(!choices.some((c) => c.id === 'chart'));
});

// ── a renovation inside a .lolly (plan 274 sections 2.1 and 3.5) ──────────────

/** The manifest a renovation file declares. `tool.id` is the renovation's own when no
 *  document travelled with it, because there is no document for a tool to own. */
const renovationManifest = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  format: 'lolly-share',
  kind: 'session',
  counts: { assets: 3, byReference: 1, bytes: 4096 },
  tool: { id: LOLLY_RENOVATION_TOOL_ID },
  renovation: {
    id: 'ren-1',
    name: 'Why SUSE Summary',
    project: 'renovation/project.json',
    parts: { sourceDeck: 'renovation/sourceDeck.json', plan: 'renovation/plan.json' },
    assets: ['user/a', 'user/b', 'user/c'],
  },
  ...over,
});

const renovationPreview = (over: Record<string, unknown> = {}) =>
  classifyLollyManifest(renovationManifest(over), 'why-suse.lolly', 240_000);

const doorIds = (choices: ReturnType<typeof lollyIntakeChoices>): string[] => choices.map(c => c.id);

test('a renovation on its own leads with the Rebrand door and offers no session door', () => {
  const preview = renovationPreview();
  assert.equal(preview.kind, 'session');
  if (preview.format !== 'lolly-share') return;
  assert.equal(preview.renovation?.name, 'Why SUSE Summary');
  assert.deepEqual(preview.renovation?.parts, ['sourceDeck', 'plan']);
  assert.equal(preview.renovation?.media, 3);
  assert.equal(preview.renovation?.withDocument, false, 'the renovation tool id means no document travelled');

  const doors = lollyIntakeChoices(preview);
  assert.deepEqual(doorIds(doors), ['open-renovation']);
  assert.equal(doors[0]!.primary, true);
});

test('a renovation carrying a design system still offers to add it', () => {
  const preview = renovationPreview({ designSystem: { label: 'Acme' } });
  assert.deepEqual(doorIds(lollyIntakeChoices(preview)), ['open-renovation', 'use-design-system']);
  assert.equal(lollyIntakeChoices(preview, { preferred: 'design-system' })[1]!.primary, false,
    'the renovation is still what the file is, whatever the surface preferred');
});

test('a file with a renovation and a document offers both doors, the renovation first', () => {
  const preview = renovationPreview({ tool: { id: 'chart' } });
  if (preview.format !== 'lolly-share') return;
  assert.equal(preview.renovation?.withDocument, true);
  const doors = lollyIntakeChoices(preview);
  assert.deepEqual(doorIds(doors), ['open-renovation', 'open-session']);
  assert.equal(doors[0]!.primary, true);
  assert.equal(doors[1]!.primary, false);
});

test('a .lolly with no renovation keeps exactly the doors it always had', () => {
  const session = classifyLollyManifest(
    { format: 'lolly-share', kind: 'session', tool: { id: 'poster' }, designSystem: { label: 'Acme' } },
    'shared.lolly', 2048,
  );
  assert.deepEqual(doorIds(lollyIntakeChoices(session)), ['open-session', 'use-design-system']);
  assert.equal(lollyIntakeChoices(session, { preferred: 'design-system' })[1]!.primary, true);
  const project = classifyLollyManifest(
    { format: 'lolly-share', kind: 'project', project: { name: 'Pitch', sessions: [{}], folders: [{}] } },
    'pitch.lolly', 2048,
  );
  assert.deepEqual(doorIds(lollyIntakeChoices(project)), ['open-project']);
  const brand = classifyLollyManifest({ format: 'lolly-brand', label: 'Acme' }, 'acme.lolly', 2048);
  assert.deepEqual(doorIds(lollyIntakeChoices(brand)), ['use-brand']);
});

test('a project file that also carries a renovation offers both', () => {
  const preview = classifyLollyManifest(
    renovationManifest({ kind: 'project', project: { name: 'Pitch', sessions: [{}, {}], folders: [] }, tool: { id: 'chart' } }),
    'pitch.lolly', 4096,
  );
  assert.deepEqual(doorIds(lollyIntakeChoices(preview)), ['open-renovation', 'open-project']);
});

test('a renovation file is described by its project, its source and where the work picks up', () => {
  const preview = renovationPreview();
  if (preview.format !== 'lolly-share' || !preview.renovation) throw new Error('no renovation on the preview');
  const renovation = preview.renovation;
  // Before the file is inflated, only the manifest is in hand.
  assert.equal(
    describeRenovation(renovation),
    'A Rebrand project: 2 stages of work, 3 pictures.',
  );
  // With the project record read, it says what it is a renovation OF, and where it picks
  // up. A checkpoint carrying a time is a stage that FINISHED, so the stage named is the
  // one after it - the same reading `resumePoint` applies in rebrand/lifecycle.ts.
  assert.equal(
    describeRenovation(renovation, {
      name: 'Why SUSE Summary',
      source: { name: 'Why SUSE Summary.pptx' },
      checkpoint: { stage: 'plan', at: '2026-09-23T10:00:00.000Z' },
    }),
    'A Rebrand project for Why SUSE Summary.pptx, ready to review.',
    'never as an empty saved session, and never back at work the file says is done',
  );
  // A checkpoint with no time committed nothing, so its own stage is the one to run.
  assert.equal(
    describeRenovation(renovation, { source: { name: 'deck.pptx' }, checkpoint: { stage: 'plan' } }),
    'A Rebrand project for deck.pptx, being prepared.',
  );
  // A stage this build does not know is left out rather than guessed at.
  assert.equal(
    describeRenovation(renovation, { source: { name: 'deck.pptx' }, checkpoint: { stage: 'polish' } }),
    'A Rebrand project for deck.pptx.',
  );
  // Past the last stage there is nothing to pick up, and saying otherwise would send a
  // person back into a renovation that is finished.
  assert.equal(
    describeRenovation(renovation, { source: { name: 'deck.pptx' }, checkpoint: { stage: 'compile', at: '2026-09-23T12:00:00.000Z' } }),
    'A Rebrand project for deck.pptx, opened in Design.',
  );
  assert.equal(
    describeRenovation(renovation, { checkpoint: { stage: 'done', at: '2026-09-23T12:00:00.000Z' } }),
    'A Rebrand project, opened in Design.',
  );
});

test('the stage order the preview spells out is the store\u2019s own', () => {
  const preview = renovationPreview();
  if (preview.format !== 'lolly-share' || !preview.renovation) throw new Error('no renovation on the preview');
  const renovation = preview.renovation;
  // The preview spells the stage list again rather than importing the renovation
  // modules into the cold path, so a describe of stage N has to name stage N+1.
  for (let i = 0; i < PROJECT_STAGES.length - 2; i += 1) {
    const said = describeRenovation(renovation, {
      source: { name: 'deck.pptx' },
      checkpoint: { stage: PROJECT_STAGES[i], at: '2026-09-23T10:00:00.000Z' },
    });
    const next = describeRenovation(renovation, {
      source: { name: 'deck.pptx' },
      checkpoint: { stage: PROJECT_STAGES[i + 1] },
    });
    assert.equal(said, next, `a finished ${PROJECT_STAGES[i]} reads as a pending ${PROJECT_STAGES[i + 1]}`);
  }
});
