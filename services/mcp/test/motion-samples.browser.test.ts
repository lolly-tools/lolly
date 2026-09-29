// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { callTool } from '../src/tools.ts';
import { closeBrowser, closeWebShell } from '../src/render.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const boxes = [
  { id: 'board', kind: 'frame', x: 0, y: 0, w: 160, h: 120, bg: '#ffffff', radius: 0 },
  { id: 'red', kind: 'box', frame: 'board', x: 0, y: 0, w: 160, h: 120, bg: '#ff0000', radius: 0, start: 0, dur: 1, lane: 'seq', enter: 'none', exit: 'none' },
  { id: 'green', kind: 'box', frame: 'board', x: 0, y: 0, w: 160, h: 120, bg: '#00ff00', radius: 0, start: 1, dur: 1, lane: 'seq', enter: 'none', exit: 'none' },
  { id: 'blue', kind: 'box', frame: 'board', x: 0, y: 0, w: 160, h: 120, bg: '#0000ff', radius: 0, start: 2, dur: 1, lane: 'seq', enter: 'none', exit: 'none' },
];
const base = { toolId: 'design', inputs: { boxes }, width: 160, height: 120, c2pa: 'off', imprint: false };

async function center(bytes: Uint8Array): Promise<number[]> {
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [160, 120]);
  const at = (60 * info.width + 80) * info.channels;
  return [...data.subarray(at, at + 3)].map(value => value < 3 ? 0 : value > 252 ? 255 : value);
}
async function archiveColors(bytes: Uint8Array): Promise<number[][]> {
  const files = Object.entries(unzipSync(bytes)).sort(([a], [b]) => a.localeCompare(b));
  assert.ok(files.every(([name]) => /-\d\d\.png$/.test(name)));
  return Promise.all(files.map(([, bytes]) => center(bytes)));
}
async function rendered(args: Record<string, unknown>): Promise<{ bytes: Uint8Array; mime: string }> {
  const result = await callTool('lolly_render', { ...base, ...args });
  console.log('sample export', args.format, args.sampleTimes ?? args.cuts, result.isError ?? false);
  assert.ok(!result.isError, JSON.stringify(result));
  const image = result.content.find(item => item.type === 'image');
  if (image?.type === 'image') return { bytes: Buffer.from(image.data, 'base64'), mime: image.mimeType };
  const resource = result.content.find(item => item.type === 'resource');
  assert.ok(resource?.type === 'resource' && typeof resource.resource.blob === 'string');
  return { bytes: Buffer.from(resource.resource.blob, 'base64'), mime: resource.resource.mimeType! };
}

test('MCP and CLI deliver timed PNG samples and paged PDF through the real web export', {
  skip: process.env.LOLLY_WEB_BASE ? false : 'set LOLLY_WEB_BASE to a running web shell', timeout: 360_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-samples-'));
  try {
    const uniform = await rendered({ format: 'png', cuts: 3 });
    assert.equal(uniform.mime, 'application/zip');
    const rgb = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
    assert.deepEqual(await archiveColors(uniform.bytes), rgb);
    const exact = await rendered({ format: 'png', sampleTimes: [0, 0.999, 1, 2] });
    assert.equal(exact.mime, 'application/zip');
    assert.deepEqual(await archiveColors(exact.bytes), [rgb[0], ...rgb]);
    const blurred = await rendered({ format: 'png', sampleTimes: [0.999, 1, 2], motionBlur: { samples: 4, shutterAngle: 360 } });
    assert.deepEqual(await archiveColors(blurred.bytes), rgb, 'hard cuts cannot blend neighboring shots');
    const exposure = await rendered({ format: 'png', fps: 10, sampleTimes: [0.05], motionBlur: { samples: 4, shutterAngle: 360 }, inputs: { background: '#000000', boxes: [
      { ...boxes[0], bg: '#000000' },
      { ...boxes[1], id: 'back', bg: '#000000' },
      { ...boxes[1], id: 'shape', lane: '', bg: '#ffffff', w: 10, x: 20, kf: 't0_el_x0*t1000_x1000' },
    ] } });
    const linearPixels = await sharp(exposure.bytes).removeAlpha().raw().toBuffer();
    for (const x of [35, 60, 85, 110]) assert.ok(Math.abs(linearPixels[(60 * 160 + x) * 3]! - 137) <= 3, `quarter exposure at x=${x}`);
    const single = await rendered({ format: 'png', sampleTimes: [2] });
    assert.equal(single.mime, 'image/png');
    assert.deepEqual(await center(single.bytes), rgb[2]);
    const pdf = await rendered({ format: 'pdf', sampleTimes: [0, 1, 2], convertPaths: false });
    assert.equal(pdf.mime, 'application/pdf');
    assert.equal((await PDFDocument.load(pdf.bytes)).getPageCount(), 3);
    for (const args of [{ sampleTimes: [3] }, { inputs: { boxes: [] }, sampleTimes: [0] }]) {
      const result = await callTool('lolly_render', { ...base, format: 'png', ...args });
      assert.equal(result.isError, true);
      assert.match(JSON.stringify(result.content), /timeline end|timed composition/);
    }
    for (const sampling of ['--cuts=3', '--sampletimes=0,1,2']) {
      const path = join(directory, 'frames.zip');
      await promisify(execFile)(process.execPath, [
        fileURLToPath(new URL('../../../shells/cli/bin/lolly.ts', import.meta.url)), 'design',
        `--boxes=${JSON.stringify(boxes)}`, '--width=160', '--height=120', '--no-provenance',
        '--export=png', `--output=${path}`, sampling,
      ], { env: { ...process.env, LOLLY_RENDERER: 'chromium' } });
      assert.deepEqual(await archiveColors(await readFile(path)), rgb);
    }
    const refusedPath = join(directory, 'refused.png');
    await assert.rejects(promisify(execFile)(process.execPath, [
      fileURLToPath(new URL('../../../shells/cli/bin/lolly.ts', import.meta.url)), 'design',
      `--boxes=${JSON.stringify(boxes)}`, '--width=160', '--height=120', '--no-provenance',
      '--export=png', `--output=${refusedPath}`, '--sampletimes=3', '--html-fallback',
    ], { env: { ...process.env, LOLLY_RENDERER: 'chromium' } }), /before the timeline end/);
    await assert.rejects(readFile(refusedPath), { code: 'ENOENT' });
  } finally {
    await closeBrowser(); await closeWebShell();
    await rm(directory, { recursive: true, force: true });
  }
});
