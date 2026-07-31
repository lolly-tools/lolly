// SPDX-License-Identifier: MPL-2.0
/**
 * The GA CLI contract, pinned (plans/cli-ga-contract.md §2, "BREAK NOW").
 *
 * Everything here is an INTERFACE promise, not an implementation detail: a flag name, a
 * default, an exit code, a refusal. Implementation quality can improve after GA; these
 * cannot move without a major version, so each one gets a test that names the contract
 * item it pins.
 *
 * Hermetic, in the style of tests/cli-fail-loud.test.ts: a fixture repo pinned via
 * LOLLY_ROOT before the first import, and LOLLY_WEB_DIST pointed at a directory with no
 * built shell so the browser tier is deterministically absent and no Chromium is ever
 * launched.
 *
 * Run with: node --test tests/cli-ga-contract.test.ts
 */

import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'lolly-ga-contract-'));
after(() => rm(root, { recursive: true, force: true }));

// The committed platform face, copied in so the text-outlining cases shape real glyphs
// browser-free. Guarded: this file must never fail merely because a checkout lacks it.
const OUTFIT_SRC = join(HERE, '..', 'shells', 'web', 'public', 'fonts', 'Outfit[wght].ttf');
const SKIP_NO_FONT = existsSync(OUTFIT_SRC) ? false : `platform font missing at ${OUTFIT_SRC}`;

const VEC_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">' +
  '<rect width="120" height="80" fill="#3cb44b"/></svg>';
const TEXT_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80">' +
  '<rect width="240" height="80" fill="#ffffff"/>' +
  '<text x="12" y="50" font-family="Outfit" font-size="28" fill="#111111">{{label}}</text></svg>';
const NOFONT_TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80">' +
  '<text x="12" y="50" font-family="Nonexistent Face" font-size="28">{{label}}</text></svg>';

function manifest(id: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id, name: id, version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    render: { width: 120, height: 80, formats: ['svg', 'png'] },
    inputs: [{ id: 'label', type: 'text', label: 'Label', default: 'Hamburg' }],
    ...extra,
  });
}

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await mkdir(join(root, 'catalog', 'fonts', 'ttf'), { recursive: true });
if (!SKIP_NO_FONT) await copyFile(OUTFIT_SRC, join(root, 'catalog', 'fonts', 'ttf', 'Outfit[wght].ttf'));
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
await writeFile(
  join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: 'vec-tool' }, { id: 'text-tool' }, { id: 'nofont-tool' }, { id: 'mic-tool' }, { id: 'shadow-tool' }, { id: 'ico-tool' }, { id: 'xform-tool' }] }),
);

const TOOLS: Array<[string, string, string]> = [
  ['vec-tool', VEC_TEMPLATE, manifest('vec-tool')],
  ['text-tool', TEXT_TEMPLATE, manifest('text-tool')],
  ['nofont-tool', NOFONT_TEMPLATE, manifest('nofont-tool')],
  // A tool gated on a capability this shell cannot provide (contract B11).
  ['mic-tool', VEC_TEMPLATE, manifest('mic-tool', { capabilities: ['microphone', 'screen'] })],
  // A tool whose INPUT is named like a reserved export flag (contract B7) — the shape
  // chart-creator, d3, filter-* and prompt-to-image all have in the shipping catalog.
  ['shadow-tool', '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#000"/><desc>{{width}}</desc></svg>',
    JSON.stringify({
      id: 'shadow-tool', name: 'shadow-tool', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
      render: { width: 120, height: 80, formats: ['svg'] },
      inputs: [{ id: 'width', type: 'number', label: 'Width', default: 1080 }],
    })],
  // Declares a browser-tier-only format (contract §4.3, `ico`): with no Chromium and no
  // built shell, the request must be UNAVAILABLE_HERE, not a generic failure.
  ['ico-tool', VEC_TEMPLATE, JSON.stringify({
    id: 'ico-tool', name: 'ico-tool', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    render: { width: 32, height: 32, formats: ['ico'] }, inputs: [],
  })],
  // A transform tool (file in → bytes out) — the docs promised these stream to stdout
  // without --output; the code wrote a file into the working directory instead (§11).
  ['xform-tool', '<div>transform</div>', JSON.stringify({
    id: 'xform-tool', name: 'xform-tool', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    render: { width: 10, height: 10, formats: ['html'] },
    hooks: { exportFile: true },
    inputs: [{ id: 'source', type: 'file', label: 'File' }],
  })],
];
for (const [id, template, json] of TOOLS) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  await writeFile(join(root, 'tools', id, 'tool.json'), json);
  await writeFile(join(root, 'tools', id, 'template.html'), template);
}
// The transform hook: uppercases the bytes it was given, so the output is verifiable.
await writeFile(join(root, 'tools', 'xform-tool', 'hooks.js'),
  'function exportFile({ model }) {\n' +
  '  const f = (model.find(i => i.id === "source") || {}).value;\n' +
  '  const text = new TextDecoder().decode(f.bytes).toUpperCase();\n' +
  '  return { bytes: new TextEncoder().encode(text), filename: "shouted.txt", mime: "text/plain" };\n' +
  '}\n');

