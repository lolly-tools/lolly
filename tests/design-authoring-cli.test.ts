// SPDX-License-Identifier: MPL-2.0
/**
 * Design authoring keys on the command line (plan 291 W5): `lolly check`, `compile`,
 * `validate`, `measure --text-layers` and `run design --document` lower `$in`,
 * `$style`, `$points` and the macros to stored rows before they read the document,
 * and a key that cannot be lowered is named by its JSON pointer. Run as CI runs, on
 * the public lolly-start profile with an empty state directory; the drawn result is
 * covered by tests/design-authoring-run.browser.test.ts.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

const ROOT = new URL('..', import.meta.url);
const INPUT = new URL('./fixtures/author/input.json', import.meta.url).pathname;
const SCHEMA = JSON.parse(readFileSync(new URL('../schemas/check-report-v1.schema.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

function lolly(args: string[], state: string): { status: number | null; stdout: string; json: Record<string, any>; stderr: string } {
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: state, NO_COLOR: '1' },
  });
  let json: Record<string, any> = {};
  try { json = JSON.parse(run.stdout); } catch { /* the assertion on status reports stderr */ }
  return { status: run.status, stdout: run.stdout, json, stderr: run.stderr };
}

/** A temporary folder holding the public fixture and a copy with one broken macro field. */
async function withDocs<T>(fn: (docs: { good: string; broken: string; state: string }) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-authoring-cli-'));
  try {
    const doc = JSON.parse(readFileSync(INPUT, 'utf8')) as { boxes: Array<Record<string, any>> };
    const broken = structuredClone(doc);
    broken.boxes[2]!.$stack.pitch = 'wide';
    const good = join(dir, 'good.author.json');
    const bad = join(dir, 'broken.author.json');
    await writeFile(good, JSON.stringify(doc));
    await writeFile(bad, JSON.stringify(broken));
    return await fn({ good, broken: bad, state: join(dir, 'state') });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('lolly check reports a macro it cannot lower as design.authoring.invalid, with its pointer', () => withDocs(async ({ broken, state }) => {
  const run = lolly(['check', broken, '--browser=off', '--json'], state);
  assert.equal(run.status, 4, run.stderr);
  const report = run.json.result;
  assert.ok(validate(report), JSON.stringify(validate.errors, null, 2));
  const finding = report.findings.find((f: { code: string }) => f.code === 'design.authoring.invalid');
  assert.ok(finding, JSON.stringify(report.findings));
  assert.equal(finding.path, '/boxes/2/$stack/pitch');
  assert.equal(finding.layerId, 'a1-list');
  assert.equal(finding.family, 'structure');
  assert.equal(finding.severity, 'error');
  assert.deepEqual(finding.origin, { checker: 'design-authoring', id: 'authoring.invalid' });
  for (const family of ['render', 'brand', 'verify', 'fidelity']) assert.equal(report.families[family].state, 'skipped', family);
  // The text report prints no path, so the message carries the pointer itself.
  assert.match(finding.message, /lowered to layers: \/boxes\/2\/\$stack\/pitch: expected a number/);
  const text = lolly(['check', broken, '--browser=off'], state);
  assert.match(text.stdout + text.stderr, /design\.authoring\.invalid.*\/boxes\/2\/\$stack\/pitch: expected a number/);
}));

test('lolly check checks the stored rows an authoring document lowers to', () => withDocs(async ({ good, state }) => {
  const run = lolly(['check', good, '--browser=off', '--json'], state);
  assert.notEqual(run.status, 4, run.stderr);
  const report = run.json.result;
  assert.ok(validate(report), JSON.stringify(validate.errors, null, 2));
  assert.equal(report.input.artboards, 2);
  assert.match(report.families.structure.reason, /authoring keys were lowered first, to 51 stored rows/);
  const codes = new Set(report.findings.map((f: { code: string }) => f.code));
  assert.ok(!codes.has('design.layer.kind-unknown'));
  assert.ok(!codes.has('design.layer.outside-artboard'));
}));

test('compile and validate --inputs lower authoring for Design', () => withDocs(async ({ good, broken, state }) => {
  const compiled = lolly(['compile', 'design', `--inputs=${good}`], state);
  assert.equal(compiled.status, 0, compiled.stderr);
  const rows = compiled.json.document.values.boxes as Array<Record<string, unknown>>;
  assert.equal(rows.length, 51);
  assert.ok(rows.every((row) => Object.keys(row).every((k) => !k.startsWith('$'))));
  assert.equal(compiled.json.document.values.$styles, undefined);
  const valid = lolly(['validate', 'design', '--document', `--inputs=${good}`], state);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.json.ok, true, JSON.stringify(valid.json.errors));
  const refused = lolly(['validate', 'design', '--document', `--inputs=${broken}`], state);
  assert.equal(refused.status, 4);
  assert.match(refused.stderr, /--inputs: \/boxes\/2\/\$stack\/pitch: expected a number/);
}));

test('measure --text-layers measures the rows an authoring document lowers to', () => withDocs(async ({ good, broken, state }) => {
  const run = lolly(['measure', good, '--text-layers', '--json'], state);
  assert.equal(run.status, 0, run.stderr);
  const ids = run.json.result.layers.map((l: { layerId: string }) => l.layerId);
  assert.ok(ids.includes('a1-title') && ids.includes('a1-li2'), ids.join(', '));
  const refused = lolly(['measure', broken, '--text-layers'], state);
  assert.equal(refused.status, 4);
  assert.match(refused.stderr, /\/boxes\/2\/\$stack\/pitch/);
}));

test('run design --document refuses before rendering: a broken key, a bare flag, a clash, another tool', () => withDocs(async ({ good, broken, state }) => {
  const bad = lolly(['run', 'design', `--document=${broken}`, '--export=png'], state);
  assert.equal(bad.status, 4, bad.stderr);
  assert.match(bad.stderr, /--document: \/boxes\/2\/\$stack\/pitch: expected a number/);
  const bare = lolly(['run', 'design', '--document', '--export=png'], state);
  assert.equal(bare.status, 2, bare.stderr);
  assert.match(bare.stderr, /--document needs a value/);
  const clash = lolly(['run', 'design', `--document=${good}`, '--boxes=[]', '--export=png'], state);
  assert.equal(clash.status, 2, clash.stderr);
  assert.match(clash.stderr, /leave out --boxes/);
  const other = lolly(['run', 'qr-code', `--document=${good}`, '--export=svg'], state);
  assert.equal(other.status, 2, other.stderr);
  assert.match(other.stderr, /--document takes a Design document/);
}));

test('run design --document --share links the lowered rows', () => withDocs(async ({ good, state }) => {
  const run = lolly(['run', 'design', `--document=${good}`, '--share'], state);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /Read 51 layers from .*authoring keys lowered/);
  const url = run.stdout.trim();
  assert.match(url, /^https:\/\/lolly\.tools\/#\/tool\/design\?/);
  assert.ok(!decodeURIComponent(url).includes('$'), 'no authoring key reaches the link');
}));
