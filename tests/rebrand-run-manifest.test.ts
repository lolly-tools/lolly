// SPDX-License-Identifier: MPL-2.0
/**
 * The folder-run manifest (plan 274 section 5, work package 0b):
 * packages/node-shell/src/rebrand-run-manifest.ts.
 *
 * A bulk `lolly rebrand` over a folder is interrupted often enough that resume is
 * part of the contract, so this file pins the answers a second run depends on:
 *
 *   - every input is listed with its content hash, an outcome, a checkpoint stage
 *     and its output paths, and the file is valid JSON after every write;
 *   - resume offers the pending files and the failures a rerun could clear, and
 *     leaves a needs-review file and a permanent failure alone;
 *   - an input whose bytes changed between runs restarts from ingest with its
 *     recorded outputs dropped;
 *   - a finished output never replaces an existing file: the collision takes a
 *     numeric suffix and the entry records both names, unless the caller asked
 *     for an overwrite, and outputs written together take one name each;
 *   - the retryable and permanent error codes together cover the contract, so a
 *     run that failed on a missing master is offered again once it is there;
 *   - a manifest this version cannot read is moved aside, not written over.
 *
 * Temp directories, an injected clock, no timers.
 *
 * Run with: node --test "tests/rebrand-run-manifest.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FILE_OUTCOMES, REBRAND_ERROR_CODES } from '@lolly-tools/core';
import { nodeRebrandFs, type RebrandFsV1 } from '../packages/node-shell/src/rebrand-project-store.ts';
import {
  RUN_MANIFEST_FILE,
  RUN_OUTCOMES,
  RUN_PERMANENT_ERROR_CODES,
  RUN_RETRYABLE_ERROR_CODES,
  createRunManifest,
  isRetryable,
  type RunManifestDocV1,
} from '../packages/node-shell/src/rebrand-run-manifest.ts';

function fixedClock(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `2026-09-23T11:00:${String(n % 60).padStart(2, '0')}.000Z`;
  };
}

/** A run directory with three input decks and an empty output directory. */
async function freshRun(): Promise<{ inDir: string; outDir: string; inputs: string[] }> {
  const inDir = await mkdtemp(join(tmpdir(), 'lolly-rebrand-in-'));
  const outDir = await mkdtemp(join(tmpdir(), 'lolly-rebrand-out-'));
  const inputs = ['one.pptx', 'two.pptx', 'three.pptx'].map(n => join(inDir, n));
  for (const [i, path] of inputs.entries()) await writeFile(path, `deck ${i}`);
  return { inDir, outDir, inputs };
}

async function readDoc(outDir: string): Promise<RunManifestDocV1> {
  return JSON.parse(await readFile(join(outDir, RUN_MANIFEST_FILE), 'utf8')) as RunManifestDocV1;
}

test('the four run outcomes are the contract three plus pending', () => {
  assert.deepEqual([...RUN_OUTCOMES], ['pending', ...FILE_OUTCOMES]);
});

