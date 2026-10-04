// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly check` from the command line (plan 291 W1): the envelope, the exit codes,
 * the design-system ladder and the refusals. Run as CI runs, on the public lolly-start
 * profile with an empty state directory. The render family is turned off with
 * `--browser=off` here; tests/check-render.browser.test.ts covers the page hook.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

import { CHECK_VALUE_FLAGS, RESERVED_SUBCOMMANDS } from '../shells/cli/src/args.ts';
import { CONTENT_FREE_COMMANDS } from '../shells/cli/src/content-root.ts';
import { checkOutline } from '../shells/cli/src/check.ts';
import { inventoryOutline } from '../shells/cli/src/read.ts';

/** True when the text holds a control character other than a newline (C0, DEL or C1). */
const hasControl = (text: string): boolean =>
  [...text].some((ch) => {
    const c = ch.charCodeAt(0);
    return (c < 0x20 && c !== 0x0a) || (c >= 0x7f && c <= 0x9f);
  });

const ROOT = new URL('..', import.meta.url);
const TRAP = new URL('./fixtures/check/trap.boxes.json', import.meta.url).pathname;
const TOKENS = new URL('./fixtures/design-brief/tokens.json', import.meta.url).pathname;
const SCHEMA = JSON.parse(readFileSync(new URL('../schemas/check-report-v1.schema.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

function lolly(args: string[], state: string): { status: number | null; stdout: string; json: Record<string, any>; stderr: string } {
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 90_000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: state, NO_COLOR: '1' },
  });
  let json: Record<string, any> = {};
  try { json = JSON.parse(run.stdout); } catch { /* the assertion on status reports stderr */ }
  return { status: run.status, stdout: run.stdout, json, stderr: run.stderr };
}

