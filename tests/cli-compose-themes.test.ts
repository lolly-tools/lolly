// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI keeps a pasted tool link's own `_themes` in the canonical id it mints
 * (plans/319 A6), the same id the web bridge's composeEmbedId writes, so a web session
 * the CLI re-renders keeps the child's choice in the links and recreate URLs it
 * writes. The CLI does not yet draw the child in those choices; this pins the id only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseEmbedUrl, parseUrlState } from '../engine/src/index.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';
import { composeEmbedId } from '../shells/web/src/bridge/compose.ts';

const PERSIMMON_DARK = { '': 'dark', colourway: 'persimmon' };
const QR = { id: 'qr-code', inputs: [{ id: 'url', type: 'url' }] } as never;

async function cliHost() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  return createCliBridge({ dom: dom.window as never, profile: {} } as never);
}

test('a link\'s own `_themes` stays in the id the CLI writes back, matching the web id', { timeout: 60_000 }, async () => {
  const host = await cliHost();
  const query = `url=${encodeURIComponent('https://example.com')}&_themes=${encodeURIComponent(JSON.stringify(PERSIMMON_DARK))}`;
  const ref = await host.compose!.renderUrl!(`https://lolly.tools/tool/qr-code.svg?${query}`, { width: 200, height: 200 });
  assert.ok(ref, 'the child renders');
  const parsed = parseEmbedUrl(ref!.id);
  assert.ok(parsed, 'the id parses back as an embed');
  assert.deepEqual(parseUrlState(parsed!.query, QR).tokenSelection, PERSIMMON_DARK);
  assert.equal(ref!.id, composeEmbedId({ toolId: 'qr-code', format: 'svg', query, tokenSelection: PERSIMMON_DARK, width: 200, height: 200 }), 'the same id as the web shell');
});

test('a link without choices keeps the id it always had', { timeout: 60_000 }, async () => {
  const host = await cliHost();
  const ref = await host.compose!.renderUrl!(`https://lolly.tools/tool/qr-code.svg?url=${encodeURIComponent('https://example.com')}`, { width: 200, height: 200 });
  assert.equal(ref?.id, 'https://lolly.tools/tool/qr-code.svg?url=https%3A%2F%2Fexample.com&w=200&h=200');
});
