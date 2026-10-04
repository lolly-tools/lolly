// SPDX-License-Identifier: MPL-2.0
/**
 * lolly_describe_tool's `transform` flag follows the shared rule every surface uses
 * (`isFileTransform`, @lolly-tools/node-shell/transform-tool): a tool is a file
 * transform when its file export is the whole tool. A tool that also exports a still
 * of its canvas (darkroom) renders like any other tool, so lolly_transform is not
 * the way to use such a tool.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFileTransform } from '@lolly-tools/node-shell/transform-tool';
import { dispatch } from '../src/server.ts';
import { loadToolCached } from '../src/catalog.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';

let nextId = 29_700;
async function describe(toolId: string): Promise<{ transform: boolean } | null> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_describe_tool', arguments: { toolId } } })) as JsonRpcResponse;
  const result = res.result as { content: Array<{ text: string }>; isError?: boolean };
  return result.isError ? null : (JSON.parse(result.content[0]!.text) as { transform: boolean });
}

test('describe_tool reports transform by the shared file-transform rule', async () => {
  let seen = 0;
  for (const toolId of ['redact', 'darkroom', 'qr-code']) {
    const tool = await loadToolCached(toolId).catch(() => null);
    if (!tool) continue;
    const described = await describe(toolId);
    assert.ok(described, toolId);
    assert.equal(described.transform, isFileTransform(tool.manifest), toolId);
    seen += 1;
  }
  assert.ok(seen > 0, 'at least one of the tools is in this catalog');
  const darkroom = await loadToolCached('darkroom').catch(() => null);
  if (darkroom) assert.equal((await describe('darkroom'))?.transform, false, 'a tool that exports a still is not a file transform');
  const redact = await loadToolCached('redact').catch(() => null);
  if (redact) assert.equal((await describe('redact'))?.transform, true);
});
