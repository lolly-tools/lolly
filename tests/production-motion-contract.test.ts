// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Hex } from '../engine/src/bytes.ts';
import { parseProductionSpec, inspectProduction, productionProblems, productionDigest, requireProduction, acceptProduction, type ProductionMotionContract, type ProductionReport } from '../engine/src/production.ts';
import { inspectProductionBytes } from '../packages/node-shell/src/production.ts';
import { collectProductionMotion } from '../packages/node-shell/src/production-motion.ts';

const run = promisify(execFile);
const skip = ['ffmpeg', 'ffprobe'].some(binary => spawnSync(binary, ['-version'], { stdio: 'ignore' }).status !== 0) && 'Install ffmpeg and ffprobe for encoded production fixtures.';
const contract: ProductionMotionContract = { profile: 'lolly/production-motion-v1', id: 'two-shots', revision: '1', format: 'webm', width: 160, height: 120, requirements: [],
  motion: { seconds: 2, secondsTolerance: .05, fps: 24, fpsTolerance: .02, frameCount: 48, timestampTolerance: .01, audio: false } };
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-motion-fixtures-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const encode = async (name: string, opts: { seconds?: number; audio?: boolean; reverse?: boolean; mp4?: boolean } = {}) => {
    const path = join(directory, name), seconds = opts.seconds ?? 2;
    const args = ['-v', 'error', '-f', 'lavfi', '-i', `color=${opts.reverse ? 'blue' : 'red'}:s=160x120:r=24:d=${seconds}`];
    if (opts.audio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    args.push('-vf', `drawbox=x=0:y=0:w=iw:h=ih:color=${opts.reverse ? 'red' : 'blue'}:t=fill:enable='gte(t,1)'`, '-t', String(seconds));
    if (opts.mp4) args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac');
    else args.push('-c:v', 'libvpx-vp9', '-lossless', '1', '-c:a', 'libopus');
    await run('ffmpeg', [...args, '-y', path], { timeout: 20_000 });
    return new Uint8Array(await readFile(path));
  };
  return { directory, encode };
}
const allPass = async (report: ProductionReport, bytes: Uint8Array, c = contract) => assert.deepEqual(await productionProblems(report, bytes, c), []);

test('motion admission rejects missing time/audio policy, silent widening and invalid sample times', () => {
  assert.deepEqual(parseProductionSpec(contract), contract);
  for (const motion of [{ ...contract.motion, fps: 0 }, { ...contract.motion, audio: true }, { ...contract.motion, typo: true },
    { ...contract.motion, audioSecondsTolerance: .1 }, { ...contract.motion, comparison: { referenceSha256: 'a'.repeat(64), times: [1, 0], channelTolerance: 0, maxChangedFraction: 0, regions: [] } }]) {
    assert.throws(() => parseProductionSpec({ ...contract, motion }));
  }
  assert.throws(() => parseProductionSpec({ ...contract, pages: 1 }));
  assert.throws(() => parseProductionSpec({ ...contract, format: 'gif' }));
});

test('encoded motion measures every timestamp and declared sample regions without a byte-equality shortcut', { skip, timeout: 60_000 }, async t => {
  const f = await fixture(t), bytes = await f.encode('reference.webm'), reversed = await f.encode('reversed.webm', { reverse: true });
  const c: ProductionMotionContract = { ...contract, motion: { ...contract.motion, comparison: { referenceSha256: await sha256Hex(bytes), times: [0, 1, 47 / 24], channelTolerance: 0, maxChangedFraction: 0,
    regions: [{ id: 'message', x: 10, y: 10, width: 80, height: 60, minSsim: 1, maxInkDelta: 0 }] } } };
  const report = await inspectProductionBytes(bytes, c, bytes); await allPass(report, bytes, c);
  assert.match(JSON.stringify(report.records), /appearanceBetweenSamples.*unmeasured/);
  const bad = await inspectProductionBytes(reversed, c, bytes);
  assert.equal(bad.checks.find(check => check.id === 'sample.1.appearance.whole')?.state, 'fail');
  assert.equal(bad.checks.find(check => check.id === 'sample.1.appearance.message.ssim')?.state, 'fail');
  const remuxedPath = join(f.directory, 'metadata.webm');
  await run('ffmpeg', ['-v', 'error', '-i', join(f.directory, 'reference.webm'), '-c', 'copy', '-metadata', 'comment=approved metadata variation', '-y', remuxedPath]);
  const remuxed = new Uint8Array(await readFile(remuxedPath));
  assert.notEqual(await sha256Hex(bytes), await sha256Hex(remuxed));
  await allPass(await inspectProductionBytes(remuxed, c, bytes), remuxed, c);
  assert.ok((await productionProblems(report, remuxed, c)).includes('artifact-digest-mismatch'));
  const staleReference = await inspectProductionBytes(bytes, c, reversed);
  assert.equal(staleReference.checks.find(check => check.id === 'sample.0.appearance.whole')?.state, 'undetermined');
});