async function withState<T>(fn: (state: string, dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-check-cli-'));
  try { return await fn(join(dir, 'state'), dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('check is a reserved, content-free verb with its own value flags', () => {
  assert.ok((RESERVED_SUBCOMMANDS as readonly string[]).includes('check'));
  assert.ok(CONTENT_FREE_COMMANDS.has('check'));
  // 1.244 (plan 291 W4): --themes checks the document in more than one theme.
  assert.deepEqual([...CHECK_VALUE_FLAGS], ['source', 'file', 'theme', 'browser', 'page-cap', 'edits', 'themes']);
});

test('the trap document exits 5 with one envelope whose result is a valid check report', () => withState(async (state) => {
  const run = lolly(['check', TRAP, '--browser=off', '--json'], state);
  assert.equal(run.status, 5, run.stderr);
  assert.equal(run.json.command, 'check');
  assert.equal(run.json.ok, false);
  assert.equal(run.json.error, null);
  const report = run.json.result;
  assert.ok(validate(report), JSON.stringify(validate.errors, null, 2));
  assert.equal(report.exitCode, 5);
  assert.equal(report.outcome, 'review');
  // No --file and no terminal system: the content profile's tokens answer.
  assert.deepEqual(report.designSystem, { origin: 'profile', profile: 'lolly-start', tokensAsset: 'lolly/tokens/brand' });
  assert.equal(report.families.render.state, 'skipped');
  const codes = new Set(report.findings.map((f: { code: string }) => f.code));
  for (const code of ['design.layer.outside-artboard', 'verify.fingernail-card', 'verify.eyebrow-heading', 'verify.decorative-numbering'])
    assert.ok(codes.has(code), code);
  assert.ok(report.findings.some((f: { family: string }) => f.family === 'brand'));
  // Findings are data, never warnings on stderr.
  assert.doesNotMatch(run.stderr, /warning/i);
}));

test('--file chooses the design system, --strict refuses with exit 4, and the human report lists every family', () => withState(async (state) => {
  const strict = lolly(['check', TRAP, '--browser=off', `--file=${TOKENS}`, '--strict', '--json'], state);
  assert.equal(strict.status, 4, strict.stderr);
  assert.deepEqual(strict.json.result.designSystem, { origin: 'file' });
  assert.equal(strict.json.result.strict, true);
  assert.ok(strict.json.result.findings.filter((f: { family: string }) => f.family === 'verify').every((f: { severity: string }) => f.severity === 'error'));

  const human = lolly(['check', TRAP, '--browser=off', `--file=${TOKENS}`], state);
  assert.equal(human.status, 5, human.stderr);
  assert.match(human.stdout, /^trap\.boxes\.json: review \(exit 5\)/);
  for (const family of ['structure', 'render', 'brand', 'verify', 'fidelity']) assert.match(human.stdout, new RegExp(`^${family}\\s`, 'm'));
  assert.match(human.stdout, /verify\.fingernail-card {2}\[slide\/card-1\]/);
}));

test('an export runs Verify alone and a clean one exits 0', () => withState(async (state, dir) => {
  const svg = join(dir, 'plain.svg');
  await writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#ffffff"/><text x="20" y="60" font-size="24">Plain words on a page</text></svg>');
  const run = lolly(['check', svg, '--json'], state);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.json.ok, true);
  const report = run.json.result;
  assert.ok(validate(report), JSON.stringify(validate.errors, null, 2));
  assert.equal(report.input.kind, 'image');
  assert.deepEqual(Object.entries(report.families).filter(([, s]: [string, any]) => s.state === 'ran').map(([f]) => f), ['verify']);
  assert.equal(report.findings.length, 0);
}));

test('bare value flags, bad values and missing files are usage errors', () => withState(async (state, dir) => {
  for (const flag of CHECK_VALUE_FLAGS) {
    const run = lolly(['check', TRAP, `--${flag}`, '--json'], state);
    assert.equal(run.status, 2, `--${flag}: ${run.stderr}`);
    assert.equal(run.json.error?.kind, 'MISSING_FLAG_VALUE', flag);
  }
  const browser = lolly(['check', TRAP, '--browser=sometimes', '--json'], state);
  assert.equal(browser.status, 2);
  assert.equal(browser.json.error?.kind, 'BAD_FLAG_VALUE');
  const cap = lolly(['check', TRAP, '--page-cap=0', '--json'], state);
  assert.equal(cap.status, 2);
  const missing = lolly(['check', '/no/such/deck.lolly', '--json'], state);
  assert.equal(missing.status, 2);
  assert.equal(missing.json.error?.kind, 'FILE_NOT_FOUND');
  const none = lolly(['check', '--json'], state);
  assert.equal(none.status, 2);
  assert.equal(none.json.error?.kind, 'MISSING_ARGUMENT');
  const docx = join(dir, 'notes.docx');
  await writeFile(docx, 'not a check input');
  const kind = lolly(['check', docx, '--json'], state);
  assert.equal(kind.status, 2);
  assert.equal(kind.json.error?.kind, 'INPUT_UNSUPPORTED');
}));

test('the human outline lists edited wording for review', () => {
  const report = {
    format: 'lolly-check', version: 1, input: { kind: 'design', name: 'deck.lolly' }, outcome: 'clean', exitCode: 0, strict: false,
    families: Object.fromEntries(['structure', 'render', 'brand', 'verify', 'fidelity'].map((f) => [f, { state: 'ran', error: 0, warn: 0, info: 0 }])),
    summary: { error: 0, warn: 0, info: 1 }, findings: [],
    fidelity: { slides: { source: 1, result: 1 }, missingStrings: [], editedStrings: [{ source: 'Next Steps', result: 'Next steps' }], notes: { carried: 0, missing: 0 } },
  } as const;
  const text = checkOutline(report as never);
  assert.match(text, /Edited wording/);
  assert.match(text, /“Next Steps” → “Next steps”/);
});

test('a flag check or read does not take is refused by name (exit 2), never dropped', () => withState(async (state) => {
  const typo = lolly(['check', TRAP, '--brower=require', '--json'], state);
  assert.equal(typo.status, 2, typo.stderr);
  assert.equal(typo.json.error?.kind, 'UNKNOWN_FLAG');
  assert.match(typo.json.error?.message ?? '', /--brower is not a flag of lolly check\. It takes: --source/);
  const source = lolly(['check', TRAP, '--srouce=tests/fixtures/rebrand/notes.pptx', '--json'], state);
  assert.equal(source.json.error?.kind, 'UNKNOWN_FLAG');
  const empty = lolly(['check', TRAP, '--source=', '--json'], state);
  assert.equal(empty.status, 2);
  assert.equal(empty.json.error?.kind, 'MISSING_FLAG_VALUE');
  const read = lolly(['read', 'tests/fixtures/rebrand/notes.pptx', '--bogus', '--json'], state);
  assert.equal(read.status, 2, read.stderr);
  assert.equal(read.json.error?.kind, 'UNKNOWN_FLAG');
  // The global flags stay valid on both verbs.
  const quiet = lolly(['check', TRAP, '--browser=off', '--quiet', '--verbose=0', '--json'], state);
  assert.equal(quiet.status, 5, quiet.stderr);
}));

test('the documented pipeline works: `lolly read --json` output is a --source for `lolly check`', () => withState(async (state, dir) => {
  const read = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'read', 'tests/fixtures/rebrand/notes.pptx', '--json'], {
    cwd: ROOT, encoding: 'utf8', timeout: 90_000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: state, NO_COLOR: '1' },
  });
  assert.equal(read.status, 0, read.stderr);
  const saved = join(dir, 'old.inventory.json');
  await writeFile(saved, read.stdout);
  const run = lolly(['check', 'tests/fixtures/rebrand/notes.pptx', `--source=${saved}`, '--json'], state);
  assert.ok(run.status === 0 || run.status === 5, run.stderr);
  const report = run.json.result;
  assert.ok(validate(report), JSON.stringify(validate.errors, null, 2));
  assert.equal(report.families.fidelity.state, 'ran');
  assert.deepEqual(report.fidelity.missingStrings, []);
}));

