// SPDX-License-Identifier: MPL-2.0
/**
 * lolly://tool/{id}/preview answers from the address the catalog index gives the tool's
 * preview, then from the catalog's own preview files. paths.ts resolves the content roots
 * once per process, so each profile is read in a child process, as asset-index-shared does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { previewCandidates } from '../src/resources.ts';

const RESOURCES = pathToFileURL(fileURLToPath(new URL('../src/resources.ts', import.meta.url))).href;
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const MARKER = '@@PREVIEW@@';

const CHILD = [
  "const { readResource } = await import(process.env.PROBE_MOD);",
  "const read = await readResource(process.env.PROBE_URI);",
  "process.stdout.write(process.env.PROBE_MARKER + JSON.stringify(read));",
].join('\n');

interface Read { uri: string; mimeType?: string; text?: string; blob?: string }

function readPreview(profile: string, id: string): Read {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LOLLY_PROFILE: profile, PROBE_MOD: RESOURCES, PROBE_URI: `lolly://tool/${id}/preview`, PROBE_MARKER: MARKER },
  });
  const at = run.stdout?.indexOf(MARKER) ?? -1;
  if (at === -1) throw new Error(`the ${id} preview on ${profile} produced nothing\n${run.stdout ?? ''}\n${run.stderr ?? ''}`);
  return JSON.parse(run.stdout.slice(at + MARKER.length)) as Read;
}

test('an ordinary tool answers with its catalog SVG', () => {
  const read = readPreview('lolly-start', 'qr-code');
  assert.equal(read.mimeType, 'image/svg+xml');
  assert.match(read.text ?? '', /<svg/);
});

test('signature on lolly-demo answers with the card the index gives it', () => {
  // This pack has no signature.svg; the index points at the tool's own card.svg.
  const read = readPreview('lolly-demo', 'signature');
  assert.equal(read.mimeType, 'image/svg+xml');
  assert.match(read.text ?? '', /<svg/);
});

test('prompt-card on lolly-start answers with its WebP preview as a blob', () => {
  const read = readPreview('lolly-start', 'prompt-card');
  assert.equal(read.mimeType, 'image/webp');
  assert.equal(read.text, undefined);
  const bytes = Buffer.from(read.blob ?? '', 'base64');
  assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP');
});

test('an index value outside the preview addresses is never read', () => {
  const catalog = ['/catalog/previews/demo.svg', '/catalog/previews/demo.webp', '/catalog/previews/demo.png'];
  assert.deepEqual(previewCandidates('demo', '/tools/demo/card.svg'), ['/tools/demo/card.svg', ...catalog]);
  assert.deepEqual(previewCandidates('demo', '/catalog/previews/demo.webp'),
    ['/catalog/previews/demo.webp', '/catalog/previews/demo.svg', '/catalog/previews/demo.png']);
  // A signed build's hashed addresses are read as the plain files kept beside them.
  assert.deepEqual(previewCandidates('demo', '/tools/demo@0123456789abcdef/card.svg'), ['/tools/demo/card.svg', ...catalog]);
  assert.deepEqual(previewCandidates('demo', '/catalog/previews/demo.0123456789abcdef.webp'),
    ['/catalog/previews/demo.webp', '/catalog/previews/demo.svg', '/catalog/previews/demo.png']);
  for (const indexed of ['/tools/demo/card.html', '/tools/other/card.svg', '/tools/other@0123456789abcdef/card.svg', '/catalog/previews/../assets/index.json', '/catalog/previews/demo.look0.svg', 42, undefined]) {
    assert.deepEqual(previewCandidates('demo', indexed), catalog, String(indexed));
  }
});
