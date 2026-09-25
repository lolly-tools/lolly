// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly rebrand plan|compile|inspect` through the real entry point
 * (shells/cli/bin/lolly.ts), over the committed synthetic decks in a temp directory.
 *
 * Every case pins LOLLY_PROFILE=lolly-start, the profile a public clone resolves, so
 * the design system is the same on every machine.
 *
 * Run with: node --test tests/cli-rebrand.test.ts
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import { readZip } from '../engine/src/zip.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';
import { fixturePath, type SyntheticFixtureName } from './helpers/rebrand-fixtures.ts';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LOLLY = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function lolly(...args: string[]): Run {
  return lollyWith({}, ...args);
}

/** `lolly` with more environment, such as a models directory. */
function lollyWith(env: Record<string, string>, ...args: string[]): Run {
  const out = spawnSync(process.execPath, [LOLLY, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', NO_COLOR: '1', ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

interface FileRecord {
  input: string;
  outcome: string;
  error?: { code: string; exit: number; message: string };
  planPath?: string;
  reportPath?: string;
  outputs?: { lolly?: string; report?: string; pptx?: string; plan?: string };
  written?: boolean;
  counts?: { slides: { total: number; included: number } };
  pending?: number;
  attention?: number;
  appliedUnreviewed?: number;
  tray?: number;
  flattened?: { slides: number; rebuilt: number; kept: number; ocr: boolean; note: string };
}

interface Envelope {
  schemaVersion: number;
  command: string;
  ok: boolean;
  result: { stage: string; files: FileRecord[]; notAttempted: string[]; totals: Record<string, number>; dryRun: boolean } & Record<string, unknown>;
  error: { kind: string; detail?: string } | null;
}

function envelopeOf(run: Run): Envelope {
  assert.ok(run.stdout.trim().startsWith('{'), `expected a JSON envelope on stdout, got: ${run.stdout.slice(0, 200)} / ${run.stderr.slice(0, 400)}`);
  return JSON.parse(run.stdout) as Envelope;
}

/** A temp directory holding copies of the named decks. */
function workspace(...decks: SyntheticFixtureName[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-cli-rebrand-'));
  for (const deck of decks) copyFileSync(fixturePath(deck), join(dir, deck));
  return dir;
}

const planSchema = JSON.parse(readFileSync(join(REPO, 'schemas', 'rebrand-plan-v1.schema.json'), 'utf8')) as Record<string, unknown>;
const validatePlan = new Ajv({ allErrors: true, strict: false }).compile(planSchema);

// ─── plan ────────────────────────────────────────────────────────────────────

test('plan writes a schema-valid plan and its report beside the deck', () => {
  const dir = workspace('simple.pptx');
  const run = lolly('rebrand', 'plan', join(dir, 'simple.pptx'), '--json');
  assert.equal(run.status, 0, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.schemaVersion, 1);
  assert.equal(env.command, 'rebrand');
  assert.equal(env.ok, true);
  assert.equal(env.error, null);
  assert.equal(env.result.stage, 'plan');
  const file = env.result.files[0];
  assert.ok(file);
  assert.equal(file.planPath, join(dir, 'simple.plan.json'));
  assert.equal(file.reportPath, join(dir, 'simple.plan.report.json'));
  assert.ok(['ready', 'needs-review'].includes(file.outcome));
  assert.equal(file.written, true);
  assert.equal(file.counts?.slides.total, 3);
  assert.equal(typeof file.pending, 'number');
  assert.equal(typeof file.attention, 'number');

  const plan = JSON.parse(readFileSync(file.planPath, 'utf8')) as { source: { hash: string } };
  assert.ok(validatePlan(plan), JSON.stringify(validatePlan.errors));
  const report = JSON.parse(readFileSync(file.reportPath, 'utf8')) as { sourceHash: string };
  assert.equal(report.sourceHash, plan.source.hash);
});

test('plan never replaces an existing file unless told to', () => {
  const dir = workspace('simple.pptx');
  const deck = join(dir, 'simple.pptx');
  const planPath = join(dir, 'simple.plan.json');
  assert.equal(lolly('rebrand', 'plan', deck).status, 0);
  writeFileSync(planPath, '{"edited":true}\n');

  const again = lolly('rebrand', 'plan', deck, '--json');
  assert.equal(again.status, 4, again.stderr);
  const env = envelopeOf(again);
  assert.equal(env.ok, false);
  assert.equal(env.result.files[0]?.outcome, 'failed');
  assert.equal(env.result.files[0]?.error?.code, 'output.exists');
  assert.equal(readFileSync(planPath, 'utf8'), '{"edited":true}\n', 'the edited plan is untouched');

  const forced = lolly('rebrand', 'plan', deck, '--force');
  assert.equal(forced.status, 0, forced.stderr);
  assert.ok(validatePlan(JSON.parse(readFileSync(planPath, 'utf8'))));
});

test('--dry-run runs every stage and writes nothing', () => {
  const dir = workspace('simple.pptx');
  const before = readdirSync(dir).sort();
  const plan = lolly('rebrand', 'plan', join(dir, 'simple.pptx'), '--dry-run', '--json');
  assert.equal(plan.status, 0, plan.stderr);
  const env = envelopeOf(plan);
  assert.equal(env.result.dryRun, true);
  assert.equal(env.result.files[0]?.written, false);
  assert.ok(env.result.files[0]?.counts, 'the counts are reported although nothing was written');

  const compile = lolly('rebrand', 'compile', join(dir, 'simple.pptx'), `--out-dir=${join(dir, 'out')}`, '--export=pptx', '--dry-run', '--json');
  assert.ok(compile.status === 0 || compile.status === 5, compile.stderr);
  assert.equal(envelopeOf(compile).result.files[0]?.written, false);
  assert.deepEqual(readdirSync(dir).sort(), before);
});

// ─── compile ─────────────────────────────────────────────────────────────────

test('compile --plan reproduces the compile the plan stage reported', () => {
  const dir = workspace('simple.pptx');
  const deck = join(dir, 'simple.pptx');
  assert.equal(lolly('rebrand', 'plan', deck).status, 0);
  const run = lolly('rebrand', 'compile', deck, `--plan=${join(dir, 'simple.plan.json')}`, `--out-dir=${join(dir, 'new')}`, '--json');
  assert.ok(run.status === 0 || run.status === 5, run.stderr);
  const env = envelopeOf(run);
  const file = env.result.files[0];
  assert.ok(file?.outputs?.lolly && file.outputs.report);
  assert.equal(env.ok, file.outcome === 'ready', 'ok mirrors the exit code');
  assert.equal(run.status, file.outcome === 'ready' ? 0 : 5);

  const planned = JSON.parse(readFileSync(join(dir, 'simple.plan.report.json'), 'utf8')) as unknown;
  const compiled = JSON.parse(readFileSync(file.outputs.report, 'utf8')) as unknown;
  assert.deepEqual(compiled, planned, 'the compile of the unedited plan is the one the plan stage reported');

  const lollyFile = readLollyFile(new Uint8Array(readFileSync(file.outputs.lolly)));
  assert.equal(lollyFile.manifest.tool.id, 'design');
  assert.ok(Array.isArray(lollyFile.session.boxes));
  const marker = lollyFile.session.__rebrandHandoff as { report: unknown };
  assert.deepEqual(marker.report, planned, 'the report travels inside the document too');
});

test('a plan made for other bytes is refused with plan.hash-mismatch', () => {
  const dir = workspace('simple.pptx', 'palette.pptx');
  assert.equal(lolly('rebrand', 'plan', join(dir, 'palette.pptx')).status, 0);
  const run = lolly('rebrand', 'compile', join(dir, 'simple.pptx'), `--plan=${join(dir, 'palette.plan.json')}`, `--out-dir=${join(dir, 'new')}`, '--json');
  assert.equal(run.status, 4, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.ok, false);
  assert.equal(env.result.files[0]?.outcome, 'failed');
  assert.equal(env.result.files[0]?.error?.code, 'plan.hash-mismatch');
  assert.equal(existsSync(join(dir, 'new', 'simple.lolly')), false);
});

test('a plan that is not a plan is refused with plan.invalid', () => {
  const dir = workspace('simple.pptx');
  writeFileSync(join(dir, 'bad.json'), JSON.stringify({ version: 1, slides: 'none' }));
  const run = lolly('rebrand', 'compile', join(dir, 'simple.pptx'), `--plan=${join(dir, 'bad.json')}`, `--out-dir=${join(dir, 'new')}`, '--json');
  assert.equal(run.status, 2, run.stderr);
  assert.equal(envelopeOf(run).result.files[0]?.error?.code, 'plan.invalid');
});

test('--accept-suggestions answers the unreviewed rows and keeps the flagged ones for a person', () => {
  const dir = workspace('adversarial.pptx');
  const run = lolly('rebrand', 'compile', join(dir, 'adversarial.pptx'), `--out-dir=${join(dir, 'new')}`, '--accept-suggestions', '--json');
  assert.equal(run.status, 5, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.result.acceptSuggestions, 'unreviewed', 'the scope is recorded');
  const file = env.result.files[0];
  assert.ok(file);
  assert.equal(file.pending, 0);
  assert.ok((file.attention ?? 0) > 0, 'a row flagged for a person stays flagged');
  assert.equal(file.outcome, 'needs-review');
});

test('--accept-suggestions=all answers every open row, says how many went unreviewed and writes the answered plan', () => {
  const dir = workspace('adversarial.pptx');
  const run = lolly('rebrand', 'compile', join(dir, 'adversarial.pptx'), `--out-dir=${join(dir, 'new')}`, '--accept-suggestions=all', '--json');
  assert.ok(run.status === 0 || run.status === 5, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.result.acceptSuggestions, 'all');
  const file = env.result.files[0];
  assert.ok(file);
  assert.equal(file.pending, 0);
  assert.equal(file.attention, 0);
  assert.ok((file.appliedUnreviewed ?? 0) > 0);
  const report = JSON.parse(readFileSync(file.outputs?.report ?? '', 'utf8')) as { counts: { appliedUnreviewed: number } };
  assert.equal(report.counts.appliedUnreviewed, file.appliedUnreviewed);

  assert.equal(file.outputs?.plan, join(dir, 'new', 'adversarial.answered.plan.json'));
  const answered = JSON.parse(readFileSync(file.outputs.plan, 'utf8')) as { revision: number };
  assert.ok(validatePlan(answered), JSON.stringify(validatePlan.errors));
  const marker = readLollyFile(new Uint8Array(readFileSync(file.outputs?.lolly ?? ''))).session.__rebrandHandoff as { planRevision: number };
  assert.equal(marker.planRevision, answered.revision, 'the document names the answered plan on disk');
  assert.ok(answered.revision > 1);

  const bad = lolly('rebrand', 'compile', join(dir, 'adversarial.pptx'), `--out-dir=${join(dir, 'bad')}`, '--accept-suggestions=some', '--json');
  assert.equal(bad.status, 2);
  assert.equal(envelopeOf(bad).error?.kind, 'BAD_FLAG_VALUE');
});

test('a kept object waiting in the tray keeps the deck from being ready', () => {
  // Every kept object of the simple deck has a place on some layout now, so the
  // tray is reached the one way it still is: a kept shape, which no layout of the
  // master holds. A person keeps the repeated band on slide 1.
  const dir = workspace('simple.pptx');
  const deck = join(dir, 'simple.pptx');
  assert.equal(lolly('rebrand', 'plan', deck).status, 0);
  type Row = { id: string; class: string; decision?: string; author?: string; review?: string };
  const plan = JSON.parse(readFileSync(join(dir, 'simple.plan.json'), 'utf8')) as { slides: Array<{ objects: Row[] }> };
  const band = plan.slides[0]?.objects.find((row) => row.class === 'decoration');
  assert.ok(band, 'the simple deck states a repeated band on slide 1');
  Object.assign(band, { decision: 'keep', author: 'user', review: 'accepted' });
  writeFileSync(join(dir, 'kept.json'), JSON.stringify(plan));
  const run = lolly('rebrand', 'compile', deck, `--plan=${join(dir, 'kept.json')}`, `--out-dir=${join(dir, 'new')}`, '--accept-suggestions=all', '--json');
  assert.equal(run.status, 5, run.stderr);
  const file = envelopeOf(run).result.files[0];
  assert.equal(file?.tray, 1);
  assert.equal(file?.attention, 0);
  assert.equal(file?.outcome, 'needs-review');
});

test('a hand-edited plan that drops an object or repeats a slide is refused with plan.invalid', () => {
  const dir = workspace('simple.pptx');
  const deck = join(dir, 'simple.pptx');
  assert.equal(lolly('rebrand', 'plan', deck).status, 0);
  const plan = JSON.parse(readFileSync(join(dir, 'simple.plan.json'), 'utf8')) as { slides: Array<{ objects: unknown[] }> };

  const dropped = structuredClone(plan);
  dropped.slides[1]?.objects.pop();
  writeFileSync(join(dir, 'dropped.json'), JSON.stringify(dropped));
  const run = lolly('rebrand', 'compile', deck, `--plan=${join(dir, 'dropped.json')}`, `--out-dir=${join(dir, 'a')}`, '--accept-suggestions=all', '--json');
  assert.equal(run.status, 2, run.stderr);
  assert.equal(envelopeOf(run).result.files[0]?.error?.code, 'plan.invalid');

  const doubled = structuredClone(plan);
  doubled.slides.push(structuredClone(doubled.slides[0]!));
  writeFileSync(join(dir, 'doubled.json'), JSON.stringify(doubled));
  const again = lolly('rebrand', 'compile', deck, `--plan=${join(dir, 'doubled.json')}`, `--out-dir=${join(dir, 'b')}`, '--json');
  assert.equal(again.status, 2, again.stderr);
  assert.equal(envelopeOf(again).result.files[0]?.error?.code, 'plan.invalid');
});

test('--keep-going records a broken deck as failed and still compiles the good one', () => {
  const dir = workspace('simple.pptx');
  writeFileSync(join(dir, 'broken.pptx'), 'this is not a deck');
  const out = join(dir, 'new');
  const run = lolly('rebrand', 'compile', join(dir, 'broken.pptx'), join(dir, 'simple.pptx'), `--out-dir=${out}`, '--keep-going', '--json');
  assert.equal(run.status, 1, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.ok, false);
  const [broken, good] = env.result.files;
  assert.equal(broken?.outcome, 'failed');
  assert.equal(broken?.error?.code, 'source.unreadable');
  assert.ok(good && ['ready', 'needs-review'].includes(good.outcome), `the good deck ended ${good?.outcome}`);
  assert.equal(env.result.totals.failed, 1);
  assert.ok(existsSync(join(out, 'simple.lolly')));
  assert.deepEqual(env.result.notAttempted, []);

  const stop = lolly('rebrand', 'compile', join(dir, 'broken.pptx'), join(dir, 'simple.pptx'), `--out-dir=${join(dir, 'stop')}`, '--json');
  assert.equal(stop.status, 1);
  const stopped = envelopeOf(stop);
  assert.equal(stopped.result.files.length, 1, 'without --keep-going the run stops at the failure');
  assert.deepEqual(stopped.result.notAttempted, [join(dir, 'simple.pptx')]);
});

test('--export=pptx writes a PowerPoint package beside the Design document', () => {
  const dir = workspace('simple.pptx');
  const out = join(dir, 'new');
  const run = lolly('rebrand', 'compile', join(dir, 'simple.pptx'), `--out-dir=${out}`, '--export=pptx');
  assert.ok(run.status === 0 || run.status === 5, run.stderr);
  const pptx = join(out, 'simple.rebranded.pptx');
  assert.ok(statSync(pptx).size > 0);
  const names = readZip(new Uint8Array(readFileSync(pptx))).map((entry) => entry.name);
  assert.ok(names.includes('[Content_Types].xml'));
  assert.ok(names.includes('ppt/presentation.xml'));
  assert.equal(readdirSync(out).filter((name) => name.startsWith('.')).length, 0, 'no temp file is left behind');
});

test('--export=pptx in the default folder beside the deck works and leaves the source alone', () => {
  const dir = workspace('simple.pptx');
  const run = lolly('rebrand', 'compile', join(dir, 'simple.pptx'), '--export=pptx', '--force', '--json');
  assert.ok(run.status === 0 || run.status === 5, run.stderr);
  const file = envelopeOf(run).result.files[0];
  assert.equal(file?.outputs?.pptx, join(dir, 'simple.rebranded.pptx'));
  assert.ok(statSync(join(dir, 'simple.rebranded.pptx')).size > 0);
  assert.deepEqual(readFileSync(join(dir, 'simple.pptx')), readFileSync(fixturePath('simple.pptx')));
});

test('an output that is the source deck itself is refused even with --force, by file identity', () => {
  // The deck is named so its Design document would be written onto it, and the
  // --out-dir is a symlink to its own folder, so the two paths differ as strings.
  const dir = workspace();
  const inner = join(dir, 'inner');
  mkdirSync(inner);
  copyFileSync(fixturePath('simple.pptx'), join(inner, 'd.lolly'));
  symlinkSync(inner, join(dir, 'alias'));
  const run = lolly('rebrand', 'compile', join(inner, 'd.lolly'), `--out-dir=${join(dir, 'alias')}`, '--force', '--json');
  assert.equal(run.status, 4, run.stderr);
  assert.equal(envelopeOf(run).result.files[0]?.error?.code, 'output.exists');
  assert.deepEqual(readFileSync(join(inner, 'd.lolly')), readFileSync(fixturePath('simple.pptx')));
});

test('a case-variant name on a case-insensitive volume is caught as the source deck', (t) => {
  const dir = workspace();
  const upper = join(dir, 'Deck.LOLLY');
  copyFileSync(fixturePath('simple.pptx'), upper);
  if (!existsSync(join(dir, 'Deck.lolly'))) {
    t.skip('this volume is case-sensitive, so a case-variant name is another file');
    return;
  }
  const run = lolly('rebrand', 'compile', upper, '--force', '--json');
  assert.equal(run.status, 4, run.stderr);
  assert.equal(envelopeOf(run).result.files[0]?.error?.code, 'output.exists');
  assert.deepEqual(readFileSync(upper), readFileSync(fixturePath('simple.pptx')));
});

test('an output folder that cannot be written is output.unwritable, not a missing source', (t) => {
  if (process.getuid?.() === 0) {
    t.skip('running as root, which writes through a read-only folder');
    return;
  }
  const dir = workspace('simple.pptx');
  const ro = join(dir, 'ro');
  mkdirSync(ro);
  chmodSync(ro, 0o555);
  try {
    const run = lolly('rebrand', 'compile', join(dir, 'simple.pptx'), `--out-dir=${join(ro, 'out')}`, '--json');
    assert.equal(run.status, 1, run.stderr);
    const file = envelopeOf(run).result.files[0];
    assert.equal(file?.error?.code, 'output.unwritable');
    assert.equal(file?.written, false);
  } finally {
    chmodSync(ro, 0o755);
  }
});

// ─── PDF decks and slides that are pictures ─────────────────────────────────

/** A temp directory holding a copy of the born-digital PDF deck. */
function pdfWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-cli-rebrand-pdf-'));
  copyFileSync(join(REPO, 'tests', 'fixtures', 'rebrand-pdf', 'editable.pdf'), join(dir, 'editable.pdf'));
  return dir;
}

test('a PDF deck plans and compiles, and compile --plan reads it the same way', () => {
  const dir = pdfWorkspace();
  const planned = lolly('rebrand', 'plan', join(dir, 'editable.pdf'), '--json');
  assert.equal(planned.status, 0, planned.stderr);
  const file = envelopeOf(planned).result.files[0];
  assert.equal(file?.error, undefined, file?.error?.message ?? 'no error');
  assert.equal(file?.flattened, undefined, 'a born-digital PDF has no slide that is a picture');
  const planPath = join(dir, 'editable.plan.json');
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { algorithms: { reader: string } };
  assert.ok(validatePlan(plan), JSON.stringify(validatePlan.errors));
  assert.match(plan.algorithms.reader, /^pdf-read\//, 'the plan names the PDF reader');

  const out = join(dir, 'out');
  const compiled = lolly('rebrand', 'compile', join(dir, 'editable.pdf'), `--plan=${planPath}`, `--out-dir=${out}`, '--json');
  assert.ok(compiled.status === 0 || compiled.status === 5, compiled.stderr);
  const record = envelopeOf(compiled).result.files[0];
  assert.equal(record?.error, undefined, record?.error?.message ?? 'no error');
  assert.equal(record?.written, true);
  const lolly_ = readLollyFile(new Uint8Array(readFileSync(join(out, 'editable.lolly'))));
  assert.ok(lolly_, 'the Design document reads back');
  assert.equal(record?.counts?.slides.total, file?.counts?.slides.total, 'compile read the same pages the plan was made from');
});

test('a folder run reads its PDFs, and a PDF beside a .pptx of the same name is left out', () => {
  const dir = workspace('simple.pptx');
  copyFileSync(join(REPO, 'tests', 'fixtures', 'rebrand-pdf', 'editable.pdf'), join(dir, 'editable.pdf'));
  copyFileSync(join(REPO, 'tests', 'fixtures', 'rebrand-pdf', 'editable.pdf'), join(dir, 'simple.pdf'));
  const run = lolly('rebrand', 'plan', dir, `--plan-out=${join(dir, 'plans')}`, '--dry-run', '--json');
  assert.equal(run.status, 0, run.stderr);
  const inputs = envelopeOf(run).result.files.map((one) => one.input.split(/[\\/]/).pop());
  assert.deepEqual(inputs, ['editable.pdf', 'simple.pptx']);
});

test('a scanned PDF page stays a picture without --ocr, and the record says so', () => {
  const dir = workspace('flattened.pdf');
  const run = lolly('rebrand', 'plan', join(dir, 'flattened.pdf'), '--json');
  assert.equal(run.status, 0, run.stderr);
  const file = envelopeOf(run).result.files[0];
  assert.equal(file?.error, undefined, file?.error?.message ?? 'no error');
  assert.ok(file?.flattened, 'the record carries what happened to the pages that are pictures');
  assert.ok(file.flattened.slides > 0);
  assert.equal(file.flattened.rebuilt, 0);
  assert.equal(file.flattened.ocr, false);
  assert.match(file.flattened.note, /Pass --ocr/);
  const plan = JSON.parse(readFileSync(join(dir, 'flattened.plan.json'), 'utf8')) as { algorithms: { reader: string } };
  assert.match(plan.algorithms.reader, /\+keep$/, 'the plan records that the pages were kept');
});

test('--ocr downloads nothing: without the model the scanned pages stay pictures and say why', () => {
  const dir = workspace('flattened.pdf');
  const models = mkdtempSync(join(tmpdir(), 'lolly-cli-rebrand-models-'));
  const run = lollyWith({ LOLLY_MODELS_DIR: models }, 'rebrand', 'plan', join(dir, 'flattened.pdf'), '--ocr', '--json');
  assert.equal(run.status, 0, run.stderr);
  const file = envelopeOf(run).result.files[0];
  assert.equal(file?.error, undefined, file?.error?.message ?? 'no error');
  assert.equal(file?.flattened?.rebuilt, 0);
  assert.equal(file?.flattened?.ocr, false);
  assert.match(file?.flattened?.note ?? '', /cannot be read here/);
  assert.deepEqual(readdirSync(models), [], 'nothing was downloaded into the models directory');
});

test('--ocr reads the scanned pages when the model is on this machine, and compile --plan reads them again', async (t) => {
  const { nodeFlattenedOcr } = await import('../packages/node-shell/src/rebrand/ocr-node.ts');
  const probe = await nodeFlattenedOcr();
  if (!probe.ok) {
    t.skip('the ocr model family is not on this machine');
    return;
  }
  const dir = workspace('flattened.pdf');
  const run = lolly('rebrand', 'plan', join(dir, 'flattened.pdf'), '--ocr', '--json');
  assert.equal(run.status, 0, run.stderr);
  const file = envelopeOf(run).result.files[0];
  assert.equal(file?.error, undefined, file?.error?.message ?? 'no error');
  assert.equal(file?.flattened?.ocr, true);
  assert.ok((file?.flattened?.rebuilt ?? 0) > 0, file?.flattened?.note ?? 'no note');
  const planPath = join(dir, 'flattened.plan.json');
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { algorithms: { reader: string } };
  assert.match(plan.algorithms.reader, /\+rebuild\/ocr/);

  const compiled = lolly('rebrand', 'compile', join(dir, 'flattened.pdf'), `--plan=${planPath}`, `--out-dir=${join(dir, 'out')}`, '--json');
  assert.ok(compiled.status === 0 || compiled.status === 5, compiled.stderr);
  assert.equal(envelopeOf(compiled).result.files[0]?.error, undefined, 'the plan fits the pages read again with text recognition');
});

test('usage errors carry the envelope and exit 2', () => {
  const noStage = lolly('rebrand', '--json');
  assert.equal(noStage.status, 2);
  assert.equal(envelopeOf(noStage).error?.kind, 'MISSING_ARGUMENT');
  const unknown = lolly('rebrand', 'plan', fixturePath('simple.pptx'), '--profile=fogra39', '--json');
  assert.equal(unknown.status, 2);
  assert.equal(envelopeOf(unknown).error?.kind, 'UNKNOWN_FLAG');
  const bare = lolly('rebrand', 'compile', fixturePath('simple.pptx'), '--plan', '--json');
  assert.equal(bare.status, 2);
  assert.equal(envelopeOf(bare).error?.kind, 'MISSING_FLAG_VALUE');
});

// ─── inspect ─────────────────────────────────────────────────────────────────

interface InspectResult {
  summary: { slides: { total: number } };
  queue?: { total: number; page: number; limit: number; items: Array<{ title: string; slideNumbers: number[]; section: string }> };
  slides?: { total: number; items: Array<{ number: number; layout: string }> };
  slide?: { number: number };
  objects?: { total: number; items: Array<{ id: string; class: string; action: string; review: string; fidelity: string; evidence: string }> };
}

test('inspect --json returns the summary, the queue and the slides of a plan', () => {
  const dir = workspace('simple.pptx');
  assert.equal(lolly('rebrand', 'plan', join(dir, 'simple.pptx')).status, 0);
  const run = lolly('rebrand', 'inspect', join(dir, 'simple.plan.json'), '--json');
  assert.equal(run.status, 0, run.stderr);
  const env = JSON.parse(run.stdout) as { ok: boolean; result: InspectResult };
  assert.equal(env.ok, true);
  assert.equal(env.result.summary.slides.total, 3);
  assert.ok(env.result.queue && env.result.queue.total > 0);
  for (const item of env.result.queue.items) {
    assert.ok(item.title.length > 0);
    assert.ok(item.slideNumbers.length > 0);
  }
  assert.equal(env.result.slides?.total, 3);

  const paged = JSON.parse(lolly('rebrand', 'inspect', join(dir, 'simple.plan.json'), '--limit=2', '--json').stdout) as { result: InspectResult };
  assert.equal(paged.result.queue?.items.length, 2);
  assert.equal(paged.result.queue?.limit, 2);

  const one = lolly('rebrand', 'inspect', join(dir, 'simple.plan.json'), '--slide=1', '--json');
  assert.equal(one.status, 0, one.stderr);
  const slide = (JSON.parse(one.stdout) as { result: InspectResult }).result;
  assert.equal(slide.slide?.number, 1);
  assert.ok(slide.objects && slide.objects.total > 0);
  for (const object of slide.objects.items) {
    assert.ok(object.class && object.action && object.review && object.fidelity && object.evidence);
  }
});

test('inspect reads a deck directly, and prints a bounded page by default', () => {
  const run = lolly('rebrand', 'inspect', fixturePath('adversarial.pptx'));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Queue/);
  assert.match(run.stdout, /Slides/);
  assert.ok(run.stdout.split('\n').length < 120, 'a default inspect stays short');
});

test('inspect of a plan with the wrong deck beside it is refused', () => {
  const dir = workspace('simple.pptx', 'palette.pptx');
  assert.equal(lolly('rebrand', 'plan', join(dir, 'palette.pptx')).status, 0);
  const run = lolly('rebrand', 'inspect', join(dir, 'palette.plan.json'), `--source=${join(dir, 'simple.pptx')}`, '--json');
  assert.equal(run.status, 4);
  const error = envelopeOf(run).error;
  assert.equal(error?.kind, 'PLAN_HASH_MISMATCH');
  assert.equal(error?.detail, 'plan.hash-mismatch');
});

test('inspect of a plan made from a PDF finds that PDF when a pptx of the same name sits beside it', () => {
  const dir = workspace('simple.pptx');
  copyFileSync(join(REPO, 'tests', 'fixtures', 'rebrand-pdf', 'editable.pdf'), join(dir, 'simple.pdf'));
  const planned = lolly('rebrand', 'plan', join(dir, 'simple.pdf'));
  assert.equal(planned.status, 0, planned.stderr);
  assert.ok(existsSync(join(dir, 'simple.plan.json')), 'the plan is named after the deck');
  const run = lolly('rebrand', 'inspect', join(dir, 'simple.plan.json'), '--json');
  assert.equal(run.status, 0, run.stderr);
  const env = JSON.parse(run.stdout) as { ok: boolean; result: InspectResult };
  assert.equal(env.ok, true, 'the deck whose bytes the plan pins is read, not the pptx');
});

// ─── completion ──────────────────────────────────────────────────────────────

test('every completion script offers the rebrand stages and completes its path flags as files', () => {
  for (const shell of ['bash', 'zsh', 'fish']) {
    const run = lolly('completion', shell);
    assert.equal(run.status, 0, run.stderr);
    for (const stage of ['plan', 'compile', 'inspect']) assert.match(run.stdout, new RegExp(`\\b${stage}\\b`), `${shell} offers ${stage}`);
    assert.match(run.stdout, /rebrand/);
    for (const flag of ['plan-out', 'plan', 'preset', 'source']) {
      const asPath = shell === 'fish'
        ? new RegExp(`-l "${flag}" -r -F`)
        : new RegExp(`--${flag}(?=[\\s|')])`);
      assert.match(run.stdout, asPath, `${shell} completes --${flag} as a path`);
    }
  }
});

// ─── --auto-match (plan 275 decision 28) ─────────────────────────────────────

/** A temp directory holding a copy of the structures fixture. */
function structuresWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-cli-rebrand-'));
  copyFileSync(join(REPO, 'tests', 'fixtures', 'rebrand', 'structures.pptx'), join(dir, 'structures.pptx'));
  return dir;
}

interface AutoMatched { clear: number; likely: number; none: number; total: number }

/**
 * The first pass already sets every clear read on the structures fixture, so a plan
 * whose layouts are all the plainest is what Auto-match has work to do on: written
 * beside the deck, for `compile --plan`.
 */
function flatPlan(dir: string): string {
  const planned = lolly('rebrand', 'plan', join(dir, 'structures.pptx'), `--plan-out=${join(dir, 'first.plan.json')}`, '--json');
  assert.equal(planned.status === 0 || planned.status === 5, true, planned.stderr);
  const plan = JSON.parse(readFileSync(join(dir, 'first.plan.json'), 'utf8')) as { slides: Array<Record<string, unknown>> };
  const flat = { ...plan, slides: plan.slides.map((slide) => ({ ...slide, layout: 'content' })) };
  const out = join(dir, 'flat.plan.json');
  writeFileSync(out, JSON.stringify(flat));
  return out;
}

test('plan --auto-match (bare means all) changes no layout the first pass already set, and says so', () => {
  const dir = structuresWorkspace();
  const run = lolly('rebrand', 'plan', join(dir, 'structures.pptx'), '--auto-match', '--json');
  assert.equal(run.status === 0 || run.status === 5, true, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.result.autoMatch, 'all');
  const file = env.result.files[0] as FileRecord & { autoMatched?: AutoMatched };
  assert.deepEqual(file.autoMatched, { clear: 0, likely: 0, none: 0, total: 0 });
  const plan = JSON.parse(readFileSync(file.planPath ?? '', 'utf8')) as { slides: Array<{ layoutSource: string }> };
  assert.ok(validatePlan(plan), JSON.stringify(validatePlan.errors));
  assert.equal(plan.slides.filter((slide) => slide.layoutSource === 'auto').length, 0, 'a proposal stays a proposal');
});

test('compile --auto-match (bare means all) matches every named slide, and the envelope counts agree with the report', () => {
  const dir = structuresWorkspace();
  const run = lolly('rebrand', 'compile', join(dir, 'structures.pptx'), `--plan=${flatPlan(dir)}`, `--out-dir=${join(dir, 'out')}`, '--auto-match', '--json');
  assert.equal(run.status === 0 || run.status === 5, true, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.result.autoMatch, 'all');
  const file = env.result.files[0] as FileRecord & { autoMatched?: AutoMatched };
  assert.deepEqual(file.autoMatched, { clear: 7, likely: 1, none: 0, total: 8 });
  const plan = JSON.parse(readFileSync(file.outputs?.plan ?? '', 'utf8')) as { slides: Array<{ layoutSource: string }> };
  assert.ok(validatePlan(plan), JSON.stringify(validatePlan.errors));
  assert.equal(plan.slides.filter((slide) => slide.layoutSource === 'auto').length, 8);
  const report = JSON.parse(readFileSync(file.outputs?.report ?? '', 'utf8')) as { entries: Array<{ code: string; reason?: string }> };
  const entries = report.entries.filter((entry) => entry.code === 'layout.auto-matched');
  assert.equal(entries.length, file.autoMatched?.total);
  assert.equal(entries.filter((entry) => entry.reason?.endsWith(':clear')).length, file.autoMatched?.clear);
  assert.equal(entries.filter((entry) => entry.reason?.endsWith(':likely')).length, file.autoMatched?.likely);
});

test('compile --auto-match=clear sets only the clear reads, writes the answered plan, and an unknown band is a usage error', () => {
  const dir = structuresWorkspace();
  const run = lolly('rebrand', 'compile', join(dir, 'structures.pptx'), `--plan=${flatPlan(dir)}`, `--out-dir=${join(dir, 'out')}`, '--auto-match=clear', '--json');
  assert.equal(run.status === 0 || run.status === 5, true, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.result.autoMatch, 'clear');
  const file = env.result.files[0] as FileRecord & { autoMatched?: AutoMatched };
  assert.deepEqual(file.autoMatched, { clear: 7, likely: 0, none: 0, total: 7 });
  assert.equal(file.outputs?.plan, join(dir, 'out', 'structures.answered.plan.json'));
  const report = JSON.parse(readFileSync(file.outputs?.report ?? '', 'utf8')) as { entries: Array<{ code: string }> };
  assert.equal(report.entries.filter((entry) => entry.code === 'layout.auto-matched').length, 7);

  const off = lolly('rebrand', 'plan', join(dir, 'structures.pptx'), `--plan-out=${join(dir, 'off.plan.json')}`, '--json');
  const plain = envelopeOf(off).result.files[0] as FileRecord & { autoMatched?: AutoMatched };
  assert.equal(plain.autoMatched, undefined, 'off by default');

  const bad = lolly('rebrand', 'plan', join(dir, 'structures.pptx'), '--auto-match=maybe', '--json');
  assert.equal(bad.status, 2);
  assert.equal(envelopeOf(bad).error?.kind, 'BAD_FLAG_VALUE');
});
