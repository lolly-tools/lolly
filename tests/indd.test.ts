// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInddKernel, InddError, INDD_MAX_INPUT, isInddSignature, describeInddError } from '../packages/node-shell/src/indd.ts';
import { loadInddKernel } from '../packages/node-shell/src/indd-node.ts';
import { JSDOM } from 'jsdom';
import { readZip } from '../engine/src/zip.ts';
import { readIdmlSpreads } from '../engine/src/idml-read.ts';

const fixtures = resolve(import.meta.dirname, '../plans/corpora/indd-fixtures');
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

// SHA-256 of the IDML package and warning count from the native build of the pinned crate
// (bytes and warnings are the same through the WASM adapter).
const GOLDEN: [path: string, sha256: string, warnings: number][] = [
  ['xmp-toolkit-bluesquare/BlueSquare.indd', 'cae26bfdd86ab98cb3b787ec927e6e9099d18530310b5b3a2261e939f1b1e6fe', 5],
  ['bootstrap3-template/bootstrap3-indesign-template.indd', '335ee379a9b8a02e921b2dc38575d0c39aca9442a5de7fc0326097d2008020b9', 0],
  ['lizdenys-minizine/indesign-minizine-template.indd', '52abc0908598094b685592fbc59f4d8fcbc5c6eb27e6eb6a3b180eca81c69097', 0],
  ['opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd', '254e3de604353ec50f387fd2bff0b7d3a29f41dd0133e26da63bcf5b02babcc5', 8],
  ['scml-template/scml.indt', '0fdb066c404db87e758c6ff1a62a0f297df1430c019bd0cf7fa748b60ff7b584', 0],
];
const wasmUrl = new URL('../packages/node-shell/wasm/indd/indd.wasm', import.meta.url);

/** The 24-byte start of every InDesign 2.0+ file, padded to one page. */
function header(pages = 8): Uint8Array {
  const bytes = new Uint8Array(pages * 4096);
  bytes.set([0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7, 0xfe, 0x74, 0xb7, 0x1d]);
  bytes.set(new TextEncoder().encode('DOCUMENT'), 16); bytes[24] = 1;
  return bytes;
}

test('signature check needs the 16-byte GUID and DOCUMENT', () => {
  assert.equal(isInddSignature(header()), true);
  assert.equal(isInddSignature(new Uint8Array(64)), false);
  assert.equal(isInddSignature(header().subarray(0, 20)), false);
  const wrong = header(); wrong[16] = 0x58; assert.equal(isInddSignature(wrong), false);
});

test('garbage, empty and signature-only input is refused with a message and leaves the kernel usable', async () => {
  const kernel = await loadInddKernel();
  assert.throws(() => kernel.convert(new Uint8Array()), (e: unknown) => e instanceof InddError && e.code === 'failed' && /empty/.test(e.message));
  assert.throws(() => kernel.convert(new Uint8Array(8192)), (e: unknown) => e instanceof InddError && e.code === 'failed' && /not an INDD/.test(e.message));
  assert.throws(() => kernel.convert(new TextEncoder().encode('%PDF-1.7 not indd')), InddError);
  assert.throws(() => kernel.convert(header(1)), InddError);
  assert.throws(() => kernel.convert(header(2)), InddError);
  const noise = header(8);
  let seed = 7; for (let i = 24; i < noise.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; noise[i] = seed >> 16; }
  assert.throws(() => kernel.convert(noise), (e: unknown) => e instanceof InddError && e.code === 'failed');
  assert.equal(kernel.dead, false);
  assert.match(describeInddError(new InddError('failed', 'corrupt database: x')), /could not be converted on this device.*Export an IDML/);
});

test('input over 128 MB is refused before it reaches the converter', async () => {
  const kernel = await loadInddKernel();
  assert.throws(() => kernel.convert(new Uint8Array(INDD_MAX_INPUT + 1)), (e: unknown) => e instanceof InddError && e.code === 'limit' && /128 MB/.test(e.message));
  assert.equal(kernel.dead, false);
});

test('the browser loader path and the Node loader agree', async () => {
  const browser = await createInddKernel(new Uint8Array(readFileSync(wasmUrl))), node = await loadInddKernel();
  const bytes = header(16);
  for (const kernel of [browser, node]) assert.throws(() => kernel.convert(bytes, 'x.indd'), InddError);
});

