// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly intent` (plan 350 W4) as a process: exit codes, one JSON document on stdout, the
 * render seam writing files and the answer beside them, and nothing added to the file by
 * this verb. Rendering here stays on the browser-free tier (qr-code), so it runs anywhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { RESERVED_SUBCOMMANDS } from '../shells/cli/src/args.ts';

const root = resolve(import.meta.dirname, '..');
const ajv = new (Ajv as unknown as new (opts: object) => { compile(schema: object): ((data: unknown) => boolean) & { errors?: unknown } })({ allErrors: true, strict: false });
const validAnswer = ajv.compile(JSON.parse(readFileSync(join(root, 'schemas/intent-resolution-v1.schema.json'), 'utf8')));

function withDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-intent-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function lolly(args: string[], input?: string) {
  return spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'intent', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', NO_COLOR: '1' },
    ...(input !== undefined ? { input } : {}),
    timeout: 120_000,
  });
}

const direct = {
  version: 1, purpose: 'direct', surfaces: [{ id: 'social-square', format: 'svg' }],
  content: { url: 'https://example.com/spring' }, occasion: 'Spring launch',
};

test('intent is a reserved word, so no tool id can shadow it', () => {
  assert.ok(RESERVED_SUBCOMMANDS.includes('intent' as never));
});

test('a ready intent answers on stdout and exits 0, with the same answer as JSON', () => withDir((dir) => {
  const file = join(dir, 'intent.json');
  writeFileSync(file, JSON.stringify(direct));
  const human = lolly([file]);
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /^Intent: ready \(direct\)/);
  assert.match(human.stdout, /social-square: ready\. qr-code/);
  const run = lolly([file, '--json']);
  assert.equal(run.status, 0, run.stderr);
  const envelope = JSON.parse(run.stdout);
  assert.equal(envelope.command, 'intent');
  assert.equal(envelope.ok, true);
  assert.ok(validAnswer(envelope.result.resolution), JSON.stringify(validAnswer.errors));
  assert.equal(envelope.result.resolution.surfaces[0].chosen.toolId, 'qr-code');
  assert.equal(envelope.result.rendered, undefined, 'nothing is made without --render');
}));

test('reads standard input with -', () => {
  const run = lolly(['-', '--json'], JSON.stringify(direct));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).result.resolution.outcome, 'ready');
});

test('--render makes the file and writes the answer beside it, and the answer is the one printed', () => withDir((dir) => {
  const out = join(dir, 'out');
  const run = lolly(['-', '--json', '--render', `--out-dir=${out}`], JSON.stringify(direct));
  assert.equal(run.status, 0, run.stderr);
  const envelope = JSON.parse(run.stdout);
  const made = envelope.result.rendered[0];
  assert.equal(made.toolId, 'qr-code');
  assert.equal(made.path, join(out, 'direct-social-square-qr-code.svg'));
  const svg = readFileSync(made.path, 'utf8');
  assert.match(svg, /^<\?xml|^<svg/);
  assert.match(svg, /width="1080px"/, 'made at the surface size');
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'intent-resolution.json'), 'utf8')), envelope.result.resolution);
  assert.equal(svg.includes('Spring launch'), false, 'free text is not written into the file');
  assert.equal(svg.includes(envelope.result.resolution.intentDigest), false, 'the digest is not written into the file');
  assert.equal(svg.includes(envelope.result.resolution.closed.rulesVersion), false, 'nothing of the resolution is written into the file');
}));

test('--render makes only what is ready, says what is not and exits 4', () => withDir((dir) => {
  const out = join(dir, 'out');
  const partial = { ...direct, surfaces: [{ id: 'social-square', format: 'svg' }, { id: 'story' }] };
  const run = lolly(['-', '--json', '--render', `--out-dir=${out}`], JSON.stringify(partial));
  assert.equal(run.status, 4);
  const envelope = JSON.parse(run.stdout);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.result.resolution.outcome, 'partial');
  assert.equal(envelope.result.resolution.surfaces[1].refusal.code, 'no-tool-for-surface');
  assert.deepEqual(readdirSync(out).sort(), ['direct-social-square-qr-code.svg', 'intent-resolution.json']);
}));

test('a missing role is a gap with exit 4, and --render makes nothing rather than print sample content', () => withDir((dir) => {
  const out = join(dir, 'out');
  const run = lolly(['-', '--render', `--out-dir=${out}`], JSON.stringify({ version: 1, purpose: 'direct', surfaces: [{ id: 'social-square' }] }));
  assert.equal(run.status, 4);
  assert.match(run.stdout, /Needs url/);
  assert.deepEqual(readdirSync(out), ['intent-resolution.json']);
}));

test('a prompt with no purpose hands the choice back, with the stable code and exit 4', () => {
  const human = lolly(['-'], JSON.stringify({ version: 1, prompt: 'A certificate for Sam' }));
  assert.equal(human.status, 4);
  assert.match(human.stdout, /intent\.purpose-needed/);
  assert.match(human.stdout, /recognise\s+Honour a person/);
  const run = lolly(['-', '--json'], JSON.stringify({ version: 1, prompt: 'A certificate for Sam' }));
  const { resolution } = JSON.parse(run.stdout).result;
  assert.equal(resolution.outcome, 'purpose-needed');
  assert.equal(resolution.prompt, 'A certificate for Sam');
  assert.equal(resolution.closed.purpose, null);
  assert.equal(resolution.purposeNeeded.code, 'intent.purpose-needed');
});

test('an intent the parser refuses exits 4 with a kind to branch on, and one JSON document', () => {
  const run = lolly(['-', '--json'], JSON.stringify({ version: 1 }));
  assert.equal(run.status, 4);
  const envelope = JSON.parse(run.stdout);
  assert.equal(envelope.error.kind, 'INTENT_INVALID');
  assert.match(envelope.error.detail, /intent\.purpose-or-prompt/);
  assert.equal(lolly(['-', '--json'], JSON.stringify({ version: 1, prompt: 'x'.repeat(2001) })).status, 4);
});

test('usage errors exit 2: no file, a missing path, a file that is not JSON, an unknown or bare flag', () => withDir((dir) => {
  assert.equal(lolly([]).status, 2);
  assert.equal(lolly([join(dir, 'nope.json')]).status, 2);
  assert.equal(lolly(['-'], 'not json').status, 2);
  assert.equal(lolly(['-', '--nope=1'], JSON.stringify(direct)).status, 2);
  assert.equal(lolly(['-', '--out-dir'], JSON.stringify(direct)).status, 2);
  assert.equal(lolly(['-', `--out-dir=${dir}`], JSON.stringify(direct)).status, 2, '--out-dir without --render does nothing, so it is refused');
  assert.equal(existsSync(join(dir, 'intent-resolution.json')), false);
}));
