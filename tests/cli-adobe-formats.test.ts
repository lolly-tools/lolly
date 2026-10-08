// SPDX-License-Identifier: MPL-2.0
// The CLI writes IDML and Premiere XML on its DOM-free path. Both writers
// (engine/src/design-idml.ts, design-premiere.ts) are pure engine code over the authored
// Design document, the same way the dotLottie writer is, so `NODE_FORMATS` has to list
// them. When it did not, run.ts sent both formats to the browser tier, and a CLI without
// a built web shell refused to write either file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_FORMATS } from '../packages/node-shell/src/raster.ts';
import { readZip } from '../engine/src/zip.ts';

const run = promisify(execFile);
const BIN = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));

/** Runs the real CLI with the browser tier unavailable: LOLLY_WEB_DIST points at a directory
 *  with no built shell and LOLLY_RENDERER pins Chromium, so only the DOM-free path can
 *  produce a file. */
async function exportWithoutBrowser(dir: string, args: string[]): Promise<{ stderr: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_WEB_DIST: join(dir, 'no-web-shell'), LOLLY_RENDERER: 'chromium' };
  delete env.LOLLY_WEB_BASE;
  const { stderr } = await run(process.execPath, [BIN, 'design', ...args], { env, maxBuffer: 16 * 1024 * 1024 });
  return { stderr };
}

test('NODE_FORMATS lists the two Adobe interchange formats beside lottie', () => {
  for (const format of ['lottie', 'idml', 'premiere-xml']) assert.ok(NODE_FORMATS.includes(format), `${format} must be in NODE_FORMATS`);
});

test('the real CLI writes IDML with no browser tier', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-cli-idml-'));
  try {
    const output = join(dir, 'page.idml');
    const { stderr } = await exportWithoutBrowser(dir, ['--width=64', '--height=64', '--export=idml', `--output=${output}`,
      '--boxes=[{"id":"t","kind":"text","x":0,"y":0,"w":64,"h":32,"text":"Hello","fg":"#000000"}]']);
    assert.doesNotMatch(stderr, /Escalating/);
    const files = Object.fromEntries(readZip(new Uint8Array(await readFile(output))).map(entry => [entry.name, entry.bytes]));
    assert.equal(new TextDecoder().decode(files.mimetype), 'application/vnd.adobe.indesign-idml-package');
    assert.ok(files['designmap.xml'], 'the package carries its designmap');
    assert.match(new TextDecoder().decode(files['Stories/Story_story-1.xml']), /Hello/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the real CLI writes a Premiere XML package with no browser tier', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-cli-premiere-'));
  try {
    const output = join(dir, 'sequence.zip');
    const { stderr } = await exportWithoutBrowser(dir, ['--width=64', '--height=64', '--projectFps=24', '--export=premiere-xml', `--output=${output}`,
      '--boxes=[{"id":"still","kind":"image","x":0,"y":0,"w":64,"h":64,"image":"lolly/demo/lorikeet-lollipop","start":0,"dur":2}]']);
    assert.doesNotMatch(stderr, /Escalating/);
    const files = Object.fromEntries(readZip(new Uint8Array(await readFile(output))).map(entry => [entry.name, entry.bytes]));
    assert.ok(files['Media/source-1.jpg']?.length, 'the original media travels in the package');
    const sequence = new TextDecoder().decode(files['sequence.xml']);
    assert.match(sequence, /<xmeml/);
    assert.match(sequence, /Media\/source-1\.jpg/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
