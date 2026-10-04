// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly measure --text` and `lolly measure <doc> --text-layers` (plan 291 W5) from the
 * command line: the envelope and its TextMeasureV1, standard input, the document mode,
 * `--style`, the refusals, the compiled-document `measure` left as it was, and the
 * `text-measure` checker of `lolly check --browser=off`. Run as CI runs, on the public
 * lolly-start profile with an empty state directory; the text is synthetic.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

import { MEASURE_BOOL_FLAGS, MEASURE_VALUE_FLAGS, RESERVED_SUBCOMMANDS } from '../shells/cli/src/args.ts';
import { measureOutline } from '../shells/cli/src/measure-text.ts';

const ROOT = new URL('..', import.meta.url);
const TRAP = new URL('./fixtures/check/trap.boxes.json', import.meta.url).pathname;
const SCHEMA = JSON.parse(readFileSync(new URL('../schemas/text-measure-v1.schema.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

const HEADLINE = 'Every quarter we measure what our customers keep using, and why they stay';

function lolly(args: string[], state: string, input?: string): { status: number | null; stdout: string; json: Record<string, any>; stderr: string } {
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 90_000, maxBuffer: 64 * 1024 * 1024, ...(input !== undefined ? { input } : {}),
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: state, NO_COLOR: '1' },
  });
  let json: Record<string, any> = {};
  try { json = JSON.parse(run.stdout); } catch { /* the assertion on status reports stderr */ }
  return { status: run.status, stdout: run.stdout, json, stderr: run.stderr };
}

async function withState<T>(fn: (state: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-measure-cli-'));
  try { return await fn(join(dir, 'state')); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('measure keeps its reserved word and gains its text flags', () => {
  assert.ok((RESERVED_SUBCOMMANDS as readonly string[]).includes('measure'));
  assert.deepEqual([...MEASURE_VALUE_FLAGS], ['text', 'font', 'weight', 'size', 'width', 'height', 'line-height', 'pad', 'tracking', 'valign', 'style', 'artboard-width', 'file', 'theme', 'layer']);
  assert.deepEqual([...MEASURE_BOOL_FLAGS], ['italic', 'text-layers']);
});

test('--text --json: one envelope whose result is a valid TextMeasureV1 with the prototype\'s breaks and heights', () => withState(async (state) => {
  const run = lolly(['measure', `--text=${HEADLINE}`, '--font=sans', '--weight=500', '--size=72', '--width=900', '--line-height=1.12', '--pad=0', '--json'], state);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.json.ok, true);
  assert.equal(run.json.command, 'measure');
  const m = run.json.result;
  assert.equal(validate(m), true, JSON.stringify(validate.errors));
  assert.deepEqual(m.lines.map((l: { text: string }) => l.text), ['Every quarter we measure ', 'what our customers keep ', 'using, and why they stay']);
  assert.equal(m.height, 241.875);
  assert.equal(m.scrollHeight, 246);
  assert.equal(m.width, 900);
}));

test('--text=- reads standard input, newlines and markup kept; a height gives the clipped verdict', () => withState(async (state) => {
  const run = lolly(['measure', '--text=-', '--width=400', '--height=60', '--size=32', '--valign=top', '--json'], state, '- one\n- **two**\n');
  assert.equal(run.status, 0, run.stderr);
  const m = run.json.result;
  assert.deepEqual(m.lines.map((l: { text: string }) => l.text), ['•  one', '•  two']);
  assert.equal(m.overflow.clipped, true);
  assert.deepEqual(m.overflow.hiddenLines, [1]);
}));

test('--style sets the box up as an authored row: the agent base, the style, then the flags', () => withState(async (state) => {
  const styled = lolly(['measure', '--text=A synthetic title', '--style=title', '--width=1200', '--json'], state);
  assert.equal(styled.status, 0, styled.stderr);
  assert.equal(styled.json.result.pad, 0);
  assert.equal(styled.json.result.lineHeight, 1.1);
  const over = lolly(['measure', '--text=A synthetic title', '--style=title', '--size=30', '--width=1200', '--json'], state);
  assert.equal(over.json.result.size, 30, 'a flag wins over the style');
  const unknown = lolly(['measure', '--text=x', '--style=nope', '--width=100'], state);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /text style "nope" does not exist/);
}));

test('--text-layers measures every plain text layer of a document; --layer narrows it', () => withState(async (state) => {
  const all = lolly(['measure', TRAP, '--text-layers', '--json'], state);
  assert.equal(all.status, 0, all.stderr);
  const layers = all.json.result.layers as Array<{ layerId: string; measure: Record<string, any> }>;
  assert.equal(layers.length, 11);
  for (const layer of layers) assert.equal(validate(layer.measure), true, `${layer.layerId}: ${JSON.stringify(validate.errors)}`);
  const overflow = layers.find((l) => l.layerId === 'overflow')!;
  assert.equal(overflow.measure.overflow.clipped, true);
  assert.equal(overflow.measure.scrollHeight, 363);
  assert.deepEqual(all.json.result.skipped, []);
  const two = lolly(['measure', TRAP, '--text-layers', '--layer=overflow', '--layer=heading', '--json'], state);
  assert.deepEqual(two.json.result.layers.map((l: { layerId: string }) => l.layerId), ['heading', 'overflow']);
  const human = lolly(['measure', TRAP, '--text-layers', '--layer=overflow'], state);
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /^overflow: 5 lines/m);
  assert.match(human.stdout, /Clipped: 293 px taller than the box/);
  const missing = lolly(['measure', TRAP, '--layer=nope'], state);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /No layer "nope"/);
}));

