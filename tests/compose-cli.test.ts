// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly compose` (plan 291 W6) from the command line: the reserved word and its flags,
 * `--list` on each profile, a three-slide spec composed, packaged and checked clean,
 * `--theme=dark` taking the dark twins, the master ladder (`--file` falls to the
 * neutral master, `--master` wins), the `lolly_compose` MCP tool handing back the same
 * document for the same spec, the refusals, and suggest to compose to package (pictures
 * from `--source` alone) to check with the `--edits-out` file (0 missing). Run as CI runs, on the public
 * lolly-start profile with an empty state directory; the slide text is synthetic.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

import { COMPOSE_BOOL_FLAGS, COMPOSE_PATH_FLAGS, COMPOSE_VALUE_FLAGS, RESERVED_SUBCOMMANDS } from '../shells/cli/src/args.ts';
import { COMPOSE_HELP } from '../shells/cli/src/compose.ts';
import { needsContentRoot } from '../shells/cli/src/content-root.ts';
import { DESIGN_COMPOSE_CASES, DESIGN_COMPOSE_EMPHASIS_MODES, DESIGN_COMPOSE_LOGO_MODES, DESIGN_COMPOSE_NOTE_CODES } from '../packages/core/src/design-compose-v1.ts';

const ROOT = new URL('..', import.meta.url);
const REPO = ROOT.pathname;
const TOKENS = new URL('./fixtures/design-brief/tokens.json', import.meta.url).pathname;
const NEUTRAL_MASTERS = new URL('../brands/lolly-start/catalog/assets/lolly/slides/masters.json', import.meta.url).pathname;
const SCHEMA = JSON.parse(readFileSync(new URL('../schemas/design-compose-v1.schema.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { addSchema: (s: unknown) => void; compile: (s: unknown) => Validator };
const ajv = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false });
ajv.addSchema(SCHEMA);
const validateReport = ajv.compile({ $ref: 'https://lolly.tools/schemas/design-compose-v1.schema.json#/$defs/report' });
const validateCatalog = ajv.compile({ $ref: 'https://lolly.tools/schemas/design-compose-v1.schema.json#/$defs/catalog' });

const SPEC = {
  footer: 'Field notes',
  slides: [
    { archetype: 'title', slots: { title: 'Quarterly field notes', subtitle: 'What the team learned this spring' }, notes: 'Open with the headline number.' },
    { archetype: 'content', slots: { title: 'Three things changed', body: '- Orders arrive earlier in the week\n- Returns fell by a third\n- Support moved to chat' } },
    { archetype: 'closing-thanks', slots: { title: 'Thank you', subtitle: 'Questions welcome', caption: 'team@example.com' } },
  ],
};

type Run = { status: number | null; stdout: string; json: Record<string, any>; stderr: string };

function lolly(args: string[], state: string, opts: { input?: string; profile?: string } = {}): Run {
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, ...(opts.input !== undefined ? { input: opts.input } : {}),
    env: { ...process.env, LOLLY_PROFILE: opts.profile ?? 'lolly-start', LOLLY_STATE_DIR: state, NO_COLOR: '1' },
  });
  let json: Record<string, any> = {};
  try { json = JSON.parse(run.stdout); } catch { /* the assertion on status reports stderr */ }
  return { status: run.status, stdout: run.stdout, json, stderr: run.stderr };
}