process.env.LOLLY_ROOT = root;
process.env.LOLLY_WEB_DIST = join(root, 'no-such-dist');
delete process.env.LOLLY_WEB_BASE;
delete process.env.LOLLY_STATE_DIR;
delete process.env.LOLLY_TUI_DIR;

const { parseArgs, textMode, resolvePassword, RESERVED_SUBCOMMANDS, VALUE_FLAGS } = await import('../shells/cli/src/args.ts');
const { EXIT, exitCodeFor, errorKind, CliError } = await import('../shells/cli/src/exit-codes.ts');
/** The thrown shape, as a TYPE: `CliError` above is a value binding from a dynamic import. */
type CliErr = InstanceType<typeof CliError>;
const { configureOutput, resetOutput, strictExitCode, recordedWarnings } = await import('../shells/cli/src/output.ts');
const { runToolCli, unmetCapabilities, shadowedInputs, unsupportedReservedParams, explicitInputValues, readProfile } =
  await import('../shells/cli/src/run.ts');
const { verdictExit } = await import('../shells/cli/src/validate.ts');
const { resolveStateDir, resetStateDirWarning } = await import('../packages/node-shell/src/state-dir.ts');
const { CLI_CAPABILITIES, createCliBridge } = await import('../shells/cli/src/bridge.ts');

/** Run a render, capturing stderr. Resets the output module first so warnings from one
 *  case never leak into another's --strict accounting. */
async function run(args: Parameters<typeof runToolCli>[0], opts: { strict?: boolean } = {}): Promise<{ stderr: string }> {
  resetOutput();
  configureOutput({ strict: Boolean(opts.strict) });
  const chunks: string[] = [];
  const result = { get stderr() { return chunks.join(''); } };
  const orig = process.stderr.write.bind(process.stderr);
  (process.stderr as { write: unknown }).write = (s: string) => { chunks.push(String(s)); return true; };
  try {
    await runToolCli(args);
    return result;
  } finally {
    (process.stderr as { write: unknown }).write = orig;
  }
}

let seq = 0;
const outPath = (ext: string): string => join(root, `out-${seq++}.${ext}`);

const BIN = join(HERE, '..', 'shells', 'cli', 'bin', 'lolly.ts');

/**
 * Run the REAL entry point as a child process, against the fixture repo.
 *
 * In-process calls cannot pin an exit code or the stdout/stderr split, which is most of
 * what this contract IS. stdout is kept as bytes because the payload often is.
 */
function cli(args: string[], stdin?: string): Promise<{ stdout: Buffer; stderr: string; code: number }> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: root,
      env: { ...process.env, LOLLY_ROOT: root, LOLLY_WEB_DIST: join(root, 'no-such-dist'), NO_COLOR: '1' },
      stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    if (stdin !== undefined) { child.stdin!.end(stdin); }
    const out: Buffer[] = [];
    let err = '';
    child.stdout!.on('data', (c: Buffer) => out.push(c));
    child.stderr!.on('data', (c: Buffer) => { err += c.toString('utf8'); });
    child.on('close', (code) => resolvePromise({ stdout: Buffer.concat(out), stderr: err, code: code ?? -1 }));
  });
}

// ── the parser (contract §1.3) ───────────────────────────────────────────────

test('`--` ends option parsing, so a value beginning with -- can be passed', () => {
  const { flags, positionals } = parseArgs(['run', 'qr-code', '--url=x', '--', '--not-a-flag']);
  assert.deepEqual(positionals, ['run', 'qr-code', '--not-a-flag']);
  assert.equal(flags.url, 'x');
  assert.equal(flags['not-a-flag'], undefined);
});

