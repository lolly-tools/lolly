// SPDX-License-Identifier: MPL-2.0
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { terminalContent } from './helpers/terminal-content.ts';

const root = await mkdtemp(join(tmpdir(), 'lolly-production-test-'));
after(() => rm(root, { recursive: true, force: true }));
await terminalContent(root);
const entry = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
const env = { ...process.env, LOLLY_ROOT: root, LOLLY_STATE_DIR: join(root, 'state') };
const csv = join(root, 'rows.csv'),
  output = join(root, 'out');
const rows = (label = 'Alpha') =>
  `toolId,format,filename,label,input.width\nbatch-fixture,svg,first,${label},7\nbatch-fixture,svg,second,Beta,9\n`;
await writeFile(csv, rows());
const exec = promisify(execFile);
async function run(flags: string[] = []) {
  const result = await exec(
    process.execPath,
    [entry, 'batch', csv, `--out-dir=${output}`, '--json', ...flags],
    { env, timeout: 45000 }
  );
  return JSON.parse(result.stdout) as {
    result: {
      jobs: Array<{ outputPattern: string }>;
      planId: string;
      summary: { rendered: number; reused: number; checked: number };
      rows: Array<{ output?: string }>;
    };
  };
}

test('production plans, isolated renders, verified resume, invalidation and preflight', async () => {
  const dry = await run(['--dry-run']);
  assert.ok(!existsSync(output), 'dry run must not create an output directory');
  assert.match(dry.result.jobs[0]!.outputPattern, /01-first\.svg$/);
  const first = await run(['--jobs=2']);
  assert.equal(first.result.summary.rendered, 2);
  assert.match(await readFile(join(output, '01-first.svg'), 'utf8'), /width="7"/);
  assert.match(await readFile(join(output, '01-first.svg'), 'utf8'), /Alpha/);
  assert.equal((await run(['--resume'])).result.summary.reused, 2);
  await writeFile(join(output, '01-first.svg'), 'changed outside Lolly');
  const edited = await run(['--resume']);
  assert.equal(edited.result.summary.rendered, 1);
  assert.equal(edited.result.summary.reused, 1);
  await writeFile(csv, rows('Changed'));
  const changed = await run(['--resume']);
  assert.equal(changed.result.summary.rendered, 1);
  assert.equal(changed.result.summary.reused, 1);
  await assert.rejects(
    run([`--expect-plan=${dry.result.planId}`]),
    (error: Error & { code?: number; stdout?: string }) => {
      assert.equal(error.code, 2);
      assert.equal(JSON.parse(error.stdout ?? '{}').error.kind, 'PLAN_CHANGED');
      return true;
    }
  );
  await writeFile(
    join(root, 'catalog/assets/unindexed.txt'),
    'actual bytes invalidate even a stale index'
  );
  assert.equal((await run(['--resume'])).result.summary.rendered, 2);
  const checked = await run(['--preflight', '--jobs=2']);
  assert.equal(checked.result.summary.checked, 2);
  assert.equal(checked.result.summary.rendered, 0);
  await writeFile(
    join(output, '.lolly-batch.json'),
    JSON.stringify({ version: 1, rows: 'invalid' })
  );
  assert.equal((await run(['--resume'])).result.summary.rendered, 2);
  await writeFile(join(output, '.lolly-batch.lock'), String(process.pid));
  await assert.rejects(run(['--resume']), (error: Error & { stdout?: string }) => {
    assert.equal(JSON.parse(error.stdout ?? '{}').error.kind, 'BATCH_BUSY');
    return true;
  });
  assert.equal(await readFile(join(output, '.lolly-batch.lock'), 'utf8'), String(process.pid));
  await writeFile(join(output, '.lolly-batch.lock'), '999999999');
  assert.equal((await run(['--resume'])).result.summary.reused, 2);
  assert.ok(!(await readdir(output)).some((name) => name.startsWith('.lolly-batch-')));
  assert.ok(!existsSync(join(output, '.lolly-batch.lock')));
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate: () => boolean | Promise<boolean>, timeout = 20000): Promise<void> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error('Timed out waiting for the batch');
}

