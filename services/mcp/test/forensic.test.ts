// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { forensicDesignSvg, forensicDesignCases } from '../../../tests/fixtures/forensic-design.ts';
import type { ForensicReport } from '@lolly/engine';
let id = 28_700;
async function inspect(args: Record<string, unknown>) {
  const response = await dispatch({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'lolly_inspect', arguments: args } }) as JsonRpcResponse;
  assert.equal(response.error, undefined);
  return response.result as { content: { text: string }[]; isError?: boolean };
}
test('MCP forensic inspection returns byte-bound located evidence and rejects mixed inspection modes', async () => {
  const file = { name: 'design.svg', mime: 'image/svg+xml', base64: Buffer.from(forensicDesignSvg(forensicDesignCases[0])).toString('base64') };
  const result = await inspect({ file, forensic: true });
  assert.equal(result.isError, undefined);
  const report = JSON.parse(result.content[0]!.text) as ForensicReport;
  assert.equal(report.profile, 'lolly/forensic-ai-v1');
  assert.equal(report.likelihood.state, 'unavailable');
  assert.ok(report.findings.some(f => f.family === 'fingernail-card'));
  assert.ok(report.findings.some(f => f.rule === 'redundant-eyebrow'));
  assert.match(report.artifactSha256, /^[a-f0-9]{64}$/);
  assert.equal((await inspect({ file, forensic: true, motion: true })).isError, true);
  assert.equal((await inspect({ forensic: true })).isError, true);
  assert.equal((await inspect({ file, forensic: true, forensicPageCap: 0 })).isError, true);
});