test('refusals: box flags with a document, a missing width, bad values, bare and unknown flags', () => withState(async (state) => {
  const cases: Array<[string[], RegExp]> = [
    [['measure', TRAP, '--text-layers', '--width=300'], /--width describes one text box/],
    [['measure', '--text=x'], /needs the box width/],
    [['measure', '--text=x', '--width=0'], /--width must be a positive number/],
    [['measure', '--text=x', '--width=100', '--valign=centre'], /--valign must be top, middle or bottom/],
    [['measure', '--text=x', '--width=100', '--weight=heavy'], /--weight must be a CSS weight/],
    [['measure', '--text=x', '--width=100', '--layer'], /--layer needs a value/],
    [['measure', '--text=x', '--width=100', '--browser=off'], /--browser is not a flag of lolly measure/],
    [['measure', '--text=x', '--width=100', 'extra.json'], /takes no file/],
    [['measure', '--text-layers'], /takes one Design document/],
  ];
  for (const [args, re] of cases) {
    const run = lolly(args, state);
    assert.equal(run.status, 2, `${args.join(' ')}: ${run.stderr}`);
    assert.match(run.stderr, re, args.join(' '));
  }
}));

test('the compiled-document measure is unchanged', () => withState(async (state) => {
  const run = lolly(['measure'], state);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /usage: lolly measure <document.json>/);
}));

test('the human outline names the lines, the heights and near-edge lines', () => {
  const text = measureOutline({
    format: 'lolly-text-measure', version: 1, method: 'harfbuzz-css-greedy',
    font: { token: 'sans', family: 'Brand', weight: 500, italic: false, file: '/fonts/Brand.ttf' },
    faces: [{ token: 'sans', family: 'Brand', weight: 500, italic: false, file: '/fonts/Brand.ttf' }],
    size: 40, weight: 500, lineHeight: 1.2, lineHeightPx: 48, pad: 0, tracking: 0, width: 300, availableWidth: 300,
    lines: [{ index: 0, paragraph: 0, text: 'Line \u001b[2Jone', start: 0, end: 8, width: 298.5, slack: 1.5, break: 'end', nearEdge: true }],
    lineCount: 1, height: 48, scrollHeight: 48, nearEdge: true,
    box: { width: 300, height: 60, clientHeight: 60 }, overflow: { y: -12, x: false, clipped: false, hiddenLines: [] },
    tolerance: { widthPx: 0.5, lineEndPx: 3, nearEdgePx: 3 }, notes: [],
  });
  assert.match(text, /1 line, 48 px tall, scrollHeight 48/);
  assert.match(text, /near edge/);
  assert.match(text, /Fits: 12 px to spare/);
  assert.ok(!text.includes('\u001b'), 'control characters from the text are scrubbed');
});