async function withDir<T>(fn: (dir: string, state: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-compose-cli-'));
  try { return await fn(dir, join(dir, 'state')); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('compose is a reserved verb that runs with no content, with its own flags', () => {
  assert.ok((RESERVED_SUBCOMMANDS as readonly string[]).includes('compose'));
  assert.equal(needsContentRoot('compose'), false, 'the ladder ends at the engine\'s neutral master');
  assert.deepEqual([...COMPOSE_VALUE_FLAGS], ['inventory', 'source', 'size', 'theme', 'themes', 'file', 'master', 'fit', 'output', 'edits-out', 'asset']);
  assert.deepEqual([...COMPOSE_BOOL_FLAGS], ['list', 'suggest', 'force']);
  assert.deepEqual([...COMPOSE_PATH_FLAGS], ['inventory', 'source', 'file', 'master', 'output', 'edits-out']);
});

test('compose --help prints the verb\'s own help, naming every key of the spec, a slide and its furniture', () => withDir(async (_dir, state) => {
  const run = lolly(['compose', '--help'], state);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^lolly compose: /, 'compose --help printed the global help');
  const defs = SCHEMA.$defs as Record<string, { properties: Record<string, unknown> }>;
  for (const def of ['spec', 'slide', 'furniture'] as const) {
    for (const key of Object.keys(defs[def]!.properties)) {
      assert.match(run.stdout, new RegExp(`(^|[\\s"{,])${key.replace('$', '\\$')}\\b`, 'm'), `compose --help does not name the ${def} key ${key}`);
    }
  }
  for (const flag of [...COMPOSE_VALUE_FLAGS, ...COMPOSE_BOOL_FLAGS]) assert.ok(run.stdout.includes(`--${flag}`), `compose --help does not show --${flag}`);
  assert.ok(run.stdout.includes('"edits"'), 'compose --help should say the --edits-out shape');
}));

/** The report notes a spec key can raise (plan 291 M3b): dark per slide, deck furniture, emphasis and sentence case. */
const SPEC_NOTE_CODES = [
  'compose.dark.themed', 'compose.dark.none', 'compose.ground.ignored',
  'compose.emphasis.accent', 'compose.emphasis.no-accent', 'compose.case.sentence', 'compose.furniture.unknown',
] as const;

test('compose --help names every slot object key, each emphasis, case and logo mode, and the notes those keys raise (plan 291 M3b)', () => {
  const slotObject = (SCHEMA.$defs as Record<string, { properties: Record<string, unknown> }>).slotObject!;
  for (const key of Object.keys(slotObject.properties)) {
    assert.match(COMPOSE_HELP, new RegExp(`(^|[\\s"{,])${key.replace('$', '\\$')}\\b`, 'm'), `compose --help does not name the slot key ${key}`);
  }
  for (const mode of [...DESIGN_COMPOSE_EMPHASIS_MODES, ...DESIGN_COMPOSE_CASES, ...DESIGN_COMPOSE_LOGO_MODES]) {
    assert.match(COMPOSE_HELP, new RegExp(`\\b${mode}\\b`), `compose --help does not name the mode ${mode}`);
  }
  for (const code of SPEC_NOTE_CODES) {
    assert.ok((DESIGN_COMPOSE_NOTE_CODES as readonly string[]).includes(code), `${code} is no longer a compose note code; update this list`);
    assert.ok(COMPOSE_HELP.includes(code), `compose --help does not say when compose writes the ${code} note`);
  }
});

test('--list --json: the lolly-start master\'s archetypes, each with its slots and dark twin', () => withDir(async (_dir, state) => {
  const run = lolly(['compose', '--list', '--json'], state);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.json.command, 'compose');
  const { master, archetypes, notes } = run.json.result;
  assert.equal(master.id, 'lolly/slides/neutral');
  assert.equal(master.origin, 'catalog');
  assert.deepEqual(notes, []);
  assert.equal(validateCatalog(archetypes), true, JSON.stringify(validateCatalog.errors));
  const content = archetypes.find((a: { id: string }) => a.id === 'content');
  assert.equal(content.dark, 'content-dark');
  assert.deepEqual(content.slots.map((s: { key: string }) => s.key), ['title', 'body']);
  assert.ok(!archetypes.some((a: { id: string }) => a.id.endsWith('-dark')), 'the catalogue lists the light archetypes; twins are named on each');
  const human = lolly(['compose', '--list'], state);
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /^lolly\/slides\/neutral \S+ "[^"]+" \(catalog\)/);
  assert.match(human.stdout, /^ {2}content +light +title body +dark: content-dark$/m);
}));

