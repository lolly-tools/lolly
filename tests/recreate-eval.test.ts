// SPDX-License-Identifier: MPL-2.0
/**
 * The recreation eval (plan 291 W10): its deck, its design system, its eval file and
 * its scorer.
 *
 * recreate.pptx is built by scripts/build-rebrand-fixtures.ts (tests/rebrand-fixtures
 * .test.ts rebuilds it byte for byte); here its reading is pinned: eight slides, and
 * the notes the labels state, line for line. The scorer is run over synthetic
 * delivered folders made in a temporary directory from the deck's own inventory: a
 * good one passes every gate, and one with a speaker note dropped, one with a theme
 * missing and one with a broken edits.json each fail their own gate.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/recreate-eval.test.ts
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync } from 'fflate';

import { buildPptxParts, EMU_PER_PX, type PptxSlide } from '../engine/src/pptx.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { CHECK_CODE_PATTERN } from '../packages/core/src/check-v1.ts';
import type { ContentInventoryV1 } from '../packages/core/src/content-inventory-v1.ts';
import { composeDesign } from '../packages/node-shell/src/design-compose.ts';
import { checkFile, parseFidelityEdits } from '../packages/node-shell/src/check.ts';
import { inventoryAsBoxes } from '../packages/node-shell/src/check.ts';
import { readContentInventory } from '../packages/node-shell/src/content-inventory.ts';
import { packageDesign } from '../packages/node-shell/src/design-lolly.ts';
import { RECREATE_COVER_NOTES, RECREATE_EYEBROW_NOTES, type RecreateFixtureLabelsV1 } from '../scripts/build-rebrand-fixtures.ts';
import {
  isDesignSystemDocument,
  loadRecreateCase,
  notesLinesSplitOf,
  pptxStructureOf,
  RECREATE_EVAL_FILE,
  RECREATE_EXIT_UNFINISHED,
  RECREATE_BASE_PASS_KEYS as RECREATE_PASS_KEYS,
  RECREATE_ACCEPTANCE_KEYS,
  RECREATE_REPORT_KEYS,
  RecreateUsageError,
  scoreRecreation,
  themeGroundsOf,
  webShellHasOpenRoute,
  type RecreateEvalFileV1,
  type RecreateScoreV1,
} from '../scripts/recreate-eval.ts';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LOLLY = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');
const SCORER = join(REPO, 'scripts', 'recreate-eval.ts');
const DECK = join(REPO, 'tests', 'fixtures', 'rebrand', 'recreate.pptx');
const LABELS = join(REPO, 'tests', 'fixtures', 'rebrand', 'recreate.labels.json');
const TOKENS = join(REPO, 'tests', 'fixtures', 'recreate', 'tokens.json');
const BRIEF_TOKENS = join(REPO, 'tests', 'fixtures', 'design-brief', 'tokens.json');
const EXPORTED_AT = '2026-10-03T00:00:00.000Z';

const run = (file: string, args: string[]) => spawnSync(process.execPath, [file, ...args], {
  cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, LOLLY_PROFILE: 'lolly-start', NO_COLOR: '1' },
});

// ─── the eval file and the design system ─────────────────────────────────────

test('recreate.json is a brief in motion.json\'s shape, and every gate it names is one the scorer computes', () => {
  const evalFile = JSON.parse(readFileSync(RECREATE_EVAL_FILE, 'utf8')) as RecreateEvalFileV1;
  assert.equal(evalFile.version, 1);
  assert.match(evalFile.purpose, /not records of completed agent runs/);
  assert.ok(evalFile.rubric.measured.length && evalFile.rubric.reviewed.length && evalFile.rubric.report);
  for (const c of evalFile.cases) {
    assert.ok(c.prompt && c.checks.length, `${c.id}: a prompt and checks`);
    for (const key of Object.keys(c.pass)) assert.ok((RECREATE_PASS_KEYS as readonly string[]).includes(key), `${c.id}: pass.${key} is a gate the scorer knows`);
    for (const key of c.report ?? []) assert.ok((RECREATE_REPORT_KEYS as readonly string[]).includes(key), `${c.id}: report ${key} is a measure the scorer reports`);
    assert.deepEqual([...c.themes].sort(), ['dark', 'light']);
    assert.deepEqual(c.deliver.formats, ['lolly', 'pptx']);
  }
  const { evalCase, source, designSystem, gates } = loadRecreateCase();
  assert.equal(evalCase.id, 'recreate-synthetic');
  assert.deepEqual(gates, [...RECREATE_PASS_KEYS], 'the synthetic case scores every gate');
  assert.equal(source, DECK);
  assert.deepEqual(designSystem, { file: TOKENS });
  assert.equal(evalCase.env?.LOLLY_PROFILE, 'lolly-start');
  // The skill folder is mirrored and published as text, so it holds no binary.
  for (const name of readdirSync(dirname(RECREATE_EVAL_FILE))) assert.match(name, /\.json$/, `${name} under skills/lolly/evals`);
});

test('the eval design system is the brief fixture set in the repo\'s own faces, its house rules still drafts', () => {
  const tokens = JSON.parse(readFileSync(TOKENS, 'utf8'));
  const brief = JSON.parse(readFileSync(BRIEF_TOKENS, 'utf8'));
  assert.equal(tokens.base.font.brand.$value, 'SUSE');
  assert.equal(tokens.base.font.mono.$value, 'SUSE Mono');
  for (const face of ['SUSE[wght].ttf', 'SUSEMono[wght].ttf']) assert.ok(existsSync(join(REPO, 'shells', 'web', 'public', 'fonts', face)), face);
  assert.deepEqual(tokens.$themes, brief.$themes);
  assert.deepEqual(tokens.light, brief.light);
  assert.deepEqual(tokens.dark, brief.dark);
  const rules = tokens.$extensions['com.suse.lolly'].brandSystem.rules as Array<{ id: string; kind: string; review: { state: string } }>;
  assert.deepEqual(rules.map((r) => r.kind).sort(), ['color-pairing', 'dash-reserved', 'stroke-on-rounded', 'text-align', 'text-case', 'text-weight', 'text-weight']);
  assert.ok(rules.every((r) => r.review.state === 'draft'), 'draft rules report and never gate');
  // A --file design system's catalog never resolves (readBriefCatalogFor), so an asset id it
  // declared would name a logo nothing can draw, package or check. It declares none.
  const roles = tokens.$extensions['com.suse.lolly'].brandSystem.roles as Array<{ resources: Array<{ type: string }> }>;
  assert.ok(roles.every((r) => r.resources.every((res) => res.type !== 'asset')), 'no role lists an asset');
  assert.equal(tokens.base.asset, undefined, 'no asset tokens');
  assert.doesNotMatch(readFileSync(TOKENS, 'utf8'), /\/logo\//, 'no logo id anywhere');
  assert.ok(tokens.base.color.ramp.neutral['8'].$value, 'the neutral master card fill resolves');
});

// ─── the deck ────────────────────────────────────────────────────────────────

test('recreate.pptx reads as eight slides whose notes keep their line breaks, as its labels state', async () => {
  const { inventory } = await readContentInventory({ bytes: new Uint8Array(readFileSync(DECK)), name: 'recreate.pptx' });
  const labels = JSON.parse(readFileSync(LABELS, 'utf8')) as RecreateFixtureLabelsV1;
  assert.equal(inventory.slides.length, 8);
  assert.equal(labels.slides.length, 8);
  assert.deepEqual(inventory.slides[0]!.notes!.paragraphs.map((p) => p.lines), RECREATE_COVER_NOTES);
  assert.deepEqual(inventory.slides[2]!.notes!.paragraphs.map((p) => p.lines), RECREATE_EYEBROW_NOTES);
  for (const [i, slide] of labels.slides.entries()) {
    if (slide.notes) assert.deepEqual(inventory.slides[i]!.notes!.paragraphs.map((p) => p.lines), slide.notes, `slide ${i + 1} notes`);
  }
  assert.deepEqual(inventory.slides[7]!.notes!.paragraphs.map((p) => p.lines), [['Thank the crews by name.'], ['Point to the shared tide table.']]);
  // The cover photo is cropped in the source, and both photos are distinct pictures over the whole slide.
  const cover = inventory.slides[0]!.pictures[0]!;
  const quay = inventory.slides[5]!.pictures[0]!;
  assert.ok(cover.crop, 'the cover photo carries its crop');
  // Both are camera-sized JPEGs: a full-bleed 1920 px slide never scales them past 2x their pixels.
  assert.deepEqual([cover.width, cover.height, quay.width, quay.height], [1600, 1200, 1920, 1080]);
  assert.deepEqual([cover.mime, quay.mime], ['image/jpeg', 'image/jpeg']);
  assert.notEqual(cover.sha256, quay.sha256);
  // The traps read the way the labels say: an eyebrow and the card numbers as labels, a centred statement.
  assert.equal(inventory.slides[2]!.text[0]!.role, 'label');
  assert.deepEqual(inventory.slides[1]!.text.filter((t) => t.role === 'label').map((t) => t.plain), ['01', '02', '03']);
  assert.equal(inventory.slides[4]!.text[0]!.paragraphs[0]!.align, 'center');
});

test('the labels name a neutral master archetype per slide and only well-formed check codes', () => {
  const labels = JSON.parse(readFileSync(LABELS, 'utf8')) as RecreateFixtureLabelsV1;
  const archetypes = new Set(neutralSlideMaster().archetypes.map((a) => a.id));
  const code = new RegExp(CHECK_CODE_PATTERN);
  for (const slide of labels.slides) {
    for (const id of [slide.archetype, ...slide.alternatives]) assert.ok(archetypes.has(id), `${slide.id}: ${id} is a neutral master archetype`);
    const authored = new Set(slide.objects.map((o) => o.authored));
    for (const trap of slide.traps) {
      for (const c of trap.naive) assert.match(c, code, `${slide.id} ${trap.id}: ${c}`);
      for (const name of trap.objects) assert.ok(authored.has(name), `${slide.id} ${trap.id}: ${name} is a labelled object`);
      assert.ok(trap.note);
    }
  }
  const naive = new Set(labels.slides.flatMap((s) => s.traps.flatMap((t) => t.naive)));
  for (const c of ['verify.fingernail-card', 'verify.decorative-numbering', 'verify.eyebrow-heading', 'brand.rule.stroke-on-rounded', 'brand.rule.text-align']) assert.ok(naive.has(c), c);
});

test('lolly read prints the cover notes with their line breaks', () => {
  const out = run(LOLLY, ['read', DECK, '--json']);
  assert.equal(out.status, 0, out.stderr);
  const envelope = JSON.parse(out.stdout) as { result: ContentInventoryV1 };
  assert.deepEqual(envelope.result.slides[0]!.notes!.paragraphs[0]!.lines, RECREATE_COVER_NOTES[0]);
  assert.ok(envelope.result.slides[0]!.notes!.text.startsWith('OPENING\nWelcome the room'), 'nothing is merged across a line break');
});

// ─── the scorer ──────────────────────────────────────────────────────────────

let inventory: ContentInventoryV1;
let work: string;

/** The deck's own inventory as Design rows, grounded and inked for one theme. */
function themedRows(theme: 'light' | 'dark'): Record<string, unknown>[] {
  const [bg, fg] = theme === 'light' ? ['#ffffff', '#13294b'] : ['#13294b', '#ffffff'];
  return inventoryAsBoxes(inventory).map((row) => {
    const { readingIndex: _drop, ...rest } = row as Record<string, unknown>;
    return rest.kind === 'frame' ? { ...rest, bg } : { ...rest, fg, fontSize: 24, weight: '400', align: 'left', valign: 'top', pad: 0 };
  });
}

