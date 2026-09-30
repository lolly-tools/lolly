// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const exec = promisify(execFile), root = resolve(import.meta.dirname, '..');
const contract = { profile: 'lolly/production-still-v1', id: 'legal-card', revision: '1', format: 'svg', width: 200, height: 100, pages: 1, alpha: 'any', requirements: [{ id: 'copy-input', kind: 'input', location: 'legalCopy', expected: createHash('sha256').update(JSON.stringify('Legal 125')).digest('hex') }, { id: 'legal', kind: 'text', location: 'legal', expected: 'Legal 125' }] };
const repair = { protected: ['legalCopy'], permitted: { layout: ['short', 'long'] }, maxAttempts: 2, when: [{ findingId: 'requirement.legal', input: 'layout' }] };
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-production-transport-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'tools', 'production-card'), { recursive: true }); await mkdir(join(dir, 'catalog', 'tools'), { recursive: true }); await mkdir(join(dir, 'catalog', 'assets'), { recursive: true }); await writeFile(join(dir, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
  const manifest = { id: 'production-card', name: 'Production card', version: '1.0.0', engineVersion: '^1.0.0', status: 'official', render: { width: 200, height: 100, formats: ['svg'] }, inputs: [{ id: 'legalCopy', type: 'text', label: 'Copy', default: 'Legal 125' }, { id: 'layout', type: 'select', label: 'Layout', default: 'short', options: [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Long' }] }] };
  await writeFile(join(dir, 'tools', 'production-card', 'tool.json'), JSON.stringify(manifest));
  await writeFile(join(dir, 'tools', 'production-card', 'template.html'), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">{{#if (eq layout "long")}}<text id="legal" x="10" y="30">{{legalCopy}}</text>{{else}}<rect width="200" height="100"/>{{/if}}</svg>');
  await writeFile(join(dir, 'catalog', 'tools', 'index.json'), JSON.stringify({ version: 1, tools: [manifest] }));
  await writeFile(join(dir, 'contract.json'), JSON.stringify(contract)); await writeFile(join(dir, 'repairs.json'), JSON.stringify(repair));
  return { dir, env: { ...process.env, LOLLY_ROOT: dir, LOLLY_NO_BROWSER: '1' } };
}
test('CLI repairs a real authored layout, preserves protected copy and writes only verified output', async t => {
  const { dir, env } = await fixture(t), output = join(dir, 'card.svg');
  await exec(process.execPath, ['shells/cli/bin/lolly.ts', 'production-card', '--export=svg', '--text=live', '--c2pa=off', `--production=${join(dir, 'contract.json')}`, `--production-repairs=${join(dir, 'repairs.json')}`, `--output=${output}`], { cwd: root, env, timeout: 20_000 });
  assert.match(await readFile(output, 'utf8'), />Legal 125</);
  const history = JSON.parse(await readFile(`${output}.production.json.history.json`, 'utf8')); assert.equal(history.length, 2);
  assert.equal(history[0].checks.at(-1).state, 'fail'); assert.equal(history[1].checks.at(-1).state, 'pass');
  const failed = join(dir, 'bad.svg');
  await assert.rejects(exec(process.execPath, ['shells/cli/bin/lolly.ts', 'production-card', '--export=svg', '--text=live', '--c2pa=off', '--legalCopy=Legal 12', '--layout=long', `--production=${join(dir, 'contract.json')}`, `--output=${failed}`], { cwd: root, env, timeout: 20_000 }));
  await assert.rejects(access(failed));
  assert.equal(JSON.parse(await readFile(`${failed}.production.json`, 'utf8')).checks.at(-1).state, 'fail');
});
test('MCP render core enforces final bytes for direct callers and records bounded repairs', async t => {
  const { dir, env } = await fixture(t);
  const script = `import {render} from ${JSON.stringify(join(root, 'services/mcp/src/render.ts'))};\nconst out = await render('production-card','layout=short',{format:'svg',noBrowser:true,c2pa:{on:false,days:null},production:${JSON.stringify(contract)},productionRepair:${JSON.stringify(repair)}});\nconsole.log(JSON.stringify({text:new TextDecoder().decode(out.bytes),report:out.production,attempts:out.productionAttempts}));`;
  const path = join(dir, 'render.mjs'); await writeFile(path, script);
  const { stdout } = await exec(process.execPath, [path], { cwd: root, env, timeout: 20_000 }); const result = JSON.parse(stdout.trim().split('\n').at(-1)!);
  assert.match(result.text, /Legal 125/); assert.equal(result.attempts.length, 2); assert.ok(result.report.checks.every((c: { state: string }) => c.state === 'pass'));
});
test('MCP refuses production inspection without bytes and render options without a contract', async t => {
  const { dir, env } = await fixture(t);
  const script = `import assert from 'node:assert/strict';
import {callTool} from ${JSON.stringify(join(root, 'services/mcp/src/tools.ts'))};
import {render} from ${JSON.stringify(join(root, 'services/mcp/src/render.ts'))};
const contract = ${JSON.stringify(contract)};
for (const args of [{production:contract,document:{}},{production:contract,productionRepair:{}},{file:{base64:'PHN2Zy8+'},productionReference:''}]) {
  assert.equal((await callTool('lolly_inspect',args)).isError,true);
}
await assert.rejects(render('production-card','',{format:'svg',productionReference:new Uint8Array()}),/requires a production contract/);
`;
  const path = join(dir, 'guards.mjs'); await writeFile(path, script);
  await exec(process.execPath, [path], { cwd: root, env, timeout: 20_000 });
});
