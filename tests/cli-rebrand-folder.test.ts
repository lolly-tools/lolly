// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly rebrand plan|compile` over a folder, through the real entry point
 * (shells/cli/bin/lolly.ts): the folder expands to its decks, each deck writes
 * its own outputs, the run record (`.lolly-rebrand-run.json`) is kept beside
 * them, `--resume` leaves finished decks alone and runs a changed one again,
 * `--jobs=2` reports what `--jobs=1` reports, and nothing is replaced without
 * `--force` (plan 274 sections 2.3 and 5).
 *
 * The folder holds copies of the three committed synthetic decks and one file
 * that is not a deck. Every case pins LOLLY_PROFILE=lolly-start and a state
 * directory of its own. Counts come from the run, never pinned.
 *
 * Run with: node --test tests/cli-rebrand-folder.test.ts
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LOLLY = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');
const FIXTURES = join(REPO, 'tests', 'fixtures', 'rebrand');
const DECKS = ['adversarial.pptx', 'palette.pptx', 'simple.pptx'] as const;
const RECORD = '.lolly-rebrand-run.json';

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function lolly(...args: string[]): Run {
  const out = spawnSync(process.execPath, [LOLLY, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: mkdtempSync(join(tmpdir(), 'lolly-state-')), NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

interface FileRecord {
  input: string;
  outcome: string;
  error?: { code: string; exit: number; message: string };
  outputs?: Record<string, string>;
  planPath?: string;
  written?: boolean;
  skipped?: boolean;
  recordedOutputs?: string[];
  counts?: unknown;
  pending?: number;
  attention?: number;
  unresolvedObjects?: number;
  unresolvedColours?: number;
  tray?: number;
}

interface Envelope {
  ok: boolean;
  result: {
    stage: string;
    files: FileRecord[];
    notAttempted: string[];
    totals: Record<string, number>;
    summary: { decks: number; ran: number; skipped: number; ready: number; needsReview: number; failed: number; notAttempted: number };
    run: { record: string | null; resume: boolean; jobs: number };
  };
  error: { kind: string } | null;
}

function envelopeOf(run: Run): Envelope {
  assert.ok(run.stdout.trim().startsWith('{'), `expected a JSON envelope, got: ${run.stdout.slice(0, 200)} / ${run.stderr.slice(0, 600)}`);
  return JSON.parse(run.stdout) as Envelope;
}

interface RecordEntry {
  input: string;
  hash: string;
  outcome: string;
  stage: string;
  outputs: string[];
  errorCode?: string;
}

function recordOf(dir: string): RecordEntry[] {
  return (JSON.parse(readFileSync(join(dir, RECORD), 'utf8')) as { files: RecordEntry[] }).files;
}

/** A folder of the three decks and one broken file, which sorts between them. */
function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-rebrand-folder-'));
  const decks = join(dir, 'decks');
  mkdirSync(decks);
  for (const deck of DECKS) copyFileSync(join(FIXTURES, deck), join(decks, deck));
  writeFileSync(join(decks, 'broken.pptx'), 'this is not a deck');
  // Neither of these is a deck to read.
  writeFileSync(join(decks, '~$simple.pptx'), 'a PowerPoint lock file');
  writeFileSync(join(decks, 'notes.txt'), 'not a deck');
  return dir;
}

const base = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/** What a deck's record says, with the paths and the timing left out, for comparing two runs. */
function comparable(file: FileRecord): Record<string, unknown> {
  return {
    input: base(file.input),
    outcome: file.outcome,
    code: file.error?.code,
    counts: file.counts,
    pending: file.pending,
    attention: file.attention,
    unresolvedObjects: file.unresolvedObjects,
    unresolvedColours: file.unresolvedColours,
    tray: file.tray,
    outputs: Object.values(file.outputs ?? {}).map(base).sort(),
  };
}

test('a folder compiles one output set per deck, keeps the run record, and resumes only what needs work', () => {
  const dir = folder();
  const decks = join(dir, 'decks');
  const out = join(dir, 'out');

  const first = lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--json');
  assert.equal(first.status, 1, `a failed deck fails the run: ${first.stderr}`);
  const env = envelopeOf(first);
  assert.deepEqual(env.result.files.map((file) => base(file.input)), ['adversarial.pptx', 'broken.pptx', 'palette.pptx', 'simple.pptx'], 'sorted by name, the lock file and the text file left out');
  const broken = env.result.files.find((file) => base(file.input) === 'broken.pptx');
  assert.equal(broken?.outcome, 'failed');
  assert.equal(broken?.error?.code, 'source.unreadable');
  for (const deck of DECKS) {
    const name = deck.replace(/\.pptx$/, '');
    assert.ok(existsSync(join(out, `${name}.lolly`)), `${name}.lolly`);
    assert.ok(existsSync(join(out, `${name}.report.json`)), `${name}.report.json`);
  }
  const summary = env.result.summary;
  assert.equal(summary.decks, 4);
  assert.equal(summary.failed, 1);
  assert.equal(summary.ready + summary.needsReview, 3);
  assert.equal(summary.skipped, 0);
  assert.equal(env.result.run.record, join(out, RECORD));

  // The record: one entry per deck, finished decks at `done` with their outputs.
  const record = recordOf(out);
  assert.equal(record.length, 4);
  for (const entry of record) {
    if (base(entry.input) === 'broken.pptx') {
      assert.equal(entry.outcome, 'failed');
      assert.equal(entry.errorCode, 'source.unreadable');
      assert.deepEqual(entry.outputs, []);
    } else {
      assert.ok(['ready', 'needs-review'].includes(entry.outcome), `${entry.input} ended ${entry.outcome}`);
      assert.equal(entry.stage, 'done');
      assert.equal(entry.outputs.length, 2);
      assert.match(entry.hash, /^sha256:[0-9a-f]{64}$/);
    }
  }

  // --resume with nothing changed: every deck is left alone, the broken one included.
  const mtimes = new Map(readdirSync(out).map((name) => [name, statSync(join(out, name)).mtimeMs]));
  const idle = lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--resume', '--json');
  const idleEnv = envelopeOf(idle);
  assert.equal(idle.status, 1, 'the broken deck still fails the folder');
  assert.equal(idleEnv.result.summary.skipped, 4);
  assert.equal(idleEnv.result.summary.ran, 0);
  assert.ok(idleEnv.result.files.every((file) => file.skipped === true));
  assert.equal(idleEnv.result.files.find((file) => base(file.input) === 'broken.pptx')?.error?.code, 'source.unreadable');
  for (const [name, mtime] of mtimes) if (name !== RECORD) assert.equal(statSync(join(out, name)).mtimeMs, mtime, `${name} was not touched`);

  // Change one deck's bytes: --resume runs that one again and replaces its own outputs.
  copyFileSync(join(FIXTURES, 'adversarial.pptx'), join(decks, 'simple.pptx'));
  const changed = lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--resume', '--json');
  const changedEnv = envelopeOf(changed);
  const ran = changedEnv.result.files.filter((file) => !file.skipped).map((file) => base(file.input));
  assert.deepEqual(ran, ['simple.pptx'], changed.stderr);
  const simple = changedEnv.result.files.find((file) => base(file.input) === 'simple.pptx');
  assert.ok(simple && simple.written === true && !simple.error, `the changed deck compiled: ${JSON.stringify(simple?.error)}`);
  assert.notEqual(statSync(join(out, 'simple.lolly')).mtimeMs, mtimes.get('simple.lolly'), 'the changed deck wrote again');
  for (const name of ['adversarial.lolly', 'palette.lolly']) assert.equal(statSync(join(out, name)).mtimeMs, mtimes.get(name), `${name} was not touched`);
  const after = recordOf(out).find((entry) => base(entry.input) === 'simple.pptx');
  assert.equal(after?.stage, 'done');
});

test('nothing is replaced without --force, and a finished deck stays finished in the record', () => {
  const dir = folder();
  const decks = join(dir, 'decks');
  const out = join(dir, 'out');
  assert.equal(lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going').status, 1);
  const before = new Map(readdirSync(out).filter((name) => name !== RECORD).map((name) => [name, readFileSync(join(out, name))]));
  const recordBefore = recordOf(out);

  const again = lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--json');
  assert.equal(again.status, 4, again.stderr);
  const env = envelopeOf(again);
  for (const file of env.result.files) {
    if (base(file.input) === 'broken.pptx') continue;
    assert.equal(file.error?.code, 'output.exists', `${file.input} was refused`);
    assert.match(file.error?.message ?? '', /--resume/, 'the refusal names --resume as well as --force');
  }
  for (const [name, bytes] of before) assert.deepEqual(readFileSync(join(out, name)), bytes, `${name} is unchanged`);
  const recordAfter = recordOf(out);
  for (const entry of recordBefore) {
    if (base(entry.input) === 'broken.pptx') continue;
    const now = recordAfter.find((one) => one.input === entry.input);
    assert.equal(now?.outcome, entry.outcome, 'a refused claim leaves the entry as it was');
    assert.deepEqual(now?.outputs, entry.outputs);
  }

  const forced = lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--force', '--json');
  assert.equal(forced.status, 1, 'only the broken deck fails once --force is given');
  assert.equal(envelopeOf(forced).result.files.filter((file) => file.error?.code === 'output.exists').length, 0);
});

test('--jobs=2 reports what --jobs=1 reports, in the same order', () => {
  const dir = folder();
  const decks = join(dir, 'decks');
  const one = envelopeOf(lolly('rebrand', 'compile', decks, `--out-dir=${join(dir, 'one')}`, '--keep-going', '--jobs=1', '--json'));
  const two = envelopeOf(lolly('rebrand', 'compile', decks, `--out-dir=${join(dir, 'two')}`, '--keep-going', '--jobs=2', '--json'));
  assert.equal(one.result.run.jobs, 1);
  assert.equal(two.result.run.jobs, Math.min(2, availableParallelism()), 'two decks run at once wherever the machine has two cores');
  assert.deepEqual(two.result.files.map(comparable), one.result.files.map(comparable));
  assert.deepEqual(two.result.summary, one.result.summary);
  assert.deepEqual(two.result.totals, one.result.totals);
  assert.deepEqual(readdirSync(join(dir, 'two')).sort(), readdirSync(join(dir, 'one')).sort());
  for (const name of readdirSync(join(dir, 'one')).filter((file) => file.endsWith('.report.json'))) {
    const a = JSON.parse(readFileSync(join(dir, 'one', name), 'utf8')) as { sourceHash: string; counts: unknown; entries: unknown[] };
    const b = JSON.parse(readFileSync(join(dir, 'two', name), 'utf8')) as { sourceHash: string; counts: unknown; entries: unknown[] };
    assert.equal(b.sourceHash, a.sourceHash);
    assert.ok(a.counts && typeof a.counts === 'object', `${name} carries its counts`);
    assert.deepEqual(b.counts, a.counts, `${name} states the same counts`);
    assert.equal(b.entries.length, a.entries.length, `${name} lists the same number of entries`);
  }
});

test('without --keep-going no deck starts after a failure, and the rest are named', () => {
  const dir = folder();
  const run = lolly('rebrand', 'compile', join(dir, 'decks'), `--out-dir=${join(dir, 'out')}`, '--json');
  assert.equal(run.status, 1);
  const env = envelopeOf(run);
  assert.deepEqual(env.result.files.map((file) => base(file.input)), ['adversarial.pptx', 'broken.pptx']);
  assert.deepEqual(env.result.notAttempted.map(base), ['palette.pptx', 'simple.pptx']);
  assert.equal(env.result.summary.notAttempted, 2);
});

test('plan takes a folder too, and --resume needs a folder to keep its record in', () => {
  const dir = folder();
  const decks = join(dir, 'decks');
  const plans = join(dir, 'plans');
  const run = lolly('rebrand', 'plan', decks, `--plan-out=${plans}`, '--keep-going', '--json');
  assert.equal(run.status, 1, run.stderr);
  for (const deck of DECKS) assert.ok(existsSync(join(plans, deck.replace(/\.pptx$/, '.plan.json'))), `${deck} has a plan`);
  assert.ok(recordOf(plans).filter((entry) => entry.outcome !== 'failed').every((entry) => entry.stage === 'plan'));

  const resumed = envelopeOf(lolly('rebrand', 'plan', decks, `--plan-out=${plans}`, '--keep-going', '--resume', '--json'));
  assert.equal(resumed.result.summary.skipped, 4);

  // A compile into the plan folder finds decks finished for the other stage, and
  // runs them; the deck the plan stage could not read is not read again.
  const compiled = envelopeOf(lolly('rebrand', 'compile', decks, `--out-dir=${plans}`, '--plan=' + plans, '--keep-going', '--resume', '--json'));
  assert.deepEqual(compiled.result.files.filter((file) => !file.skipped).map((file) => base(file.input)), [...DECKS]);

  // Each stage keeps its own state: after the compile, a plan run leaves every
  // deck alone, and the record lists the outputs of both stages.
  const replanned = lolly('rebrand', 'plan', decks, `--plan-out=${plans}`, '--keep-going', '--resume', '--json');
  const replannedEnv = envelopeOf(replanned);
  assert.equal(replannedEnv.result.summary.skipped, 4, replanned.stderr);
  assert.equal(replannedEnv.result.files.filter((file) => file.error?.code === 'output.exists').length, 0);
  for (const entry of recordOf(plans)) {
    if (base(entry.input) === 'broken.pptx') continue;
    const names = entry.outputs.map(base);
    const name = base(entry.input).replace(/\.pptx$/, '');
    for (const want of [`${name}.plan.json`, `${name}.plan.report.json`, `${name}.lolly`, `${name}.report.json`]) {
      assert.ok(names.includes(want), `${entry.input} lists ${want}`);
    }
  }

  const noFolder = lolly('rebrand', 'plan', join(decks, 'simple.pptx'), '--resume', '--json');
  assert.equal(noFolder.status, 2);
  assert.equal(envelopeOf(noFolder).error?.kind, 'MISSING_ARGUMENT');
});

test('--recursive reads subfolders and writes into the same subfolder under --out-dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-rebrand-tree-'));
  const decks = join(dir, 'decks');
  mkdirSync(join(decks, 'q3'), { recursive: true });
  copyFileSync(join(FIXTURES, 'simple.pptx'), join(decks, 'simple.pptx'));
  copyFileSync(join(FIXTURES, 'palette.pptx'), join(decks, 'q3', 'simple.pptx'));
  const out = join(decks, 'out');

  const flat = lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--json');
  assert.deepEqual(envelopeOf(flat).result.files.map((file) => file.input), [join(decks, 'simple.pptx')], 'without --recursive only the top level is read');

  // The output folder sits inside the input and holds a file with a deck's name,
  // so only the rule that never walks the output folder keeps it out.
  const deepOut = join(decks, 'deep');
  mkdirSync(deepOut);
  copyFileSync(join(FIXTURES, 'simple.pptx'), join(deepOut, 'copy.pptx'));
  const deep = lolly('rebrand', 'compile', decks, `--out-dir=${deepOut}`, '--recursive', '--json');
  const env = envelopeOf(deep);
  assert.deepEqual(env.result.files.map((file) => file.input), [join(decks, 'simple.pptx'), join(decks, 'q3', 'simple.pptx')], 'the output folder inside the input is never read');
  assert.ok(existsSync(join(deepOut, 'simple.lolly')));
  assert.ok(existsSync(join(deepOut, 'q3', 'simple.lolly')), 'two decks with one name do not collide');
});