/**
 * A PPTX of those rows: one slide per frame, one text box per row, the frame's notes.
 * With `tierA`, two slide layouts alternate and each slide's first text is bound to
 * the title placeholder, the way a composed deck exports.
 */
function pptxOf(rows: Record<string, unknown>[], opts: { tierA?: boolean } = {}): Uint8Array {
  const px = (v: unknown): number => Math.round(Number(v) * EMU_PER_PX);
  const frames = rows.filter((r) => r.kind === 'frame');
  const slides: PptxSlide[] = frames.map((frame, i) => ({
    shapes: rows.filter((r) => r.frame === frame.id).map((r, k) => ({
      kind: 'text' as const, x: px(Number(r.x) - Number(frame.x)), y: px(r.y), cx: px(r.w), cy: px(r.h),
      paras: String(r.text).split('\n').map((line) => ({ runs: [{ text: line, sizePt: 18 }] })),
      ...(opts.tierA && k === 0 ? { ph: { type: 'title' as const } } : {}),
    })),
    media: [],
    ...(opts.tierA ? { layout: i % 2 } : {}),
    ...(typeof frame.notes === 'string' ? { notes: frame.notes } : {}),
  }));
  const title = { type: 'title' as const, x: px(64), y: px(48), cx: px(1152), cy: px(120) };
  const layouts = opts.tierA ? [{ name: 'Title and content', placeholders: [title] }, { name: 'Statement', placeholders: [title] }] : undefined;
  const parts = buildPptxParts(slides, { emuW: px(1280), emuH: px(720), now: '2026-01-01T00:00:00Z', ...(layouts ? { layouts } : {}) });
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const name of Object.keys(parts).sort()) {
    const value = parts[name]!;
    files[name] = typeof value === 'string' ? enc.encode(value) : value;
  }
  return zipSync(files, { level: 0, mtime: '2026-01-01T00:00:00' });
}

