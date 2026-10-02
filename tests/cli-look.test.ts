// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly look`, `lolly sample` and `lolly trace` (plans/289 D5): the MCP looking
 * tools on the command line, over the shared core in @lolly-tools/node-shell/look.
 *
 * Run with: node --test tests/cli-look.test.ts
 *
 * Each case runs the real CLI on a small SVG with a known green rectangle, so the
 * answers can be checked against the document's own numbers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const CLI = new URL('../shells/cli/bin/lolly.ts', import.meta.url).pathname;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><rect width="400" height="300" fill="#ffffff"/><rect x="100" y="80" width="200" height="140" fill="#30ba78"/></svg>';

const dir = await mkdtemp(join(tmpdir(), 'lolly-look-'));
const svgPath = join(dir, 'card.svg');
await writeFile(svgPath, SVG);
process.on('exit', () => { void rm(dir, { recursive: true, force: true }); });

const lolly = async (...args: string[]) => run(process.execPath, [CLI, ...args], { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
const envelopeOf = (stdout: string) => JSON.parse(stdout) as { ok: boolean; command: string; result: Record<string, unknown> };

test('look: a region drawn with a grid, in the document\'s own units', async () => {
  const out = join(dir, 'look.png');
  const { stdout } = await lolly('look', svgPath, '--region=80,60,240,180', `--output=${out}`, '--json');
  const env = envelopeOf(stdout);
  assert.equal(env.command, 'look');
  assert.deepEqual(env.result.region, { x: 80, y: 60, w: 240, h: 180 });
  assert.equal(env.result.units, 'document');
  assert.equal(env.result.gridSpacing, 20);
  const png = await readFile(out);
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(png.readUInt32BE(16), env.result.width);
});

test('look: --json without --output is refused, because the picture would share standard output', async () => {
  await assert.rejects(lolly('look', svgPath, '--json'), (e: { code?: number; stdout?: string }) => {
    assert.equal(e.code, 2);
    assert.equal(envelopeOf(e.stdout ?? '').ok, false);
    return true;
  });
});

test('sample: colours at points, outside said plainly', async () => {
  const { stdout } = await lolly('sample', svgPath, '--points=200,150;10,10;500,500', '--json');
  const samples = envelopeOf(stdout).result.samples as Array<{ hex: string | null; note?: string }>;
  assert.deepEqual(samples.map(s => s.hex), ['#30ba78', '#ffffff', null]);
  assert.equal(samples[2]!.note, 'outside the document');
});

test('trace: the rectangle comes back as one closed outline, and as a Design layer on request', async () => {
  const { stdout } = await lolly('trace', svgPath, '--design-layers', '--json');
  const lines = envelopeOf(stdout).result.lines as Array<{ closed: boolean; points: Array<[number, number]>; layer?: { kind: string } }>;
  assert.ok(lines.length >= 1);
  const outline = lines[0]!;
  assert.equal(outline.closed, true);
  const xs = outline.points.map(p => p[0]), ys = outline.points.map(p => p[1]);
  assert.ok(Math.abs(Math.min(...xs) - 100) <= 2 && Math.abs(Math.max(...xs) - 300) <= 2, `x ${Math.min(...xs)}..${Math.max(...xs)}`);
  assert.ok(Math.abs(Math.min(...ys) - 80) <= 2 && Math.abs(Math.max(...ys) - 220) <= 2, `y ${Math.min(...ys)}..${Math.max(...ys)}`);
  assert.equal(outline.layer?.kind, 'path');
});

test('the source can come from standard input, so a render pipes straight in', async () => {
  const out = join(dir, 'piped.png');
  const child = execFile(process.execPath, [CLI, 'look', '-', '--grid=0', `--output=${out}`, '--json'], { encoding: 'utf8' });
  child.stdin!.end(SVG);
  const stdout = await new Promise<string>((resolve, reject) => {
    let text = '';
    child.stdout!.on('data', (c) => { text += c; });
    child.on('close', (code) => (code === 0 ? resolve(text) : reject(new Error(`exit ${code}`))));
  });
  const env = envelopeOf(stdout);
  assert.equal(env.result.gridSpacing, 0);
  assert.equal(env.result.width, 400, 'a whole document at its own size is not enlarged');
});

test('bad flags are usage errors that name the flag', async () => {
  await assert.rejects(lolly('look', svgPath, '--region=1,2,3'), /--region takes x,y,w,h/);
  await assert.rejects(lolly('sample', svgPath), /--points=x,y/);
  await assert.rejects(lolly('sample', svgPath, '--points=1;2'), /--points: "1" is not x,y/);
});