test('--list --json on the suse profile lists that profile\'s catalog master', (t) => withDir(async (_dir, state) => {
  // The private SUSE pack is absent from a public clone, so name the skip rather than
  // pass quietly: a green run would otherwise mean the profile was never resolved.
  if (!existsSync(`${REPO}brands/suse/catalog`)) {
    t.skip('brands/suse is not checked out, so the suse profile cannot be resolved here');
    return;
  }
  const run = lolly(['compose', '--list', '--json'], state, { profile: 'suse' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.json.result.master.origin, 'catalog');
  assert.notEqual(run.json.result.master.id, 'lolly/slides/neutral');
  assert.equal(validateCatalog(run.json.result.archetypes), true, JSON.stringify(validateCatalog.errors));
}));

test('a three-slide spec composes, packages and checks with no errors; the MCP tool returns the same document', () => withDir(async (dir, state) => {
  const spec = join(dir, 'spec.json');
  await writeFile(spec, JSON.stringify(SPEC));
  const out = join(dir, 'deck.json');
  const edits = join(dir, 'edits.json');
  const run = lolly(['compose', spec, '--size=1920x1080', `--output=${out}`, `--edits-out=${edits}`, '--json'], state);
  assert.equal(run.status, 0, run.stderr);
  const { report, next } = run.json.result;
  assert.equal(validateReport(report), true, JSON.stringify(validateReport.errors));
  assert.deepEqual(report.master, { id: 'lolly/slides/neutral', version: report.master.version, origin: 'catalog' });
  assert.deepEqual(report.size, { width: 1920, height: 1080 });
  assert.deepEqual(report.slides.map((s: { archetype: string }) => s.archetype), ['title', 'content', 'closing-thanks']);
  for (const slide of report.slides) assert.ok(slide.fit.every((f: { overflow: boolean }) => !f.overflow), `slide ${slide.index + 1} clips`);
  assert.deepEqual(JSON.parse(await readFile(edits, 'utf8')), { edits: [] });
  assert.match(next[0], /^lolly package /);

  const doc = JSON.parse(await readFile(out, 'utf8')) as { boxes: Array<Record<string, unknown>>; __export_width: string };
  assert.equal(doc.__export_width, '1920');
  const frames = doc.boxes.filter((b) => b.kind === 'frame');
  assert.deepEqual(frames.map((f) => f.order), [0, 1, 2], 'frames carry their place in the deck');
  assert.ok(frames.every((f) => f.master === 'lolly/slides/neutral' && typeof f.archetype === 'string'));
  assert.equal(frames[0]!.notes, 'Open with the headline number.');
  const title = doc.boxes.find((b) => b.id === 's02.title')!;
  assert.equal(title.role, 'title');
  assert.equal(title.pad, 0);
  assert.ok(doc.boxes.filter((b) => b.furniture).every((b) => b.locked === true), 'furniture is locked');

  const lolly1 = join(dir, 'deck.lolly');
  const pack = lolly(['package', out, `--output=${lolly1}`, '--json'], state);
  assert.equal(pack.status, 0, pack.stderr);
  const check = lolly(['check', lolly1, '--browser=off', '--json'], state);
  assert.equal(check.json.result?.summary?.error, 0, `${check.stdout}\n${check.stderr}`);
  assert.ok(check.status === 0 || check.status === 5, `check exit ${check.status}`);

  // The MCP tool runs the same composer on the same profile.
  process.env.LOLLY_PROFILE = 'lolly-start';
  const { callCompose } = await import('../services/mcp/src/compose.ts');
  const mcp = await callCompose({ spec: SPEC, size: '1920x1080' }, {});
  assert.ok(!mcp.isError, JSON.stringify(mcp.content[0]));
  assert.deepEqual(mcp.structuredContent.document, doc);
}));

test('--theme=dark takes each archetype\'s dark twin; one without a twin keeps itself', () => withDir(async (dir, state) => {
  const spec = join(dir, 'spec.json');
  await writeFile(spec, JSON.stringify(SPEC));
  const run = lolly(['compose', spec, '--theme=dark', '--json'], state);
  assert.equal(run.status, 0, run.stderr);
  const slides = run.json.result.report.slides as Array<{ archetype: string; requested: string; ground: string }>;
  assert.deepEqual(slides.map((s) => s.archetype), ['title', 'content-dark', 'closing-thanks']);
  assert.deepEqual(slides.map((s) => s.requested), ['title', 'content', 'closing-thanks']);
  assert.ok(slides.every((s) => s.ground === 'dark'));
  assert.ok(Array.isArray(run.json.result.document.boxes), 'without --output the document is in the envelope');
}));

test('the master ladder: a --file system that is not the profile\'s falls to the neutral master; --master wins', () => withDir(async (dir, state) => {
  const spec = join(dir, 'spec.json');
  await writeFile(spec, JSON.stringify({ slides: [SPEC.slides[1]] }));
  const neutral = lolly(['compose', spec, `--file=${TOKENS}`, '--json'], state);
  assert.equal(neutral.status, 0, neutral.stderr);
  assert.equal(neutral.json.result.report.master.origin, 'neutral');
  assert.ok(neutral.json.result.report.notes.some((n: { code: string }) => n.code === 'compose.master.neutral'));
  const flag = lolly(['compose', spec, `--master=${NEUTRAL_MASTERS}`, '--json'], state);
  assert.equal(flag.status, 0, flag.stderr);
  assert.equal(flag.json.result.report.master.origin, 'flag');
  const list = lolly(['compose', '--list', `--master=${NEUTRAL_MASTERS}`, '--json'], state);
  assert.equal(list.json.result.master.origin, 'flag');
}));

test('a spec on standard input; the human outline lists each slide', () => withDir(async (dir, state) => {
  const out = join(dir, 'deck.json');
  const run = lolly(['compose', '-', `--output=${out}`], state, { input: JSON.stringify(SPEC) });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /3 slides at 1920x1080 on lolly\/slides\/neutral/);
  assert.match(run.stdout, /^ {3}2 {2}content {2}light {2}filled 2/m);
  const again = lolly(['compose', '-'], state, { input: JSON.stringify(SPEC) });
  assert.equal(again.status, 0, again.stderr);
  assert.ok(Array.isArray(JSON.parse(again.stdout).boxes), 'with no --output the document goes to standard output');
}));