/** Deliver both themes as .lolly and .pptx into a fresh folder; `edit` changes the rows of one theme first. */
async function deliver(name: string, edit?: (theme: 'light' | 'dark', rows: Record<string, unknown>[]) => Record<string, unknown>[]): Promise<string> {
  const dir = join(work, name);
  rmSync(dir, { recursive: true, force: true });
  const { mkdirSync } = await import('node:fs');
  mkdirSync(dir, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    const rows = edit ? edit(theme, themedRows(theme)) : themedRows(theme);
    const label = `Harbour lights ${theme}`;
    const { bytes } = await packageDesign({ boxes: rows }, { label, exportedAt: EXPORTED_AT });
    writeFileSync(join(dir, `harbour-${theme}.lolly`), bytes);
    writeFileSync(join(dir, `harbour-${theme}.pptx`), pptxOf(rows));
  }
  return dir;
}

const gate = (score: RecreateScoreV1, id: string) => score.gates.find((g) => g.id === id)!;
const score = (dir: string) => scoreRecreation({ dir, source: DECK, designSystem: { file: TOKENS }, browser: 'off', caseId: 'recreate-synthetic' });

before(async () => {
  work = mkdtempSync(join(tmpdir(), 'lolly-recreate-eval-'));
  ({ inventory } = await readContentInventory({ bytes: new Uint8Array(readFileSync(DECK)), name: 'recreate.pptx' }));
});
after(() => { rmSync(work, { recursive: true, force: true }); });

test('a folder that carries every string and note in both themes and formats passes every gate', { timeout: 180_000 }, async () => {
  const dir = await deliver('good');
  const result = await score(dir);
  assert.equal(result.pass, true, result.summary);
  assert.deepEqual(result.gates.map((g) => [g.id, g.pass]), RECREATE_PASS_KEYS.map((id) => [id, true]));
  assert.equal(result.files.length, 4);
  assert.deepEqual(result.files.map((f) => [f.name, f.theme, f.format]), [
    ['harbour-dark.lolly', 'dark', 'lolly'], ['harbour-dark.pptx', 'dark', 'pptx'],
    ['harbour-light.lolly', 'light', 'lolly'], ['harbour-light.pptx', 'light', 'pptx'],
  ]);
  for (const f of result.files) {
    assert.deepEqual(f.slides, { source: 8, result: 8 }, f.name);
    if (f.format === 'lolly') {
      assert.deepEqual(f.notesLines, { slides: 6, kept: 6, merged: [], split: [] }, `${f.name} keeps every notes line apart`);
      assert.equal(f.pptx, undefined, `${f.name} has no PPTX structure`);
    } else {
      // The notes writer keeps a single newline as an a:br inside its paragraph (plan 291
      // M4), so the a:br of slides 1 and 3 come back as line breaks, not paragraphs.
      assert.deepEqual(f.notesLines, { slides: 6, kept: 6, merged: [], split: [] }, `${f.name} keeps the a:br lines inside their paragraphs`);
      assert.deepEqual(f.pptx, { tier: 'B', layouts: 1, placeholders: [0, 0, 0, 0, 0, 0, 0, 0] }, `${f.name} is one blank layout`);
    }
  }
  assert.equal(result.reported.notesLinesSplit, 0, 'no note of either .pptx file splits its line breaks');
  assert.deepEqual(result.reported.pptxTier, { 'harbour-dark.pptx': 'B', 'harbour-light.pptx': 'B' });
  const lolly = result.files.find((f) => f.name === 'harbour-light.lolly')!;
  assert.equal(lolly.readback?.ok, true);
  assert.equal(lolly.readback?.label, 'Harbour lights light');
  assert.deepEqual(lolly.reopen, { state: 'not run', reason: 'the browser tier was turned off for this run' });
  assert.deepEqual(lolly.themeGrounds, { frames: 8, mismatched: [], exempt: [] });
  assert.deepEqual(result.designSystem, { origin: 'file', file: 'tests/fixtures/recreate/tokens.json' });
  assert.deepEqual(result.source, { name: 'recreate.pptx', sha256: inventory.source.sha256, slides: 8, notes: 6 });
  assert.ok(result.sourceBaseline, 'the source is checked against itself as the zero point');
  assert.match(result.summary, /^All 7 gates pass for 4 delivered files against recreate\.pptx \(8 slides\)\./);
  assert.match(result.summary, /0 notes whose line breaks came back as paragraphs/);
  assert.match(result.summary, /harbour-dark\.pptx and harbour-light\.pptx are Tier B/);
  // Every name a case may list under `report` is a field the score writes there, and the other way round.
  assert.deepEqual(Object.keys(result.reported).sort(), [...RECREATE_REPORT_KEYS].sort());
  assert.equal(result.reported.sourceVerifyFindings, Object.values(result.sourceBaseline!.verify).reduce((n, v) => n + v, 0));
});