test('a bare value-taking flag is a usage error, not the string "1" (B5)', () => {
  assert.throws(() => parseArgs(['qr-code', '--output']), (e: CliErr) => {
    assert.equal(e.exit, EXIT.USAGE);
    assert.equal(e.kind, 'MISSING_FLAG_VALUE');
    assert.match(e.message, /--output needs a value/);
    return true;
  });
  // …while a bare boolean input flag still means true.
  assert.equal(parseArgs(['qr-code', '--dark']).flags.dark, '1');
  assert.equal(parseArgs(['qr-code', '--dark=false']).flags.dark, 'false');
});

test('--trust-anchor accumulates; every other flag is last-wins', () => {
  const { flags, repeated } = parseArgs(['validate', 'a.png', '--trust-anchor=one.pem', '--trust-anchor=two.pem', '--export=svg', '--export=png']);
  assert.deepEqual(repeated['trust-anchor'], ['one.pem', 'two.pem']);
  assert.equal(flags.export, 'png');
});

test('a multiline value survives as one argv element', () => {
  const { flags } = parseArgs(['text-helper', '--body=line one\nline two']);
  assert.equal(flags.body, 'line one\nline two');
});

test('the reserved subcommand words are frozen, and include the deferred `completion`', () => {
  for (const word of ['list', 'describe', 'run', 'assets', 'batch', 'smoke', 'validate', 'install-browser', 'help', 'version', 'completion']) {
    assert.ok(RESERVED_SUBCOMMANDS.includes(word as never), `${word} must be reserved`);
  }
  // No shipped tool id may collide — verified against the fixture ids here, and against
  // the real catalog by scripts/validate-catalog.ts.
  for (const [id] of TOOLS) assert.ok(!RESERVED_SUBCOMMANDS.includes(id as never));
});

test('--text accepts only outline|live', () => {
  assert.equal(textMode(undefined), undefined);
  assert.equal(textMode('outline'), 'outline');
  assert.equal(textMode('live'), 'live');
  assert.throws(() => textMode('paths'), /--text must be/);
});

test('--password-stdin reads the password off stdin and refuses to coexist with --password (B15)', async () => {
  const stdin = async () => Buffer.from('hunter2\n');
  assert.equal(await resolvePassword({ 'password-stdin': '1' }, stdin), 'hunter2');
  assert.equal(await resolvePassword({ password: 'plain' }, stdin), 'plain');
  await assert.rejects(
    () => resolvePassword({ password: 'plain', 'password-stdin': '1' }, stdin),
    /cannot both be given/,
  );
  await assert.rejects(() => resolvePassword({ 'password-stdin': '1' }, async () => Buffer.alloc(0)), /stdin was empty/);
});

test('every value-taking reserved flag is in VALUE_FLAGS (so none of them can parse to "1")', () => {
  for (const f of ['output', 'export', 'filename', 'width', 'height', 'unit', 'dpi', 'user-profile', 'press-profile', 'text']) {
    assert.ok(VALUE_FLAGS.has(f), `${f} must reject its bare form`);
  }
});

// ── exit codes (contract §5.1) ───────────────────────────────────────────────

test('the taxonomy has the frozen numbers', () => {
  assert.deepEqual(
    { ...EXIT },
    { OK: 0, FAILED: 1, USAGE: 2, UNAVAILABLE_HERE: 3, REFUSED: 4, NOT_FOUND: 5, AUTH: 6, INTERNAL: 70 },
  );
});

test('classification keys on typed sentinels, never on prose', () => {
  assert.equal(exitCodeFor(Object.assign(new Error('x'), { code: 'FORMAT_UNAVAILABLE' })), EXIT.UNAVAILABLE_HERE);
  assert.equal(exitCodeFor(Object.assign(new Error('x'), { code: 'NEEDS_BROWSER' })), EXIT.UNAVAILABLE_HERE);
  assert.equal(exitCodeFor(Object.assign(new Error('x'), { name: 'BrowserError' })), EXIT.UNAVAILABLE_HERE);
  assert.equal(exitCodeFor(Object.assign(new Error('x'), { name: 'RenderIntegrityError' })), EXIT.FAILED);
  assert.equal(exitCodeFor(Object.assign(new Error('x'), { name: 'FormatMismatchError' })), EXIT.REFUSED);
  assert.equal(exitCodeFor(Object.assign(new Error('x'), { name: 'DeepSourceError' })), EXIT.REFUSED);
  assert.equal(exitCodeFor(Object.assign(new Error('x'), { code: 'ENOENT' })), EXIT.USAGE);
  assert.equal(exitCodeFor(new Error('a plain failure')), EXIT.FAILED);
  // A programmer error is 70, so an agent stops retrying it.
  assert.equal(exitCodeFor(new TypeError('undefined is not a function')), EXIT.INTERNAL);
  assert.equal(exitCodeFor('a thrown string'), EXIT.INTERNAL);
  // error.kind is the stable handle, not error.message.
  assert.equal(errorKind(new CliError('m', EXIT.REFUSED, 'TEXT_NOT_OUTLINED')), 'TEXT_NOT_OUTLINED');
});

