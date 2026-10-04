// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_check` (plan 291 W1) driven through dispatch() as a transport would: a
 * Design document given as a file, as toolId "design" with its inputs, or as a
 * compiled document gets the same `CheckReportV1` `lolly check` prints, every
 * structured result validates against the tool's own outputSchema and the report
 * against schemas/check-report-v1.schema.json, and the exit code is the CLI's.
 *
 * The render family's page hook is replaced by a stub through `callCheck`'s seam,
 * or turned off with `browser: "off"` over dispatch, so these tests need no web
 * shell. The hosted caps run through `callCheck` with the limits lowered.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import { checkFile } from '@lolly-tools/node-shell/check';
import { readProfileBriefCatalog, readProfileTokenDocument } from '@lolly-tools/node-shell/design-brief';
import { CHECK_OUTCOME_EXIT_CODES, type CheckReportV1 } from '@lolly-tools/core';
import { dispatch } from '../src/server.ts';
import { serverInstructions } from '../src/tools.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { CHECK_LIMITS, CHECK_OUTPUT_SCHEMA, CHECK_TOOL_CODES, callCheck, type CheckDesignResolver } from '../src/check.ts';
import { callRead } from '../src/read.ts';

const ROOT = new URL('../../../', import.meta.url);
const TRAP_BYTES = new Uint8Array(readFileSync(new URL('tests/fixtures/check/trap.boxes.json', ROOT)));
const TRAP = JSON.parse(new TextDecoder().decode(TRAP_BYTES)) as Array<Record<string, unknown>>;
const NOTES = new Uint8Array(readFileSync(new URL('tests/fixtures/rebrand/notes.pptx', ROOT)));
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
const trapFile = { base64: b64(TRAP_BYTES), name: 'trap.boxes.json' };

const ajv = new Ajv({ allErrors: true, strict: false });
const validateOutput = ajv.compile(CHECK_OUTPUT_SCHEMA);
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
const reportSchema = JSON.parse(readFileSync(new URL('schemas/check-report-v1.schema.json', ROOT), 'utf8'));
const validateReport = new (Ajv2020 as unknown as new (o: unknown) => { compile: (s: unknown) => Validator })({ allErrors: true, strict: false }).compile(reportSchema);

interface Result { content: Array<{ type: string; text?: string }>; structuredContent: Record<string, unknown>; isError?: boolean }

function assertValid(result: Result): void {
  assert.ok(validateOutput(result.structuredContent), `structuredContent does not match the outputSchema: ${ajv.errorsText(validateOutput.errors)}`);
  if (result.isError) return;
  assert.deepEqual(JSON.parse(result.content[1]?.text ?? ''), result.structuredContent);
  const report = result.structuredContent as unknown as CheckReportV1;
  assert.ok(validateReport(report), JSON.stringify(validateReport.errors, null, 2));
  assert.ok(CHECK_OUTCOME_EXIT_CODES[report.outcome].includes(report.exitCode), `${report.outcome} with exit ${report.exitCode}`);
}

let nextId = 29_400;
async function check(args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_check', arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `lolly_check errored at the protocol level: ${JSON.stringify(res?.error)}`);
  const result = res.result as Result;
  assertValid(result);
  return result;
}

const reportOf = (result: Result): CheckReportV1 => {
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  return result.structuredContent as unknown as CheckReportV1;
};

function refusedWith(result: Result, code: string): void {
  assertValid(result);
  assert.equal(result.isError, true, `expected ${code}, got ${result.content[0]?.text}`);
  assert.equal((result.structuredContent.error as { code: string }).code, code, result.content[0]?.text ?? '');
}

/** A resolver that must not be reached: the input is a file or a document. */
const unreachable: CheckDesignResolver = async () => { throw new Error('the Design resolver was called'); };