// ─── reported measures, one by one ───────────────────────────────────────────

test('the PPTX measure tells a deck of layouts and placeholders (Tier A) from one blank layout (Tier B)', () => {
  const rows = themedRows('light');
  assert.deepEqual(pptxStructureOf(pptxOf(rows)), { tier: 'B', layouts: 1, placeholders: [0, 0, 0, 0, 0, 0, 0, 0] });
  assert.deepEqual(pptxStructureOf(pptxOf(rows, { tierA: true })), { tier: 'A', layouts: 2, placeholders: [1, 1, 1, 1, 1, 1, 1, 1] });
  // The source deck reads in presentation order whatever its tier.
  const own = pptxStructureOf(new Uint8Array(readFileSync(DECK)));
  assert.equal(own?.placeholders.length, 8);
  assert.equal(pptxStructureOf(new Uint8Array([1, 2, 3])), null, 'bytes that are not a package have no structure');
});

test('a line break inside a note paragraph that comes back as a paragraph is reported as split', async () => {
  // The source against itself keeps every a:br inside its paragraph.
  assert.deepEqual(notesLinesSplitOf(inventory, inventory), []);
  // The same words with every line a paragraph (a blank line between each, which the
  // notes writer reads as a paragraph break): slides 1 and 3 carry a:br in the source.
  const lineByLine = themedRows('light').map((row) => (row.kind === 'frame' && typeof row.notes === 'string' ? { ...row, notes: row.notes.split('\n').filter((l) => l.trim()).join('\n\n') } : row));
  const { inventory: flat } = await readContentInventory({ bytes: pptxOf(lineByLine), name: 'flat.pptx' });
  assert.deepEqual(notesLinesSplitOf(inventory, flat), [1, 3]);
  // A merged note is a different measure: lines run together are never called split.
  const merged = structuredClone(flat);
  merged.slides[0]!.notes = { text: 'one', paragraphs: [{ lines: [inventory.slides[0]!.notes!.paragraphs.flatMap((p) => p.lines).join(' ')] }] };
  assert.deepEqual(notesLinesSplitOf(inventory, merged), [3]);
});

test('notes are compared paragraph for paragraph: a blank line lost inside a paragraph is split, lines run together merged', async () => {
  const { notesLinesOf, notesParagraphsOfText } = await import('../scripts/recreate-eval.ts');
  // The cover's first paragraph holds an empty line between OPENING and TIMING (a:br a:br).
  const cover = inventory.slides[0]!.notes!.paragraphs;
  assert.ok(cover[0]!.lines.includes(''), 'the fixture\'s cover notes have an empty line inside a paragraph');
  const only = (paras: Array<{ lines: string[] }> | null) => inventory.slides.map((_, i) => (i === 0 ? paras : inventory.slides[i]!.notes?.paragraphs ?? null));
  const kept = notesLinesOf(inventory, only(cover.map((p) => ({ lines: [...p.lines] }))));
  assert.deepEqual([kept.kept, kept.merged, kept.split], [6, [], []]);
  // Written with the no-break space for the empty line, a .lolly note reads back exactly.
  const authored = cover.map((p) => p.lines.map((l, k) => (l === '' && k > 0 ? '\u00a0' : l)).join('\n')).join('\n\n');
  assert.deepEqual(notesParagraphsOfText(authored), cover.map((p) => ({ lines: [...p.lines] })));
  // Written with a plain blank line, the empty line becomes a paragraph break: split.
  const lost = notesParagraphsOfText(cover.map((p) => p.lines.join('\n')).join('\n\n'));
  assert.ok(lost.length > cover.length);
  assert.deepEqual(notesLinesOf(inventory, only(lost)).split, [1]);
  // Dropping the empty line (as a PPTX writer that knew no marker did) is split too.
  assert.deepEqual(notesLinesOf(inventory, only(cover.map((p) => ({ lines: p.lines.filter(Boolean) })))).split, [1]);
  // Lines run together are merged, never split.
  const runTogether = notesLinesOf(inventory, only([{ lines: [cover.flatMap((p) => p.lines).filter(Boolean).join(' ')] }]));
  assert.deepEqual([runTogether.merged, runTogether.split], [[1], []]);
});