test('lolly check --browser=off reports the trap headline through the text-measure checker', () => withState(async (state) => {
  const run = lolly(['check', TRAP, '--browser=off', '--json'], state);
  assert.equal(run.status, 5, run.stderr);
  const report = run.json.result;
  assert.equal(report.families.render.state, 'skipped');
  assert.match(report.families.render.reason, /predicted from font metrics instead \(text-measure\): 11 plain text layers measured, 1 clipped/);
  const found = report.findings.filter((f: { origin: { checker: string } }) => f.origin.checker === 'text-measure');
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'design.text.overflow');
  assert.equal(found[0].layerId, 'overflow');
  assert.equal(found[0].severity, 'warn');
  assert.equal(found[0].evidence.scrollHeight, 363);
  assert.equal(found[0].evidence.clientHeight, 70);
}));

test('--style is sized for --artboard-width (default 1920, said in the output), matching the document mode on that artboard', () => withState(async (state) => {
  const doc = join(state, '..', 'small.json');
  await writeFile(doc, JSON.stringify({ boxes: [
    { id: 'ab', kind: 'frame', $artboard: true, x: 0, y: 0, w: 1280, h: 720 },
    { id: 't', kind: 'text', $in: 'ab', x: 0, y: 0, w: 600, h: 200, text: 'Quarterly review of the platform', $style: 'title' },
  ] }));
  const inDoc = lolly(['measure', doc, '--text-layers', '--json'], state);
  assert.equal(inDoc.status, 0, inDoc.stderr);
  const want = inDoc.json.result.layers[0].measure;
  const sized = lolly(['measure', '--text=Quarterly review of the platform', '--width=600', '--height=200', '--style=title', '--artboard-width=1280', '--json'], state);
  assert.equal(sized.status, 0, sized.stderr);
  assert.equal(sized.json.result.size, want.size);
  assert.deepEqual(sized.json.result.lines, want.lines);
  assert.ok(sized.json.result.notes.some((n: string) => /sized for an artboard 1280 px wide/.test(n)));
  const byDefault = lolly(['measure', '--text=Quarterly review of the platform', '--width=600', '--style=title'], state);
  assert.match(byDefault.stdout, /sized for an artboard 1920 px wide \(the default; give --artboard-width=<px> for another\)/);
  const alone = lolly(['measure', '--text=x', '--width=100', '--artboard-width=1280'], state);
  assert.equal(alone.status, 2);
  assert.match(alone.stderr, /--artboard-width sizes a text style/);
}));

test('--italic measures what the canvas draws for an italic style: the italic face, never the layer family in italic', () => withState(async (state) => {
  const flag = lolly(['measure', '--text=Mono box set in italic across a few words', '--width=420', '--size=30', '--weight=400', '--font=mono', '--italic', '--json'], state);
  const markup = lolly(['measure', '--text=*Mono box set in italic across a few words*', '--width=420', '--size=30', '--weight=400', '--font=mono', '--json'], state);
  assert.equal(flag.status, 0, flag.stderr);
  assert.deepEqual(flag.json.result.lines, markup.json.result.lines);
  assert.deepEqual(flag.json.result.faces, markup.json.result.faces);
  assert.equal(flag.json.result.font.italic, false, 'the layer face stays upright');
  assert.ok(!flag.json.result.faces.some((f: { file: string }) => /SUSEMono-Italic/.test(f.file)), 'no mono italic face');
}));

test('lolly check --browser=off: a finding path counts every row, and text the face cannot draw is not judged', () => withState(async (state) => {
  const doc = join(state, '..', 'rows.json');
  await writeFile(doc, JSON.stringify({ boxes: [
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600 },
    'junk',
    { id: 't1', kind: 'text', frame: 'f1', text: 'A long piece of synthetic text that overflows a tiny box many times over', x: 10, y: 10, w: 60, h: 20 },
    { id: 'cjk', kind: 'text', frame: 'f1', text: '日本語のテキストは長い行で折り返されます。日本語のテキストは長い行で折り返されます。', x: 10, y: 100, w: 300, h: 40, fontSize: 32 },
  ] }));
  const run = lolly(['check', doc, '--browser=off', '--json'], state);
  const found = run.json.result.findings.filter((f: { origin: { checker: string } }) => f.origin.checker === 'text-measure');
  assert.deepEqual(found.map((f: { layerId: string; path: string }) => [f.layerId, f.path]), [['t1', '/boxes/2/text']]);
  assert.match(run.json.result.families.render.reason, /1 layer not judged \(its face has no glyph for some characters/);
}));