test('refusals: bare, empty and unknown flags, bad values, an existing output, a spec the composer refuses', () => withDir(async (dir, state) => {
  const spec = join(dir, 'spec.json');
  await writeFile(spec, JSON.stringify(SPEC));
  const existing = join(dir, 'there.json');
  await writeFile(existing, '{}');
  const usage: Array<[string[], RegExp]> = [
    [['compose', spec, '--size'], /--size needs a value/],
    [['compose', spec, '--master='], /--master needs a value/],
    [['compose', spec, '--browser=off'], /--browser is not a flag of lolly compose/],
    [['compose', spec, '--size=wide'], /--size takes WIDTHxHEIGHT/],
    [['compose', spec, '--theme=sepia'], /--theme must be light or dark/],
    [['compose', spec, '--fit=squash'], /--fit must be report or shrink/],
    [['compose'], /needs a spec/],
    [['compose', spec, spec], /takes one spec/],
    [['compose', spec, '--list'], /--list takes no spec/],
    [['compose', '--list', '--size=10x10'], /--size does not apply/],
    [['compose', '--suggest'], /needs the deck/],
    [['compose', join(dir, 'missing.json')], /No file at/],
    [['compose', spec, `--master=${spec}`], /no slide master/],
  ];
  for (const [args, re] of usage) {
    const run = lolly(args, state);
    assert.equal(run.status, 2, `${args.join(' ')}: ${run.stderr}`);
    assert.match(run.stderr, re, args.join(' '));
  }
  for (const value of COMPOSE_VALUE_FLAGS) {
    const run = lolly(['compose', spec, `--${value}`], state);
    assert.equal(run.status, 2, `--${value}: ${run.stderr}`);
  }
  const exists = lolly(['compose', spec, `--output=${existing}`, '--json'], state);
  assert.equal(exists.status, 4);
  assert.equal(exists.json.error?.kind, 'OUTPUT_EXISTS');
  const bad = join(dir, 'bad.json');
  await writeFile(bad, JSON.stringify({ slides: [{ archetype: 'contnet' }] }));
  const refused = lolly(['compose', bad, '--json'], state);
  assert.equal(refused.status, 4, refused.stderr);
  assert.equal(refused.json.error?.kind, 'SPEC_INVALID');
  assert.match(refused.json.error?.message, /^\/slides\/0\/archetype/);
  assert.match(refused.json.error?.message, /content/, 'the refusal gives the closest ids');
}));

