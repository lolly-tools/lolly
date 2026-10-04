// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly package` from the command line (plan 291 W8): a Design document becomes a
 * `.lolly` the app reopens, with the `--json` envelope around a design package report,
 * and every refusal exits with its code. A compiled document keeps the zip the verb
 * has always written. Run as CI runs, on the public lolly-start profile with an empty
 * state directory; the documents and pictures are synthetic.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import { unzipSync, strFromU8 } from 'fflate';

import { PACKAGE_BOOL_FLAGS, PACKAGE_VALUE_FLAGS } from '../shells/cli/src/args.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';

const ROOT = new URL('..', import.meta.url);
const SCHEMA = JSON.parse(readFileSync(new URL('../schemas/design-package-v1.schema.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const DOC = [
  { id: 'a', kind: 'frame', name: 'One', x: 0, y: 0, w: 1280, h: 720, rot: 0, shape: 'rect', bg: '#ffffff' },
  { id: 'a-photo', kind: 'image', frame: 'a', x: 0, y: 0, w: 1280, h: 720, rot: 0, image: 'photo:hero', fit: 'cover' },
  { id: 'a-logo', kind: 'image', frame: 'a', x: 40, y: 40, w: 200, h: 60, rot: 0, image: 'lolly/logo/primary' },
  { id: 'a-title', kind: 'text', frame: 'a', x: 40, y: 200, w: 900, h: 80, rot: 0, text: 'Hello' },
];

function lolly(args: string[], state: string, cwd: string, input?: string): { status: number | null; stdout: string; json: Record<string, any>; stderr: string } {
  const run = spawnSync(process.execPath, [new URL('shells/cli/bin/lolly.ts', ROOT).pathname, ...args], {
    cwd, encoding: 'utf8', timeout: 90_000, maxBuffer: 64 * 1024 * 1024, ...(input !== undefined ? { input } : {}),
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: state, NO_COLOR: '1', SOURCE_DATE_EPOCH: '1790985600' },
  });
  let json: Record<string, any> = {};
  try { json = JSON.parse(run.stdout); } catch { /* the assertion on status reports stderr */ }
  return { status: run.status, stdout: run.stdout, json, stderr: run.stderr };
}

async function withDir<T>(fn: (dir: string, state: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-package-cli-'));
  try {
    await writeFile(join(dir, 'deck.json'), JSON.stringify(DOC));
    await writeFile(join(dir, 'hero.jpg'), JPG);
    return await fn(dir, join(dir, 'state'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('package has its own value and on/off flags', () => {
  assert.deepEqual([...PACKAGE_VALUE_FLAGS], ['asset', 'asset-dir', 'source', 'label', 'theme', 'file', 'output']);
  assert.deepEqual([...PACKAGE_BOOL_FLAGS], ['force', 'allow-missing-media']);
});

test('a Design document packages in one call, with one envelope whose result is a valid report', () => withDir(async (dir, state) => {
  const run = lolly(['package', 'deck.json', '--asset=photo:hero=hero.jpg', '--label=Quarterly review', '--output=deck.lolly', '--json'], state, dir);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.json.command, 'package');
  assert.equal(run.json.ok, true);
  const report = run.json.result;
  assert.ok(validate(report), JSON.stringify(validate.errors, null, 2));
  assert.equal(realpathSync(report.output), realpathSync(join(dir, 'deck.lolly')));
  assert.equal(report.exportedAt, '2026-10-03T00:00:00.000Z');
  assert.deepEqual(report.references, { profile: 'lolly-start', catalog: 1, unchecked: 0, external: 0, unknown: [] });
  assert.deepEqual(report.next, ['lolly check deck.lolly', 'lolly run deck.lolly --export=pptx']);
  const bytes = new Uint8Array(await readFile(join(dir, 'deck.lolly')));
  assert.equal(report.sha256, sha(bytes));
  const back = readLollyFile(bytes);
  assert.equal(back.session.__label, 'Quarterly review');
  assert.equal(back.session.__export_filename, 'Quarterly review');
  const boxes = back.session.boxes as Array<Record<string, unknown>>;
  assert.deepEqual(boxes[1]!.image, { id: `user/media/${sha(JPG)}`, source: 'user' });
  assert.ok(back.session.__toolVersion, 'the profile\'s Design version is recorded');

  // The same call writes the same bytes, and refuses to replace the file without --force.
  const again = lolly(['package', 'deck.json', '--asset=photo:hero=hero.jpg', '--label=Quarterly review', '--output=deck.lolly', '--json'], state, dir);
  assert.equal(again.status, 4, again.stderr);
  assert.equal(again.json.error.kind, 'OUTPUT_EXISTS');
  const forced = lolly(['package', 'deck.json', '--asset=photo:hero=hero.jpg', '--label=Quarterly review', '--output=deck.lolly', '--force', '--json'], state, dir);
  assert.equal(forced.status, 0, forced.stderr);
  assert.equal(sha(new Uint8Array(await readFile(join(dir, 'deck.lolly')))), sha(bytes));
}));

test('standard input and the human summary', () => withDir(async (dir, state) => {
  const run = lolly(['package', '-', '--asset=photo:hero=hero.jpg', '--output=stdin.lolly'], state, dir, JSON.stringify({ boxes: DOC }));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /"standard-input", 1 artboard, 4 layers, 1 picture carried/);
  assert.equal(readLollyFile(new Uint8Array(await readFile(join(dir, 'stdin.lolly')))).session.__label, 'standard-input');
}));

test('refusals exit with their codes and kinds', () => withDir(async (dir, state) => {
  const missing = lolly(['package', 'deck.json', '--output=x.lolly', '--json'], state, dir);
  assert.equal(missing.status, 4, missing.stderr);
  assert.equal(missing.json.error.kind, 'MEDIA_MISSING');
  assert.match(missing.json.error.message, /photo:hero \(a-photo\)/);
  // The remedies are this surface's flags, dashes included.
  assert.match(missing.json.error.message, /--asset=KEY=PATH, or pass --allow-missing-media to write them as references\.$/);

  // A key that matched no layer is named in the refusal, with the one it was likely meant to be.
  const typo = lolly(['package', 'deck.json', '--asset=photo:heor=hero.jpg', '--output=x.lolly', '--json'], state, dir);
  assert.equal(typo.status, 4, typo.stderr);
  assert.match(typo.json.error.message, /No layer names photo:heor \(did you mean photo:hero\?\)/);

  // A document that is missing or is not JSON is said as such, flags or none.
  for (const args of [[], ['--asset=photo:hero=hero.jpg']]) {
    const gone = lolly(['package', 'missing.json', ...args, '--output=x.lolly', '--json'], state, dir);
    assert.equal(gone.status, 2, gone.stderr);
    assert.equal(gone.json.error.kind, 'FILE_NOT_FOUND');
    assert.match(gone.json.error.message, /No file at missing\.json/);
    await writeFile(join(dir, 'broken.json'), '{"a":');
    const broken = lolly(['package', 'broken.json', ...args, '--output=x.lolly', '--json'], state, dir);
    assert.equal(broken.status, 2, broken.stderr);
    assert.equal(broken.json.error.kind, 'BAD_INPUT');
    assert.match(broken.json.error.message, /^broken\.json is not JSON/);
  }

  await writeFile(join(dir, 'not.jpg'), '%PDF-1.7');
  const notImage = lolly(['package', 'deck.json', '--asset=photo:hero=not.jpg', '--output=x.lolly', '--json'], state, dir);
  assert.equal(notImage.status, 4);
  assert.equal(notImage.json.error.kind, 'ASSET_NOT_IMAGE');

  const bare = lolly(['package', 'deck.json', '--asset', '--output=x.lolly', '--json'], state, dir);
  assert.equal(bare.status, 2);
  assert.equal(bare.json.error.kind, 'MISSING_FLAG_VALUE');

  const noKey = lolly(['package', 'deck.json', '--asset=hero.jpg', '--output=x.lolly', '--json'], state, dir);
  assert.equal(noKey.status, 2);
  assert.equal(noKey.json.error.kind, 'BAD_FLAG_VALUE');

  const noFile = lolly(['package', 'deck.json', '--asset=photo:hero=gone.jpg', '--output=x.lolly', '--json'], state, dir);
  assert.equal(noFile.status, 2);
  assert.equal(noFile.json.error.kind, 'FILE_NOT_FOUND');

  const unknown = lolly(['package', 'deck.json', '--media=photo:hero=hero.jpg', '--output=x.lolly', '--json'], state, dir);
  assert.equal(unknown.status, 2);
  assert.equal(unknown.json.error.kind, 'UNKNOWN_FLAG');

  const noOutput = lolly(['package', 'deck.json', '--asset=photo:hero=hero.jpg', '--json'], state, dir);
  assert.equal(noOutput.status, 2);
  assert.equal(noOutput.json.error.kind, 'MISSING_ARGUMENT');

  await writeFile(join(dir, 'retired.json'), JSON.stringify([...DOC.slice(0, 2), { ...DOC[2], image: 'lolly/logo/retired' }]));
  const retired = lolly(['package', 'retired.json', '--asset=photo:hero=hero.jpg', '--output=x.lolly', '--json'], state, dir);
  assert.equal(retired.status, 4);
  assert.equal(retired.json.error.kind, 'REFERENCE_UNKNOWN');
  const allowed = lolly(['package', 'retired.json', '--allow-missing-media', '--output=x.lolly', '--json'], state, dir);
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(allowed.json.result.missingMedia.length, 1);
  assert.equal(allowed.json.result.references.unknown.length, 1);
}));

test('a compiled document keeps the zip lolly package has always written', () => withDir(async (dir, state) => {
  const compiled = lolly(['compile', 'qr-code'], state, dir);
  assert.equal(compiled.status, 0, compiled.stderr);
  await writeFile(join(dir, 'd.json'), compiled.stdout);
  const run = lolly(['package', 'd.json', '--output=d.lolly'], state, dir);
  assert.equal(run.status, 0, run.stderr);
  const printed = JSON.parse(run.stdout) as Record<string, any>;
  assert.equal(printed.output, 'd.lolly');
  assert.equal(printed.tool.id, 'document');
  const files = unzipSync(new Uint8Array(await readFile(join(dir, 'd.lolly'))));
  assert.deepEqual(Object.keys(files).sort(), ['README.txt', 'manifest.json', 'session.json']);
  assert.deepEqual(JSON.parse(strFromU8(files['session.json']!)), JSON.parse(compiled.stdout));
  // --force is let through as it always was, over an output that exists.
  const forced = lolly(['package', 'd.json', '--output=d.lolly', '--force'], state, dir);
  assert.equal(forced.status, 0, forced.stderr);
  // The Design flags mean nothing to a compiled document, so naming one is refused.
  const labelled = lolly(['package', 'd.json', '--label=x', '--output=e.lolly', '--json'], state, dir);
  assert.equal(labelled.status, 2);
  assert.equal(labelled.json.error.kind, 'UNKNOWN_FLAG');
}));

test('colour references are stored as the literal plus a link, in the design system that styles the text (plan 291 W4)', () => withDir(async (dir, state) => {
  const doc = { boxes: [
    { id: 'a', $artboard: true, x: 0, y: 0, w: 1280, h: 720, bg: '{color.semantic.surface}' },
    { id: 't', $in: 'a', kind: 'text', x: 40, y: 40, w: 600, h: 80, fg: '{color.role.muted-ink}', text: 'Hello' },
  ] };
  await writeFile(join(dir, 'themed.json'), JSON.stringify(doc));
  const r = lolly(['package', 'themed.json', '--output=themed.lolly', '--json'], state, dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.json.result.warnings.some((w: { message: string }) => /colour\.deferred/.test(w.message)), JSON.stringify(r.json.result.warnings));
  const rows = readLollyFile(new Uint8Array(await readFile(join(dir, 'themed.lolly')))).session.boxes as Array<Record<string, unknown>>;
  assert.match(String(rows[0]!.bg), /^#[0-9a-f]{6}$/i, 'the artboard holds a literal colour');
  assert.match(String(rows[1]!.fg), /^#[0-9a-f]{6}$/i, 'the text holds a literal colour');
  assert.match(String(rows[0]!.tokenLinks), /color\.semantic\.surface/);
  assert.match(String(rows[1]!.tokenLinks), /color\.role\.muted-ink/);
}));

test('a document with no authoring key still has its colour references stored as literals plus links (a composed deck)', () => withDir(async (dir, state) => {
  const doc = [
    { id: 'a', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, rot: 0, shape: 'rect', bg: '#ffffff' },
    { id: 'g', kind: 'box', frame: 'a', x: 0, y: 0, w: 1280, h: 720, rot: 0, bg: '{color.semantic.surface}' },
    { id: 't', kind: 'text', frame: 'a', x: 40, y: 40, w: 600, h: 80, rot: 0, fg: '{color.semantic.text}', text: 'Hello' },
  ];
  await writeFile(join(dir, 'composed.json'), JSON.stringify(doc));
  const r = lolly(['package', 'composed.json', '--output=composed.lolly', '--json'], state, dir);
  assert.equal(r.status, 0, r.stderr);
  const rows = readLollyFile(new Uint8Array(await readFile(join(dir, 'composed.lolly')))).session.boxes as Array<Record<string, unknown>>;
  assert.deepEqual(rows[0], doc[0], 'a row with no reference is stored as it was');
  assert.match(String(rows[1]!.bg), /^#[0-9a-f]{6}$/i);
  assert.match(String(rows[1]!.tokenLinks), /color\.semantic\.surface/);
  assert.match(String(rows[2]!.fg), /^#[0-9a-f]{6}$/i);
  assert.match(String(rows[2]!.tokenLinks), /color\.semantic\.text/);
}));

test('a document packaged against a --file design system says the file does not carry it, and its next commands keep --file (plan 291 section 6)', () => withDir(async (dir, state) => {
  // The colour links cache the --file system's values; the app opens a .lolly in its own
  // active design system, so a reopen repaints them there unless the person adds that system.
  await writeFile(join(dir, 'brand tokens.json'), await readFile(new URL('fixtures/recreate/tokens.json', import.meta.url)));
  const doc = [
    { id: 'a', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, rot: 0, shape: 'rect', bg: '{color.semantic.surface}' },
    { id: 't', kind: 'text', frame: 'a', x: 40, y: 40, w: 600, h: 80, rot: 0, fg: '{color.semantic.text}', text: 'Hello' },
  ];
  await writeFile(join(dir, 'linked.json'), JSON.stringify(doc));
  const r = lolly(['package', 'linked.json', '--file=brand tokens.json', '--output=linked.lolly', '--json'], state, dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(validate(r.json.result), JSON.stringify(validate.errors));
  const note = r.json.result.warnings.find((w: { code: string }) => w.code === 'design-system.not-carried');
  assert.ok(note, JSON.stringify(r.json.result.warnings));
  assert.match(note.message, /brand tokens\.json/);
  assert.match(note.message, /active design system/);
  assert.deepEqual(r.json.result.next, ['lolly check linked.lolly --file="brand tokens.json"', 'lolly run linked.lolly --export=pptx --file="brand tokens.json"']);
  // The file still carries no design system: the app's #/open route takes it unattended.
  const back = readLollyFile(new Uint8Array(await readFile(join(dir, 'linked.lolly'))));
  assert.equal((back.manifest as unknown as Record<string, unknown>).designSystem, undefined);
  // The human summary says it too.
  const plain = lolly(['package', 'linked.json', '--file=brand tokens.json', '--output=linked2.lolly'], state, dir);
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stderr, /design-system\.not-carried/);
  // Packaged in the content profile's own system, nothing needs saying.
  const own = lolly(['package', 'linked.json', '--output=own.lolly', '--json'], state, dir);
  assert.equal(own.status, 0, own.stderr);
  assert.ok(!own.json.result.warnings.some((w: { code: string }) => w.code === 'design-system.not-carried'), JSON.stringify(own.json.result.warnings));
  assert.deepEqual(own.json.result.next, ['lolly check own.lolly', 'lolly run own.lolly --export=pptx']);
  // With --file but no colour link, there is nothing for a reopen to repaint.
  await writeFile(join(dir, 'plain.json'), JSON.stringify(DOC.filter((row) => row.kind !== 'image')));
  const unlinked = lolly(['package', 'plain.json', '--file=brand tokens.json', '--output=plain.lolly', '--json'], state, dir);
  assert.equal(unlinked.status, 0, unlinked.stderr);
  assert.ok(!unlinked.json.result.warnings.some((w: { code: string }) => w.code === 'design-system.not-carried'), JSON.stringify(unlinked.json.result.warnings));
}));