// ── B1/B2: the --profile collision ───────────────────────────────────────────

test('--profile is the PRESS condition; the user-profile file has its own flag (B1)', async () => {
  const out = outPath('svg');
  // `--profile=fogra39` must not be treated as a file path any more: this run succeeds.
  await run({ toolId: 'vec-tool', params: { profile: 'fogra39' }, outputPath: out, format: 'svg' });
  assert.equal(existsSync(out), true);
});

test('a missing --user-profile file is a usage error, not a warning (B2)', async () => {
  await assert.rejects(
    () => readProfile(join(root, 'no-such-profile.json')),
    (e: CliErr) => {
      assert.equal(e.exit, EXIT.USAGE);
      assert.equal(e.kind, 'PROFILE_UNREADABLE');
      assert.match(e.message, /Nothing was rendered/);
      return true;
    },
  );
});

test('an unparseable --user-profile file is a usage error too', async () => {
  const bad = join(root, 'bad-profile.json');
  await writeFile(bad, '{ not json');
  await assert.rejects(() => readProfile(bad), (e: CliErr) => {
    assert.equal(e.exit, EXIT.USAGE);
    assert.equal(e.kind, 'PROFILE_INVALID');
    return true;
  });
  const good = join(root, 'good-profile.json');
  await writeFile(good, JSON.stringify({ firstname: 'Ada' }));
  assert.deepEqual(await readProfile(good), { firstname: 'Ada' });
});

// ── B6: reserved params stop being silent ────────────────────────────────────

test('--cuts is refused with exit 3 rather than rendering one frame (B6)', async () => {
  const out = outPath('svg');
  await assert.rejects(
    () => run({ toolId: 'vec-tool', params: { cuts: '6' }, outputPath: out, format: 'svg' }),
    (e: CliErr) => {
      assert.equal(e.exit, EXIT.UNAVAILABLE_HERE);
      assert.equal(e.kind, 'CUTS_UNAVAILABLE');
      assert.match(e.message, /contact sheet/);
      return true;
    },
  );
  assert.equal(existsSync(out), false, 'a silent single frame would have written a file here');
});

test('reserved params the CLI cannot honour warn instead of vanishing (B6)', async () => {
  assert.deepEqual(
    unsupportedReservedParams({ copy: '1', slot: 'a', full: '1', options: '1', nostage: '1', _v: '2', width: '10' }).sort(),
    ['_v', 'copy', 'full', 'nostage', 'options', 'slot'],
  );
  const out = outPath('svg');
  const { stderr } = await run({ toolId: 'vec-tool', params: { copy: '1' }, outputPath: out, format: 'svg' });
  assert.match(stderr, /--copy is not supported by the CLI/);
  assert.equal(existsSync(out), true, 'an unsupported reserved param warns; it does not fail the render');
});

test('--strict promotes those warnings to exit 2', async () => {
  const out = outPath('svg');
  await run({ toolId: 'vec-tool', params: { copy: '1' }, outputPath: out, format: 'svg' }, { strict: true });
  assert.equal(strictExitCode(), EXIT.USAGE);
  assert.equal(recordedWarnings()[0]?.code, 'RESERVED_UNSUPPORTED');
  resetOutput();
});

test('--filename names the output file when --output is absent (B6)', async () => {
  const name = `filename-${seq++}.svg`;
  const cwd = process.cwd();
  process.chdir(root);
  try {
    await run({ toolId: 'vec-tool', params: { filename: name }, format: 'svg' });
    assert.equal(existsSync(join(root, name)), true);
  } finally {
    process.chdir(cwd);
  }
});