/** The page answer the web shell gives for the trap's overflowing headline. */
const overflowAnswer = async () => ({
  kind: 'answered' as const,
  value: {
    format: 'lolly-design-check-page',
    version: 1,
    toolId: 'design',
    layers: TRAP.length,
    painted: TRAP.length,
    structure: [],
    settled: true,
    mounted: {
      findings: [{
        id: 'design.text.overflow', severity: 'warn', path: `/boxes/${TRAP.findIndex((r) => r.id === 'overflow')}/text`,
        evidence: { name: 'An unexpectedly long headline' }, message: 'English fallback', layerId: 'overflow',
      }],
      checked: { overflow: 11, contrast: 11, fonts: 11 },
      manualContrastReview: 0,
    },
  },
});

test('a Design file gets the report lolly check prints, against this server\'s content profile', async () => {
  const report = reportOf(await check({ file: trapFile, browser: 'off' }));
  assert.equal(report.input.kind, 'design');
  assert.equal(report.input.artboards, 1);
  assert.equal(report.families.structure.state, 'ran');
  assert.equal(report.families.verify.state, 'ran');
  assert.equal(report.families.render.state, 'skipped');
  assert.equal(report.families.fidelity.state, 'skipped');
  assert.ok(report.findings.some((f) => f.code === 'verify.fingernail-card' && f.layerId), 'Verify reads the card from the layers');

  // The same work as the CLI: checkFile with the profile's design system and catalog.
  const tokens = readProfileTokenDocument();
  const direct = await checkFile(TRAP_BYTES, 'trap.boxes.json', {
    browser: 'off',
    ocr: false,
    // The one difference: the reasons name lolly_check's arguments rather than CLI flags.
    surface: 'mcp',
    designSystem: tokens ? { doc: tokens.doc, origin: 'profile', profile: tokens.profile, tokensAsset: tokens.tokensAsset } : null,
    catalog: readProfileBriefCatalog(),
  });
  assert.deepEqual(report, direct);
  if (tokens) {
    assert.equal(report.families.brand.state, 'ran');
    assert.deepEqual(report.designSystem, { origin: 'profile', profile: tokens.profile, tokensAsset: tokens.tokensAsset });
  } else assert.equal(report.families.brand.state, 'unavailable');
});

test('toolId "design" with inputs and a compiled document read as the same document', async () => {
  const byFile = reportOf(await check({ file: trapFile, browser: 'off' }));
  const byInputs = reportOf(await check({ toolId: 'design', inputs: { boxes: TRAP }, browser: 'off' }));
  assert.equal(byInputs.input.kind, 'design');
  const codes = (r: CheckReportV1) => r.findings.map((f) => `${f.code}@${f.layerId ?? ''}`).sort();
  assert.deepEqual(codes(byInputs), codes(byFile));
  const byDocument = reportOf(await check({ document: { toolId: 'design', values: { boxes: TRAP } }, browser: 'off' }));
  assert.deepEqual(codes(byDocument), codes(byFile));

  // Layer patches apply as lolly_validate applies them: hide the card and its clue goes.
  const patched = reportOf(await check({ toolId: 'design', inputs: { boxes: TRAP }, layerPatches: [{ id: 'card-1', set: { hidden: true } }, { id: 'card-1-strip', set: { hidden: true } }], browser: 'off' }));
  assert.ok(!patched.findings.some((f) => f.code === 'verify.fingernail-card'), 'the hidden card is not read');
});

test('strict refuses on any warning, and the exit code is the CLI\'s', async () => {
  const relaxed = reportOf(await check({ file: trapFile, browser: 'off' }));
  assert.equal(relaxed.strict, false);
  assert.equal(relaxed.exitCode, relaxed.summary.error ? 4 : relaxed.summary.warn ? 5 : 0);
  const strict = reportOf(await check({ file: trapFile, browser: 'off', strict: true }));
  assert.equal(strict.strict, true);
  assert.equal(strict.outcome, 'refused');
  assert.equal(strict.exitCode, 4);
});

