// SPDX-License-Identifier: MPL-2.0
/**
 * lolly_redact - the agent-facing half of "redaction instructions" (plans/37-redact-tool.md section 3).
 *
 * A share link, `lolly redact --bars=…`, and this call must all parse one
 * canonical instruction string the same way. These tests check that parse and
 * check the failure messages. This suite is browser-free by design: redact's
 * export rebuilds real pixels and runs in the Tier-B web shell, and node:test
 * must never launch that shell. So no test here calls transform() with bars.
 * The Tier-B path is verified by hand against the built shell (see the plan's
 * section 3 notes).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFS, callTool, redactInputs } from '../src/tools.ts';
import { needsBrowserTier } from '../src/render.ts';
import { loadToolCached } from '../src/catalog.ts';

const def = TOOL_DEFS.find(t => t.name === 'lolly_redact');
const manifest = (await loadToolCached('redact')).manifest;

test('lolly_redact is advertised, takes a file plus an instruction string', () => {
  assert.ok(def, 'lolly_redact missing from TOOL_DEFS');
  const schema = def!.inputSchema as { properties: Record<string, unknown>; required: string[] };
  assert.deepEqual(schema.required, ['file']);
  for (const k of ['file', 'instructions', 'bars', 'quantise', 'grayscale', 'resign']) {
    assert.ok(schema.properties[k], `missing ${k}`);
  }
  // The description must not promise more than the tool does.
  assert.match(def!.description, /destroyed/i);
  assert.doesNotMatch(def!.description, /watermark removal|SynthID/i);
});

test('a tilde instruction string decodes to bars', async () => {
  const inputs = await redactInputs(manifest, { instructions: 'bars=1,40,60,200,24~2,40,100,120,14&grayscale=1' });
  const bars = inputs['bars'] as Array<Record<string, unknown>>;
  assert.equal(bars.length, 2);
  assert.deepEqual([bars[0]!.page, bars[0]!.x, bars[0]!.w].map(Number), [1, 40, 200]);
  assert.equal(inputs['grayscale'], true);
});

test('a whole share link works as the instruction string', async () => {
  const inputs = await redactInputs(manifest, {
    instructions: 'https://lolly.tools/#/tool/redact?bars=1,10,20,30,40&quantise=0',
  });
  assert.equal((inputs['bars'] as unknown[]).length, 1);
  assert.equal(inputs['quantise'], false);
});

test('explicit arguments win over the string, and the file never comes from it', async () => {
  const inputs = await redactInputs(manifest, {
    instructions: 'bars=1,10,20,30,40&source=/etc/passwd&quantise=1',
    bars: [{ page: 1, x: 1, y: 2, w: 3, h: 4 }, { page: 1, x: 5, y: 6, w: 7, h: 8 }],
    quantise: false,
    resign: true,
  });
  assert.equal((inputs['bars'] as unknown[]).length, 2);
  assert.equal(inputs['quantise'], false);
  assert.equal(inputs['resign'], true);
  assert.equal(inputs['source'], undefined);
});

test('no file, and no bars, are refused before any work happens', async () => {
  const firstText = (r: { content: unknown[] }): string => (r.content[0] as { text?: string }).text ?? '';

  const noFile = await callTool('lolly_redact', {});
  assert.ok(noFile.isError);
  assert.match(firstText(noFile), /file\.base64 is required/);

  const noBars = await callTool('lolly_redact', { file: { base64: 'AAAA', name: 'x.png', mime: 'image/png' } });
  assert.ok(noBars.isError);
  assert.match(firstText(noBars), /No redaction bars given/);
});

test('needsBrowserTier tells a missing capability from a failed verification', () => {
  assert.equal(needsBrowserTier('Redacting this file needs a browser canvas. Open this tool in the Lolly web app.'), true);
  assert.equal(needsBrowserTier('PDF redaction is not available in this app.'), true);
  assert.equal(needsBrowserTier('Verification failed: the rebuilt PDF still carries Info. Nothing was downloaded.'), false);
  assert.equal(needsBrowserTier('Choose a file first.'), false);
});
