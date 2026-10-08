// SPDX-License-Identifier: MPL-2.0
/**
 * deploy/docker/web-pairing.ts reports how the MCP image's tools differ from the web
 * shell the deployed MCP will drive (plan 295 section 1B: the MCP image ships from
 * main while that shell stays on an older release). These tests hold what it counts
 * as a difference and what it refuses to read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  compareToolFiles, envelopeFiles, isSignedToolFile, pairingReport, signedFileHashes, webOrigin,
} from '../deploy/docker/web-pairing.ts';

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

/** A tools/ tree from `<tool id>/<file>` to its text. */
function toolsTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'lolly-web-pairing-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test('only the kinds of file the catalog signature covers are compared', () => {
  for (const path of ['tool.json', 'template.html', 'styles.css', 'hooks.js', 'template.ics', 'i18n/de.json', 'templates/poster.json']) {
    assert.equal(isSignedToolFile(path), true, path);
  }
  for (const path of ['thumb.png', 'README.md', 'assets/logo.svg', 'i18n/notes.txt', 'templates/poster.svg']) {
    assert.equal(isSignedToolFile(path), false, path);
  }
  const root = toolsTree({ 'qr-code/tool.json': '{}', 'qr-code/thumb.png': 'png', 'qr-code/i18n/de.json': '{"de":1}', 'chart/hooks.js': 'x' });
  try {
    assert.deepEqual(signedFileHashes(root), {
      'chart/hooks.js': sha('x'), 'qr-code/i18n/de.json': sha('{"de":1}'), 'qr-code/tool.json': sha('{}'),
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('drift is reported tool by tool: missing from the shell, changed, and only in the shell', () => {
  const mcp = { 'qr-code/tool.json': sha('2'), 'qr-code/hooks.js': sha('h'), 'chart/tool.json': sha('c'), 'rondocode/tool.json': sha('r') };
  const shell = { 'qr-code/tool.json': sha('1'), 'qr-code/hooks.js': sha('h'), 'qr-code/i18n/de.json': sha('d'), 'chart/tool.json': sha('c'), 'retired/tool.json': sha('o') };
  assert.deepEqual(compareToolFiles(mcp, shell), {
    missingFromShell: ['rondocode'],
    changed: [{ id: 'qr-code', files: ['i18n/de.json', 'tool.json'] }],
    onlyInShell: ['retired'],
  });
  assert.deepEqual(compareToolFiles(mcp, { ...mcp }), { missingFromShell: [], changed: [], onlyInShell: [] });
});

test('the shell file list and the web base are refused unless they have the expected shape', () => {
  const hash = sha('x');
  assert.deepEqual(envelopeFiles({ files: { 'qr-code/tool.json': hash } }), { 'qr-code/tool.json': hash });
  for (const files of [JSON.parse(`{"__proto__":"${hash}"}`) as Record<string, string>, { 'qr-code/../x': hash }, { '../tool.json': hash }, { 'Qr/tool.json': hash }, { 'qr-code/tool.json': 'abc' }, { 'qr-code/': hash }]) {
    assert.throws(() => envelopeFiles({ files }), /unexpected entry/, JSON.stringify(files));
  }
  assert.throws(() => envelopeFiles({}), /no files map/);
  assert.throws(() => envelopeFiles(null), /no files map/);
  assert.equal(webOrigin('https://lolly.example'), 'https://lolly.example');
  assert.equal(webOrigin('https://lolly.example:8443/'), 'https://lolly.example:8443');
  for (const value of ['http://lolly.example', 'https://lolly.example/app', 'https://lolly.example/?a=1', 'https://user:pass@lolly.example', 'https://lolly.example/#x']) {
    assert.throws(() => webOrigin(value), /HTTPS origin/, value);
  }
});

test('a report reads the shell signature once and states what it could not read instead of failing', async () => {
  const root = toolsTree({ 'qr-code/tool.json': '{"v":2}', 'chart/tool.json': '{}' });
  const asked: string[] = [];
  const serve = (status: number, body: unknown): typeof fetch => async (input) => {
    asked.push(String(input));
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  try {
    const signature = { signedAt: '2026-10-07T23:31:24.407Z', files: { 'qr-code/tool.json': sha('{"v":1}'), 'chart/tool.json': sha('{}') } };
    const report = await pairingReport(root, 'https://lolly.example', serve(200, signature));
    assert.deepEqual(asked, ['https://lolly.example/catalog/tools/index.sig.json']);
    assert.deepEqual(report, {
      checked: true, webBase: 'https://lolly.example', signedAt: '2026-10-07T23:31:24.407Z', signatureVerified: false,
      mcpTools: 2, paired: false, missingFromShell: [], changed: [{ id: 'qr-code', files: ['tool.json'] }], onlyInShell: [],
    });
    const same = await pairingReport(root, 'https://lolly.example', serve(200, { files: { 'qr-code/tool.json': sha('{"v":2}'), 'chart/tool.json': sha('{}') } }));
    assert.equal(same.checked && same.paired, true);
    const missing = await pairingReport(root, 'https://lolly.example', serve(404, {}));
    assert.deepEqual(missing, { checked: false, webBase: 'https://lolly.example', reason: 'Could not read https://lolly.example/catalog/tools/index.sig.json: HTTP 404' });
    const malformed = await pairingReport(root, 'https://lolly.example', serve(200, { files: { '../x': sha('x') } }));
    assert.equal(malformed.checked, false);
    await assert.rejects(pairingReport(root, 'http://lolly.example', serve(200, signature)), /HTTPS origin/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