test('watch debounces source changes, ignores output changes and stops on a signal', async () => {
  const child = spawn(
    process.execPath,
    [entry, 'batch', csv, '--watch', '--jobs=2', `--out-dir=${output}`],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let stderr = '';
  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });
  child.stdout.resume();
  const finished = new Promise<number | null>((resolve) =>
    child.once('exit', (code) => resolve(code))
  );
  try {
    await until(() => stderr.includes('Watching the CSV'));
    await writeFile(join(output, '01-first.svg'), 'output changes alone do not retrigger');
    await delay(600);
    assert.equal(stderr.match(/Watching the CSV/g)?.length, 1);
    await writeFile(csv, rows('Watched'));
    await until(() => (stderr.match(/Watching the CSV/g)?.length ?? 0) >= 2);
    assert.match(await readFile(join(output, '01-first.svg'), 'utf8'), /Watched/);
    await writeFile(csv, 'invalid header\n');
    await until(() => stderr.includes('Batch source error:'));
    await writeFile(csv, rows('Recovered'));
    await until(() => (stderr.match(/Watching the CSV/g)?.length ?? 0) >= 3);
    assert.match(await readFile(join(output, '01-first.svg'), 'utf8'), /Recovered/);
    child.kill('SIGINT');
    assert.equal(await finished, 130);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await finished;
    }
  }
});

test('watch is listening before it says it is waiting', async () => {
  // A change made the moment the line appears must be seen, so the watchers have to
  // exist by then. Before, the line came first and a quick change could be missed.
  const order = join(root, 'watch-order.log'), out = join(root, 'watch-order');
  await writeFile(csv, rows('Ordered'));
  const preload = fileURLToPath(new URL('./helpers/watch-order-preload.ts', import.meta.url));
  const child = spawn(
    process.execPath,
    ['--import', preload, entry, 'batch', csv, '--watch', '--jobs=1', `--out-dir=${out}`],
    { env: { ...env, LOLLY_WATCH_ORDER_LOG: order }, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let stderr = '';
  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });
  child.stdout.resume();
  const finished = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  try {
    await until(() => stderr.includes('Watching the CSV'));
    await writeFile(csv, 'invalid header\n');
    await until(() => stderr.includes('Batch source error:'));
    child.kill('SIGINT');
    await finished;
    const counts = (await readFile(order, 'utf8')).trim().split('\n').map(Number);
    assert.equal(counts.length, 2, 'one count for each waiting line');
    assert.ok(counts.every((n) => n > 0), `watchers open when each line was written: ${counts.join(', ')}`);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await finished;
    }
    await writeFile(csv, rows());
  }
});

test('cancelling active workers writes a resumable receipt and clears staging and locks', async () => {
  const slow = join(root, 'slow.csv'),
    out = join(root, 'cancelled');
  await writeFile(slow, 'toolId,format\nslow-fixture,svg\n');
  const child = spawn(
    process.execPath,
    [entry, 'batch', slow, '--jobs=1', `--out-dir=${out}`, '--json'],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let stdout = '';
  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });
  child.stderr.resume();
  const finished = new Promise<number | null>((resolve) =>
    child.once('exit', (code) => resolve(code))
  );
  try {
    await until(
      async () =>
        existsSync(out) && (await readdir(out)).some((name) => name.startsWith('.lolly-batch-'))
    );
    child.kill('SIGTERM');
    assert.equal(await finished, 143);
    const receipt = JSON.parse(await readFile(join(out, '.lolly-batch.json'), 'utf8'));
    assert.equal(receipt.cancelled, true);
    assert.equal(JSON.parse(stdout).result.summary.aborted, true);
    assert.ok(!(await readdir(out)).some((name) => name.startsWith('.lolly-batch-')));
    assert.ok(!existsSync(join(out, '.lolly-batch.lock')));
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await finished;
    }
  }
});