test('the render family runs through the page hook, and is unavailable where this server cannot paint', async () => {
  const painted = reportOf((await callCheck({ file: trapFile }, unreachable, {}, CHECK_LIMITS, { renderChecks: overflowAnswer })) as Result);
  assert.equal(painted.families.render.state, 'ran');
  const overflow = painted.findings.find((f) => f.code === 'design.text.overflow');
  assert.ok(overflow, 'the mounted overflow is a finding');
  assert.equal(overflow.family, 'render');
  assert.equal(overflow.layerId, 'overflow');

  const older = reportOf((await callCheck({ file: trapFile }, unreachable, {}, CHECK_LIMITS, {
    renderChecks: async () => ({ kind: 'no-hook', reason: 'This web shell predates the hook.' }),
  })) as Result);
  assert.equal(older.families.render.state, 'unavailable');
  // The tier's own reason leads; the text-measure checker (plan 291 W5) adds what it predicted after that reason.
  assert.match(older.families.render.reason ?? '', /^This web shell predates the hook\. Clipping was predicted from font metrics/);
  assert.equal(older.families.structure.state, 'ran', 'the other families still run');

  // A serverless function cannot paint the editor: unavailable in words, and require exits 3.
  const vercel = { VERCEL: '1' };
  const serverless = reportOf((await callCheck({ file: trapFile }, unreachable, vercel)) as Result);
  assert.equal(serverless.families.render.state, 'unavailable');
  assert.match(serverless.families.render.reason ?? '', /serverless function/);
  const required = (await callCheck({ file: trapFile, browser: 'require' }, unreachable, vercel)) as Result;
  assertValid(required);
  assert.equal(required.isError, undefined, 'a missing tier is a report, not a tool error');
  assert.equal(reportOf(required).exitCode, 3);
  assert.equal(reportOf(required).outcome, 'failed');
});

