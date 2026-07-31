// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's MACHINE contract, pinned (plans/cli-ga-contract.md §5).
 *
 * Three promises, and one test each for every way they can be broken:
 *
 *   §5.1  the exit taxonomy — a script branches on the number, so each code is pinned
 *         against a real invocation of the real entry point, not against a helper.
 *   §5.2  the JSON envelope — one shape, every command, INCLUDING the failure path,
 *         with `schemaVersion` as the thing a consumer keys its parser off.
 *   §5.3  stdout carries the payload and nothing else — verified by piping a binary
 *         export and comparing it byte for byte with the same render written to a file,
 *         with a tool whose hook logs to `console.log` while it renders.
 *
 * Everything runs the REAL binary as a child process against a fixture repo pinned by
 * LOLLY_ROOT: an in-process call can pin neither an exit code nor the stream split, and
 * those two things ARE the contract here.
 *
 * Run with: node --test tests/cli-machine-contract.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, '..', 'shells', 'cli', 'bin', 'lolly.ts');
const root = await mkdtemp(join(tmpdir(), 'lolly-machine-'));
after(() => rm(root, { recursive: true, force: true }));

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">' +
  '<rect width="120" height="80" fill="#3cb44b"/><desc>{{label}}</desc></svg>';

function manifest(id: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id, name: id, version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    description: `${id} description`,
    render: { width: 120, height: 80, formats: ['svg', 'png'] },
    inputs: [{ id: 'label', type: 'text', label: 'Label', default: 'Hamburg' }],
    ...extra,
  });
}

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({
  assets: [{ id: 'demo/logo', name: 'Demo logo', type: 'vector', tags: ['logo'] }],
}));
await writeFile(join(root, 'catalog', 'tools', 'index.json'), JSON.stringify({
  version: '1',
  tools: [
    { id: 'vec-tool', name: 'vec-tool', status: 'community', description: 'vec-tool description', category: 'utility', formats: ['svg', 'png'] },
    { id: 'mic-tool', name: 'mic-tool', status: 'community', description: 'mic-tool description', category: 'utility', formats: ['svg'] },
    { id: 'shadow-tool', name: 'shadow-tool', status: 'community', description: 'shadow-tool description', category: 'utility', formats: ['svg'] },
    { id: 'loud-tool', name: 'loud-tool', status: 'community', description: 'loud-tool description', category: 'utility', formats: ['svg'] },
  ],
}));

const TOOLS: Array<[string, string, string]> = [
  ['vec-tool', SVG, manifest('vec-tool')],
  // Gated on capabilities this shell cannot provide: `run` must exit 3, and `list --json`
  // must say so BEFORE anyone tries.
  ['mic-tool', SVG, manifest('mic-tool', { capabilities: ['microphone', 'screen'] })],
  // An input whose id collides with a reserved export flag — the case where reading the
  // bare id off the manifest would set the export size instead of the input.
  ['shadow-tool', SVG, JSON.stringify({
    id: 'shadow-tool', name: 'shadow-tool', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    render: { width: 120, height: 80, formats: ['svg'] },
    inputs: [{ id: 'width', type: 'number', label: 'Width', default: 1080 }],
  })],
  // A tool whose hook writes to console.log while it renders. hooks.js ships as DATA
  // from another repository, so "no shipped tool does that" is not a property this
  // shell can rely on — and on `--export=png > out.png` the line would land in the PNG.
  ['loud-tool', SVG, manifest('loud-tool', { hooks: { onInit: true } })],
];
for (const [id, template, json] of TOOLS) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  await writeFile(join(root, 'tools', id, 'tool.json'), json);
  await writeFile(join(root, 'tools', id, 'template.html'), template);
}
await writeFile(join(root, 'tools', 'loud-tool', 'hooks.js'),
  'function onInit() {\n' +
  '  console.log("HOOK NOISE ON STDOUT");\n' +
  '  console.info("more noise");\n' +
  '  return {};\n' +
  '}\n');

function cli(args: string[]): Promise<{ stdout: Buffer; stderr: string; code: number }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: root,
      env: { ...process.env, LOLLY_ROOT: root, LOLLY_WEB_DIST: join(root, 'no-such-dist'), NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    let err = '';
    child.stdout!.on('data', (c: Buffer) => out.push(c));
    child.stderr!.on('data', (c: Buffer) => { err += c.toString('utf8'); });
    child.on('close', (code) => done({ stdout: Buffer.concat(out), stderr: err, code: code ?? -1 }));
  });
}