test('the ground measure exempts archetypes with no variant for the theme and frames under a photo', () => {
  const neutral = neutralSlideMaster();
  const masterFor = (id: string) => (id === neutral.id ? neutral : null);
  const frame = (id: string, x: number, archetype: string | null, bg: string, master = neutral.id): Record<string, unknown> => ({
    id, kind: 'frame', x, y: 0, w: 1920, h: 1080, bg, ...(archetype ? { master, archetype } : {}),
  });
  const photo = (id: string, frameId: string, x: number, w: number, h: number): Record<string, unknown> => ({ id, kind: 'image', frame: frameId, x, y: 0, w, h, image: 'photo:cover', fit: 'cover' });
  const light = themeGroundsOf([
    frame('title', 0, 'title', '#13294b'),            // dark by design, no light variant: exempt
    frame('content', 2080, 'content', '#13294b'),     // has a light form, painted dark: counted
    frame('twin', 4160, 'content-dark', '#13294b'),   // the twin of a light archetype: counted
    frame('cover', 6240, 'content', '#13294b'), photo('cover.photo', 'cover', 6240, 1920, 1000), // 93% under a photo: exempt
    frame('half', 8320, 'content', '#13294b'), photo('half.photo', 'half', 8320, 960, 1080),     // 50%: counted
    frame('logo', 10400, 'content', '#13294b'), { id: 'logo.mark', kind: 'image', frame: 'logo', x: 10400, y: 0, w: 1920, h: 1080, furniture: 'logo', image: 'x' }, // furniture is not a photo
    frame('other', 12480, 'title', '#13294b', 'acme/slides/brand'), // a master not here: counted
    frame('plain', 14560, null, '#13294b'),           // no archetype: counted
    frame('fine', 16640, 'content', '#ffffff'),
  ], 'light', masterFor);
  assert.equal(light.frames, 9);
  assert.deepEqual(light.mismatched, ['content', 'twin', 'half', 'logo', 'other', 'plain']);
  assert.deepEqual(light.exempt, [{ frame: 'title', why: 'archetype' }, { frame: 'cover', why: 'photo' }]);

  const dark = themeGroundsOf([
    frame('main', 0, 'main-point', '#f4f6f8'),        // light, no dark twin: exempt
    frame('content', 2080, 'content', '#ffffff'),     // has content-dark: counted
    frame('flow', 4160, 'flow-cards-3-1', '#ffffff'), // a flow layout resolves through the layout components
    frame('closing', 6240, 'closing-thanks', '#13294b'),
  ], 'dark', masterFor);
  assert.deepEqual(dark.exempt.map((e) => e.frame).filter((id) => id !== 'flow'), ['main']);
  assert.ok(dark.mismatched.includes('content'));
  assert.equal(dark.mismatched.length + dark.exempt.length, 3, 'the flow frame is either counted or exempt, never lost');

  // An opaque under row covering the frame as its first layer is the ground recreate.md
  // asks for (plan 291 M4): a dark frame bg under a white surface row reads light.
  const box = (id: string, frameId: string, x: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({ id, kind: 'box', frame: frameId, x, y: 0, w: 1920, h: 1080, bg: '#ffffff', ...over });
  const grounded = themeGroundsOf([
    frame('ground', 0, 'content', '#13294b'), box('ground.under-1', 'ground', 0),                          // white surface row: fine
    frame('veil', 2080, 'content', '#13294b'), box('veil.under-1', 'veil', 2080, { opacity: 50 }),         // translucent: the frame counts
    frame('strip', 4160, 'content', '#13294b'), box('strip.under-1', 'strip', 4160, { w: 960 }),           // half the frame: the frame counts
    frame('scrim', 6240, 'content', '#13294b'), box('scrim.under-1', 'scrim', 6240, { grad: 'lin_0_ffffff-0_ffffff00-100' }), // a gradient: the frame counts
  ], 'light', masterFor);
  assert.deepEqual(grounded.mismatched, ['veil', 'strip', 'scrim']);
  // In a dark file the same white row is a light ground on a dark-themed frame.
  assert.deepEqual(themeGroundsOf([frame('ground', 0, 'content', '#13294b'), box('ground.under-1', 'ground', 0)], 'dark', masterFor).mismatched, ['ground']);
});

test('a folder that drops one speaker note fails the notes gate, and the scorer exits 1', { timeout: 180_000 }, async () => {
  const dir = await deliver('missing-note', (theme, rows) => (theme === 'dark'
    ? rows.map((row) => (row.id === 'page-3' ? { ...row, notes: undefined } : row))
    : rows));
  const result = await score(dir);
  assert.equal(result.pass, false);
  assert.equal(gate(result, 'missingNotes').pass, false);
  assert.match(gate(result, 'missingNotes').detail, /^2 slide notes missing/, 'the .lolly and the .pptx of the dark theme');
  for (const id of ['checkErrors', 'missingStrings', 'slides', 'themes', 'reopens', 'edits']) assert.equal(gate(result, id).pass, true, id);
  assert.match(result.summary, /^1 of 7 gates fail .*missingNotes/);

  const cli = run(SCORER, [dir, '--browser=off', '--json']);
  assert.equal(cli.status, 1, cli.stderr);
  const record = JSON.parse(cli.stdout) as RecreateScoreV1 & { run: { engine?: string } };
  assert.equal(record.pass, false);
  assert.equal(record.case, 'recreate-synthetic');
  assert.ok(record.run.engine, 'the record names the engine version');
});

test('a theme not delivered, a string dropped without a reason and a broken edits.json each fail their gate', { timeout: 180_000 }, async () => {
  const dropped = 'Questions to the harbour desk, any tide.';
  const dir = await deliver('partial', (_theme, rows) => rows.filter((row) => row.text !== dropped));
  rmSync(join(dir, 'harbour-dark.pptx'));
  writeFileSync(join(dir, 'edits.json'), '{"edits": [{"source": "Thank you"}]}');
  writeFileSync(join(dir, 'build_deck.py'), '# left behind\n');
  const result = await score(dir);
  assert.equal(gate(result, 'themes').pass, false);
  assert.match(gate(result, 'themes').detail, /dark \.pptx/);
  assert.equal(gate(result, 'missingStrings').pass, false);
  assert.ok(gate(result, 'missingStrings').detail.includes(dropped));
  assert.equal(gate(result, 'edits').pass, false);
  assert.deepEqual(result.reported.scaffolding, ['build_deck.py']);
  assert.deepEqual(result.reported.undelivered, ['dark .pptx']);

  // Declared with a reason, the same drop is an edit and no longer a miss.
  writeFileSync(join(dir, 'edits.json'), JSON.stringify([{ source: dropped, reason: 'the closing slide carries the contact line in the notes' }]));
  const declared = await score(dir);
  assert.equal(gate(declared, 'missingStrings').pass, true, gate(declared, 'missingStrings').detail);
  assert.equal(gate(declared, 'edits').pass, true);
  assert.equal(declared.edits.count, 1);
});

test('the scorer refuses an unknown flag and a missing folder with exit 2', () => {
  const unknown = run(SCORER, [work, '--srouce=x']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /--srouce=x is not an option/);
  const missing = run(SCORER, [join(work, 'not-there'), '--browser=off']);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /is not a directory/);
});