const have = existsSync(resolve(fixtures, GOLDEN[0]![0]));
for (const [path, expected, warnings] of GOLDEN) {
  test(`fixture ${path} converts to the native package`, { skip: have ? false : 'run `node scripts/indd-corpus.ts fetch-fixtures` first' }, async () => {
    const bytes = new Uint8Array(readFileSync(resolve(fixtures, path)));
    const name = path.split('/').pop()!;
    const node = (await loadInddKernel()).convert(bytes, name);
    const browser = (await createInddKernel(new Uint8Array(readFileSync(wasmUrl)))).convert(bytes, name);
    assert.equal(sha(node.idml), expected);
    assert.equal(node.warnings.length, warnings);
    assert.deepEqual(browser.idml, node.idml);
    assert.deepEqual(browser.warnings, node.warnings);
    const parts = readZip(node.idml, { maxInputBytes: 64 << 20, maxTotalBytes: 256 << 20, maxEntryBytes: 32 << 20, maxEntries: 4096 });
    assert.ok(parts.some(p => p.name === 'designmap.xml'));
    assert.equal(new TextDecoder().decode(parts.find(p => p.name === 'mimetype')!.bytes), 'application/vnd.adobe.indesign-idml-package');
    // The converted package goes through the same IDML reader as an exported one. Real InDesign
    // paragraph styles carry more than 128 attributes, so this also guards the reader's attribute cap.
    const dom = new JSDOM(''), parse = (x: string) => new dom.window.DOMParser().parseFromString(x, 'application/xml');
    const spreads = await readIdmlSpreads(Object.fromEntries(parts.map(p => [p.name, p.bytes])), parse);
    dom.window.close();
    assert.ok(spreads.length >= 1 && spreads.every(f => f.width > 0 && f.height > 0), `${path}: ${spreads.length} spreads`);
  });
}

test('truncated fixtures refuse cleanly and repeated conversions keep the instance healthy', { skip: have ? false : 'fixtures not fetched' }, async () => {
  const kernel = await loadInddKernel();
  const bytes = new Uint8Array(readFileSync(resolve(fixtures, GOLDEN[0]![0])));
  for (const cut of [24, 4096, 8192, 20000]) {
    assert.throws(() => kernel.convert(bytes.subarray(0, cut)), InddError, `cut at ${cut}`);
  }
  // A flipped byte in the database may refuse or convert with warnings, but never crash the module.
  for (let i = 0; i < 20; i++) {
    const damaged = bytes.slice(); damaged[8192 + i * 997] = ~damaged[8192 + i * 997]! & 0xff;
    try { kernel.convert(damaged); } catch (e) { assert.ok(e instanceof InddError && e.code !== 'crashed'); }
  }
  for (let i = 0; i < 10; i++) assert.equal(sha(kernel.convert(bytes, 'BlueSquare.indd').idml), GOLDEN[0]![1]);
  assert.equal(kernel.dead, false);
});

test('lolly adobe indd writes the package and prints warnings; adobe idml reads an .indd', { skip: have ? false : 'fixtures not fetched' }, async () => {
  const run = promisify(execFile), bin = resolve(import.meta.dirname, '../shells/cli/bin/lolly.ts');
  const source = resolve(fixtures, GOLDEN[0]![0]), dir = await mkdtemp(join(tmpdir(), 'lolly-cli-indd-'));
  try {
    const output = join(dir, 'blue.idml');
    const { stderr } = await run(process.execPath, [bin, 'adobe', 'indd', source, `--output=${output}`]);
    assert.equal(sha(new Uint8Array(await readFile(output))), GOLDEN[0]![1]);
    assert.equal(stderr.split('\n').filter(l => l.startsWith('warning: ')).length, GOLDEN[0]![2]);
    const { stdout } = await run(process.execPath, [bin, 'adobe', 'idml', source], { maxBuffer: 16 * 1024 * 1024 });
    const report = JSON.parse(stdout) as { frames: unknown[]; notes: string[] };
    assert.ok(report.frames.length >= 1); assert.match(report.notes[0]!, /preview/);
    await assert.rejects(run(process.execPath, [bin, 'adobe', 'indd', output, `--output=${join(dir, 'again.idml')}`]), /not an InDesign document/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
