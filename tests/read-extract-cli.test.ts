// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly read --extract` (plan 203, rank 10): the bounded extract on the command
 * line, over the labelled fixtures in tests/fixtures/read-extract. The extract
 * itself is tested in read-extract.test.ts and read-extract-fixtures.test.ts;
 * this file covers the flags, the outputs and the refusals.
 *
 * Run with: node --test tests/read-extract-cli.test.ts
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import type { ReadExtractV1 } from '../packages/core/src/read-extract-v1.ts';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LOLLY = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');
const FIXTURES = join(REPO, 'tests', 'fixtures', 'read-extract');
const PDF = join(FIXTURES, 'multilingual.pdf');
const SCAN = join(FIXTURES, 'scan.pdf');

const schema = JSON.parse(readFileSync(join(REPO, 'schemas', 'read-extract-v1.schema.json'), 'utf8')) as object;
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

interface Run { status: number | null; stdout: string; stderr: string }

function lolly(args: string[], env: Record<string, string> = {}): Run {
  const out = spawnSync(process.execPath, [LOLLY, ...args], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', NO_COLOR: '1', ...env },
  });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

interface Envelope { command: string; ok: boolean; result: ReadExtractV1 | null; error: { kind: string; exit: number } | null }

const envelopeOf = (run: Run): Envelope => {
  assert.ok(run.stdout.trim().startsWith('{'), `expected a JSON envelope, got: ${run.stdout.slice(0, 200)} / ${run.stderr.slice(0, 400)}`);
  return JSON.parse(run.stdout) as Envelope;
};

test('--extract --json returns a ReadExtractV1, and --max-chars with --from reads it in steps', () => {
  const whole = lolly(['read', PDF, '--extract', '--json']);
  assert.equal(whole.status, 0, whole.stderr);
  const all = envelopeOf(whole).result!;
  assert.ok(validate(all), JSON.stringify(validate.errors?.slice(0, 3)));
  assert.equal(all.source.name, 'multilingual.pdf');
  assert.equal(all.complete, true);

  const first = envelopeOf(lolly(['read', PDF, '--extract', '--json', '--max-chars=120'])).result!;
  assert.equal(first.complete, false);
  assert.ok(first.chars <= 120);
  const rest = envelopeOf(lolly(['read', PDF, '--extract', '--json', `--from=${first.next}`])).result!;
  assert.deepEqual([...first.blocks, ...rest.blocks].map((b) => b.id), all.blocks.map((b) => b.id), 'the two steps together are the whole extract');
});

test('--extract writes plain text or Markdown, with a summary on standard error', () => {
  const text = lolly(['read', PDF, '--extract', '--pages=2']);
  assert.equal(text.status, 0, text.stderr);
  assert.ok(text.stdout.startsWith('Page 2\n\nAccents et Umlaute\n\nÉvaluer la qualité, page après page.'));
  assert.ok(!text.stdout.includes('Page 1'), 'only the page asked for');
  assert.match(text.stderr, /Extracted 5 blocks \(\d+ characters\) from page 2 of multilingual\.pdf\./);

  const md = lolly(['read', PDF, '--extract', '--markdown', '--pages=3']);
  assert.equal(md.status, 0, md.stderr);
  assert.ok(md.stdout.startsWith('# multilingual.pdf\n\n## Page 3\n\nA SEARCHABLE SCAN  \nITS WORDS ARE AN INVISIBLE LAYER\n\n*(from the scan text layer)*'));

  const stopped = lolly(['read', PDF, '--extract', '--max-chars=40']);
  assert.match(stopped.stderr, /Stopped at the budget: continue with --from=p1\.\d+\./);
});

test('--ocr without the model on this machine downloads nothing, says so and leaves the scans unread', () => {
  // A folder that exists and holds no ocr family: the runner finds no model there.
  const run = lolly(['read', SCAN, '--extract', '--ocr', '--json'], { LOLLY_MODELS_DIR: FIXTURES });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /cannot be read here/);
  const extract = envelopeOf(run).result!;
  assert.deepEqual(extract.pages.map((p) => p.read), ['not-read', 'not-read']);
});

test('the extract flags are refused without --extract, bare, or with values the file does not have', () => {
  const cases: Array<[string[], string]> = [
    [['--pages=2'], 'MISSING_ARGUMENT'],
    [['--markdown'], 'MISSING_ARGUMENT'],
    [['--extract', '--pages'], 'MISSING_FLAG_VALUE'],
    [['--extract', '--pages=9'], 'PAGES_OUTSIDE'],
    [['--extract', '--pages=two'], 'PAGES_INVALID'],
    [['--extract', '--max-chars=lots'], 'BAD_FLAG_VALUE'],
    [['--extract', '--from=later'], 'FROM_INVALID'],
    [['--extract', '--markdown'], 'CONFLICTING_FLAGS'],
  ];
  for (const [flags, kind] of cases) {
    const run = lolly(['read', PDF, ...flags, '--json']);
    assert.equal(run.status, 2, `${flags.join(' ')} exits 2`);
    assert.equal(envelopeOf(run).error?.kind, kind, `${flags.join(' ')} is ${kind}`);
  }
});