test('--output wins over --filename, and says so', async () => {
  const out = outPath('svg');
  const { stderr } = await run({ toolId: 'vec-tool', params: { filename: 'ignored.svg' }, outputPath: out, format: 'svg' });
  assert.equal(existsSync(out), true);
  assert.match(stderr, /wins over --filename/);
});

// ── B7: inputs shadowed by reserved flags ────────────────────────────────────

test('a reserved flag that shadows a declared input is announced (B7)', async () => {
  assert.deepEqual(shadowedInputs({ width: '999' }, { inputs: [{ id: 'width' }] }), ['width']);
  assert.deepEqual(shadowedInputs({ width: '999' }, { inputs: [{ id: 'label' }] }), []);
  const out = outPath('svg');
  const { stderr } = await run({ toolId: 'shadow-tool', params: { width: '999' }, outputPath: out, format: 'svg' });
  assert.match(stderr, /--width is a reserved export flag AND an input/);
  assert.match(stderr, /--input\.width=/);
});

test('--input.<id>= reaches the input the reserved flag cannot (B7)', async () => {
  const values = explicitInputValues({ 'input.width': '42' }, { inputs: [{ id: 'width', type: 'number' }] });
  assert.deepEqual(values, { width: 42 });        // coerced by the ENGINE's own parser
  const out = outPath('svg');
  await run({ toolId: 'shadow-tool', params: { 'input.width': '42' }, outputPath: out, format: 'svg' });
  assert.match(await readFile(out, 'utf8'), /<desc>42<\/desc>/);
});

test('--input.<id> naming nothing warns rather than silently doing nothing', () => {
  resetOutput();
  const values = explicitInputValues({ 'input.nope': 'x' }, { inputs: [{ id: 'width', type: 'number' }] });
  assert.deepEqual(values, {});
  assert.equal(recordedWarnings()[0]?.code, 'UNKNOWN_INPUT');
  resetOutput();
});

// ── B11: capabilities ────────────────────────────────────────────────────────

test('the CLI declares the capabilities it can fulfil, and no others', async () => {
  assert.deepEqual([...CLI_CAPABILITIES], ['network', 'wasm', 'compose', 'capture']);
  const jsdom = await import('jsdom');
  const dom = new jsdom.JSDOM('<!DOCTYPE html><body></body>');
  const host = await createCliBridge({ dom: dom.window as never, profile: {} } as never);
  assert.deepEqual([...(host.capabilities ?? [])], ['network', 'wasm', 'compose', 'capture']);
  // …and the clipboard refusal is classified, not a bare throw (contract §4.4).
  await assert.rejects(() => host.clipboard.writeText('x'), (e: CliErr) => {
    assert.equal(e.exit, EXIT.UNAVAILABLE_HERE);
    assert.equal(e.kind, 'CAPABILITY_UNAVAILABLE');
    assert.match(e.message, /--output/);
    return true;
  });
});

test('a tool needing an unmet capability REFUSES with exit 3 instead of rendering a placeholder (B11)', async () => {
  assert.deepEqual(unmetCapabilities({ capabilities: ['microphone', 'screen'] }), ['microphone', 'screen']);
  assert.deepEqual(unmetCapabilities({ capabilities: ['network', 'compose'] }), []);
  const out = outPath('svg');
  await assert.rejects(
    () => run({ toolId: 'mic-tool', params: {}, outputPath: out, format: 'svg' }),
    (e: CliErr) => {
      assert.equal(e.exit, EXIT.UNAVAILABLE_HERE);
      assert.equal(e.kind, 'CAPABILITY_UNAVAILABLE');
      assert.match(e.message, /"microphone" \+ "screen"/);
      return true;
    },
  );
  assert.equal(existsSync(out), false);
});

// ── B12: vector text as paths ────────────────────────────────────────────────

