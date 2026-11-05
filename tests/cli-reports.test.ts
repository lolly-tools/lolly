// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { reportCases, junitReport, sarifReport } from '../shells/cli/src/reports.ts';

const envelope = (result: unknown, ok = true) => ({
  schemaVersion: 1,
  command: 'check',
  ok,
  result,
  warnings: [],
  error: null,
});
const fixture = envelope(
  {
    findings: [
      {
        code: 'brand.color',
        severity: 'error',
        message: 'Colour <needs> & "review"',
        path: '/boxes/0/fill',
        layerId: 'hero',
      },
      { code: 'text.review', severity: 'warn', message: 'Read the caption.' },
    ],
    families: { render: { state: 'unavailable', reason: 'No paint tier.' } },
  },
  false
);

test('adapters preserve failed findings, unavailable coverage and document locations', () => {
  const cases = reportCases(fixture);
  assert.equal(cases.filter((item) => item.state === 'failed').length, 1);
  assert.equal(cases.filter((item) => item.state === 'skipped').length, 1);
  const xml = new JSDOM(junitReport(cases), { contentType: 'application/xml' });
  try {
    assert.equal(xml.window.document.querySelector('testsuite')?.getAttribute('failures'), '1');
    assert.equal(
      xml.window.document.querySelector('failure')?.textContent,
      'Colour <needs> & "review"\n{"path":"/boxes/0/fill","layerId":"hero"}'
    );
  } finally {
    xml.window.close();
  }
  const sarif = sarifReport(cases);
  const results = (
    sarif.runs as Array<{
      results: Array<{ properties: Record<string, unknown>; locations?: unknown }>;
    }>
  )[0]!.results;
  assert.equal(results[0]!.properties.path, '/boxes/0/fill');
  assert.equal(
    results[0]!.locations,
    undefined,
    'JSON pointers must not become invented source lines'
  );
  assert.deepEqual(sarifReport(cases), sarif);
});

test('unknown and malformed reports refuse, and a negative outcome cannot turn into a green suite', () => {
  assert.throws(() => reportCases({ tools: [] }), /not a check report/);
  assert.throws(
    () => reportCases(envelope({ findings: [{ message: 'Missing severity' }] })),
    /severity/
  );
  assert.throws(() => reportCases({ schemaVersion: 99 }), /envelope/);
  assert.equal(reportCases(envelope({ findings: [] }, false))[0]!.state, 'failed');
  const rows = reportCases({
    rows: [
      { row: 1, ok: true, report: { findings: [] } },
      { row: 2, ok: false, error: 'Missing input' },
    ],
  });
  assert.equal(rows[0]!.suite, 'lolly.row-1');
  assert.equal(rows[1]!.state, 'failed');
  const learning = reportCases({
    findings: [
      { severity: 'warn', message: 'First lesson' },
      { severity: 'warn', message: 'Second lesson' },
    ],
  });
  assert.notEqual(learning[0]!.rule, learning[1]!.rule);
  const preflight = reportCases({
    findings: [
      {
        id: 'refuse.output-file-size',
        severity: 'info',
        needs: 'not-computable',
        message: 'Lolly cannot predict the output file size.',
      },
    ],
  });
  assert.equal(preflight[0]!.state, 'skipped');
});

test('report command handles stdin JSONL, exclusive private output and JSON error envelopes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-reports-test-'));
  const entry = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
  try {
    const child = spawn(
      process.execPath,
      [entry, 'reports', '-', '--input-format=jsonl', '--to=jsonl'],
      { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.resume();
    child.stdin.end(
      [fixture, envelope({ findings: [] })].map((value) => JSON.stringify(value)).join('\n')
    );
    assert.equal(await new Promise((resolve) => child.once('exit', resolve)), 0);
    assert.equal(
      stdout
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)).length,
      4
    );
    const source = join(dir, 'source.json'),
      output = join(dir, 'checks.xml');
    await writeFile(source, JSON.stringify(fixture));
    const run = promisify(execFile);
    const result = await run(
      process.execPath,
      [entry, 'reports', source, '--to=junit', `--output=${output}`, '--json'],
      { cwd: dir }
    );
    assert.equal(JSON.parse(result.stdout).result.failures, 1);
    const original = await readFile(output, 'utf8');
    await assert.rejects(
      run(process.execPath, [entry, 'reports', source, '--to=junit', `--output=${output}`], {
        cwd: dir,
      })
    );
    assert.equal(await readFile(output, 'utf8'), original);
    await assert.rejects(
      run(process.execPath, [entry, 'reports', source, '--to=unknown', '--json'], { cwd: dir }),
      (error: Error & { stdout?: string }) => {
        assert.equal(JSON.parse(error.stdout ?? '{}').command, 'reports');
        return true;
      }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
