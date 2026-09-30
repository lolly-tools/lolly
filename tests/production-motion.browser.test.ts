// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionDigest, requireProduction, type ProductionMotionContract } from '../engine/src/production.ts';
import { render, closeBrowser, closeWebShell } from '../services/mcp/src/render.ts';
import { holdEncodeTier } from './helpers/sequence-browser.ts';

const skip = !process.env.LOLLY_WEB_BASE ? 'Set LOLLY_WEB_BASE for motion production render tests.'
  : ['ffmpeg', 'ffprobe'].some(binary => spawnSync(binary, ['-version'], { stdio: 'ignore' }).status !== 0) ? 'Install ffmpeg and ffprobe.' : false;
test('real Design video exports enforce production checks in MCP and CLI and retain failed evidence', { skip, timeout: 180_000 }, async t => {
  const release = await holdEncodeTier();
  const directory = await mkdtemp(join(tmpdir(), 'lolly-production-motion-browser-'));
  t.after(async () => { await closeBrowser(); await closeWebShell(); release(); await rm(directory, { recursive: true, force: true }); });
  const recipe = JSON.parse(await readFile(new URL('../skills/lolly/examples/motion/quiet-explainer.json', import.meta.url), 'utf8'));
  const values = Object.entries(recipe.inputs).map(([id, value]) => [id, typeof value === 'string' ? value : JSON.stringify(value)] as [string, string]);
  const query = new URLSearchParams([...values, ['fps', '24'], ['seconds', '1.25'], ['wait', '0'], ['codec', 'vp9'], ['vq', 'smaller'], ['imprint', 'off']]).toString();
  const contract: ProductionMotionContract = { profile: 'lolly/production-motion-v1', id: 'quiet-explainer', revision: '1', format: 'webm', width: 320, height: 320,
    requirements: [{ id: 'background', kind: 'input', location: 'background', expected: await productionDigest('#f7f7f5') }],
    motion: { seconds: 1.25, secondsTolerance: .05, fps: 24, fpsTolerance: .1, frameCount: 30, timestampTolerance: .01, audio: false },
  };
  const opts = { format: 'webm', width: 320, height: 320, c2pa: { on: false, days: null }, production: contract };
  const result = await render('design', query, opts);
  assert.ok(result.production); await requireProduction(result.production, result.bytes, contract);
  const shorter = new URLSearchParams(query); shorter.set('seconds', '.5');
  await assert.rejects(render('design', shorter.toString(), opts), (error: unknown) => {
    const e = error as { report?: { checks: { id: string; state: string }[] } };
    return e.report?.checks.some(check => check.id === 'motion.frameCount' && check.state === 'fail') ?? false;
  });
  const path = join(directory, 'checks.json'), output = join(directory, 'verified.webm');
  await writeFile(path, JSON.stringify(contract));
  const args = ['shells/cli/bin/lolly.ts', 'design', '--export=webm', '--width=320', '--height=320', '--fps=24', '--wait=0', '--codec=vp9', '--vq=smaller', '--c2pa=off', '--imprint=off', `--production=${path}`, ...values.map(([id, value]) => `--${id}=${value}`)];
  const exec = (extra: string[]) => promisify(execFile)(process.execPath, [...args, ...extra], { env: { ...process.env, LOLLY_RENDERER: 'chromium' }, timeout: 70_000 });
  await exec(['--seconds=1.25', `--output=${output}`]);
  const bytes = new Uint8Array(await readFile(output)), report = JSON.parse(await readFile(`${output}.production.json`, 'utf8'));
  await requireProduction(report, bytes, contract);
  const failed = join(directory, 'failed.webm');
  await assert.rejects(exec(['--seconds=.5', `--output=${failed}`]), (error: unknown) => {
    const e = error as { code?: number; killed?: boolean; message?: string };
    return e.code === 4 && !e.killed && /Production checks did not complete/.test(e.message ?? '');
  });
  await assert.rejects(access(failed));
  assert.ok(JSON.parse(await readFile(`${failed}.production.json`, 'utf8')).checks.some((check: { id: string; state: string }) => check.id === 'motion.frameCount' && check.state === 'fail'));
});