test('the human report scrubs control characters a file carries, so it cannot forge a verdict line', () => withState(async (state, dir) => {
  const forged = 'b\u001b[2K\r\u001b[1Aesc.json: clean (exit 0). 0 errors, 0 to review, 0 notes.\u001b[8m';
  const doc = [
    { id: 'slide', kind: 'frame', name: 'Slide', x: 0, y: 0, w: 1920, h: 1080 },
    { id: forged, name: forged, kind: 'text', frame: 'slide', text: 'Out of bounds', x: 4000, y: 4000, w: 200, h: 40 },
  ];
  const file = join(dir, 'esc.json');
  await writeFile(file, JSON.stringify(doc));
  const run = lolly(['check', file, '--browser=off'], state);
  assert.equal(run.status, 5, run.stderr);
  assert.ok(!hasControl(run.stdout), JSON.stringify(run.stdout));
  assert.match(run.stdout, /^esc\.json: review \(exit 5\)/);
}));

test('the read outline scrubs control characters from the deck\'s own words', () => {
  const evil = 'Title\u001b[2K\r\u001b[1AFake line\u001b[8m';
  const inventory = {
    version: 'lolly/content-inventory-v1',
    source: { name: 'x.pptx', sha256: '0'.repeat(64), bytes: 1, kind: 'pptx', slides: 1, width: 1920, height: 1080 },
    slides: [{
      number: 1, id: 's1', layoutName: evil,
      text: [{ objectId: 't', role: 'title', class: 'title', box: { x: 0, y: 0, width: 1, height: 0.1 }, paragraphs: [], plain: evil }],
      notes: { text: evil, paragraphs: [{ lines: [evil] }] }, pictures: [], tables: [], charts: [{ objectId: 'c', type: evil }], objects: [],
    }],
    media: [], warnings: [],
  };
  const text = inventoryOutline(inventory as never);
  assert.ok(!hasControl(text), JSON.stringify(text));
  assert.match(text, /Fake line/);
});

test('--edits records deliberate wording changes: their findings stay as excepted notes, and a bad file refuses', () => withState(async (state, dir) => {
  const inventory = {
    version: 'lolly/content-inventory-v1',
    source: { name: 'old.pptx', sha256: '0'.repeat(64), bytes: 1, kind: 'pptx', slides: 1, width: 1920, height: 1080 },
    slides: [{
      number: 1, id: 's1',
      text: ['Growth that compounds', 'A paragraph we dropped on purpose', 'Something else that went missing'].map((plain, i) => ({
        objectId: `t${i}`, role: 'body', class: 'body', box: { x: 0, y: 0, width: 1, height: 0.1 }, paragraphs: [{ runs: [{ text: plain }] }], plain,
      })),
      notes: null, pictures: [], tables: [], charts: [], objects: [],
    }],
    media: [], warnings: [],
  };
  const inv = join(dir, 'old.inventory.json');
  await writeFile(inv, JSON.stringify(inventory));
  const edits = join(dir, 'edits.json');
  await writeFile(edits, JSON.stringify([{ source: 'A paragraph we dropped on purpose', reason: 'Cut for length' }]));

  const run = lolly(['check', TRAP, `--source=${inv}`, `--edits=${edits}`, '--browser=off', '--json'], state);
  assert.equal(run.status, 5, run.stderr);
  const report = run.json.result;
  assert.ok(validate(report), JSON.stringify(validate.errors, null, 2));
  assert.deepEqual(report.fidelity.missingStrings, ['Something else that went missing']);
  assert.deepEqual(report.fidelity.excepted, [{ slide: 1, source: 'A paragraph we dropped on purpose', reason: 'Cut for length' }]);
  const excepted = report.findings.find((f: { evidence?: { excepted?: boolean } }) => f.evidence?.excepted === true);
  assert.equal(excepted.code, 'fidelity.text.missing');
  assert.equal(excepted.severity, 'info');
  assert.match(report.families.fidelity.reason, /1 string is recorded as a deliberate edit/);

  const human = lolly(['check', TRAP, `--source=${inv}`, `--edits=${edits}`, '--browser=off'], state);
  assert.match(human.stdout, /Recorded as deliberate edits \(excepted, not passed\):\n {2}slide 1: “A paragraph we dropped on purpose” {2}Cut for length/);

  const alone = lolly(['check', TRAP, `--edits=${edits}`, '--browser=off', '--json'], state);
  assert.equal(alone.status, 2);
  assert.equal(alone.json.error?.kind, 'MISSING_ARGUMENT');
  await writeFile(edits, JSON.stringify([{ source: 'A paragraph we dropped on purpose' }]));
  const bad = lolly(['check', TRAP, `--source=${inv}`, `--edits=${edits}`, '--browser=off', '--json'], state);
  assert.equal(bad.status, 2);
  assert.equal(bad.json.error?.kind, 'BAD_FLAG_VALUE');
  assert.match(bad.json.error?.message ?? '', /Edit 1 needs "reason"/);
}));
