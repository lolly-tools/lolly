// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { productionDigest, type ProductionContract } from '../engine/src/production.ts';

const root = resolve(import.meta.dirname, '..');
const skip = !process.env.LOLLY_WEB_BASE && 'Set LOLLY_WEB_BASE to check real Chart production exports.';
test('Chart CLI and MCP bind actual browser inputs and reject changed data and scale', { skip, timeout: 180_000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-production-chart-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const values = { data: 'Category,Revenue (GBP)\nA,125\nB,250', yTitle: 'Revenue (GBP)', yScaleType: 'linear', yZero: true };
  const contract: ProductionContract = { profile: 'lolly/production-still-v1', id: 'chart-revenue', revision: '1', format: 'svg', width: 1280, height: 800, pages: 1, alpha: 'any',
    requirements: await Promise.all(Object.entries(values).map(async ([id, value]) => ({ id, kind: 'input' as const, location: id, expected: await productionDigest(value) }))),
  };
  const path = join(dir, 'checks.json'), output = join(dir, 'chart.svg');
  await writeFile(path, JSON.stringify(contract));
  const env = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_RENDERER: 'chromium', LOLLY_BROWSER_PATH: chromium.executablePath() };
  const exec = (args: string[]) => promisify(execFile)(process.execPath, args, { cwd: root, env, timeout: 75_000 });
  const args = ['shells/cli/bin/lolly.ts', 'chart', '--export=svg', '--c2pa=off', '--imprint=off', `--production=${path}`, ...Object.entries(values).map(([id, value]) => `--${id}=${value}`)];
  await exec([...args, `--output=${output}`]);
  const report = JSON.parse(await readFile(`${output}.production.json`, 'utf8'));
  assert.ok(report.checks.every((check: { state: string }) => check.state === 'pass'));
  assert.doesNotMatch(JSON.stringify(report), /Revenue \(GBP\)/);
  const failed = join(dir, 'changed.svg');
  await assert.rejects(exec([...args.filter(arg => !arg.startsWith('--data=')), '--data=Category,Revenue (GBP)\nA,12\nB,250', `--output=${failed}`]), /requirement.data:fail/);
  await assert.rejects(access(failed));
  const query = new URLSearchParams(Object.entries(values).map(([id, value]) => [id, String(value)])).toString();
  const script = `import assert from 'node:assert/strict';
import {render,closeWebShell,closeBrowser} from ${JSON.stringify(join(root, 'services/mcp/src/render.ts'))};
const options = {format:'svg',c2pa:{on:false,days:null},imprint:false,production:${JSON.stringify(contract)}};
try {
 const good = await render('chart',${JSON.stringify(query)},options);
 assert.ok(good.production.checks.every(check => check.state === 'pass'));
 await assert.rejects(render('chart',${JSON.stringify(query.replace('yZero=true', 'yZero=false'))},options), /requirement.yZero:fail/);
} finally { await closeBrowser(); await closeWebShell(); }
`;
  const scriptPath = join(dir, 'mcp-chart.mjs'); await writeFile(scriptPath, script);
  await exec([scriptPath]);
});