test('CLI svg export OUTLINES text by default (B12/§6a)', { skip: SKIP_NO_FONT }, async () => {
  const out = outPath('svg');
  await run({ toolId: 'text-tool', params: {}, outputPath: out, format: 'svg' });
  const svg = await readFile(out, 'utf8');
  assert.doesNotMatch(svg, /<text\b/, 'live <text> must not survive the default export');
  assert.match(svg, /<path[^>]*\bd="M/, 'glyph outlines must be present');
  assert.doesNotMatch(svg, /Hamburg/, 'the string itself is gone once it is geometry');
});

test('--text=live is the opt-out, and keeps editable <text>', { skip: SKIP_NO_FONT }, async () => {
  const out = outPath('svg');
  await run({ toolId: 'text-tool', params: {}, outputPath: out, format: 'svg', text: 'live' });
  const svg = await readFile(out, 'utf8');
  assert.match(svg, /<text\b/);
  assert.match(svg, /Hamburg/);
});

test('an unresolvable font falls back to live <text> WITH a warning, never silently', async () => {
  const out = outPath('svg');
  const { stderr } = await run({ toolId: 'nofont-tool', params: {}, outputPath: out, format: 'svg' });
  const svg = await readFile(out, 'utf8');
  assert.match(svg, /<text\b/, 'SVG can represent live text, so the file still renders');
  assert.match(stderr, /kept live <text>/);
  assert.match(stderr, /Nonexistent Face/);
});

test('--strict turns that fallback into a refusal (exit 4) with nothing written', async () => {
  const out = outPath('svg');
  await assert.rejects(
    () => run({ toolId: 'nofont-tool', params: {}, outputPath: out, format: 'svg' }, { strict: true }),
    (e: CliErr) => {
      assert.equal(e.exit, EXIT.REFUSED);
      assert.equal(e.kind, 'TEXT_NOT_OUTLINED');
      return true;
    },
  );
  assert.equal(existsSync(out), false);
  resetOutput();
});

// ── B10: `-` means stdout ────────────────────────────────────────────────────

test('--output=- streams to stdout instead of writing a file called "-"', async () => {
  const { stdout, code } = await cli(['run', 'vec-tool', '--export=svg', '--output=-']);
  assert.equal(code, EXIT.OK);
  assert.match(stdout.toString('utf8'), /<svg/);
  assert.equal(existsSync(join(root, '-')), false);
});

// ── the entry point, end to end (a real child process) ───────────────────────

test('stdout carries the payload and stderr carries the diagnostics (§5.3)', async () => {
  const { stdout, stderr, code } = await cli(['run', 'vec-tool', '--export=svg', '--copy=1']);
  assert.equal(code, EXIT.OK);
  assert.match(stdout.toString('utf8'), /^<\?xml/, 'stdout is the artefact, byte one');
  assert.doesNotMatch(stdout.toString('utf8'), /Warning|Note:/);
  assert.match(stderr, /--copy is not supported by the CLI/);
});

test('the whole payload reaches the pipe — no exit() truncation (B3)', async () => {
  const { stdout, code } = await cli(['run', 'text-tool', '--export=svg', '--label=' + 'x'.repeat(200)]);
  assert.equal(code, EXIT.OK);
  // Whatever the length, the document must be COMPLETE: a truncated write loses the tail.
  assert.match(stdout.toString('utf8').trimEnd(), /<\/svg>$/);
});

test('--quiet silences stderr but never the error, and --strict fails the run', async () => {
  const quiet = await cli(['run', 'vec-tool', '--export=svg', '--copy=1', '--quiet', '--output=-']);
  assert.equal(quiet.stderr, '', 'a warning is a diagnostic, and --quiet means no diagnostics');
  assert.equal(quiet.code, EXIT.OK);
  const strict = await cli(['run', 'vec-tool', '--export=svg', '--copy=1', '--strict', '--output=-']);
  assert.equal(strict.code, EXIT.USAGE, 'a warning under --strict is a failure');
  const err = await cli(['run', 'no-such-tool', '--export=svg', '--quiet']);
  assert.equal(err.code, EXIT.USAGE);
  assert.match(err.stderr, /Tool not found/, '--quiet must not swallow the error');
});

test('the explicit verbs work and can never be shadowed by a tool id (§1.1)', async () => {
  const list = await cli(['list']);
  assert.equal(list.code, EXIT.OK);
  assert.match(list.stdout.toString('utf8'), /vec-tool/);
  const describe = await cli(['describe', 'vec-tool']);
  assert.equal(describe.code, EXIT.OK);
  assert.match(describe.stdout.toString('utf8'), /--label=<text>/);
  // `run` renders at defaults, which the bare sugar cannot do (no flags ⇒ describe).
  const ran = await cli(['run', 'vec-tool', '--output=-']);
  assert.match(ran.stdout.toString('utf8'), /<svg/);
  const sugar = await cli(['vec-tool']);
  assert.match(sugar.stdout.toString('utf8'), /Inputs:/);
  assert.equal((await cli(['describe'])).code, EXIT.USAGE);
});

test('--help documents the exit codes; --version reports both versions', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, EXIT.OK);
  const text = help.stdout.toString('utf8');
  for (const line of ['0  OK', '2  USAGE', '3  UNAVAILABLE_HERE', '4  REFUSED', '5  NOT_FOUND', '6  AUTH', '70 INTERNAL']) {
    assert.ok(text.includes(line), `--help must document exit code line "${line}"`);
  }
  assert.match((await cli(['--version'])).stdout.toString('utf8'), /^lolly \d+\.\d+\.\d+ \(engine \d+\.\d+\.\d+\)$/m);
});

