// SPDX-License-Identifier: MPL-2.0
/**
 * Transform tools on the real catalog: the `lolly smoke` transform lane and `lolly batch`
 * rows for a transform (shells/cli/src/smoke.ts, shells/cli/src/batch.ts).
 *
 * A transform (hooks.exportFile: file in, file out) has nothing to render at defaults,
 * so smoke runs it over a committed fixture picked by the types its file input accepts
 * and checks the magic bytes of what came back. A batch row names the input file in the
 * tool's file-input column and gets no export format, since run.ts refuses one for a
 * transform. Both are exercised here on real community tools, under the lolly-start
 * profile (the one CI resolves on a public clone), with the browser tier pointed at a
 * directory that holds no built shell so nothing here can start Chromium.
 *
 * Run with: node --test tests/cli-transform-lane.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.LOLLY_PROFILE = 'lolly-start';
process.env.LOLLY_WEB_DIST = join(tmpdir(), 'lolly-no-such-web-dist');
delete process.env.LOLLY_WEB_BASE;

const { smokeCli, TRANSFORM_FIXTURES } = await import('../shells/cli/src/smoke.ts');
const { runBatchCli } = await import('../shells/cli/src/batch.ts');

const fixture = (...parts: string[]): string => fileURLToPath(new URL(`./fixtures/${parts.join('/')}`, import.meta.url));
const PPTX = fixture('rebrand', 'simple.pptx');
const PDF = fixture('rebrand', 'flattened.pdf');
const PNG = fixture('public-journeys', 'welcome.png');
const TTF = fixture('text-composition', 'fonts', 'notosanshebrew', 'NotoSansHebrew[wdth,wght].ttf');

const work = await mkdtemp(join(tmpdir(), 'lolly-transform-lane-'));
after(() => rm(work, { recursive: true, force: true }));

/** Quiet stderr for one call: runToolCli notes each transform there. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try { return await fn(); } finally { process.stderr.write = write; }
}

test('smoke runs rebrand-deck and compress-pdf over their fixtures and checks the bytes', async () => {
  let out = '';
  const code = await smokeCli({ only: 'rebrand-deck,compress-pdf', out: (line: string) => { out += line; } });
  assert.equal(code, 0, out);
  assert.match(out, /✓ rebrand-deck\s+pptx\s+[\d,]+ B .*\(transform over simple\.pptx\)/);
  assert.match(out, /✓ compress-pdf\s+pdf\s+[\d,]+ B .*\(transform over flattened\.pdf\)/);
  assert.match(out, /smoke: 2 ✓ {2}0 ✗/);
  const directory = /outputs in (.+)\n/.exec(out)![1]!;
  const deck = await readFile(join(directory, 'rebrand-deck.pptx'));
  assert.deepEqual([...deck.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'a pptx is a zip container');
  const pdf = await readFile(join(directory, 'compress-pdf.pdf'));
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('every transform fixture is a file this checkout holds', () => {
  assert.ok(TRANSFORM_FIXTURES.length >= 5, 'a source checkout lists the lane fixtures');
  for (const f of TRANSFORM_FIXTURES) assert.ok(existsSync(f.path), `${f.kind} fixture missing at ${f.path}`);
});

test('smoke --format=svg stays green: a transform whose fixture is not svg is skipped', async () => {
  let out = '';
  const code = await smokeCli({ only: 'redact,claim,strip-data', format: 'svg', out: (line: string) => { out += line; } });
  assert.equal(code, 0, out);
  assert.match(out, /– redact\s+-\s+skipped: runs over a png fixture, so it writes png, not "svg"/);
});

test('text-helper is checked for the change it made; darkroom names its real precondition', async () => {
  let out = '';
  const code = await smokeCli({ only: 'text-helper,darkroom', out: (line: string) => { out += line; } });
  assert.equal(code, 0, out);
  assert.match(out, /✓ text-helper\s+html\s+18 B/);
  assert.doesNotMatch(out, /not verifiable/);
  assert.match(out, /– darkroom\s+-\s+skipped: its file input "lutFile" is shown only for some settings/);
});

test('a transform input type with no committed fixture is a skip, never a pass', async () => {
  let out = '';
  const code = await smokeCli({ only: 'trim', out: (line: string) => { out += line; } });
  assert.equal(code, 0);
  assert.match(out, /– trim\s+-\s+skipped: transform tool with no committed fixture for its input/);
  assert.match(out, /smoke: 0 ✓ {2}0 ✗ {2}0 ~ \(layout tools rendered as html\) {2}1 skipped/);
});

test('batch runs a transform tool over a two-row CSV, one named file per row', async () => {
  const csv = join(work, 'rows.csv');
  await writeFile(csv, `toolId,source,filename\nrebrand-deck,${PPTX},\ncompress-pdf,${PDF},smaller\n`);
  const outDir = join(work, 'out');
  const code = await quietly(() => runBatchCli(csv, { outDir }));
  assert.equal(code, 0);
  assert.deepEqual((await readdir(outDir)).sort(), ['01-simple.pptx', '02-smaller.pdf']);
  const deck = await readFile(join(outDir, '01-simple.pptx'));
  assert.deepEqual([...deck.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const pdf = await readFile(join(outDir, '02-smaller.pdf'));
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('a format cell on a transform row gets the transform refusal; other rows still run', async () => {
  const csv = join(work, 'format.csv');
  await writeFile(csv, `toolId,source,format\ncompress-pdf,${PDF},pdf\ncompress-pdf,${PDF},\n`);
  const outDir = join(work, 'format-out');
  const code = await quietly(() => runBatchCli(csv, { outDir, keepGoing: true }));
  assert.equal(code, 2, 'the refused row is a usage error');
  assert.deepEqual(await readdir(outDir), ['02-flattened.pdf']);
});

test('batch: a relative source path, and converters named after the container they wrote', async () => {
  const dir = join(work, 'relative');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dir, { recursive: true });
  await copyFile(PNG, join(dir, 'welcome.png'));
  const rel = relative(process.cwd(), join(dir, 'welcome.png'));
  const csv = join(work, 'convert.csv');
  await writeFile(csv, `toolId,source,target\nconvert-image,${rel},png\nfont-convert,"${TTF}",woff\n`);
  const outDir = join(work, 'convert-out');
  const code = await quietly(() => runBatchCli(csv, { outDir }));
  assert.equal(code, 0);
  assert.deepEqual((await readdir(outDir)).sort(), ['01-welcome.png', '02-notosanshebrew-wdth-wght.woff']);
  const png = await readFile(join(outDir, '01-welcome.png'));
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  const woff = await readFile(join(outDir, '02-notosanshebrew-wdth-wght.woff'));
  assert.equal(woff.subarray(0, 4).toString('latin1'), 'wOFF');
});