test('shortened files, missing audio and stricter timing fail independently', { skip, timeout: 40_000 }, async t => {
  const f = await fixture(t), short = await f.encode('short.webm', { seconds: 1 });
  const report = await inspectProductionBytes(short, contract);
  for (const id of ['motion.seconds', 'motion.frameCount']) assert.equal(report.checks.find(c => c.id === id)?.state, 'fail');
  await assert.rejects(requireProduction(report, short, contract), /motion.frameCount/);
  await assert.rejects(acceptProduction(report, short, contract, { kind: 'local-person', id: 'reviewer', decisionRef: 'review-1' }, []));
  const wantedAudio: ProductionMotionContract = { ...contract, motion: { ...contract.motion, audio: true, audioSecondsTolerance: .05 } };
  assert.equal((await inspectProductionBytes(short, wantedAudio)).checks.find(c => c.id === 'motion.audio')?.state, 'fail');
  const bytes = await f.encode('full.webm');
  const exact: ProductionMotionContract = { ...contract, motion: { ...contract.motion, timestampTolerance: 0 } };
  assert.equal((await inspectProductionBytes(bytes, exact)).checks.find(c => c.id === 'motion.timestampError')?.state, 'fail', 'millisecond timestamps are not exact 24 fps');
});

test('intentional silence and reading holds pass while authored loudness and audio duration remain mandatory', { skip, timeout: 40_000 }, async t => {
  const f = await fixture(t), bytes = await f.encode('silent.webm', { audio: true });
  const c: ProductionMotionContract = { ...contract, motion: { ...contract.motion, audio: true, audioSecondsTolerance: .05 } };
  const report = await inspectProductionBytes(bytes, c); await allPass(report, bytes, c);
  assert.match(JSON.stringify(report.records), /silent-spans.*review/);
  const loud: ProductionMotionContract = { ...c, motion: { ...c.motion, loudness: { min: -24, max: -14 }, truePeakMax: -1 } };
  const measured = await inspectProductionBytes(bytes, loud);
  assert.equal(measured.checks.find(check => check.id === 'motion.loudness.min')?.state, 'fail');
  assert.equal((await inspectProductionBytes(bytes, contract)).checks.find(check => check.id === 'motion.audio')?.state, 'fail');
  const shortPath = join(f.directory, 'short-audio.webm');
  await run('ffmpeg', ['-v', 'error', '-i', join(f.directory, 'silent.webm'), '-c:v', 'copy', '-af', 'atrim=duration=1,asetpts=PTS+1/TB', '-c:a', 'libopus', '-y', shortPath]);
  const short = await inspectProductionBytes(new Uint8Array(await readFile(shortPath)), c);
  assert.equal(short.checks.find(check => check.id === 'motion.audioSeconds')?.state, 'fail');
  assert.equal(short.checks.find(check => check.id === 'motion.audioTimestampError')?.state, 'fail');
});

test('MP4 delivery reads its actual frame count and refuses a different container requirement', { skip, timeout: 30_000 }, async t => {
  const f = await fixture(t), bytes = await f.encode('movie.mp4', { mp4: true });
  const c: ProductionMotionContract = { ...contract, format: 'mp4' };
  await allPass(await inspectProductionBytes(bytes, c), bytes, c);
  assert.equal((await inspectProductionBytes(bytes, contract)).checks.find(check => check.id === 'format')?.state, 'fail');
});

test('unavailable decoders, corrupt bytes and cancellation cannot produce a verified motion report', { skip, timeout: 30_000 }, async t => {
  const f = await fixture(t), bytes = await f.encode('movie.webm');
  const report = await inspectProduction(bytes, contract, (b, c, signal) => collectProductionMotion(b, c as ProductionMotionContract, signal, { probe: 'ffprobe', decode: '/nonexistent/ffmpeg' }));
  assert.equal(report.checks.find(check => check.id === 'readability')?.state, 'undetermined');
  assert.ok((await productionProblems(report, bytes, contract)).length);
  const corrupt = await inspectProductionBytes(bytes.subarray(0, 80), contract);
  assert.ok((await productionProblems(corrupt, bytes.subarray(0, 80), contract)).length);
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 10);
  try { await assert.rejects(inspectProductionBytes(bytes, contract, undefined, abort.signal), { name: 'AbortError' }); }
  finally { clearTimeout(timer); }
});

test('saved motion evidence validates measured values and authored tolerances after JSON reload', { skip, timeout: 30_000 }, async t => {
  const f = await fixture(t), bytes = await f.encode('movie.webm');
  const report = JSON.parse(JSON.stringify(await inspectProductionBytes(bytes, contract))) as ProductionReport;
  await allPass(report, bytes);
  const fps = report.checks.find(check => check.id === 'motion.fps')!;
  fps.actual = 10; fps.state = 'pass'; fps.tolerance = 100;
  const { reportSha256: _digest, ...body } = report; report.reportSha256 = await productionDigest(body);
  assert.ok((await productionProblems(report, bytes, contract)).includes('motion.fps:coverage'));
});

test('CLI and MCP inspect the same encoded artifact under the same motion contract', { skip, timeout: 40_000 }, async t => {
  const f = await fixture(t), bytes = await f.encode('movie.webm'), path = join(f.directory, 'checks.json');
  await writeFile(path, JSON.stringify(contract));
  const cli = await run(process.execPath, ['shells/cli/bin/lolly.ts', 'inspect', join(f.directory, 'movie.webm'), '--motion', `--production=${path}`], { timeout: 20_000 });
  const value = JSON.parse(cli.stdout);
  const { callTool } = await import('../services/mcp/src/tools.ts');
  const result = await callTool('lolly_inspect', { file: { base64: Buffer.from(bytes).toString('base64') }, production: contract });
  assert.ok(!result.isError, JSON.stringify(result));
  const text = result.content.find(block => block.type === 'text'); assert.ok(text?.type === 'text');
  const mcp = JSON.parse(text.text);
  assert.deepEqual(value.checks ?? value.data?.checks, mcp.checks);
  await allPass(mcp, bytes);
});
