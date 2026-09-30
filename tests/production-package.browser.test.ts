// SPDX-License-Identifier: MPL-2.0
/** Portable tool production checks use the real isolated browser reader. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { buildLollyFile } from '../shells/web/src/lib/lolly-pack.ts';
import { sha256Hex } from '../engine/src/bytes.ts';

const exec = (file: string, args: string[], options: { cwd: string; timeout: number }) => promisify(execFile)(file, args, { ...options, env: { ...process.env, LOLLY_BROWSER_PATH: chromium.executablePath() } });
const root = resolve(import.meta.dirname, '..');
const skip = !process.env.LOLLY_WEB_BASE && 'Set LOLLY_WEB_BASE to a local shell for portable production checks.';
test('portable production checks retain failed evidence, bind package bytes and repair declared inputs', { skip, timeout: 180_000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-production-package-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const inputs = [
    { id: 'legalCopy', label: 'Legal copy', type: 'text', default: 'Legal 125', maxLength: 40 },
    { id: 'layout', label: 'Layout', type: 'select', default: 'short', options: [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Long' }] },
  ];
  const manifest = { id: 'production-package-fixture', name: 'Production package', version: '1.0.0', engineVersion: '^1.199.0', status: 'community', inputs,
    render: { width: 200, height: 100, formats: ['svg'] },
    designTool: { schemaVersion: 1, presentation: 'sidebar', inputs: inputs.map(input => ({ input, targets: [] })), choices: [], variants: [{ id: 'card', label: 'Card', width: 200, height: 100 }], defaultVariant: 'card', formats: ['svg'] },
  };
  const files = Object.fromEntries(Object.entries({ 'tool.json': JSON.stringify(manifest), 'template.html': '<svg class="lolly-locked-design" xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="white"/>{{#if (eq layout "long")}}<text id="legal" x="10" y="30" font-size="18">{{legalCopy}}</text>{{/if}}</svg>' }).map(([path, text]) => [path, new TextEncoder().encode(text)]));
  const pack = await buildLollyFile({ kind: 'tool', session: null, toolId: manifest.id, userAssets: [], tool: { id: manifest.id, version: manifest.version, trust: 'custom', files } });
  const bytes = new Uint8Array(await pack.blob.arrayBuffer()), packagePath = join(dir, 'card.lolly');
  await writeFile(packagePath, bytes);
  const contract = { profile: 'lolly/production-still-v1', id: 'portable-legal', revision: '1', format: 'svg', width: 200, height: 100, pages: 1, alpha: 'any', sourceSha256: await sha256Hex(bytes), requirements: [{ id: 'protected-copy', kind: 'input', location: 'legalCopy', expected: await sha256Hex(new TextEncoder().encode(JSON.stringify('Legal 125'))) }, { id: 'legal', kind: 'text', location: 'legal', expected: 'Legal 125' }] };
  const contractPath = join(dir, 'checks.json'), repairPath = join(dir, 'repairs.json');
  await writeFile(contractPath, JSON.stringify(contract));
  await writeFile(repairPath, JSON.stringify({ protected: ['legalCopy'], permitted: { layout: ['short', 'long'] }, maxAttempts: 2, when: [{ findingId: 'requirement.legal', input: 'layout' }] }));
  const args = ['shells/cli/bin/lolly.ts', 'run', packagePath, '--export=svg', '--text=live', '--c2pa=off', '--imprint=off', `--production=${contractPath}`];
  await assert.rejects(exec(process.execPath, args, { cwd: root, timeout: 15_000 }), /trust-tool/);
  const failed = join(dir, 'failed.svg');
  await assert.rejects(exec(process.execPath, [...args, '--trust-tool', `--output=${failed}`], { cwd: root, timeout: 60_000 }), /Production checks did not complete/);
  await assert.rejects(access(failed));
  assert.equal(JSON.parse(await readFile(`${failed}.production.json`, 'utf8')).checks.at(-1).state, 'fail');
  const output = join(dir, 'verified.svg');
  await exec(process.execPath, [...args, '--trust-tool', `--production-repairs=${repairPath}`, `--output=${output}`], { cwd: root, timeout: 90_000 });
  const report = JSON.parse(await readFile(`${output}.production.json`, 'utf8'));
  assert.equal(report.sourceSha256, contract.sourceSha256);
  assert.equal(report.artifactSha256, await sha256Hex(new Uint8Array(await readFile(output))));
  assert.ok(report.checks.every((check: { state: string }) => check.state === 'pass'));
  assert.equal(JSON.parse(await readFile(`${output}.production.json.history.json`, 'utf8')).length, 2);
});