test('--json is refused on a render rather than accepted and ignored (§3)', async () => {
  const { code, stderr } = await cli(['run', 'vec-tool', '--export=svg', '--json']);
  assert.equal(code, EXIT.USAGE);
  assert.match(stderr, /--json is not available on a render/);
});

test('batch refuses --output instead of writing somewhere else (B13)', async () => {
  const { code, stderr } = await cli(['batch', 'rows.csv', '--output=zzz.svg']);
  assert.equal(code, EXIT.USAGE);
  assert.match(stderr, /use --out-dir=<dir>, not --output/);
});

test('an unmet capability exits 3 from the real binary, and writes nothing (B11)', async () => {
  const out = join(root, 'never-written.svg');
  const { code, stderr } = await cli(['run', 'mic-tool', '--export=svg', `--output=${out}`]);
  assert.equal(code, EXIT.UNAVAILABLE_HERE);
  assert.match(stderr, /needs "microphone" \+ "screen"/);
  assert.equal(existsSync(out), false);
});

test('validate reports a missing file as USAGE and a clean file as NOT_FOUND (B8/B9)', async () => {
  const plain = join(root, 'plain.svg');
  await writeFile(plain, VEC_TEMPLATE);
  assert.equal((await cli(['validate', join(root, 'nope.png')])).code, EXIT.USAGE);
  assert.equal((await cli(['validate', plain])).code, EXIT.NOT_FOUND);
  // N files, worst code wins — and every file gets a record, not just the first.
  const both = await cli(['validate', plain, join(root, 'nope.png')]);
  assert.equal(both.code, EXIT.USAGE, 'an unreadable path outranks a legitimate "no credential"');
  assert.match(both.stdout.toString('utf8'), /plain\.svg/);
  // --require=none is the inspection mode: readable ⇒ 0, whatever the verdict.
  assert.equal((await cli(['validate', plain, '--require=none'])).code, EXIT.OK);
  assert.equal((await cli(['validate', plain, '--require=nonsense'])).code, EXIT.USAGE);
});

// ── B14: LOLLY_TUI_DIR → LOLLY_STATE_DIR ─────────────────────────────────────

test('LOLLY_STATE_DIR is the name; LOLLY_TUI_DIR still works and says it is deprecated (B14)', () => {
  resetStateDirWarning();
  const notes: string[] = [];
  const push = (m: string): number => notes.push(m);
  assert.deepEqual(
    resolveStateDir({ LOLLY_STATE_DIR: '/tmp/state' } as NodeJS.ProcessEnv, push),
    { dir: '/tmp/state', explicit: true, deprecated: false },
  );
  assert.deepEqual(notes, [], 'the current name must not print a deprecation note');

  const old = resolveStateDir({ LOLLY_TUI_DIR: '/tmp/old' } as NodeJS.ProcessEnv, push);
  assert.equal(old.dir, '/tmp/old');
  assert.equal(old.deprecated, true);
  assert.match(notes.join(''), /LOLLY_TUI_DIR is deprecated — use LOLLY_STATE_DIR/);
  // Once per process, not once per read.
  resolveStateDir({ LOLLY_TUI_DIR: '/tmp/old' } as NodeJS.ProcessEnv, push);
  assert.equal(notes.length, 1);

  const fresh = resolveStateDir({ LOLLY_STATE_DIR: '/a', LOLLY_TUI_DIR: '/b' } as NodeJS.ProcessEnv, push);
  assert.equal(fresh.dir, '/a', 'the new name wins when both are set');
  assert.equal(resolveStateDir({} as NodeJS.ProcessEnv, () => {}).explicit, false);
  resetStateDirWarning();
});