/** Parse stdout as ONE JSON document, failing with the actual bytes when it is not. */
function envelope(r: { stdout: Buffer }): Record<string, any> {
  const text = r.stdout.toString('utf8');
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch (e) {
    assert.fail(`stdout was not one JSON document (${(e as Error).message}): ${JSON.stringify(text.slice(0, 400))}`);
  }
}

/** The envelope keys every command must carry, in the frozen §5.2 shape. */
function assertEnvelopeShape(env: Record<string, any>, command: string): void {
  assert.deepEqual(
    Object.keys(env).sort(),
    ['cli', 'command', 'engine', 'error', 'ok', 'result', 'schemaVersion', 'warnings'],
  );
  assert.equal(env.schemaVersion, 1);
  assert.equal(env.command, command);
  assert.equal(typeof env.ok, 'boolean');
  assert.match(env.engine, /^\d+\.\d+\.\d+/);
  assert.equal(typeof env.cli, 'string');
  assert.ok(Array.isArray(env.warnings));
}

// ── §5.2 the envelope ────────────────────────────────────────────────────────

test('list --json is one envelope, schemaVersion 1', async () => {
  const r = await cli(['list', '--json']);
  assert.equal(r.code, 0);
  const env = envelope(r);
  assertEnvelopeShape(env, 'list');
  assert.equal(env.ok, true);
  assert.equal(env.error, null);
  assert.deepEqual(env.result.tools.map((t: any) => t.id).sort(), ['loud-tool', 'mic-tool', 'shadow-tool', 'vec-tool']);
});

test('describe --json carries the input schema and the real flag spelling', async () => {
  const r = await cli(['describe', 'vec-tool', '--json']);
  assert.equal(r.code, 0);
  const env = envelope(r);
  assertEnvelopeShape(env, 'describe');
  assert.equal(env.result.tool.id, 'vec-tool');
  assert.deepEqual(env.result.tool.formats, ['svg', 'png']);
  const label = env.result.inputs.find((i: any) => i.id === 'label');
  assert.equal(label.flag, '--label=');
  assert.equal(label.type, 'text');
  assert.equal(label.default, 'Hamburg');
});

test('describe --json names the --input.<id>= escape for a shadowed input (B7)', async () => {
  const env = envelope(await cli(['describe', 'shadow-tool', '--json']));
  const width = env.result.inputs.find((i: any) => i.id === 'width');
  // The whole point: an agent reading `--width=` off the manifest would set the EXPORT
  // size and leave the input at its default, silently.
  assert.equal(width.flag, '--input.width=');
  assert.equal(width.shadowedByReservedParam, true);
});

test('assets --json reports the matches and the catalog total', async () => {
  const env = envelope(await cli(['assets', 'logo', '--json']));
  assertEnvelopeShape(env, 'assets');
  assert.deepEqual(env.result.assets.map((a: any) => a.id), ['demo/logo']);
  assert.equal(env.result.total, 1);
  assert.equal(env.result.query, 'logo');
});

test('the envelope covers the FAILURE path: stdout is never empty under --json', async () => {
  const r = await cli(['describe', 'no-such-tool', '--json']);
  assert.equal(r.code, 2);
  // The regression this pins: `validate /nope.png --json` used to write ZERO bytes to
  // stdout, so `… --json > r.json` left an unparseable file and an agent got EOF.
  assert.ok(r.stdout.length > 0, 'stdout carried no envelope');
  const env = envelope(r);
  assertEnvelopeShape(env, 'describe');
  assert.equal(env.ok, false);
  assert.equal(env.result, null);
  assert.equal(env.error.code, 'USAGE');
  assert.equal(env.error.exit, 2);
  assert.equal(env.error.kind, 'UNKNOWN_TOOL');
  assert.equal(typeof env.error.message, 'string');
  // The human copy of the same failure goes to stderr, never into the document.
  assert.match(r.stderr, /Tool not found/);
});