test('an export runs Verify alone, and its kind comes from the name, the type or the bytes', async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#ffffff"/>
    <rect x="100" y="100" width="400" height="300" rx="24" fill="#f2f3f5"/>
    <rect x="100" y="100" width="400" height="8" fill="#2563eb"/>
    <text x="140" y="200" font-size="36">A card with an edge</text>
  </svg>`;
  const bytes = new TextEncoder().encode(svg);
  for (const file of [{ base64: b64(bytes), name: 'card.svg' }, { base64: b64(bytes), name: 'card', mime: 'image/svg+xml' }, { base64: b64(bytes) }]) {
    const report = reportOf(await check({ file }));
    assert.equal(report.input.kind, 'image', JSON.stringify(file.name ?? null));
    for (const family of ['structure', 'render', 'brand'] as const) assert.equal(report.families[family].state, 'skipped', family);
    assert.equal(report.families.verify.state, 'ran');
    assert.match(report.families.verify.reason ?? '', /OCR and the text classifier off/);
    assert.ok(report.findings.some((f) => f.code === 'verify.fingernail-card'));
  }
});

test('fidelity compares with a lolly_read inventory or the source deck itself', async () => {
  const read = (await callRead({ file: { base64: b64(NOTES), name: 'notes.pptx' } })) as Result;
  const inventory = read.structuredContent.inventory;
  const withInventory = reportOf(await check({ file: { base64: b64(NOTES), name: 'notes.pptx' }, inventory }));
  assert.equal(withInventory.families.fidelity.state, 'ran');
  assert.deepEqual(withInventory.fidelity?.missingStrings, []);
  assert.equal(withInventory.fidelity?.notes.missing, 0);
  const withDeck = reportOf(await check({ file: { base64: b64(NOTES), name: 'notes.pptx' }, source: { base64: b64(NOTES), name: 'notes.pptx' } }));
  assert.deepEqual(withDeck.fidelity, withInventory.fidelity);

  const trap = reportOf(await check({ file: trapFile, browser: 'off', inventory }));
  assert.equal(trap.families.fidelity.state, 'ran');
  assert.ok((trap.fidelity?.missingStrings.length ?? 0) > 0, 'the trap carries none of the deck');

  refusedWith(await check({ file: trapFile, inventory: { version: 'lolly/content-inventory-v1' } }), 'source.unreadable');
  refusedWith(await check({ file: trapFile, inventory, source: { base64: b64(NOTES), name: 'notes.pptx' } }), 'request.invalid');
});

test('requests it cannot read are refused with a stable code, and the call never throws', async () => {
  refusedWith(await check({}), 'input.missing');
  refusedWith(await check({ file: trapFile, toolId: 'design' }), 'request.invalid');
  refusedWith(await check({ file: trapFile, layerPatches: [] }), 'request.invalid');
  refusedWith(await check({ toolId: 'qr-code', inputs: {} }), 'input.unsupported');
  refusedWith(await check({ document: { toolId: 'qr-code', values: {} } }), 'input.unsupported');
  refusedWith(await check({ document: 'not an object' }), 'request.invalid');
  refusedWith(await check({ toolId: 'design', templateId: 7 }), 'request.invalid');
  refusedWith(await check({ file: { base64: b64(new Uint8Array(4)), name: 'notes.docx' } }), 'input.unsupported');
  refusedWith(await check({ file: { base64: b64(new TextEncoder().encode('{')), name: 'x.json' } }), 'input.unreadable');
  refusedWith(await check({ file: trapFile, pageCap: 0 }), 'request.invalid');
  refusedWith(await check({ file: trapFile, browser: 'sometimes' }), 'request.invalid');
  refusedWith(await check({ file: trapFile, strict: 'yes' }), 'request.invalid');
  refusedWith((await callCheck({ file: trapFile, fix: true }, unreachable)) as Result, 'request.invalid');
  for (const code of ['input.missing', 'input.unsupported', 'input.unreadable', 'input.too-large', 'source.unreadable', 'source.too-large', 'request.invalid', 'output.too-large', 'internal'])
    assert.ok(CHECK_TOOL_CODES.includes(code as never), code);
});

test('hosted caps: the file and source together, the file alone and the response', async () => {
  const hosted = { VERCEL: '1', LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' };
  const deck = { base64: b64(NOTES), name: 'notes.pptx' };
  const room = b64(NOTES).length + 16 * 1024 + 100;
  // Each file fits alone, but not both in one request: steer to the inventory.
  const both = (await callCheck({ file: deck, source: deck }, unreachable, hosted, { ...CHECK_LIMITS, bodyMaxBytes: room })) as Result;
  refusedWith(both, 'source.too-large');
  assert.match(both.content[0]?.text ?? '', /inventory/);
  refusedWith((await callCheck({ file: deck }, unreachable, hosted, { ...CHECK_LIMITS, bodyMaxBytes: 20_000 })) as Result, 'input.too-large');
  refusedWith((await callCheck({ file: deck }, unreachable, hosted, { ...CHECK_LIMITS, hostedMaxSlides: 1 })) as Result, 'input.too-large');
  refusedWith((await callCheck({ file: trapFile }, unreachable, hosted, { ...CHECK_LIMITS, responseMaxBytes: 1_000 })) as Result, 'output.too-large');
});

test('the server instructions point an agent at lolly_read, lolly_check and the design brief', async () => {
  const text = await serverInstructions();
  assert.match(text, /lolly_read/);
  assert.match(text, /lolly_check/);
  assert.match(text, /lolly:\/\/design-context first/);
});

test('the server instructions keep the tool list one sentence and the authoring note after it', async () => {
  const text = await serverInstructions();
  assert.doesNotMatch(text, /, [A-Z]/, 'no sentence starts after a comma');
  assert.match(text, /lolly_check to check a Design document[\s\S]*, lolly_redact to destroy[\s\S]*, and lolly_verify to check a file's Content Credentials \(C2PA\)\. For Design, rows may carry authoring keys/);
});

const EDITABLE_PDF = new Uint8Array(readFileSync(new URL('tests/fixtures/rebrand-pdf/editable.pdf', ROOT)));

test('inventory takes what lolly_read returned, whole or its inventory field', async () => {
  const read = (await callRead({ file: { base64: b64(NOTES), name: 'notes.pptx' } })) as Result;
  const file = { base64: b64(NOTES), name: 'notes.pptx' };
  const field = reportOf(await check({ file, inventory: read.structuredContent.inventory }));
  const whole = reportOf(await check({ file, inventory: read.structuredContent }));
  assert.equal(whole.families.fidelity.state, 'ran');
  assert.deepEqual(whole.fidelity, field.fidelity);
  // A `lolly read --json` envelope saved to a file reads the same way as a source.
  const envelope = { schemaVersion: 1, command: 'read', ok: true, error: null, warnings: [], result: read.structuredContent.inventory };
  const saved = reportOf(await check({ file, source: { base64: b64(new TextEncoder().encode(JSON.stringify(envelope))), name: 'old.inventory.json' } }));
  assert.deepEqual(saved.fidelity, field.fidelity);
});

test('hosted caps count a PDF\'s pages, for the file, the source and an inventory', async () => {
  const hosted = { VERCEL: '1', LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' };
  const limits = { ...CHECK_LIMITS, hostedMaxSlides: 2 };
  const pdf = { base64: b64(EDITABLE_PDF), name: 'editable.pdf' };
  const file = (await callCheck({ file: pdf }, unreachable, hosted, limits)) as Result;
  refusedWith(file, 'input.too-large');
  assert.match(file.content[0]?.text ?? '', /3 slides or pages/);
  refusedWith((await callCheck({ file: trapFile, source: pdf }, unreachable, hosted, limits)) as Result, 'source.too-large');
  const inventory = (await callRead({ file: pdf })).structuredContent.inventory;
  refusedWith((await callCheck({ file: trapFile, inventory }, unreachable, hosted, limits)) as Result, 'source.too-large');
  // The same calls run on a local server, and an export is never failed by `require`.
  const local = reportOf((await callCheck({ file: pdf, browser: 'require' }, unreachable, {}, limits)) as Result);
  assert.notEqual(local.exitCode, 3);
  assert.equal(local.input.pages, 3);
});

test('family reasons name lolly_check arguments, never a CLI flag', async () => {
  const report = reportOf(await check({ file: trapFile, browser: 'off' }));
  assert.match(report.families.fidelity.reason ?? '', /source.*inventory/);
  for (const state of Object.values(report.families)) assert.doesNotMatch(state.reason ?? '', /--(source|file|ocr)\b|terminal system/);
});

test('the tool descriptions say a hosted server takes smaller files than a local one', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list', params: {} })) as JsonRpcResponse;
  const tools = (res.result as { tools: Array<{ name: string; description: string }> }).tools;
  for (const name of ['lolly_read', 'lolly_check']) {
    const description = tools.find((t) => t.name === name)?.description ?? '';
    assert.match(description, /on a local server and less on a hosted one/, name);
    assert.match(description, /100 slides or (PDF )?pages/, name);
  }
});

test('edits records deliberate wording changes: excepted in the report, never passed, and a bad list refuses', async () => {
  const read = (await callRead({ file: { base64: b64(NOTES), name: 'notes.pptx' } })) as Result;
  const inventory = read.structuredContent.inventory;
  const plain = reportOf(await check({ file: trapFile, browser: 'off', inventory }));
  const dropped = plain.fidelity!.missingStrings[0]!;
  assert.ok(dropped);
  const withEdits = reportOf(await check({ file: trapFile, browser: 'off', inventory, edits: [{ source: dropped, reason: 'Cut on purpose' }] }));
  assert.ok(!withEdits.fidelity!.missingStrings.includes(dropped));
  assert.deepEqual(withEdits.fidelity!.excepted?.map((e) => [e.source, e.reason]), [[dropped, 'Cut on purpose']]);
  const finding = withEdits.findings.find((f) => f.evidence?.excepted === true)!;
  assert.equal(finding.severity, 'info');
  assert.equal(finding.evidence?.source, dropped);

  refusedWith(await check({ file: trapFile, browser: 'off', edits: [{ source: dropped, reason: 'x' }] }), 'request.invalid');
  refusedWith(await check({ file: trapFile, browser: 'off', inventory, edits: [{ source: dropped }] }), 'request.invalid');
  refusedWith(await check({ file: trapFile, browser: 'off', inventory, edits: 'all of them' }), 'request.invalid');
});