// ─── declared note edits, harness faults and hostile input ──────────────────

test('a speaker note changed on purpose and declared in edits.json passes the notes gate', { timeout: 180_000 }, async () => {
  const shortened = 'Shortened on purpose.';
  const dir = await deliver('declared-note', (_theme, rows) => rows.map((row) => (row.id === 'page-1' ? { ...row, notes: shortened } : row)));
  const undeclared = await score(dir);
  assert.equal(gate(undeclared, 'missingNotes').pass, false, 'a changed note nobody declared is missing');
  assert.match(gate(undeclared, 'missingNotes').detail, /^4 slide notes missing/);

  // The whole note, as `lolly read` prints it, with its replacement: every file now carries the declared change.
  const note = inventory.slides[0]!.notes!.paragraphs.map((p) => p.lines.join('\n')).join('\n\n');
  writeFileSync(join(dir, 'edits.json'), JSON.stringify([{ source: note, result: shortened, reason: 'The client asked for shorter notes on the cover.' }]));
  const declared = await score(dir);
  assert.equal(gate(declared, 'missingNotes').pass, true, gate(declared, 'missingNotes').detail);
  assert.equal(declared.pass, true, declared.summary);
  assert.equal(declared.reported.unmatchedEdits, 0, 'the edit was used by every file');
  for (const f of declared.files) assert.equal(f.missingNotes, 0, f.name);

  // Each lost paragraph declared on its own covers the note too.
  writeFileSync(join(dir, 'edits.json'), JSON.stringify(inventory.slides[0]!.notes!.paragraphs.map((p) => ({ source: p.lines.join(' '), reason: 'Cut for time.' }))));
  const perParagraph = await score(dir);
  assert.equal(gate(perParagraph, 'missingNotes').pass, true, gate(perParagraph, 'missingNotes').detail);
});

/** A copy of a zip whose central directory (and local header) says `name` expands to `size` bytes. */
function withDeclaredSize(zip: Uint8Array, name: string, size: number): Uint8Array {
  const out = Uint8Array.from(zip);
  const view = new DataView(out.buffer);
  const want = new TextEncoder().encode(name);
  for (let p = 0; p + 46 <= out.length; p += 1) {
    if (view.getUint32(p, true) !== 0x02014b50) continue;
    const nameLen = view.getUint16(p + 28, true);
    const got = out.subarray(p + 46, p + 46 + nameLen);
    if (got.length !== want.length || !got.every((b, i) => b === want[i])) continue;
    view.setUint32(p + 24, size, true);
    view.setUint32(view.getUint32(p + 42, true) + 22, size, true);
    return out;
  }
  throw new Error(`${name} is not in the zip`);
}

/** The light .pptx of the synthetic deck with one more media entry. */
function pptxWithMedia(name: string, bytes: Uint8Array<ArrayBuffer>): Uint8Array {
  const files = unzipSync(pptxOf(themedRows('light')));
  files[name] = bytes;
  return zipSync(files, { level: 6, mtime: '2026-01-01T00:00:00' });
}

test('the PPTX measure reads a package under the engine\'s zip budgets and never inflates its media', () => {
  const media = 'ppt/media/bomb.bin';
  const fine = pptxWithMedia(media, new Uint8Array(4096));
  assert.equal(pptxStructureOf(fine)?.placeholders.length, 8, 'media under budget does not stop the reading');
  // An entry that says it expands past the zip reader's budget is refused before anything is inflated.
  assert.equal(pptxStructureOf(withDeclaredSize(fine, media, 300 * 1024 * 1024)), null);
});