test('create lists every input with its hash, pending, at ingest', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });

  assert.equal(manifest.path, join(outDir, RUN_MANIFEST_FILE));
  const doc = await readDoc(outDir);
  assert.equal(doc.version, 1);
  assert.equal(doc.files.length, 3);
  for (const entry of doc.files) {
    assert.equal(entry.outcome, 'pending');
    assert.equal(entry.stage, 'ingest');
    assert.deepEqual(entry.outputs, []);
    assert.match(entry.hash, /^sha256:[0-9a-f]{64}$/);
  }
  // Distinct bytes, distinct hashes.
  assert.equal(new Set(doc.files.map(f => f.hash)).size, 3);

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('an input that cannot be read is recorded as a failure with a stable code', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const missing = join(inDir, 'gone.pptx');
  const manifest = await createRunManifest(outDir, { inputs: [...inputs, missing], now: fixedClock() });

  const entry = manifest.file(missing);
  assert.equal(entry?.outcome, 'failed');
  assert.equal(entry?.errorCode, 'source.unreadable');
  assert.equal(entry?.hash, '');
  assert.equal(isRetryable(entry!), false);

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('markOutcome persists the outcome, stage, outputs and error code', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one, two, three] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });

  const ready = await manifest.markOutcome(one, { outcome: 'ready', stage: 'done', outputs: [join(outDir, 'one.lolly')] });
  assert.equal(ready?.outcome, 'ready');
  assert.equal(ready?.stage, 'done');
  assert.equal(typeof ready?.at, 'string');

  await manifest.markOutcome(two, { outcome: 'failed', stage: 'compile', errorCode: 'export.failed', message: 'The export did not finish.' });
  await manifest.markOutcome(three, { outcome: 'needs-review', stage: 'review' });
  assert.equal(await manifest.markOutcome(join(inDir, 'not-in-the-run.pptx'), { outcome: 'ready' }), null);

  const doc = await readDoc(outDir);
  const byInput = new Map(doc.files.map(f => [f.input, f]));
  assert.equal(byInput.get(one)?.outcome, 'ready');
  assert.deepEqual(byInput.get(one)?.outputs, [join(outDir, 'one.lolly')]);
  assert.equal(byInput.get(two)?.errorCode, 'export.failed');
  assert.equal(byInput.get(three)?.outcome, 'needs-review');

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('resume after a partial run offers the pending and the retryable, not the finished or the reviewed', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one, two, three] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });

  await manifest.markOutcome(one, { outcome: 'ready', stage: 'done' });
  await manifest.markOutcome(two, { outcome: 'failed', stage: 'compile', errorCode: 'storage.quota' });
  await manifest.markOutcome(three, { outcome: 'needs-review', stage: 'review' });

  assert.deepEqual((await manifest.resume()).map(f => f.input), [two]);

  // A failure in the input itself repeats on a rerun, so it is not offered again.
  await manifest.markOutcome(two, { outcome: 'failed', stage: 'ingest', errorCode: 'source.encrypted' });
  assert.deepEqual(await manifest.resume(), []);

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('a changed input restarts from ingest and drops what was recorded against the old bytes', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });
  const firstHash = manifest.file(one)?.hash;

  await manifest.markOutcome(one, { outcome: 'ready', stage: 'done', outputs: [join(outDir, 'one.lolly')] });
  await writeFile(one, 'the deck was edited between two runs');

  const pending = await manifest.resume();
  const restarted = pending.find(f => f.input === one);
  assert.equal(restarted?.outcome, 'pending');
  assert.equal(restarted?.stage, 'ingest');
  assert.deepEqual(restarted?.outputs, []);
  assert.notEqual(restarted?.hash, firstHash);

  // The reset is on disk, not only in memory.
  const doc = await readDoc(outDir);
  assert.equal(doc.files.find(f => f.input === one)?.outcome, 'pending');

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('reopening the manifest keeps unchanged work and restarts changed inputs', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one, two] = inputs as [string, string, string];
  const first = await createRunManifest(outDir, { inputs, now: fixedClock() });
  await first.markOutcome(one, { outcome: 'ready', stage: 'done', outputs: [join(outDir, 'one.lolly')] });
  await first.markOutcome(two, { outcome: 'needs-review', stage: 'review' });
  await writeFile(two, 'edited after the first run');

  const second = await createRunManifest(outDir, { inputs, now: fixedClock() });
  assert.equal(second.file(one)?.outcome, 'ready');
  assert.deepEqual(second.file(one)?.outputs, [join(outDir, 'one.lolly')]);
  assert.equal(second.file(two)?.outcome, 'pending');
  assert.equal(second.file(two)?.stage, 'ingest');
  assert.equal((await readDoc(outDir)).createdAt, '2026-09-23T11:00:01.000Z');

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('an output never replaces an existing file: the collision takes a numeric suffix and is recorded', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one, two, three] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });

  const a = await manifest.writeOutput(one, 'renovated.pptx', 'first deck');
  assert.equal(a.path, join(outDir, 'renovated.pptx'));
  assert.equal(a.suffixed, false);
  assert.equal(a.overwritten, false);

  const b = await manifest.writeOutput(two, 'renovated.pptx', 'second deck');
  assert.equal(b.path, join(outDir, 'renovated-2.pptx'));
  assert.equal(b.suffixed, true);
  assert.equal(b.requested, join(outDir, 'renovated.pptx'));

  const c = await manifest.writeOutput(three, 'renovated.pptx', 'third deck');
  assert.equal(c.path, join(outDir, 'renovated-3.pptx'));

  assert.equal(await readFile(join(outDir, 'renovated.pptx'), 'utf8'), 'first deck');
  assert.equal(await readFile(join(outDir, 'renovated-2.pptx'), 'utf8'), 'second deck');

  const doc = await readDoc(outDir);
  const second = doc.files.find(f => f.input === two);
  assert.deepEqual(second?.outputs, [join(outDir, 'renovated-2.pptx')]);
  assert.deepEqual(second?.collisions, [{ requested: join(outDir, 'renovated.pptx'), written: join(outDir, 'renovated-2.pptx') }]);

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('overwrite is the caller stating the opposite intent, and a name outside the run directory is refused', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });

  await manifest.writeOutput(one, 'renovated.pptx', 'first deck');
  const again = await manifest.writeOutput(one, 'renovated.pptx', 'replacement', { overwrite: true });
  assert.equal(again.path, join(outDir, 'renovated.pptx'));
  assert.equal(again.overwritten, true);
  assert.equal(again.suffixed, false);
  assert.equal(await readFile(join(outDir, 'renovated.pptx'), 'utf8'), 'replacement');

  await assert.rejects(() => manifest.writeOutput(one, join('..', 'escape.pptx'), 'nope'));
  await assert.rejects(() => manifest.writeOutput(one, join(outDir, 'absolute.pptx'), 'nope'));

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('a rename that fails leaves the earlier output and the manifest as they were', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });
  await manifest.writeOutput(one, 'renovated.pptx', 'first deck');
  const before = await readDoc(outDir);

  // The manifest's own writes go through; the deck's rename is the one that fails.
  const crashing: RebrandFsV1 = {
    ...nodeRebrandFs,
    rename: async (from, to) => {
      if (to.endsWith('.pptx')) throw Object.assign(new Error('the machine stopped between the write and the rename'), { code: 'EIO' });
      return nodeRebrandFs.rename(from, to);
    },
  };
  const crashed = await createRunManifest(outDir, { inputs, now: fixedClock(), fs: crashing });
  await assert.rejects(() => crashed.writeOutput(one, 'renovated.pptx', 'second deck'));

  assert.equal(await readFile(join(outDir, 'renovated.pptx'), 'utf8'), 'first deck');
  const after = await readDoc(outDir);
  assert.deepEqual(after.files.map(f => f.input), before.files.map(f => f.input));
  assert.deepEqual(after.files.find(f => f.input === one)?.outputs, [join(outDir, 'renovated.pptx')]);

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('the retryable and permanent error codes together cover the contract, and a missing master is offered again', async () => {
  assert.deepEqual(
    [...RUN_PERMANENT_ERROR_CODES, ...RUN_RETRYABLE_ERROR_CODES].sort(),
    [...REBRAND_ERROR_CODES].sort(),
  );
  assert.deepEqual([...RUN_PERMANENT_ERROR_CODES], ['source.unreadable', 'source.encrypted', 'plan.hash-mismatch', 'plan.invalid']);

  const { inDir, outDir, inputs } = await freshRun();
  const [one, two] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });

  // The person adds the master and runs the folder again.
  await manifest.markOutcome(one, { outcome: 'failed', stage: 'plan', errorCode: 'design-system.master-missing' });
  await manifest.markOutcome(two, { outcome: 'failed', stage: 'ingest', errorCode: 'plan.hash-mismatch' });
  assert.deepEqual((await manifest.resume()).map(f => f.input).sort(), [one, inputs[2]].sort());

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('a manifest this version cannot read is moved aside rather than overwritten', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one] = inputs as [string, string, string];
  const first = await createRunManifest(outDir, { inputs, now: fixedClock() });
  assert.equal(first.setAside, null);
  await first.markOutcome(one, { outcome: 'ready', stage: 'done', outputs: [join(outDir, 'one.pptx')] });

  const before = await readFile(join(outDir, RUN_MANIFEST_FILE), 'utf8');
  await writeFile(join(outDir, RUN_MANIFEST_FILE), before.slice(0, 40));

  const second = await createRunManifest(outDir, { inputs, now: fixedClock() });
  assert.equal(typeof second.setAside, 'string');
  assert.equal(await readFile(second.setAside as string, 'utf8'), before.slice(0, 40));
  // The run starts over, but the record it could not read is still on disk.
  assert.equal(second.file(one)?.outcome, 'pending');

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('resume offers this run, not what an earlier run over other files left behind', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one, two] = inputs as [string, string, string];
  await createRunManifest(outDir, { inputs: [one], now: fixedClock() });

  const second = await createRunManifest(outDir, { inputs: [two], now: fixedClock() });
  assert.deepEqual((await second.resume()).map(f => f.input), [two]);
  // The earlier entry is still in the document for the summary.
  assert.deepEqual(second.doc().files.map(f => f.input).sort(), [one, two].sort());

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('finished decks written at the same time land on four files, each recorded', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const extra = join(inDir, 'four.pptx');
  await writeFile(extra, 'deck 3');
  const all = [...inputs, extra];
  const manifest = await createRunManifest(outDir, { inputs: all, now: fixedClock() });

  const written = await Promise.all(all.map((input, i) => manifest.writeOutput(input, 'renovated.pptx', `deck ${i}`)));
  const paths = written.map(w => w.path);
  assert.equal(new Set(paths).size, 4);
  assert.equal(written.filter(w => w.suffixed).length, 3);
  for (const [i, path] of paths.entries()) assert.equal(await readFile(path, 'utf8'), `deck ${i}`);

  const doc = await readDoc(outDir);
  const recorded = doc.files.flatMap(f => f.outputs);
  assert.deepEqual(recorded.sort(), [...paths].sort());

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('the run record is not an output name, and a stale failure sentence goes with the code', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });

  await assert.rejects(() => manifest.writeOutput(one, RUN_MANIFEST_FILE, 'nope'));
  assert.equal((await readDoc(outDir)).version, 1);

  await manifest.markOutcome(one, { outcome: 'failed', stage: 'compile', errorCode: 'export.failed', message: 'The export did not finish.' });
  const cleared = await manifest.markOutcome(one, { outcome: 'ready', stage: 'done' });
  assert.equal(cleared?.errorCode, undefined);
  assert.equal(cleared?.message, undefined);
  assert.equal((await readDoc(outDir)).files.find(f => f.input === one)?.message, undefined);

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('what doc and file hand back is a copy, down to the collisions', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const [one, two] = inputs as [string, string, string];
  const manifest = await createRunManifest(outDir, { inputs, now: fixedClock() });
  await manifest.writeOutput(one, 'renovated.pptx', 'first deck');
  await manifest.writeOutput(two, 'renovated.pptx', 'second deck');

  const entry = manifest.file(two);
  entry?.collisions?.splice(0);
  entry?.outputs.splice(0);
  const doc = manifest.doc();
  doc.files.find(f => f.input === two)?.collisions?.splice(0);

  assert.equal(manifest.file(two)?.collisions?.length, 1);
  assert.equal(manifest.file(two)?.outputs.length, 1);

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test('an input that is still unreadable is left as it is rather than restamped on every resume', async () => {
  const { inDir, outDir, inputs } = await freshRun();
  const missing = join(inDir, 'gone.pptx');
  const manifest = await createRunManifest(outDir, { inputs: [...inputs, missing], now: fixedClock() });
  const at = manifest.file(missing)?.at;

  await manifest.resume();
  await manifest.resume();
  assert.equal(manifest.file(missing)?.at, at);
  assert.equal(manifest.file(missing)?.errorCode, 'source.unreadable');

  await rm(inDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});