test('--resume runs a deck again when its plan is edited or the options change', () => {
  const dir = folder();
  const decks = join(dir, 'decks');
  const plans = join(dir, 'plans');
  const out = join(dir, 'out');
  // Without its plan the broken deck fails as plan.missing, which a person fixes by
  // writing one, so it would run every time; this case is about the other three.
  rmSync(join(decks, 'broken.pptx'));
  lolly('rebrand', 'plan', decks, `--plan-out=${plans}`, '--keep-going');
  lolly('rebrand', 'compile', decks, `--plan=${plans}`, `--out-dir=${out}`, '--keep-going', '--resume');

  const idle = envelopeOf(lolly('rebrand', 'compile', decks, `--plan=${plans}`, `--out-dir=${out}`, '--keep-going', '--resume', '--json'));
  assert.equal(idle.result.summary.ran, 0, 'nothing changed, so nothing runs');

  // An edited plan is work.
  const planFile = join(plans, 'simple.plan.json');
  const plan = JSON.parse(readFileSync(planFile, 'utf8')) as { revision: number; slides: Array<{ include: boolean }> };
  plan.revision += 1;
  plan.slides[0]!.include = false;
  writeFileSync(planFile, JSON.stringify(plan, null, 2));
  const before = readFileSync(join(out, 'simple.lolly'));
  const edited = lolly('rebrand', 'compile', decks, `--plan=${plans}`, `--out-dir=${out}`, '--keep-going', '--resume', '--json');
  const editedEnv = envelopeOf(edited);
  assert.deepEqual(editedEnv.result.files.filter((file) => !file.skipped).map((file) => base(file.input)), ['simple.pptx'], edited.stderr);
  assert.ok(!editedEnv.result.files.find((file) => base(file.input) === 'simple.pptx')?.error, 'the edited plan compiled');
  assert.notDeepEqual(readFileSync(join(out, 'simple.lolly')), before, 'the document follows the edited plan');

  // Other options are work too, and the output they ask for is written.
  const exported = lolly('rebrand', 'compile', decks, `--plan=${plans}`, `--out-dir=${out}`, '--keep-going', '--resume', '--export=pptx', '--json');
  const exportedEnv = envelopeOf(exported);
  assert.deepEqual(exportedEnv.result.files.filter((file) => !file.skipped).map((file) => base(file.input)), [...DECKS], exported.stderr);
  for (const deck of DECKS) assert.ok(existsSync(join(out, deck.replace(/\.pptx$/, '.rebranded.pptx'))), `${deck} has its pptx`);

  // Without --plan the first pass is other work than the plan was, so a deck that
  // failed on its plan runs again.
  copyFileSync(join(plans, 'palette.plan.json'), join(plans, 'adversarial.plan.json'));
  const mismatch = envelopeOf(lolly('rebrand', 'compile', decks, `--plan=${plans}`, `--out-dir=${out}`, '--keep-going', '--resume', '--export=pptx', '--json'));
  assert.equal(mismatch.result.files.find((file) => base(file.input) === 'adversarial.pptx')?.error?.code, 'plan.hash-mismatch');
  const firstPass = envelopeOf(lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--resume', '--export=pptx', '--json'));
  const adversarial = firstPass.result.files.find((file) => base(file.input) === 'adversarial.pptx');
  assert.ok(adversarial && !adversarial.skipped && !adversarial.error, `the first pass ran: ${JSON.stringify(adversarial)}`);
});

test('a deck keeps its own outputs when its bytes change, fail, and come back', () => {
  const dir = folder();
  const decks = join(dir, 'decks');
  const out = join(dir, 'out');
  lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--resume');
  writeFileSync(join(decks, 'simple.pptx'), 'broken now');
  const failed = envelopeOf(lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--resume', '--json'));
  assert.equal(failed.result.files.find((file) => base(file.input) === 'simple.pptx')?.error?.code, 'source.unreadable');
  const entry = recordOf(out).find((one) => base(one.input) === 'simple.pptx');
  assert.deepEqual(entry?.outputs.map(base).sort(), ['simple.lolly', 'simple.report.json'], 'the record lists the outputs still on disk');

  copyFileSync(join(FIXTURES, 'simple.pptx'), join(decks, 'simple.pptx'));
  const back = lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--keep-going', '--resume', '--json');
  const simple = envelopeOf(back).result.files.find((file) => base(file.input) === 'simple.pptx');
  assert.ok(simple && simple.written === true && !simple.error, `its own outputs are replaced, not refused: ${JSON.stringify(simple?.error)}`);
});

test('--resume on a first run runs every deck, and a missing one is source.missing', () => {
  const dir = folder();
  const decks = join(dir, 'decks');
  const run = lolly('rebrand', 'compile', join(decks, 'simple.pptx'), join(decks, 'typo.pptx'), `--out-dir=${join(dir, 'out')}`, '--keep-going', '--resume', '--json');
  assert.equal(run.status, 2, run.stderr);
  const env = envelopeOf(run);
  assert.equal(env.result.summary.skipped, 0);
  const typo = env.result.files.find((file) => base(file.input) === 'typo.pptx');
  assert.equal(typo?.error?.code, 'source.missing');
  assert.notEqual(typo?.skipped, true);
});

test('with --jobs=2 and no --keep-going, the decks after a failure are not written', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-rebrand-order-'));
  const decks = join(dir, 'decks');
  for (const [sub, deck] of [['a', 'adversarial.pptx'], ['b', 'simple.pptx'], ['c', 'palette.pptx'], ['d', 'simple.pptx']] as const) {
    mkdirSync(join(decks, sub), { recursive: true });
    copyFileSync(join(FIXTURES, deck), join(decks, sub, deck));
  }
  const results = [1, 2].map((jobs) => {
    const out = join(dir, `out${jobs}`);
    mkdirSync(out);
    // A file where the first deck's folder goes, so that deck fails only when it writes.
    writeFileSync(join(out, 'a'), 'in the way');
    const env = envelopeOf(lolly('rebrand', 'compile', decks, `--out-dir=${out}`, '--recursive', `--jobs=${jobs}`, '--json'));
    return { env, written: readdirSync(out).filter((name) => name !== 'a' && !name.startsWith('.')).sort() };
  });
  const [one, two] = results as [typeof results[0], typeof results[0]];
  assert.deepEqual(one.env.result.files.map((file) => [base(file.input), file.error?.code]), [['adversarial.pptx', 'output.unwritable']]);
  assert.deepEqual(two.env.result.files.map(comparable), one.env.result.files.map(comparable));
  assert.deepEqual(two.env.result.notAttempted.map(base), one.env.result.notAttempted.map(base));
  assert.deepEqual(two.written, one.written, 'no deck after the failure wrote anything');
  assert.deepEqual(one.written, []);
});

test('a write that fails part-way puts back the files it replaced', () => {
  const dir = folder();
  const deck = join(dir, 'decks', 'simple.pptx');
  const out = join(dir, 'out');
  const first = lolly('rebrand', 'compile', deck, `--out-dir=${out}`);
  assert.ok(first.status === 0 || first.status === 5, first.stderr);
  const report = readFileSync(join(out, 'simple.report.json'));
  const document = readFileSync(join(out, 'simple.lolly'));
  // A folder where the pptx goes, so the last output of the group cannot be written.
  mkdirSync(join(out, 'simple.rebranded.pptx'));
  const run = lolly('rebrand', 'compile', deck, `--out-dir=${out}`, '--export=pptx', '--force', '--json');
  assert.equal(envelopeOf(run).result.files[0]?.error?.code, 'output.unwritable', run.stderr);
  assert.deepEqual(readFileSync(join(out, 'simple.report.json')), report, 'the report is the earlier one');
  assert.deepEqual(readFileSync(join(out, 'simple.lolly')), document, 'the document is the earlier one');
  assert.deepEqual(readdirSync(out).filter((name) => name.startsWith('.')), [], 'no temp or backup file is left');
});

test('a preset is checked on every path, and refused beside --plan', () => {
  const dir = folder();
  const decks = join(dir, 'decks');
  const plans = join(dir, 'plans');
  lolly('rebrand', 'plan', join(decks, 'simple.pptx'), `--plan-out=${plans}/`);
  const inspect = lolly('rebrand', 'inspect', join(plans, 'simple.plan.json'), `--source=${join(decks, 'simple.pptx')}`, '--preset=does-not-exist', '--json');
  assert.equal(inspect.status, 2, inspect.stderr);
  assert.equal(envelopeOf(inspect).error?.kind, 'PRESET_UNKNOWN');

  const both = lolly('rebrand', 'compile', join(decks, 'simple.pptx'), `--plan=${join(plans, 'simple.plan.json')}`, '--preset=tidy', '--dry-run', '--json');
  assert.equal(both.status, 2, both.stderr);
  assert.equal(envelopeOf(both).error?.kind, 'CONFLICTING_FLAGS');
});

test('every rebrand flag that takes a value refuses its bare form', () => {
  const deck = join(FIXTURES, 'simple.pptx');
  for (const flag of ['out-dir', 'jobs', 'export', 'limit']) {
    const run = lolly('rebrand', 'compile', deck, `--${flag}`, '--dry-run', '--json');
    assert.equal(run.status, 2, `--${flag}: ${run.stderr}`);
    assert.equal(envelopeOf(run).error?.kind, 'MISSING_FLAG_VALUE', `--${flag}`);
  }
});

test('a folder plan with --auto-match counts per file, and --resume runs the decks again when the band changes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-rebrand-auto-'));
  const decks = join(dir, 'decks');
  mkdirSync(decks);
  for (const deck of ['simple.pptx', 'structures.pptx']) copyFileSync(join(FIXTURES, deck), join(decks, deck));
  const plans = join(dir, 'plans');
  const first = envelopeOf(lolly('rebrand', 'plan', decks, `--plan-out=${plans}`, '--auto-match=clear', '--json'));
  const counted = first.result.files.map((file) => [base(file.input), (file as FileRecord & { autoMatched?: { total: number } }).autoMatched?.total]);
  // The first pass already set every clear read as a proposal, so Auto-match changes none of them.
  assert.deepEqual(counted.find(([name]) => name === 'structures.pptx'), ['structures.pptx', 0]);
  assert.equal(typeof counted.find(([name]) => name === 'simple.pptx')?.[1], 'number', 'every file carries its count, none included');

  const same = envelopeOf(lolly('rebrand', 'plan', decks, `--plan-out=${plans}`, '--auto-match=clear', '--resume', '--json'));
  assert.equal(same.result.summary.skipped, 2, 'the same options leave finished decks alone');
  const wider = envelopeOf(lolly('rebrand', 'plan', decks, `--plan-out=${plans}`, '--auto-match=all', '--resume', '--force', '--json'));
  assert.equal(wider.result.summary.skipped, 0, 'another band is another run');
});
