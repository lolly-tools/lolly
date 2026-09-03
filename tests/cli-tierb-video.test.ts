// SPDX-License-Identifier: MPL-2.0
/**
 * Tier B end to end: the CLI's heavy exports through the REAL path (plans/183 WS3).
 *
 * Everything below spawns `lolly` exactly as a person would, so what is under test is
 * the whole chain - the localhost dist server and its isolation headers, the scoped
 * Chromium, the web shell's own export path, the download interception, and the CLI's
 * teardown. A unit test of any one link would have kept passing through both of the
 * failures this file exists to catch:
 *
 *   • a video that never arrives (the download times out and nothing is written), and
 *   • a run that FAILS and then hangs, because the pooled browser and the dist server
 *     were only torn down on the success path. That one made a plain error look like a
 *     hung terminal, so the wall-time bound below is not decoration: a run that exceeds
 *     it is the bug, whatever exit code it eventually produces.
 *
 * GATED, and it says by name what is missing: a built web shell (`npm run build:web`)
 * and a headless browser (`lolly install-browser`). Never silently green.
 *
 * Run with: node --test tests/cli-tierb-video.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const REPO = join(fileURLToPath(import.meta.url), '..', '..');
const CLI = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');
const DIST = process.env.LOLLY_WEB_DIST || join(REPO, 'shells', 'web', 'dist');

/** The browsers dir the shells resolve, mirroring browsers.ts's own order. */
function browserThere(): boolean {
  if (process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH) return true;
  return existsSync(process.env.PLAYWRIGHT_BROWSERS_PATH || join(REPO, '.browsers'))
    || existsSync(join(REPO, 'services', 'mcp', '.browsers'));
}

/** The skip reason, naming the missing half and the command that supplies it. */
const MISSING = !existsSync(join(DIST, 'index.html'))
  ? `no built web shell at ${DIST} - run \`npm run build:web\``
  : !browserThere()
    ? 'no headless browser - run `lolly install-browser`'
    : null;

/** Generous, because this shares a machine with whatever else is running: the point of
 *  the bound is to catch a hang, not to benchmark. A local mp4 takes ~15-70s. */
const WALL_BUDGET_MS = 300_000;

const OUT = mkdtempSync(join(tmpdir(), 'lolly-tierb-'));
process.on('exit', () => rmSync(OUT, { recursive: true, force: true }));

async function exportTo(args: string[], file: string): Promise<{ bytes: Buffer; ms: number }> {
  const t0 = Date.now();
  await run(process.execPath, [CLI, ...args, `--output=${file}`], {
    cwd: REPO, timeout: WALL_BUDGET_MS, maxBuffer: 64 * 1024 * 1024,
  });
  const ms = Date.now() - t0;
  assert.ok(existsSync(file), `${args.join(' ')} exited 0 but wrote no file`);
  return { bytes: readFileSync(file), ms };
}

test('an animated tool exports a real mp4 through the browser tier', { skip: MISSING ?? false }, async (t) => {
  t.diagnostic(`dist: ${DIST}`);
  const file = join(OUT, 'chart.mp4');
  const { bytes, ms } = await exportTo(['chart', '--export=mp4'], file);
  t.diagnostic(`${bytes.length} bytes in ${(ms / 1000).toFixed(1)}s`);
  assert.ok(bytes.length > 10_000, `mp4 is only ${bytes.length} bytes`);
  // ISO base media: a 4-byte big-endian box length, then 'ftyp'. Not a substring
  // search - a JPEG that happened to contain the word would pass that.
  assert.equal(bytes.subarray(4, 8).toString('latin1'), 'ftyp', 'not an ISO base media file');
  const boxLen = bytes.readUInt32BE(0);
  assert.ok(boxLen >= 8 && boxLen < bytes.length, `implausible ftyp box length ${boxLen}`);
  // A moov atom somewhere in the file: an mp4 with no movie box is a truncated write.
  assert.ok(bytes.includes(Buffer.from('moov', 'latin1')), 'no moov atom - the file is truncated');
  assert.ok(ms < WALL_BUDGET_MS, `took ${ms}ms, over the ${WALL_BUDGET_MS}ms bound`);
});