test('validate --json is ONE document for N files, and an unreadable file is a record', async () => {
  const good = join(root, 'plain.svg');
  await writeFile(good, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const r = await cli(['validate', good, join(root, 'missing.svg'), '--json']);
  // The worst file's code: an unreadable path (2) outranks "no credential here" (5).
  assert.equal(r.code, 2);
  const env = envelope(r);
  assertEnvelopeShape(env, 'validate');
  assert.equal(env.result.files.length, 2);
  // Per-file records keep the §5.2 verdict shape…
  assert.equal(env.result.files[0].verdict, 'no-credential');
  assert.equal(env.result.files[0].metadata, null, '--metadata did not run, so it is null, not {}');
  assert.ok(env.result.files[0].resolved.state);
  assert.ok(env.result.files[0].report);
  // …and the missing file is a RECORD, so a list of ten does not lose nine to one typo.
  assert.equal(env.result.files[1].ok, false);
  assert.equal(env.result.files[1].error.kind, 'INPUT_UNREADABLE');
});

test('validate --json on a file with no credential exits 5 and still carries a result', async () => {
  const f = join(root, 'plain2.svg');
  await writeFile(f, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const r = await cli(['validate', f, '--json']);
  assert.equal(r.code, 5, 'no credential is a legitimate negative answer, not an error');
  const env = envelope(r);
  assert.equal(env.ok, false, 'ok mirrors the exit code');
  assert.equal(env.error, null, 'an ANSWER is not an error: result is present');
  assert.equal(env.result.files[0].verdict, 'no-credential');
});

test('smoke --json envelopes the per-tool outcomes; the table moves to stderr', async () => {
  const r = await cli(['smoke', '--only=vec-tool', '--json']);
  assert.equal(r.code, 0);
  const env = envelope(r);
  assertEnvelopeShape(env, 'smoke');
  assert.deepEqual(env.result.tools.map((t: any) => [t.id, t.outcome]), [['vec-tool', 'ok']]);
  assert.equal(env.result.summary.ok, 1);
  assert.match(r.stderr, /vec-tool/, 'the human table is a diagnostic under --json');
});

test('smoke --json emits a failure envelope for a bad --only', async () => {
  const r = await cli(['smoke', '--only=nope', '--json']);
  assert.equal(r.code, 2);
  const env = envelope(r);
  assert.equal(env.ok, false);
  assert.equal(env.error.kind, 'UNKNOWN_TOOL');
});

test('batch --json reports one record per row, each with its own exit code', async () => {
  const csv = join(root, 'rows.csv');
  await writeFile(csv, 'toolId,label,format\nvec-tool,One,svg\nmic-tool,Two,svg\n');
  const r = await cli(['batch', csv, '--out-dir=' + join(root, 'batch-out'), '--keep-going', '--json']);
  // The worst row's code (B13): an unmet capability is UNAVAILABLE_HERE, not a flat 1.
  assert.equal(r.code, 3);
  const env = envelope(r);
  assertEnvelopeShape(env, 'batch');
  assert.equal(env.result.rows[0].ok, true);
  assert.equal(env.result.rows[0].exit, 0);
  assert.equal(env.result.rows[1].ok, false);
  assert.equal(env.result.rows[1].exit, 3);
  assert.equal(env.result.summary.ok, 1);
});

test('a warning is carried IN the envelope, not only printed', async () => {
  const env = envelope(await cli(['batch', '--template=vec-tool,no-such-tool', '--json']));
  assert.equal(env.warnings.length, 1);
  assert.equal(env.warnings[0].code, 'UNKNOWN_TOOL');
  assert.equal(env.warnings[0].kind, 'usage');
  assert.match(env.result.csv, /^toolId,/);
});

test('--json on a render is a usage error, not a silently ignored flag', async () => {
  const r = await cli(['run', 'vec-tool', '--label=x', '--json']);
  assert.equal(r.code, 2);
  const env = envelope(r);
  assert.equal(env.command, 'run');
  assert.equal(env.error.kind, 'UNSUPPORTED_FLAG');
});

// ── §5.1 the exit taxonomy ───────────────────────────────────────────────────

test('exit codes are pinned per outcome', async () => {
  const cases: Array<[string[], number, string]> = [
    [['run', 'vec-tool', '--label=x', '--output=' + join(root, 'ok.svg')], 0, 'a produced file is 0'],
    [['run', 'no-such-tool'], 2, 'an unknown tool is USAGE'],
    [['run'], 2, 'a missing required argument is USAGE'],
    [['run', 'vec-tool', '--export=tiff'], 2, 'an undeclared format is USAGE'],
    [['run', 'mic-tool'], 3, 'an unmet capability is UNAVAILABLE_HERE'],
    [['validate', join(root, 'no-file.png')], 2, 'an unreadable path is USAGE'],
  ];
  for (const [args, code, why] of cases) {
    const r = await cli(args);
    assert.equal(r.code, code, `${why}: ${args.join(' ')} exited ${r.code}\n${r.stderr}`);
  }
});

test('an unmet capability refuses with the capability named, and writes nothing', async () => {
  const out = join(root, 'never.svg');
  const r = await cli(['run', 'mic-tool', '--output=' + out]);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /microphone/);
  await assert.rejects(readFile(out), 'a refused render must not leave a plausible file behind');
});

// ── §5.3 stdout discipline ───────────────────────────────────────────────────

test('a binary export piped to stdout is byte-identical to the same render written to a file', async () => {
  const file = join(root, 'ref.png');
  const written = await cli(['run', 'vec-tool', '--label=Pipe', '--export=png', '--output=' + file]);
  assert.equal(written.code, 0, written.stderr);
  const piped = await cli(['run', 'vec-tool', '--label=Pipe', '--export=png']);
  assert.equal(piped.code, 0, piped.stderr);
  const onDisk = await readFile(file);
  assert.equal(piped.stdout.length, onDisk.length, 'the pipe was truncated or padded');
  assert.ok(piped.stdout.equals(onDisk), 'the piped bytes differ from the written file');
  // …and the diagnostics that a human run prints were on stderr the whole time.
  assert.match(piped.stderr, /catalog integrity/);
});

test("a hook's console.log cannot corrupt a binary pipe", async () => {
  const file = join(root, 'loud.png');
  const written = await cli(['run', 'loud-tool', '--export=png', '--output=' + file]);
  assert.equal(written.code, 0, written.stderr);
  const piped = await cli(['run', 'loud-tool', '--export=png']);
  assert.equal(piped.code, 0, piped.stderr);
  assert.ok(piped.stdout.equals(await readFile(file)));
  // The PNG signature must be the FIRST thing on stdout — a stray log line would land
  // in front of it (or, worse, in the middle of the IDAT).
  assert.deepEqual([...piped.stdout.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(piped.stdout.includes(Buffer.from('HOOK NOISE')), false, 'hook logging reached stdout');
  assert.match(piped.stderr, /HOOK NOISE/, 'and it must still be visible — on stderr');
});

test('--quiet silences the diagnostics but never the payload or an error', async () => {
  const quiet = await cli(['run', 'vec-tool', '--label=Q', '--export=svg', '--quiet']);
  assert.equal(quiet.code, 0);
  assert.match(quiet.stdout.toString('utf8'), /<svg/);
  assert.equal(quiet.stderr.trim(), '', `--quiet left stderr output: ${quiet.stderr}`);
  const failed = await cli(['run', 'no-such-tool', '--quiet']);
  assert.equal(failed.code, 2);
  assert.match(failed.stderr, /Tool not found/, 'an error survives --quiet');
});

test('the byte-determinism docs/cli.md promises for SVG actually holds', async () => {
  // The docs used to claim "same inputs, same bytes" for everything. Measured, that is
  // true of SVG and the DOM-free formats and false of PDF (a /CreationDate), of the
  // browser tier, and of anything signed. Only the promise that survived is pinned here;
  // the browser tier is deliberately absent in this fixture, so it cannot be pinned at
  // all — which is itself the reason the claim was narrowed rather than tested wider.
  const a = await cli(['run', 'vec-tool', '--label=Same', '--export=svg']);
  const b = await cli(['run', 'vec-tool', '--label=Same', '--export=svg']);
  assert.equal(a.code, 0, a.stderr);
  assert.ok(a.stdout.equals(b.stdout), 'two SVG renders of the same inputs differed');
  assert.ok(a.stdout.length > 0);
});

// ── machine discovery (§5.2 result.environment) ──────────────────────────────

test('list --json reports what THIS installation can do, before anything is tried', async () => {
  const env = envelope(await cli(['list', '--json']));
  const e = env.result.environment;
  assert.match(e.engine, /^\d+\.\d+\.\d+/);
  assert.equal(e.root, root);
  assert.ok(e.capabilities.includes('network'));
  assert.ok(e.nativeFormats.includes('svg'));
  assert.equal(e.tiers.domFree.available, true);
  // LOLLY_WEB_DIST points at a directory with no built shell, so the browser tier must
  // report itself unavailable AND say why — that is the whole value of the report.
  assert.equal(e.tiers.browser.available, false);
  assert.match(e.tiers.browser.reason, /web shell/);
  assert.equal(e.env.LOLLY_ROOT, root);
});

test('a tool that cannot run here says so in the listing, not only in an exit code', async () => {
  const env = envelope(await cli(['list', '--json']));
  const byId = Object.fromEntries(env.result.tools.map((t: any) => [t.id, t]));
  assert.equal(byId['vec-tool'].runnableHere, true);
  assert.deepEqual(byId['vec-tool'].nativeFormats, ['svg']);
  assert.equal(byId['mic-tool'].runnableHere, false);
  assert.deepEqual(byId['mic-tool'].unmetCapabilities, ['microphone', 'screen']);
  // …and that listing is the truth: running it really does exit 3.
  assert.equal((await cli(['run', 'mic-tool'])).code, 3);
});
