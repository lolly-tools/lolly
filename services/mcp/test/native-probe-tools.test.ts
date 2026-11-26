// SPDX-License-Identifier: MPL-2.0
/**
 * The MCP browser image's probe (scripts/native-public-image-probe.ts) asserts the exact
 * tools/list it expects. The probe runs only in the image candidate, so a tool added to
 * TOOL_DEFS without updating that list first failed at release time (1.2.0,
 * lolly_resolve_intent). This keeps the two in step on every pull request.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOL_DEFS } from '../src/tools.ts';

test('the MCP browser image probe expects exactly the tools the server lists, in order', () => {
  const probe = readFileSync(new URL('../scripts/native-public-image-probe.ts', import.meta.url), 'utf8');
  const block = /const expectedMetaTools = \[([\s\S]*?)\]\.map/.exec(probe);
  assert.ok(block, 'the probe keeps its expected tool list');
  const expected = [...block[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => `lolly_${m[1]}`);
  assert.deepEqual(expected, TOOL_DEFS.map((tool) => tool.name));
});
