// SPDX-License-Identifier: MPL-2.0
/**
 * scripts/tool-browser-free.ts and the `browser-free.json` record it writes beside a tool
 * (packages/node-shell/src/browser-free-record.ts): the verdict over measured cases, the
 * record's shape, and the rule that a record no longer describing its tool admits nothing.
 * The measuring half needs a built web shell and Chromium and is never run here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { browserFreeVerdict, loadCases, recordFor, staleEvidence, type CaseOutcome } from '../scripts/tool-browser-free.ts';
import { BROWSER_FREE_FILE, browserFreeStatus, digestToolSources, parseBrowserFreeRecord, toolSourceDigest } from '../packages/node-shell/src/browser-free-record.ts';

const ROOT = join(import.meta.dirname, '..');
const schema = JSON.parse(readFileSync(join(ROOT, 'schemas', 'browser-free-v1.schema.json'), 'utf8'));
const validate = new (Ajv as unknown as new (o: object) => { compile(s: object): ((d: unknown) => boolean) & { errors?: unknown } })({ allErrors: true, strict: false }).compile(schema);
const drawn = (name: string, inBands: boolean): CaseOutcome => ({ name, tool: 't', drawn: true, inBands, args: [] });
const run = {
  date: '2026-11-20', profile: 'lolly-demo', webShell: 'abc', renderers: { resvg: '2.6.2', engine: '1.348.0', chromium: '150' },
  bands: { threshold: 24, fillThreshold: 72, regionShare: 0.005, inkShare: 0.25, inkShift: 1.5, gradientLevels: 2 },
};

test('a tool is admitted only with a drawn case and none outside a band', () => {
  assert.equal(browserFreeVerdict([drawn('a', true), drawn('b', true), { name: 'c', tool: 't', drawn: false, refusal: 'a WebP picture' }]).eligible, true);
  assert.equal(browserFreeVerdict([drawn('a', true), drawn('b', false)]).eligible, false, 'one case outside a band keeps the tool off the route');
  assert.equal(browserFreeVerdict([{ name: 'c', tool: 't', drawn: false, refusal: 'x' }]).eligible, false, 'every case refused is no evidence');
  assert.equal(browserFreeVerdict([drawn('a', true), { name: 'e', tool: 't', drawn: false, error: 'not in this profile' }]).eligible, false, 'a case that could not run is no evidence');
  assert.deepEqual(browserFreeVerdict([drawn('a', true), drawn('b', false)]).outside, ['b']);
});

test('the record the script writes matches the schema and carries the verdict', () => {
  const tool = { id: 'qr-code', version: '2.8.0', digest: 'a'.repeat(64) };
  const yes = recordFor(tool, [drawn('a', true), { name: 'w', tool: 't', drawn: false, refusal: 'a WebP picture', args: ['--src=x'] }], run);
  assert.equal(yes.verdict, 'resvg');
  assert.deepEqual(yes.cases.map((c) => c.result), ['inside', 'refused']);
  assert.ok(validate(yes), JSON.stringify(validate.errors));
  const no = recordFor(tool, [drawn('a', true), { ...drawn('b', false), faults: ['rect#1 0.71% over 24'] }], run);
  assert.equal(no.verdict, 'browser');
  assert.equal(no.cases[1]!.detail, 'rect#1 0.71% over 24');
  assert.ok(validate(no));
  assert.ok('record' in parseBrowserFreeRecord(JSON.stringify(yes)));
  assert.ok('problem' in parseBrowserFreeRecord('{"version": 2}'));
});

test('a record admits only the version and files it was measured on', () => {
  const tool = { id: 'qr-code', version: '2.8.0', digest: 'a'.repeat(64) };
  const record = recordFor(tool, [drawn('a', true)], run);
  assert.deepEqual(browserFreeStatus(record, tool), { admitted: true });
  assert.match(browserFreeStatus(record, { ...tool, version: '2.9.0' }).stale!, /measured on version 2\.8\.0, and the tool is now 2\.9\.0/);
  assert.match(browserFreeStatus(record, { ...tool, digest: 'b'.repeat(64) }).stale!, /files changed/);
  assert.match(browserFreeStatus(record, { ...tool, id: 'gradient' }).stale!, /names the qr-code tool/);
  assert.deepEqual(browserFreeStatus(recordFor(tool, [drawn('a', false)], run), tool), { admitted: false }, 'a browser verdict admits nothing and is not stale');
});

test('the digest covers the manifest, template, stylesheet and hooks', () => {
  const files: Record<string, string | null> = { 'tool.json': '{}', 'template.html': '<svg/>', 'styles.css': null, 'hooks.js': null };
  const base = digestToolSources((n) => files[n] ?? null);
  for (const name of Object.keys(files)) {
    const changed = { ...files, [name]: `${files[name] ?? ''} ` };
    assert.notEqual(digestToolSources((n) => changed[n] ?? null), base, `${name} is part of the digest`);
  }
  assert.notEqual(digestToolSources((n) => (n === 'styles.css' ? '' : files[n] ?? null)), base, 'an empty file is not an absent one');
});

test('reused evidence counts only for every current case, its arguments and the same tool files', () => {
  const cases = [{ name: 'a', tool: 't', aim: '', args: ['--x=1'] }, { name: 'b', tool: 't', aim: '', args: [] }];
  const ok: CaseOutcome[] = [{ ...drawn('a', true), args: ['--x=1'], digest: 'd' }, { ...drawn('b', true), args: [], digest: 'd' }];
  assert.equal(staleEvidence(ok, cases, 't', 'd'), null);
  assert.match(staleEvidence(ok.slice(0, 1), cases, 't', 'd')!, /no result for b/);
  assert.match(staleEvidence(ok, [{ ...cases[0]!, args: ['--x=2'] }, cases[1]!], 't', 'd')!, /other arguments/);
  assert.match(staleEvidence(ok, cases, 't', 'changed')!, /files changed/);
});

test('every community record matches the schema, names its own tool and its measured cases', () => {
  const measured = new Set(loadCases().map((c) => c.name));
  const dir = join(ROOT, 'community');
  for (const id of readdirSync(dir)) {
    const file = join(dir, id, BROWSER_FREE_FILE);
    if (!existsSync(file)) continue;
    const record = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(validate(record), `${id}: ${JSON.stringify(validate.errors)}`);
    assert.equal(record.tool.id, id);
    for (const c of record.cases) assert.ok(measured.has(c.name), `${id}: ${c.name} is not in scripts/data/browser-free-cases.json`);
    // The record describes the tool as it is: a stale one is a warning in validate:catalog,
    // and an error here only for the tools this repository ships with a resvg verdict.
    if (record.verdict === 'resvg' && existsSync(join(dir, id, 'tool.json'))) {
      const version = JSON.parse(readFileSync(join(dir, id, 'tool.json'), 'utf8')).version;
      assert.deepEqual(browserFreeStatus(record, { id, version, digest: toolSourceDigest(id) }), { admitted: true }, `${id}: run scripts/tool-browser-free.ts --verify --write --tools=${id} again`);
    }
  }
});