test('--suggest reads a deck into a first spec that composes, its pictures listed by placeholder key', () => withDir(async (dir, state) => {
  const deck = 'tests/fixtures/rebrand/recreate.pptx';
  const spec = join(dir, 'spec.json');
  const run = lolly(['compose', '--suggest', `--source=${deck}`, `--output=${spec}`, '--json'], state);
  assert.equal(run.status, 0, run.stderr);
  const { reasons, assets, master, next } = run.json.result;
  assert.equal(master.origin, 'catalog');
  const suggested = JSON.parse(await readFile(spec, 'utf8')) as { slides: Array<{ archetype: string; source?: number }> };
  assert.equal(reasons.length, suggested.slides.length);
  assert.deepEqual(suggested.slides.map((s) => s.source), suggested.slides.map((_, i) => i + 1), 'every slide recreates its source slide');
  assert.ok(assets.length >= 1 && assets.every((a: { key: string; sha256: string; name: string }) => a.key === `photo:${a.sha256.slice(0, 12)}` && a.name.startsWith(a.sha256)));
  assert.match(next[0], /^lolly compose /);
  const composed = lolly(['compose', spec, `--source=${deck}`, '--json'], state);
  assert.equal(composed.status, 0, composed.stderr);
  assert.equal(composed.json.result.report.slides.length, suggested.slides.length);
  assert.equal(validateReport(composed.json.result.report), true, JSON.stringify(validateReport.errors));
  assert.deepEqual(composed.json.result.assets.map((a: { key: string }) => a.key).sort(), assets.map((a: { key: string }) => a.key).sort());
  const refused = lolly(['compose', '--suggest', `--source=${deck}`, spec], state);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /takes no spec/);
}));

test('suggest, compose, package from the deck alone, then check with the declared edits: 0 errors, 0 missing', () => withDir(async (dir, state) => {
  const deck = 'tests/fixtures/rebrand/recreate.pptx';
  const spec = join(dir, 'spec.json');
  assert.equal(lolly(['compose', '--suggest', `--source=${deck}`, `--output=${spec}`], state).status, 0);
  // One deliberate change: a body left out, which compose declares as edits.
  const suggested = JSON.parse(await readFile(spec, 'utf8')) as { slides: Array<{ archetype: string; slots?: Record<string, unknown> }> };
  const content = suggested.slides.find((s) => s.archetype === 'content' && s.slots?.body !== undefined);
  assert.ok(content, 'the fixture has a title-and-body slide');
  content.slots!.body = null;
  await writeFile(spec, JSON.stringify(suggested));

  const out = join(dir, 'deck.json');
  const edits = join(dir, 'edits.json');
  const composed = lolly(['compose', spec, `--source=${deck}`, `--output=${out}`, `--edits-out=${edits}`, '--json'], state);
  assert.equal(composed.status, 0, composed.stderr);
  const declared = JSON.parse(await readFile(edits, 'utf8')) as { edits: Array<{ source: string; reason: string }> };
  assert.ok(declared.edits.length >= 1, 'the dropped body is declared');
  const packageHint = composed.json.result.next.find((n: string) => n.startsWith('lolly package '));
  assert.match(packageHint, /--source=/);
  assert.doesNotMatch(packageHint, /--asset=/, 'the deck supplies every picture, so no --asset is needed');

  // The photo:<sha12> keys resolve from --source; no --asset and no lolly read --media.
  const file = join(dir, 'deck.lolly');
  const pack = lolly(['package', out, `--source=${deck}`, `--output=${file}`, '--json'], state);
  assert.equal(pack.status, 0, pack.stderr);
  const media = pack.json.result.media as Array<{ origin: string; keys: string[] }>;
  assert.ok(media.length >= 2 && media.every((m) => m.origin === 'source' && /^photo:[0-9a-f]{12}$/.test(m.keys[0]!)), JSON.stringify(media));

  const check = lolly(['check', file, `--source=${deck}`, `--edits=${edits}`, '--browser=off', '--json'], state);
  assert.equal(check.json.result?.summary?.error, 0, `${check.stdout}\n${check.stderr}`);
  assert.deepEqual(check.json.result.fidelity.missingStrings, [], JSON.stringify(check.json.result.fidelity));
  assert.equal(check.json.result.fidelity.excepted.length, declared.edits.length);
}));

