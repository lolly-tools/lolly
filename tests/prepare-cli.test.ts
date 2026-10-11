// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { storeZip } from '../engine/src/zip.ts';
const run = promisify(execFile);
const cli = new URL('../shells/cli/bin/lolly.ts', import.meta.url).pathname;
test('CLI replace-all keeps read-only Office findings and never proposes unsupported edits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-office-'));
  try {
    const bytes = storeZip(['[Content_Types].xml', 'word/document.xml', 'docProps/core.xml'].map((name, i) => ({ name, bytes: new TextEncoder().encode(i === 2 ? '<props><creator>Private Office Author</creator></props>' : '<root/>') })));
    const input = join(dir, 'input.docx'), output = join(dir, 'copy.docx'), review = join(dir, 'private.json');
    await writeFile(input, bytes);
    const result = await run(process.execPath, [cli, 'prepare', input, '--replace-all', `--output=${output}`, `--review-file=${review}`]);
    const report = JSON.parse(result.stdout); assert.equal(report.replaced, 0); assert(report.remaining > 0);
    assert(!result.stdout.includes('Private Office Author')); assert.deepEqual(await readFile(output), Buffer.from(bytes));
    const envelope = JSON.parse(await readFile(review, 'utf8')); assert.deepEqual(envelope.choices, []); assert(envelope.inspection.findings.every((f: { readOnly?: boolean }) => f.readOnly));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('CLI default report is advisory and value-free; explicit private review binds edits to source bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-prepare-'));
  try {
    const input = join(dir, 'input.txt'), review = join(dir, 'private.json'), output = join(dir, 'prepared.txt');
    await writeFile(input, 'password=secret-for-this-test');
    const json = JSON.parse((await run(process.execPath, [cli, 'prepare', input, '--json'])).stdout);
    assert.equal(json.command, 'prepare'); assert.equal(json.ok, true); assert(json.result.remaining > 0);
    const first = await run(process.execPath, [cli, 'prepare', input, `--review-file=${review}`]);
    const report = JSON.parse(first.stdout);
    assert(report.remaining > 0); assert(!first.stdout.includes('secret-for-this-test'));
    assert.equal((await stat(review)).mode & 0o777, 0o600);
    const envelope = JSON.parse(await readFile(review, 'utf8')); envelope.choices[0].replacement = 'replacement'; await writeFile(review, JSON.stringify(envelope));
    await run(process.execPath, [cli, 'prepare', input, `--choices=${review}`, `--output=${output}`]);
    assert.equal(await readFile(output, 'utf8'), 'password=replacement');
    assert.equal(await readFile(input, 'utf8'), 'password=secret-for-this-test');
    await writeFile(input, 'password=a-different-secret');
    await assert.rejects(run(process.execPath, [cli, 'prepare', input, `--choices=${review}`, `--output=${output}-stale`]), error => {
      const e = error as Error & { code: number; stderr: string }; assert.equal(e.code, 1); assert(!e.stderr.includes('a-different-secret')); return true;
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('CLI mixed delivery preserves successful files and reports a processing failure separately from findings', async () => {
  const { savePreparationCopies } = await import('../shells/cli/src/prepare.ts');
  const { inspectPreparation, applyPreparation } = await import('../engine/src/prepare.ts');
  const dir = await mkdtemp(join(tmpdir(), 'lolly-prepare-delivery-'));
  try {
    const sources = ['first', 'second'].map((value, i) => ({ id: `file${i}`, name: 'same.txt', bytes: new TextEncoder().encode(value) }));
    const result = await applyPreparation(sources, await inspectPreparation(sources), []);
    await writeFile(join(dir, 'file0-same.txt'), 'existing');
    const delivery = await savePreparationCopies(result, dir);
    assert.deepEqual(delivery.map(d => d.saved), [false, true]);
    assert.equal(await readFile(join(dir, 'file0-same.txt'), 'utf8'), 'existing');
    assert.equal(await readFile(join(dir, 'file1-same.txt'), 'utf8'), 'second');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
