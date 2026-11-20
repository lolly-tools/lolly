// SPDX-License-Identifier: MPL-2.0
/**
 * scripts/tool-browser-free.ts - the pure half of deciding which tools the browser-free
 * raster route draws: the verdict over measured cases, and the manifest rewrite. The
 * measuring half needs a built web shell and Chromium and is never run here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BROWSER_FREE_SINCE, browserFreeVerdict, loadCases, rewriteBrowserFree, staleEvidence, toolDigest, withEngineFloor, type CaseOutcome } from '../scripts/tool-browser-free.ts';
import { validateManifest } from '../engine/src/validate.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';

const ROOT = join(import.meta.dirname, '..');
const drawn = (name: string, inBands: boolean): CaseOutcome => ({ name, tool: 't', drawn: true, inBands });

test('a tool is flagged only with a drawn case and none outside a band', () => {
  assert.equal(browserFreeVerdict([drawn('a', true), drawn('b', true), { name: 'c', tool: 't', drawn: false, refusal: 'a WebP picture' }]).eligible, true);
  assert.equal(browserFreeVerdict([drawn('a', true), drawn('b', false)]).eligible, false, 'one case outside a band keeps the tool off the route');
  assert.equal(browserFreeVerdict([{ name: 'c', tool: 't', drawn: false, refusal: 'x' }]).eligible, false, 'every case refused is no evidence');
  assert.equal(browserFreeVerdict([drawn('a', true), { name: 'e', tool: 't', drawn: false, error: 'not in this profile' }]).eligible, false, 'a case that could not run is no evidence');
  assert.deepEqual(browserFreeVerdict([drawn('a', true), drawn('b', false)]).outside, ['b']);
});

test('the flag is written first in the render block, and cleared, keeping the formatting', () => {
  const raw = '{\n  "id": "x",\n  "engineVersion": "^1.0.0",\n  "render": {\n    "width": 10,\n    "height": 10\n  }\n}\n';
  const on = rewriteBrowserFree(raw, true);
  assert.equal(on, '{\n  "id": "x",\n  "engineVersion": "^1.0.0",\n  "render": {\n    "browserFree": true,\n    "width": 10,\n    "height": 10\n  }\n}\n');
  assert.equal(rewriteBrowserFree(on, true), on, 'idempotent');
  assert.equal(rewriteBrowserFree(on, false), raw);
  assert.deepEqual(JSON.parse(rewriteBrowserFree('{"render": {"width": 1}}', true)), { render: { browserFree: true, width: 1 } });
  // One-line manifests: an existing key takes the value or goes, whichever side its comma is on.
  assert.deepEqual(JSON.parse(rewriteBrowserFree('{"render":{"browserFree":true,"width":100}}', false)), { render: { width: 100 } });
  assert.deepEqual(JSON.parse(rewriteBrowserFree('{"render":{"width":100,"browserFree":true}}', false)), { render: { width: 100 } });
  assert.deepEqual(JSON.parse(rewriteBrowserFree('{"render":{"browserFree":true}}', false)), { render: {} });
  assert.equal(rewriteBrowserFree('{"render":{"browserFree":false,"width":1}}', true), '{"render":{"browserFree": true,"width":1}}', 'no second key');
  assert.deepEqual(JSON.parse(rewriteBrowserFree('{"render":{}}', true)), { render: { browserFree: true } });
});

test('reused evidence counts only for every current case, its arguments and the same tool files', () => {
  const cases = [{ name: 'a', tool: 't', aim: '', args: ['--x=1'] }, { name: 'b', tool: 't', aim: '', args: [] }];
  const ok: CaseOutcome[] = [{ ...drawn('a', true), args: ['--x=1'], digest: 'd' }, { ...drawn('b', true), args: [], digest: 'd' }];
  assert.equal(staleEvidence(ok, cases, 't', 'd'), null);
  assert.match(staleEvidence(ok.slice(0, 1), cases, 't', 'd')!, /no result for b/);
  assert.match(staleEvidence(ok, [{ ...cases[0]!, args: ['--x=2'] }, cases[1]!], 't', 'd')!, /other arguments/);
  assert.match(staleEvidence(ok, cases, 't', 'changed')!, /files changed/);
});

test('the tool digest leaves out the two fields this script writes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'browser-free-digest-'));
  try {
    writeFileSync(join(dir, 'template.html'), '<svg/>');
    writeFileSync(join(dir, 'tool.json'), '{\n  "engineVersion": "^1.0.0",\n  "render": {\n    "width": 1\n  }\n}\n');
    const before = toolDigest(dir);
    writeFileSync(join(dir, 'tool.json'), withEngineFloor(rewriteBrowserFree(readFileSync(join(dir, 'tool.json'), 'utf8'), true), BROWSER_FREE_SINCE));
    assert.equal(toolDigest(dir), before);
    writeFileSync(join(dir, 'template.html'), '<svg><rect/></svg>');
    assert.notEqual(toolDigest(dir), before, 'a changed drawing is new work to measure');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a flagged tool requires the engine that admits the field', () => {
  assert.equal(BROWSER_FREE_SINCE, ENGINE_VERSION, 'the field arrived in this engine; bump BROWSER_FREE_SINCE only with the field itself');
  assert.match(withEngineFloor('{"engineVersion": "^1.293.0"}', '1.350.0'), /"\^1\.350\.0"/);
  assert.equal(withEngineFloor('{"engineVersion": "^1.400.0"}', '1.350.0'), '{"engineVersion": "^1.400.0"}', 'a higher floor stays');
});

test('the schema admits render.browserFree as a boolean', () => {
  const base = { id: 'xx', name: 'xx', version: '1.0.0', engineVersion: '^1.350.0', status: 'community', inputs: [] };
  assert.equal(validateManifest({ ...base, render: { width: 1, height: 1, formats: ['png'], browserFree: true } }).valid, true);
  assert.equal(validateManifest({ ...base, render: { width: 1, height: 1, formats: ['png'], browserFree: 'yes' } }).valid, false);
});

test('every flagged community tool has measured cases and the floor its flag needs', () => {
  const cases = loadCases();
  const measured = new Set(cases.map((c) => c.tool));
  for (const c of cases) assert.ok(c.name && c.tool && Array.isArray(c.args), `case ${c.name}`);
  const dir = join(ROOT, 'community');
  for (const id of readdirSync(dir)) {
    const file = join(dir, id, 'tool.json');
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as { id: string; engineVersion: string; render?: { browserFree?: boolean } };
    if (manifest.render?.browserFree !== true) continue;
    assert.ok(measured.has(manifest.id), `${manifest.id} carries render.browserFree with no case in scripts/data/browser-free-cases.json`);
    assert.match(manifest.engineVersion, /^\^1\.(\d+)\./);
    assert.ok(Number(/^\^1\.(\d+)\./.exec(manifest.engineVersion)![1]) >= 350, `${manifest.id} needs engine ${BROWSER_FREE_SINCE} for the field`);
  }
});