test('a deck exports a real pptx through the browser tier', { skip: MISSING ?? false }, async (t) => {
  const file = join(OUT, 'deck.pptx');
  const { bytes, ms } = await exportTo(['deck-studio', '--export=pptx'], file);
  t.diagnostic(`${bytes.length} bytes in ${(ms / 1000).toFixed(1)}s`);
  assert.ok(bytes.length > 10_000, `pptx is only ${bytes.length} bytes`);
  assert.equal(bytes.subarray(0, 2).toString('latin1'), 'PK', 'not a zip container');
  // The part that makes a zip a PRESENTATION. Read from the central directory rather
  // than by scanning bytes: a name that appears only in a local header of a partly
  // written archive would fool a substring test.
  assert.ok(zipNames(bytes).includes('ppt/presentation.xml'), 'zip carries no ppt/presentation.xml');
  assert.ok(zipNames(bytes).some(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)), 'zip carries no slides');
  assert.ok(ms < WALL_BUDGET_MS, `took ${ms}ms, over the ${WALL_BUDGET_MS}ms bound`);
});

test('a Tier-B failure fails, and fails PROMPTLY, with the debug log it was asked for', { skip: MISSING ?? false }, async (t) => {
  // A stub dist: the server serves it, the page loads, and nothing ever downloads.
  // That is what every "produced no file in time" report looks like, reproduced on
  // purpose so the error path is exercised rather than assumed.
  const stub = mkdtempSync(join(tmpdir(), 'lolly-stub-dist-'));
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(stub, 'index.html'), '<!doctype html><title>stub</title><body>stub');
  const file = join(OUT, 'nope.jpg');
  const t0 = Date.now();
  const outcome = await run(process.execPath, [CLI, 'wordmark', '--export=jpg', '--tier-b-debug', `--output=${file}`], {
    cwd: REPO, timeout: WALL_BUDGET_MS, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, LOLLY_WEB_DIST: stub },
  }).then(() => ({ code: 0, stderr: '' }), (e: { code?: number; stderr?: string }) => ({ code: e.code ?? -1, stderr: e.stderr ?? '' }));
  const ms = Date.now() - t0;
  rmSync(stub, { recursive: true, force: true });
  t.diagnostic(`exited ${outcome.code} in ${(ms / 1000).toFixed(1)}s`);
  assert.notEqual(outcome.code, 0, 'a render that produced nothing must not exit 0');
  assert.ok(!existsSync(file), 'nothing may be written when the format could not be produced');
  // It must END. Before the teardown fix this same run printed its error and then sat
  // there holding the browser and the dist server open until the harness killed it.
  assert.ok(ms < 150_000, `the failure took ${ms}ms - it is hanging, not failing`);
  // The debug switch names the step and writes the log beside the output.
  assert.match(outcome.stderr, /Timed out in step "wait for the jpeg download"/);
  const log = `${file}.tier-b-debug.log`;
  assert.ok(existsSync(log), 'no tier-b debug log was written beside the output');
  const text = readFileSync(log, 'utf8');
  assert.match(text, /STEPS \(the last one is where it stopped\)/);
  assert.match(text, /CONSOLE \(/);
  assert.match(text, /NETWORK \(/);
});

/** Every entry name in a zip's central directory. */
function zipNames(buf: Buffer): string[] {
  // Find the end-of-central-directory record (scan back from the tail; the comment is
  // at most 64 KB), then walk the directory it points at.
  const sig = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65_536; i--) {
    if (buf.readUInt32LE(i) === sig) { eocd = i; break; }
  }
  if (eocd < 0) return [];
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < count && off + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    names.push(buf.subarray(off + 46, off + 46 + nameLen).toString('utf8'));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}
