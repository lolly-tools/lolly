// SPDX-License-Identifier: MPL-2.0
/**
 * Convert Font 1.1 on the CLI (shells/cli/src/batch.ts rows over the real community
 * tool): a subset to typed characters arrives in the chosen container with those
 * characters still drawn, and a font whose own fsType forbids embedding is refused
 * for a subset while its plain container conversion still runs. lolly-start profile,
 * no browser tier, as in tests/cli-transform-lane.test.ts.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.LOLLY_PROFILE = 'lolly-start';
process.env.LOLLY_WEB_DIST = join(tmpdir(), 'lolly-no-such-web-dist');
delete process.env.LOLLY_WEB_BASE;

const { runBatchCli } = await import('../shells/cli/src/batch.ts');
const { inspectFont } = await import('../engine/src/font-inspect.ts');
const { woffToSfnt } = await import('../engine/src/font-convert.ts');

const HEBREW = fileURLToPath(new URL('./fixtures/text-composition/fonts/notosanshebrew/NotoSansHebrew[wdth,wght].ttf', import.meta.url));
const OUTFIT = new Uint8Array(readFileSync(new URL('../shells/web/public/fonts/Outfit[wght].ttf', import.meta.url)));

const work = await mkdtemp(join(tmpdir(), 'lolly-font-convert-'));
after(() => rm(work, { recursive: true, force: true }));

async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try { return await fn(); } finally { process.stderr.write = write; }
}

/** Outfit with OS/2.fsType set to restricted licence embedding. */
async function restrictedFont(): Promise<string> {
  const copy = OUTFIT.slice();
  const view = new DataView(copy.buffer);
  for (let i = 0; i < view.getUint16(4); i++) {
    const entry = 12 + i * 16;
    if (String.fromCharCode(...copy.subarray(entry, entry + 4)) === 'OS/2') view.setUint16(view.getUint32(entry + 8) + 8, 0x0002);
  }
  const path = join(work, 'restricted.ttf');
  await writeFile(path, copy);
  return path;
}

test('a subset to typed characters is a smaller WOFF that still draws them', async () => {
  const csv = join(work, 'subset.csv');
  await writeFile(csv, `toolId,source,target,subset,characters\nfont-convert,"${HEBREW}",woff,text,"שלום abc"\nfont-convert,"${HEBREW}",ttf,latin,\n`);
  const outDir = join(work, 'subset-out');
  assert.equal(await quietly(() => runBatchCli(csv, { outDir })), 0);
  assert.deepEqual((await readdir(outDir)).sort(), ['01-notosanshebrew-wdth-wght.woff', '02-notosanshebrew-wdth-wght.ttf']);
  const woff = new Uint8Array(await readFile(join(outDir, '01-notosanshebrew-wdth-wght.woff')));
  assert.equal(String.fromCharCode(...woff.subarray(0, 4)), 'wOFF');
  const subset = inspectFont(woffToSfnt(woff));
  const full = inspectFont(new Uint8Array(readFileSync(HEBREW)));
  const mapped = (info: typeof full, cp: number) => info.coverage.ranges.some(([a, b]) => cp >= a && cp <= b);
  for (const char of 'שלום abc') assert.ok(mapped(subset, char.codePointAt(0)!), `kept ${char}`);
  assert.ok(subset.coverage.characters < full.coverage.characters);
  assert.equal(subset.embedding.fsType, full.embedding.fsType);
  const latin = inspectFont(new Uint8Array(await readFile(join(outDir, '02-notosanshebrew-wdth-wght.ttf'))));
  assert.ok(mapped(latin, 0x41) && !mapped(latin, 0x5e9), 'the Basic Latin preset drops Hebrew');
});

test('a restricted font is refused for a subset, and its container conversion still runs', async () => {
  const restricted = await restrictedFont();
  const csv = join(work, 'restricted.csv');
  await writeFile(csv, `toolId,source,target,subset,characters\nfont-convert,"${restricted}",woff,latin,\nfont-convert,"${restricted}",woff,all,\n`);
  const outDir = join(work, 'restricted-out');
  const code = await quietly(() => runBatchCli(csv, { outDir, keepGoing: true }));
  assert.notEqual(code, 0, 'the refused row fails the batch');
  assert.deepEqual(await readdir(outDir), ['02-restricted.woff']);
});
