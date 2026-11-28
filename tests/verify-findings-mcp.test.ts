// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_verify` returns Verify's six findings, over the real MCP handler.
 *
 * What it pins, for a file another tool signed, a file with nothing in it and a file
 * whose metadata states a licence and a place:
 *   - the readable block prints the six labels in the engine's fixed order after the
 *     verdict, the same lines `lolly validate` prints
 *   - the machine payload gains a `findings` array and keeps every earlier field
 *   - the tool's description says the findings are there
 *
 * Run with: node --test tests/verify-findings-mcp.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINDING_LABELS_IN_ORDER, labelPositions, licensedLocatedJpeg, plainJpeg, signedPng } from './helpers/verify-findings-fixtures.ts';

interface Finding { id: string; label: string; state: string; tone: string; strength: string; strengthLabel: string; word: string; detail: string; names: string[]; evidence: unknown[] }
interface Payload { verdict: string; resolved: unknown; report: unknown; metadata: unknown; findings: Finding[] }

async function verify(bytes: Uint8Array, name: string): Promise<{ text: string; payload: Payload }> {
  const { callTool } = await import('../services/mcp/src/tools.ts');
  const result = await callTool('lolly_verify', { file: { base64: Buffer.from(bytes).toString('base64'), name } });
  const texts = ((result.content ?? []) as Array<{ type: string; text?: string }>).filter((b) => b.type === 'text').map((b) => b.text ?? '');
  assert.equal(texts.length, 2, 'still the readable verdict and the machine payload, nothing more');
  return { text: texts[0]!, payload: JSON.parse(texts[1]!) as Payload };
}

const isFinding = (line: string): boolean => FINDING_LABELS_IN_ORDER.some((label) => line.startsWith(`  ${label}: `));

test('a file another tool signed: the six findings follow the verdict', async () => {
  const { text, payload } = await verify(signedPng(), 'signed.png');
  labelPositions(text);
  const lines = text.split('\n');
  assert.equal(lines[0], 'signed.png  [png]');
  assert.match(lines[1]!, /^Credential intact/);
  assert.deepEqual(lines.slice(2, 8), [
    '  Credential: Unchanged, signer not recognised (Signed)',
    '  Made with: c2patool 0.26.68 (Signed)',
    '  AI: Nothing declared',
    '  Licence: None recorded',
    '  Personal data: None found',
    '  Hidden content: None found',
  ]);
  // Every line this tool returned before is still there, in the same order.
  const rest = lines.filter((line) => !isFinding(line));
  assert.equal(rest[2], '  (fields below are self-asserted by whoever signed the file)');
  assert.equal(rest[3], '  Title       c2patool cross-validation fixture');
  assert.ok(rest.includes('  ✓ assertion.dataHash.match - data hash valid'));
  assert.equal(payload.verdict, 'credential-intact');
  for (const key of ['verdict', 'resolved', 'report', 'metadata']) assert.ok(key in payload, `${key} is still in the payload`);
  assert.deepEqual(payload.findings.map((f) => f.id), ['credential', 'made-with', 'ai', 'licence', 'personal', 'hidden']);
  assert.deepEqual(payload.findings.map((f) => f.strength), ['signed', 'signed', 'none', 'none', 'none', 'none']);
});

test('a file with nothing in it: all six slots are still returned', async () => {
  const { text, payload } = await verify(plainJpeg(), 'plain.jpg');
  assert.deepEqual(text.split('\n'), [
    'plain.jpg  [jpeg]',
    'No Content Credentials found',
    '  no Content Credentials found',
    '  Credential: Not signed',
    '  Made with: Not identified',
    '  AI: Nothing declared',
    '  Licence: None recorded',
    '  Personal data: None found',
    '  Hidden content: None found',
  ]);
  assert.equal(payload.verdict, 'no-credential');
  assert.deepEqual(payload.findings.map((f) => f.state), ['none', 'unknown', 'nothing-declared', 'none', 'none', 'none']);
});

test('a licence and a place in the metadata are stated, never signed', async () => {
  const { text, payload } = await verify(licensedLocatedJpeg(), 'licensed.jpg');
  assert.deepEqual(text.split('\n').filter(isFinding), [
    '  Credential: Not signed',
    '  Made with: TestCam (Stated in the file)',
    '  AI: Nothing declared',
    '  Licence: CC BY 4.0 (Stated in the file)',
    '  Personal data: Location recorded (Stated in the file)',
    '  Hidden content: None found',
  ]);
  const [, , , licence, personal] = payload.findings;
  assert.equal(licence!.detail, 'Declared terms: CC BY 4.0. Permission to reuse is not verified.');
  assert.equal(licence!.strengthLabel, 'Stated in the file');
  assert.equal(personal!.state, 'location');
  assert.equal(personal!.tone, 'warn');
  assert.doesNotMatch(JSON.stringify(payload.findings), /%|royalty-free|cleared|legally safe|copyright verified/i);
});

test('the tool description says the findings are there', async () => {
  const { TOOL_DEFS } = await import('../services/mcp/src/tools.ts');
  const tool = TOOL_DEFS.find((t) => t.name === 'lolly_verify');
  assert.ok(tool);
  assert.match(tool.description, /`findings`: six answers in a fixed order \(credential, made-with, ai, licence, personal, hidden\)/);
});
