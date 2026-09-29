// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { callTool } from '../src/tools.ts';
import { closeBrowser, closeWebShell } from '../src/render.ts';

const skip = !process.env.LOLLY_WEB_BASE ? 'set LOLLY_WEB_BASE to a running web shell'
  : ['ffprobe', 'ffmpeg'].some(binary => spawnSync(binary, ['-version'], { stdio: 'ignore' }).status !== 0)
    ? 'ffprobe and ffmpeg are required to inspect the encoded movie' : false;

test('MCP exports the requested movie dimensions, duration, frame rate and codec', { skip, timeout: 180_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-motion-mcp-'));
  try {
    const recipe = JSON.parse(await readFile(new URL('../../../skills/lolly/examples/motion/quiet-explainer.json', import.meta.url), 'utf8'));
    const result = await callTool('lolly_render', {
      ...recipe, width: 320, height: 320, fps: 24, seconds: 1.25, wait: 0,
      codec: 'vp9', vq: 'smaller', c2pa: 'off', imprint: false,
    });
    assert.ok(!result.isError, JSON.stringify(result));
    const resource = result.content.find(item => item.type === 'resource');
    assert.ok(resource?.type === 'resource' && typeof resource.resource.blob === 'string');
    const file = join(directory, 'movie.webm');
    await writeFile(file, Buffer.from(resource.resource.blob, 'base64'));
    const probe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file,
    ], { encoding: 'utf8' })) as {
      format: { duration: string };
      streams: Array<{ codec_type: string; codec_name: string; width: number; height: number; avg_frame_rate: string; nb_read_frames: string }>;
    };
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    assert.ok(video);
    assert.equal(video.codec_name, 'vp9');
    assert.equal(video.width, 320);
    assert.equal(video.height, 320);
    assert.equal(Number(video.nb_read_frames), 30);
    assert.equal(video.avg_frame_rate, '24/1');
    assert.ok(Math.abs(Number(probe.format.duration) - 1.25) < 0.05);
    const pixels = execFileSync('ffmpeg', [
      '-v', 'error', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
    ]);
    let textPixels = 0;
    let outsideTextPixels = 0;
    for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
      const at = (y * 320 + x) * 3;
      if (pixels[at]! < 100 && pixels[at + 1]! < 100 && pixels[at + 2]! < 100) {
        textPixels++;
        if (x < 25 || x > 295 || y < 80 || y > 240) outsideTextPixels++;
      }
    }
    assert.ok(textPixels > 1000, `the scaled authored text is absent: ${textPixels} pixels`);
    assert.equal(outsideTextPixels, 0, 'resizing must preserve the composition inside the authored text box');
    assert.ok(probe.streams.every(stream => stream.codec_type !== 'audio'), 'the silent brief stays silent');
  } finally {
    await closeBrowser();
    await closeWebShell();
    await rm(directory, { recursive: true, force: true });
  }
});
