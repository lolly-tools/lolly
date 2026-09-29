// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { inspectMotionBytes } from '../src/motion-inspect.ts';
import { motionReport } from '../../../engine/src/motion-report.ts';

test('missing decoders produce explicit unchecked results', async () => {
  const report = await inspectMotionBytes(new Uint8Array([1]), { audio: true }, { probe: '/nonexistent/ffprobe', decode: '/nonexistent/ffmpeg' });
  assert.equal(report.ok, null);
  assert.ok(report.checks.every(check => check.status === 'not-run'));
});
test('delivery targets fail independently; review candidates do not fail intentional holds', () => {
  const report = motionReport({ width: 320, height: 180, seconds: 2, fps: 30, audio: false, truePeak: -0.2 }, { audio: true, truePeakMax: -1 }, [{ id: 'frozen-spans', status: 'review', measured: [{ from: 1 }] }]);
  assert.equal(report.ok, false);
  assert.deepEqual(report.checks.filter(check => check.status === 'fail').map(check => check.id), ['audio', 'truePeak']);
  assert.equal(motionReport({ audio: false }, { audio: false }).ok, true);
});
test('encoded black, frozen and silent spans remain review candidates', { skip: spawnSync('ffmpeg', ['-version']).status === 0 ? false : 'Install ffmpeg for encoded motion inspection fixtures', timeout: 30_000 }, async () => {
  const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=160x120:r=24:d=2', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '2', '-c:v', 'libvpx-vp9', '-c:a', 'libopus', '-f', 'webm', 'pipe:1']);
  assert.equal(encoded.status, 0, encoded.stderr.toString());
  const report = await inspectMotionBytes(encoded.stdout, { width: 160, height: 120, fps: 24, seconds: 2, audio: true });
  assert.equal(report.ok, true, JSON.stringify(report));
  for (const id of ['black-spans', 'frozen-spans', 'silent-spans']) assert.equal(report.checks.find(check => check.id === id)?.status, 'review', id);
  const skipped = await inspectMotionBytes(encoded.stdout, {}, { probe: 'ffprobe', decode: '/nonexistent/ffmpeg' });
  assert.equal(skipped.checks.find(check => check.id === 'loudness')?.status, 'not-run');
});
