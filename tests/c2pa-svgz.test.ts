// SPDX-License-Identifier: MPL-2.0
/**
 * Content Credentials in SVGZ (plan 326, decision 6).
 *
 * The C2PA specification defines the SVG embedding (a `c2pa:manifest` element in the
 * SVG's `<metadata>`, Appendix A.3.3) and says nothing about a compressed variant, and
 * c2pa-rs (c2patool) refuses a `.svgz` file as an unsupported type. SVGZ is a gzip
 * member around SVG text with no framing of its own, so Lolly writes the credential into
 * the SVG and compresses the result: the hard binding covers the SVG bytes, and
 * decompressing the file gives back exactly the signed document. Lolly's verifier reads
 * it directly, and c2patool reads it once the file is decompressed. These tests hold
 * both halves, the tamper evidence through the compression, and the CLI writing such a file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { C2PA_FORMATS, attachC2paStore, embedC2pa, exportActionSteps, extractC2paStore, gzip, gunzip, verifyC2pa } from '../engine/src/index.ts';

const ROOT = new URL('../', import.meta.url).pathname;
const DATES = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) };
const SVG = new TextEncoder().encode('<?xml version="1.0" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20"><metadata></metadata><rect width="40" height="20" fill="#d9480f"/></svg>');
const hasC2patool = spawnSync('c2patool', ['--version']).status === 0;
const stamp = (bytes: Uint8Array) => embedC2pa(bytes, 'svgz', {
  claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: 'test' },
  environment: { format: 'svgz', surface: 'test', route: 'operations', renderer: 'design-draw-v0' },
  actions: exportActionSteps('svgz', {}), dates: DATES,
});

test('svgz is a stampable format, appended after the existing slots', () => {
  assert.equal(C2PA_FORMATS.at(-1), 'svgz');
  assert.equal(C2PA_FORMATS.indexOf('svgz'), C2PA_FORMATS.length - 1, 'append-only: no earlier slot moved');
});

test('an SVGZ carries a credential inside its SVG and verifies as svgz', async () => {
  const out = await stamp(gzip(SVG));
  assert.deepEqual([...out.subarray(0, 2)], [0x1f, 0x8b], 'still a gzip member');
  const inner = gunzip(out);
  assert.match(new TextDecoder().decode(inner), /<c2pa:manifest/);
  const report = await verifyC2pa(out);
  assert.equal(report.found, true);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(report.format, 'svgz');
  assert.equal(report.environment?.route, 'operations');
  assert.equal(report.environment?.renderer, 'design-draw-v0');
  // The same credential read from the decompressed document, as any SVG reader would.
  const plain = await verifyC2pa(inner);
  assert.equal(plain.state, 'valid');
  assert.equal(plain.format, 'svg');
  assert.equal(plain.claim?.instanceId, report.claim?.instanceId);
});

test('a gzip written by another producer is read the same way', async () => {
  const signed = gunzip(await stamp(gzip(SVG)));
  const report = await verifyC2pa(new Uint8Array(gzipSync(signed, { level: 1 })));
  assert.equal(report.state, 'valid');
  assert.equal(report.format, 'svgz');
});

test('an edit to the compressed SVG fails the hard binding', async () => {
  const text = new TextDecoder().decode(gunzip(await stamp(gzip(SVG))));
  const edited = new TextEncoder().encode(text.replace('#d9480f', '#1c7ed6'));
  const report = await verifyC2pa(gzip(edited));
  assert.equal(report.found, true);
  assert.equal(report.state, 'invalid');
});

test('a stored credential re-attaches to an SVGZ the way it does to an SVG', async () => {
  const signed = gunzip(await stamp(gzip(SVG)));
  const store = extractC2paStore(signed)!;
  assert.equal(store.format, 'svg');
  const back = attachC2paStore(gzip(signed), 'svgz', store.store);
  const report = await verifyC2pa(back);
  assert.equal(report.found, true);
  assert.equal(report.format, 'svgz');
});

test('gzip that holds no SVG, or is broken, is not read as a container', async () => {
  assert.equal((await verifyC2pa(gzip(new TextEncoder().encode('plain words, not an svg document')))).found, false);
  const truncated = (await stamp(gzip(SVG))).subarray(0, 40);
  assert.equal((await verifyC2pa(truncated)).found, false);
  await assert.rejects(() => stamp(gzip(new TextEncoder().encode('not svg'))));
});

test('c2patool reads the credential once the SVGZ is decompressed, and names .svgz unsupported', { skip: !hasC2patool && 'c2patool not installed' }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-svgz-c2pa-'));
  try {
    const out = await stamp(gzip(SVG));
    await writeFile(join(dir, 'page.svgz'), out);
    await writeFile(join(dir, 'page.svg'), gunzipSync(out));
    const direct = spawnSync('c2patool', [join(dir, 'page.svgz')], { encoding: 'utf8' });
    assert.notEqual(direct.status, 0, 'c2pa-rs has no SVGZ reader');
    const run = spawnSync('c2patool', [join(dir, 'page.svg')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(run.stdout) as { validation_state?: string; validation_status?: { code: string }[] };
    assert.equal(report.validation_state, 'Valid');
    assert.deepEqual((report.validation_status ?? []).map((s) => s.code).filter((code) => code !== 'signingCredential.untrusted'), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the CLI writes a credentialed SVGZ for a Design page, with the route that drew it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-svgz-cli-'));
  try {
    const boxes = [
      { id: 'cover', kind: 'frame', x: 0, y: 0, w: 320, h: 200, bg: '#f4f1ea' },
      { id: 'chip', frame: 'cover', kind: 'box', x: 20, y: 20, w: 120, h: 80, bg: '#d9480f' },
    ];
    const out = join(dir, 'cover.svgz');
    const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(boxes)}`, '--s=cover', '--export=svgz', `--output=${out}`], {
      cwd: ROOT, encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, LOLLY_ROOT: ROOT, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDERER: 'chromium', NO_COLOR: '1' },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stderr, /Escalating|C2PA_SKIPPED/);
    const report = await verifyC2pa(new Uint8Array(await readFile(out)));
    assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter((c) => !c.ok)));
    assert.equal(report.format, 'svgz');
    assert.equal(report.environment?.surface, 'cli');
    assert.equal(report.environment?.route, 'operations');
    assert.match(String(report.environment?.renderer), /^design-draw-v\d+$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