test('a delivered file whose check could not run fails the check gate and names the families', { timeout: 180_000 }, async () => {
  const dir = await deliver('unfinished');
  const media = 'ppt/media/bomb.bin';
  writeFileSync(join(dir, 'harbour-light.pptx'), withDeclaredSize(pptxWithMedia(media, new Uint8Array(4096)), media, 300 * 1024 * 1024));
  // A .lolly that is not a package at all: its reason is the read error, never "undefined".
  writeFileSync(join(dir, 'harbour-dark.lolly'), new Uint8Array(5000).map((_, i) => (i * 7919) % 251));
  const result = await score(dir);
  const checks = gate(result, 'checkErrors');
  assert.equal(checks.pass, false);
  assert.match(checks.detail, /harbour-light\.pptx: the (\w+ and )*\w+ checks? failed to run \(/, checks.detail);
  assert.match(checks.detail, /harbour-dark\.lolly: /);
  const pptx = result.files.find((f) => f.name === 'harbour-light.pptx')!;
  assert.equal(pptx.pptx, undefined, 'no structure is read from a package past the budgets');
  if (!pptx.error) assert.ok(pptx.failedFamilies && Object.keys(pptx.failedFamilies).length, 'the failed families are recorded');
  const reopens = gate(result, 'reopens');
  assert.equal(reopens.pass, false);
  assert.doesNotMatch(reopens.detail, /undefined/);
  assert.match(reopens.detail, /^harbour-dark\.lolly: \S/);
});

test('a case is held to the thresholds the scorer supports, and a case that leaves a gate out does not score it', async () => {
  const evalFile = JSON.parse(readFileSync(RECREATE_EVAL_FILE, 'utf8')) as RecreateEvalFileV1;
  const synthetic = evalFile.cases.find((c) => c.id === 'recreate-synthetic')!;
  const write = (name: string, change: (c: typeof synthetic) => void): string => {
    const c = structuredClone(synthetic);
    change(c);
    const file = join(work, name);
    // The case's paths resolve against the eval file, so the copy keeps them absolute.
    c.source = DECK;
    c.designSystem = { file: TOKENS };
    writeFileSync(file, JSON.stringify({ ...evalFile, cases: [c] }));
    return file;
  };
  const looser = write('looser.json', (c) => { c.pass.checkErrors = 2; });
  assert.throws(() => loadRecreateCase(looser), (err: Error) => err instanceof RecreateUsageError && /pass\.checkErrors is 2; the scorer gates on 0 only/.test(err.message));
  const themes = write('themes.json', (c) => { c.pass.themes = ['light']; });
  assert.throws(() => loadRecreateCase(themes), /pass\.themes/);
  const unknown = write('unknown.json', (c) => { (c.pass as Record<string, unknown>).beauty = 10; c.report = ['notesLines']; });
  assert.throws(() => loadRecreateCase(unknown), (err: Error) => /pass\.beauty is not a gate/.test(err.message) && /report "notesLines" is not a measure/.test(err.message));
  const cli = run(SCORER, [work, `--eval=${looser}`, '--browser=off']);
  assert.equal(cli.status, 2, cli.stderr);
  assert.match(cli.stderr, /pass\.checkErrors is 2/);

  const noReopen = write('no-reopen.json', (c) => { delete c.pass.reopens; });
  const { gates } = loadRecreateCase(noReopen);
  assert.deepEqual(gates, RECREATE_PASS_KEYS.filter((k) => k !== 'reopens'));
});

test('a folder whose .lolly does not reopen still passes a case that does not gate on reopening', { timeout: 180_000 }, async () => {
  const dir = await deliver('no-reopen-gate');
  writeFileSync(join(dir, 'harbour-dark.lolly'), new TextEncoder().encode('not a package'));
  const gates = RECREATE_PASS_KEYS.filter((k) => k !== 'reopens' && k !== 'checkErrors');
  const result = await scoreRecreation({ dir, source: DECK, designSystem: { file: TOKENS }, browser: 'off', gates });
  assert.deepEqual(result.gates.map((g) => g.id), gates);
  assert.match(result.summary, new RegExp(`^All ${gates.length} gates pass`), result.summary);
});

test('the scorer exits 2 for a source, design system or --out it cannot use, and keeps exit 1 for a failed gate', async () => {
  const dir = join(work, 'usage');
  mkdirSync(dir, { recursive: true });
  const notADeck = join(work, 'notadeck.pptx');
  writeFileSync(notADeck, '# Not a deck\n');
  const cases: Array<[string[], RegExp]> = [
    [[`--source=${notADeck}`], /cannot be read as a deck/],
    [[`--source=${work}`], /is not a file/],
    [[`--out=${join(work, 'no-such-folder', 'score.json')}`], /does not exist/],
    [[`--out=${work}`], /is a folder/],
  ];
  const arrayTokens = join(work, 'array-tokens.json');
  writeFileSync(arrayTokens, '[1, 2]');
  const emptyTokens = join(work, 'empty-tokens.json');
  writeFileSync(emptyTokens, '{}');
  cases.push([[`--file=${arrayTokens}`], /not a design token document/], [[`--file=${emptyTokens}`], /not a design token document/]);
  for (const [flags, message] of cases) {
    const out = run(SCORER, [dir, '--browser=off', ...flags]);
    assert.equal(out.status, 2, `${flags.join(' ')}: ${out.stderr}`);
    assert.match(out.stderr, message, flags.join(' '));
    assert.doesNotMatch(out.stderr, /\n\s+at /, `${flags.join(' ')}: no stack trace for a usage error`);
  }
  assert.notEqual(RECREATE_EXIT_UNFINISHED, 1, 'a fault in the scorer is never read as a failed gate');
  assert.equal(isDesignSystemDocument(JSON.parse(readFileSync(TOKENS, 'utf8'))), true);
  await assert.rejects(scoreRecreation({ dir, source: DECK, designSystem: { file: arrayTokens }, browser: 'off' }), RecreateUsageError);
});

test('a built web shell without the #/open route chunk is told apart, so the reopen reports not run', () => {
  const dist = join(work, 'dist');
  assert.equal(webShellHasOpenRoute(dist), null, 'no _app folder: unknown, the reopen is tried');
  mkdirSync(join(dist, '_app'), { recursive: true });
  writeFileSync(join(dist, '_app', 'open-_pJ3GLQf.js'), '');
  writeFileSync(join(dist, '_app', 'asset-open-handoff-B2sLdWT4.js'), '');
  assert.equal(webShellHasOpenRoute(dist), false, 'chunks with "open" in the name are not the route');
  writeFileSync(join(dist, '_app', 'open-route-Ab12_cd3.js'), '');
  assert.equal(webShellHasOpenRoute(dist), true);
});

test('one document made for every theme, listed with its themes in delivery.json, is scored in each (plan 291 M4)', { timeout: 180_000 }, async () => {
  const dir = join(work, 'one-document');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // Ground and ink as token references, so the one file paints each theme's colours.
  const rows = themedRows('light').map((row) => (row.kind === 'frame' ? { ...row, bg: '{color.semantic.surface}' } : { ...row, fg: '{color.semantic.text}' }));
  const { bytes } = await packageDesign({ boxes: rows }, { label: 'Harbour lights', exportedAt: EXPORTED_AT });
  writeFileSync(join(dir, 'harbour.lolly'), bytes);
  for (const theme of ['light', 'dark'] as const) writeFileSync(join(dir, `harbour-${theme}.pptx`), pptxOf(themedRows(theme)));

  // A file name with no theme word is in no theme.
  const unlisted = await score(dir);
  assert.equal(gate(unlisted, 'themes').pass, false);
  assert.deepEqual(unlisted.reported.unthemed, ['harbour.lolly']);

  writeFileSync(join(dir, 'delivery.json'), JSON.stringify({ files: { 'harbour.lolly': ['light', 'dark'] } }));
  const result = await score(dir);
  assert.equal(result.pass, true, result.summary);
  const lollies = result.files.filter((f) => f.format === 'lolly');
  assert.deepEqual(lollies.map((f) => [f.name, f.theme]), [['harbour.lolly', 'light'], ['harbour.lolly', 'dark']]);
  // Each theme's grounds are read with the links resolved in that theme.
  for (const f of lollies) assert.deepEqual(f.themeGrounds, { frames: 8, mismatched: [], exempt: [] }, f.theme ?? '');
});


test('acceptance refuses a document whose render and reopen did not run, separate theme documents and scaffolding', async () => {
  const dir = await deliver('acceptance-skipped');
  writeFileSync(join(dir, 'build.js'), '// scaffolding');
  const score = await scoreRecreation({ dir, source: DECK, designSystem: { file: TOKENS }, browser: 'off', gates: ['themes'], acceptance: true });
  assert.deepEqual(score.gates.map((g) => g.id), [...RECREATE_PASS_KEYS, ...RECREATE_ACCEPTANCE_KEYS]);
  assert.equal(score.pass, false);
  assert.equal(gate(score, 'rendered').pass, false);
  assert.match(gate(score, 'rendered').detail, /render skipped, reopen not run/);
  assert.match(gate(score, 'rendered').detail, /browser tier was turned off/);
  assert.equal(gate(score, 'oneDocument').pass, false);
  assert.equal(gate(score, 'noScaffolding').pass, false);
  assert.match(gate(score, 'noScaffolding').detail, /build.js/);
});


test('PowerPoint owner files are not scored as delivered decks', async () => {
  const dir = await deliver('owner-file');
  writeFileSync(join(dir, '~$harbour-light.pptx'), new Uint8Array([1, 2, 3]));
  const score = await scoreRecreation({ dir, source: DECK, designSystem: { file: TOKENS }, browser: 'off' });
  assert.equal(score.pass, true, score.summary);
  assert.equal(score.files.length, 4);
});


test('acceptance rejects clipped text even when the base fidelity gates pass', async () => {
  const dir = await deliver('acceptance-clipped', (_theme, rows) => rows.map((row) => row.kind === 'text' ? { ...row, w: 1, h: 1, fontSize: 100 } : row));
  const score = await scoreRecreation({ dir, source: DECK, designSystem: { file: TOKENS }, browser: 'off', acceptance: true });
  assert.equal(gate(score, 'clippedText').pass, false);
  assert.ok(score.reported.clippedText > 0);
});


test('the maintained recreation spec composes both themes without clipped text, Verify or house-rule findings', async () => {
  const spec = JSON.parse(readFileSync(join(REPO, 'tests/fixtures/recreate/acceptance.compose.json'), 'utf8'));
  const { document, edits } = await composeDesign(spec, { source: { bytes: new Uint8Array(readFileSync(DECK)), name: 'recreate.pptx' }, file: TOKENS });
  const fidelity = parseFidelityEdits(edits);
  assert.deepEqual(fidelity.problems, []);
  for (const theme of ['light', 'dark']) {
    const checked = await checkFile(new TextEncoder().encode(JSON.stringify(document)), 'design.json', {
      source: inventory, edits: fidelity.edits, theme, designSystem: { doc: JSON.parse(readFileSync(TOKENS, 'utf8')), origin: 'file' }, browser: 'off',
    });
    assert.equal(checked.summary.error, 0);
    assert.deepEqual(checked.findings.filter((f) => f.code.startsWith('verify.') || f.code.startsWith('brand.rule.') || f.code === 'design.text.overflow'), [], theme);
  }
});