test('--output and --edits-out: one file each, --edits-out names a file, and both folders are checked before either is written', () => withDir(async (dir, state) => {
  const spec = join(dir, 'spec.json');
  await writeFile(spec, JSON.stringify(SPEC));
  const same = join(dir, 'same.json');
  const both = lolly(['compose', spec, `--output=${same}`, `--edits-out=${same}`], state);
  assert.equal(both.status, 2, both.stderr);
  assert.match(both.stderr, /--output and --edits-out both name/);
  assert.equal(existsSync(same), false, 'nothing is written');
  // Standard output is the document's; the edits go to a file (or, with --json, under "edits").
  const dash = lolly(['compose', spec, `--output=${join(dir, 'doc.json')}`, '--edits-out=-'], state);
  assert.equal(dash.status, 2, dash.stderr);
  assert.match(dash.stderr, /--edits-out names the file/);
  assert.equal(existsSync(join(REPO, '-')), false, 'no file named - in the working folder');
  assert.equal(existsSync(join(dir, 'doc.json')), false);
  // A missing folder for either file stops the run before the other is written.
  for (const [output, edits] of [[join(dir, 'doc.json'), join(dir, 'nope', 'edits.json')], [join(dir, 'nope', 'doc.json'), join(dir, 'edits.json')]]) {
    const run = lolly(['compose', spec, `--output=${output}`, `--edits-out=${edits}`], state);
    assert.equal(run.status, 2, run.stderr);
    assert.match(run.stderr, /The folder for .* does not exist/);
    assert.equal(existsSync(join(dir, 'doc.json')) || existsSync(join(dir, 'edits.json')), false, 'neither file is written');
  }
  const fine = lolly(['compose', spec, `--output=${join(dir, 'doc.json')}`, `--edits-out=${join(dir, 'edits.json')}`], state);
  assert.equal(fine.status, 0, fine.stderr);
  assert.ok(Array.isArray(JSON.parse(readFileSync(join(dir, 'doc.json'), 'utf8')).boxes));
  assert.ok(Array.isArray(JSON.parse(readFileSync(join(dir, 'edits.json'), 'utf8')).edits));
}));

test('every Next: hint keeps the --file, --master and --themes it was given, so the next command reads the same design system (plan 291 section 6)', () => withDir(async (dir, state) => {
  const spec = join(dir, 'spec.json');
  await writeFile(spec, JSON.stringify({ slides: [SPEC.slides[1]] }));
  const out = join(dir, 'deck.json');
  const run = lolly(['compose', spec, `--file=${TOKENS}`, `--master=${NEUTRAL_MASTERS}`, '--themes=light,dark', `--output=${out}`, '--json'], state);
  assert.equal(run.status, 0, run.stderr);
  const [pack = '', check = ''] = run.json.result.next as string[];
  assert.match(pack, /^lolly package /);
  assert.ok(pack.includes(` --file=${TOKENS}`), pack);
  assert.match(check, /^lolly check /);
  assert.ok(check.includes(` --file=${TOKENS}`), check);
  assert.ok(check.includes(' --themes=light,dark'), check);
  // Without --file the hints name none, as before.
  const plain = lolly(['compose', spec, `--output=${join(dir, 'plain.json')}`, '--json'], state);
  assert.equal(plain.status, 0, plain.stderr);
  for (const hint of plain.json.result.next as string[]) assert.doesNotMatch(hint, /--file=|--themes=/);
  // A spec that lists two themes asks the check for both.
  await writeFile(spec, JSON.stringify({ themes: ['light', 'dark'], slides: [SPEC.slides[1]] }));
  const themed = lolly(['compose', spec, `--output=${join(dir, 'themed.json')}`, '--json'], state);
  assert.equal(themed.status, 0, themed.stderr);
  assert.ok((themed.json.result.next as string[])[1]!.includes(' --themes=light,dark'), themed.json.result.next[1]);

  // --suggest hands the same --file and --master to the compose it suggests.
  const suggested = join(dir, 'suggested.json');
  const suggest = lolly(['compose', '--suggest', '--source=tests/fixtures/rebrand/recreate.pptx', `--file=${TOKENS}`, `--master=${NEUTRAL_MASTERS}`, `--output=${suggested}`, '--json'], state);
  assert.equal(suggest.status, 0, suggest.stderr);
  const hint = (suggest.json.result.next as string[])[0]!;
  assert.match(hint, /^lolly compose /);
  assert.ok(hint.includes(` --file=${TOKENS}`), hint);
  assert.ok(hint.includes(` --master=${NEUTRAL_MASTERS}`), hint);
  // The human outline prints the same hint.
  const human = lolly(['compose', '--suggest', '--source=tests/fixtures/rebrand/recreate.pptx', `--file=${TOKENS}`, `--output=${join(dir, 'suggested2.json')}`], state);
  assert.equal(human.status, 0, human.stderr);
  assert.ok(human.stdout.includes(` --file=${TOKENS}`), human.stdout);
}));