test('host.state persists to LOLLY_STATE_DIR when one is named, and stays in memory otherwise', async () => {
  const jsdom = await import('jsdom');
  const dom = new jsdom.JSDOM('<!DOCTYPE html><body></body>');
  const dir = join(root, 'statedir');
  process.env.LOLLY_STATE_DIR = dir;
  try {
    const host = await createCliBridge({ dom: dom.window as never, profile: {} } as never);
    await host.state.save('slot-a', { hello: 'world' });
    assert.equal(existsSync(join(dir, 'state', 'slot-a.json')), true);
    // A SECOND process (a second bridge) sees it — which is the whole point: a tool that
    // saves state used to be unscriptable, because every run started empty.
    const host2 = await createCliBridge({ dom: dom.window as never, profile: {} } as never);
    assert.deepEqual(await host2.state.load('slot-a'), { hello: 'world' });
    assert.deepEqual((await host2.state.list()).map(e => e.slot), ['slot-a']);
    await host2.state.delete('slot-a');
    assert.equal(existsSync(join(dir, 'state', 'slot-a.json')), false);
  } finally {
    delete process.env.LOLLY_STATE_DIR;
  }
  const ephemeral = await createCliBridge({ dom: dom.window as never, profile: {} } as never);
  await ephemeral.state.save('slot-b', { x: 1 });
  assert.equal(existsSync(join(root, 'state')), false, 'no state dir named ⇒ nothing on disk');
});

// ── B8: validate exit codes ──────────────────────────────────────────────────

test('the verdict ladder maps onto the taxonomy (B8/§6b)', () => {
  assert.equal(verdictExit('valid'), EXIT.OK);
  assert.equal(verdictExit('trusted'), EXIT.OK);
  assert.equal(verdictExit('lolly'), EXIT.OK);
  assert.equal(verdictExit('delivered'), EXIT.OK);
  // Expired is 0 BY DESIGN: Lolly signs with 7/30/90/365-day on-device certs.
  assert.equal(verdictExit('expired'), EXIT.OK);
  assert.equal(verdictExit('expired', true), EXIT.REFUSED, '--strict is the stricter reading');
  assert.equal(verdictExit('likelyLolly'), EXIT.REFUSED);
  assert.equal(verdictExit('invalid'), EXIT.REFUSED);
  assert.equal(verdictExit('none'), EXIT.NOT_FOUND, 'a legitimate negative, not a failure');
});

before(() => resetOutput());

// ── §4.3 ico, §11 transform tools, B10 stdin ────────────────────────────────

test('a browser-tier-only format with no browser is UNAVAILABLE_HERE, not FAILED (§4.3)', async () => {
  const out = join(root, 'icon.ico');
  const { code, stderr } = await cli(['run', 'ico-tool', '--export=ico', `--output=${out}`]);
  assert.equal(code, EXIT.UNAVAILABLE_HERE, 'exit 3 is the retry-on-another-runner code');
  assert.match(stderr, /Cannot export "ico"/);
  assert.equal(existsSync(out), false);
  // An UNDECLARED format is a different answer: that is the caller's mistake, exit 2.
  assert.equal((await cli(['run', 'vec-tool', '--export=ico'])).code, EXIT.USAGE);
});

test('a transform tool streams to stdout without --output, and reads `-` from stdin (§11/B10)', async () => {
  const src = join(root, 'shout.txt');
  await writeFile(src, 'quiet words');
  const piped = await cli(['run', 'xform-tool', `--source=${src}`]);
  assert.equal(piped.code, EXIT.OK);
  assert.equal(piped.stdout.toString('utf8'), 'QUIET WORDS');
  assert.equal(existsSync(join(root, 'shouted.txt')), false, 'no surprise file in the working directory');
  assert.match(piped.stderr, /streaming to stdout/);
  // …and `-` reads the file from stdin, so the tool composes with the shell.
  const fromStdin = await cli(['run', 'xform-tool', '--source=-'], 'from a pipe');
  assert.equal(fromStdin.code, EXIT.OK);
  assert.equal(fromStdin.stdout.toString('utf8'), 'FROM A PIPE');
  // --filename is how you ask for a file instead.
  const named = await cli(['run', 'xform-tool', `--source=${src}`, '--filename=out.txt']);
  assert.equal(named.code, EXIT.OK);
  assert.equal(await readFile(join(root, 'out.txt'), 'utf8'), 'QUIET WORDS');
});
