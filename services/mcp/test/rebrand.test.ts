// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_rebrand` (plan 274 work package 9) driven through dispatch() exactly as
 * a transport would: the four stages round-trip the synthetic `simple.pptx`
 * fixture, every structured result validates against the tool's own
 * outputSchema, the capabilities stage tells a local server from a hosted one
 * and says `ocr: false` where there is no OCR, and a plan for other bytes is
 * refused with `plan.hash-mismatch`. The hosted caps (slides, the request and the
 * response on Vercel) and the preset checks run through `callRebrand` with the
 * limits lowered, so a small fixture reaches them.
 *
 * Counts are never pinned: where a number is compared, the test reads it from
 * the same pipeline the tool runs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { buildDeckTheme, planSummary, reviewQueue, setDeckTheme, setSlideGround } from '@lolly/engine';
import type { RenovationPlanV1 } from '@lolly-tools/core';
import { compileDeck, designSessionFromCompiled, planDeck, readDeck, resolveProfileDesignSystem } from '@lolly-tools/node-shell/rebrand';
import { readLollyFile } from '@lolly-tools/node-shell/lolly-file';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import {
  REBRAND_LIMITS,
  REBRAND_OUTPUT_SCHEMA,
  REQUEST_ENVELOPE_BYTES,
  RebrandToolError,
  callRebrand,
  checkSlides,
  isHostedServer,
  rebrandCapabilities,
  responseBytes,
  slidePartCount,
  type RebrandLimitsV1,
} from '../src/rebrand.ts';
import { MAX_TRANSFORM_INPUT_BYTES } from '../src/render.ts';

const FIXTURES = new URL('../../../tests/fixtures/rebrand/', import.meta.url);
const simple = new Uint8Array(readFileSync(new URL('simple.pptx', FIXTURES)));
const palette = new Uint8Array(readFileSync(new URL('palette.pptx', FIXTURES)));
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

const ajv = new Ajv({ allErrors: true, strict: false });
const validateOutput = ajv.compile(REBRAND_OUTPUT_SCHEMA);

function assertValid(structured: unknown): void {
  const ok = validateOutput(structured);
  assert.ok(ok, `structuredContent does not match the outputSchema: ${ajv.errorsText(validateOutput.errors)}`);
}

interface Block { type: string; text?: string; resource?: { uri: string; mimeType?: string; text?: string; blob?: string } }
interface Result { content: Block[]; structuredContent: Record<string, unknown>; isError?: boolean }

let nextId = 1;
async function rebrand(args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_rebrand', arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `lolly_rebrand errored at the protocol level: ${JSON.stringify(res?.error)}`);
  const result = res.result as Result;
  assertValid(result.structuredContent);
  // The structured JSON also travels as text, for a client that reads no structuredContent.
  assert.deepEqual(JSON.parse(result.content[1]?.text ?? (result.isError ? 'null' : '')), result.isError ? null : result.structuredContent);
  return result;
}

async function ok(args: Record<string, unknown>): Promise<Result> {
  const result = await rebrand(args);
  assert.ok(!result.isError, `lolly_rebrand ${String(args.stage)} failed: ${result.content[0]?.text}`);
  return result;
}

async function refused(args: Record<string, unknown>, code: string): Promise<Result> {
  const result = await rebrand(args);
  assert.equal(result.isError, true, `expected ${code}, got success`);
  assert.equal((result.structuredContent.error as { code: string }).code, code, result.content[0]?.text ?? '');
  return result;
}

function planFrom(result: Result): RenovationPlanV1 {
  const s = result.structuredContent;
  const delivery = s.planDelivery as { mode: string; uri?: string };
  if (delivery.mode === 'inline') return s.plan as RenovationPlanV1;
  const block = result.content.find((one) => one.resource?.uri === delivery.uri);
  assert.ok(block?.resource?.text, 'a resource-delivered plan is in the content');
  return JSON.parse(block.resource.text) as RenovationPlanV1;
}

let planned: Result | undefined;
async function simplePlan(): Promise<Result> {
  planned ??= await ok({ stage: 'plan', file: { base64: b64(simple), name: 'simple.pptx' } });
  return planned;
}

test('tools/list carries lolly_rebrand with an outputSchema that compiles', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: Array<{ name: string; outputSchema?: unknown; inputSchema: { required?: string[] } }> }).tools;
  const tool = tools.find((one) => one.name === 'lolly_rebrand');
  assert.ok(tool, 'lolly_rebrand is listed');
  assert.deepEqual(tool.inputSchema.required, ['stage']);
  assert.equal((tool.outputSchema as { type?: string }).type, 'object');
  assert.doesNotThrow(() => ajv.compile(tool.outputSchema as object));
});

test('capabilities on a local server: the file stays on the machine, and no OCR', async () => {
  const local = await rebrandCapabilities({});
  assertValid(local);
  assert.equal(local.surface, 'mcp-local');
  assert.equal(local.bytes, 'local-process');
  assert.equal(local.hosted, false);
  assert.equal(local.ocr, false);
  assert.deepEqual(local.formats, ['pptx', 'pdf'], 'a PDF deck is read');
  assert.equal(local.maxInputBytes, MAX_TRANSFORM_INPUT_BYTES);
  assert.equal(local.nativePptx, true);
  assert.match(String(local.transfer), /stays on the machine this server runs on/);
  assert.equal(local.rasterFallback, true, 'a fallback picture the deck stores is kept, as rasterNote says');
  assert.deepEqual(local.notYetRead, [], 'nothing on the list waits for a later build');
  assert.match(String(local.ocrNote), /reads no text from pictures/);

  const viaDispatch = await ok({ stage: 'capabilities' });
  assert.equal(viaDispatch.structuredContent.ocr, false);
});

test('capabilities on a hosted server says the file is sent there, with its limits and retention', async () => {
  const hosted = await rebrandCapabilities({ VERCEL: '1', LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' });
  assertValid(hosted);
  assert.equal(hosted.surface, 'mcp-hosted');
  assert.equal(hosted.bytes, 'configured-server');
  assert.equal(hosted.ocr, false);
  assert.match(String(hosted.ocrNote), /This server has no OCR/, 'the hosted server says in words that OCR is absent');
  assert.deepEqual(hosted.formats, ['pptx', 'pdf']);
  assert.match(String(hosted.transfer), /sends the file to the server at https:\/\/mcp\.example\.test/);
  assert.match(String(hosted.retention), /not kept/);
  const limits = hosted.limits as { maxBytes: number; maxRequestBytes?: number; maxResponseBytes?: number };
  assert.ok((limits.maxRequestBytes ?? 0) > 0 && (limits.maxResponseBytes ?? 0) > 0, 'the platform body limits are stated');
  // The largest file stated is one whose base64 fits a request, not the reader's 24 MiB.
  assert.ok(limits.maxBytes <= ((limits.maxRequestBytes ?? 0) * 3) / 4, `maxBytes ${limits.maxBytes} fits a ${limits.maxRequestBytes}-byte request as base64`);
  assert.equal(hosted.maxInputBytes, limits.maxBytes);
  assert.match(String(hosted.transfer), /the file and the plan together/);
  assert.ok((hosted.maxSlides as number) <= ((await rebrandCapabilities({})).maxSlides as number));

  // A public origin other machines can reach counts as hosted; a loopback one does not.
  assert.equal(isHostedServer({ LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' }), true);
  assert.equal(isHostedServer({ LOLLY_MCP_PUBLIC_ORIGIN: 'http://localhost:8790' }), false);
  assert.equal(isHostedServer({}), false);

  const flagged = await rebrandCapabilities({ LOLLY_MCP_HOSTED: '1' });
  assert.equal(flagged.bytes, 'configured-server');
  assert.equal((flagged.limits as Record<string, unknown>).maxRequestBytes, undefined);
  assert.equal((flagged.limits as { maxBytes: number }).maxBytes, MAX_TRANSFORM_INPUT_BYTES);
});

test('plan returns the summary, the queue and the outcome the pipeline computes', async () => {
  const result = await simplePlan();
  const s = result.structuredContent;
  const resolved = await resolveProfileDesignSystem();
  assert.ok(resolved);
  const { JSDOM } = await import('jsdom');
  const domParser = new new JSDOM('').window.DOMParser();
  const pipeline = await planDeck({ bytes: simple, name: 'simple.pptx', parseXml: (xml) => domParser.parseFromString(xml, 'application/xml'), system: resolved.system });
  assert.deepEqual(s.summary, planSummary(pipeline.plan, pipeline.source, pipeline.census));
  const queue = s.queue as { total: number; items: Array<{ slideNumbers: number[]; title: string }> };
  assert.equal(queue.total, reviewQueue(pipeline.plan, pipeline.census, pipeline.source).length);
  for (const item of queue.items) {
    assert.ok(item.title.length > 0);
    assert.ok(item.slideNumbers.length > 0);
  }
  assert.equal((s.source as { hash: string }).hash, pipeline.source.source.hash);
  assert.ok(['ready', 'needs-review'].includes(String(s.outcome)));
  const plan = planFrom(result);
  assert.equal(plan.source.hash, pipeline.source.source.hash);
  assert.equal(plan.mode, 'renovate');
});

test('compile turns the returned plan into a Design document that reads back, and a .pptx on request', async () => {
  const plan = planFrom(await simplePlan());
  const result = await ok({ stage: 'compile', file: { base64: b64(simple), name: 'simple.pptx' }, plan, export: 'pptx' });
  const s = result.structuredContent;
  assert.equal(s.planRevision, plan.revision);
  assert.equal(s.appliedUnreviewed, 0);
  const outputs = s.outputs as Array<{ kind: string; uri: string; bytes: number }>;
  const blobOf = (kind: string): Uint8Array => {
    const out = outputs.find((one) => one.kind === kind);
    assert.ok(out, `a ${kind} output`);
    const block = result.content.find((one) => one.resource?.uri === out.uri);
    assert.ok(block?.resource?.blob, `the ${kind} bytes are in the content`);
    const bytes = new Uint8Array(Buffer.from(block.resource.blob, 'base64'));
    assert.equal(bytes.byteLength, out.bytes);
    return bytes;
  };
  const lolly = blobOf('lolly');
  assert.doesNotThrow(() => readLollyFile(lolly));
  const pptx = blobOf('pptx');
  assert.equal(Buffer.from(pptx.subarray(0, 2)).toString('latin1'), 'PK');
  assert.ok(outputs.some((one) => one.kind === 'report'));

  // A string plan compiles the same way, and without export there is no .pptx.
  const plain = await ok({ stage: 'compile', file: { base64: b64(simple), name: 'simple.pptx' }, plan: JSON.stringify(plan) });
  assert.ok(!(plain.structuredContent.outputs as Array<{ kind: string }>).some((one) => one.kind === 'pptx'));
});

test('compile with acceptSuggestions hands back the answered plan under the next revision', async () => {
  const plan = planFrom(await simplePlan());
  const result = await ok({ stage: 'compile', file: { base64: b64(simple), name: 'simple.pptx' }, plan, acceptSuggestions: 'unreviewed' });
  const s = result.structuredContent;
  assert.equal(s.acceptSuggestions, 'unreviewed');
  if ((s.appliedUnreviewed as number) > 0) {
    assert.equal(s.planRevision, plan.revision + 1);
    const delivery = s.answeredPlanDelivery as { mode: string; revision: number };
    assert.equal(delivery.revision, plan.revision + 1);
    if (delivery.mode === 'inline') assert.equal((s.answeredPlan as RenovationPlanV1).revision, plan.revision + 1);
  } else {
    assert.equal(s.planRevision, plan.revision);
    assert.equal(s.answeredPlanDelivery, undefined);
  }
});

test('inspect pages the queue, the slides and one slide of objects', async () => {
  const plan = planFrom(await simplePlan());
  const file = { base64: b64(simple), name: 'simple.pptx' };

  const overview = await ok({ stage: 'inspect', plan, file, limit: 2 });
  const o = overview.structuredContent;
  assert.equal(o.fidelityKnown, true);
  const slides = o.slides as { total: number; items: unknown[] };
  assert.equal(slides.total, plan.slides.length);
  assert.ok(slides.items.length <= 2);

  const first = plan.slides[0]!;
  const one = await ok({ stage: 'inspect', plan, file, slide: 1, limit: 2, page: 1 });
  const objects = one.structuredContent.objects as { total: number; items: Array<{ id: string; fidelity: string | null; class: string; action: string; review: string; evidence: string }> };
  assert.equal(objects.total, first.objects.length);
  assert.ok(objects.items.length <= 2);
  for (const item of objects.items) {
    assert.ok(item.fidelity !== null, 'with the file, fidelity is known');
    assert.ok(item.evidence.length > 0);
  }

  // Without the file the plan alone answers, and says fidelity is not known.
  const bare = await ok({ stage: 'inspect', plan, slide: 1 });
  assert.equal(bare.structuredContent.fidelityKnown, false);
  for (const item of (bare.structuredContent.objects as { items: Array<{ fidelity: unknown }> }).items) assert.equal(item.fidelity, null);

  // A page past the end is empty, not an error.
  const past = await ok({ stage: 'inspect', plan, slide: 1, page: 1000 });
  assert.deepEqual((past.structuredContent.objects as { items: unknown[] }).items, []);

  await refused({ stage: 'inspect', plan, slide: plan.slides.length + 1 }, 'request.invalid');
});

test('a plan for other bytes is refused with plan.hash-mismatch', async () => {
  const plan = planFrom(await simplePlan());
  await refused({ stage: 'compile', file: { base64: b64(palette), name: 'palette.pptx' }, plan }, 'plan.hash-mismatch');
  await refused({ stage: 'inspect', file: { base64: b64(palette), name: 'palette.pptx' }, plan }, 'plan.hash-mismatch');
});

test('refusals carry their stable codes', async () => {
  await refused({ stage: 'plan' }, 'source.missing');
  await refused({ stage: 'compile', file: { base64: b64(simple), name: 'simple.pptx' } }, 'plan.missing');
  await refused({ stage: 'compile', file: { base64: b64(simple), name: 'simple.pptx' }, plan: '{"version":1' }, 'plan.invalid');
  await refused({ stage: 'plan', file: { base64: b64(new TextEncoder().encode('not a deck')), name: 'x.pptx' } }, 'source.unreadable');
  await refused({ stage: 'plan', file: { base64: b64(simple), name: 'simple.pptx' }, seed: 1.5 }, 'request.invalid');
  await refused({ stage: 'renovate' }, 'request.invalid');
  // Refused on the estimate, before the base64 is decoded.
  const tooBig = 'A'.repeat(Math.ceil((MAX_TRANSFORM_INPUT_BYTES + 3) / 3) * 4);
  await refused({ stage: 'plan', file: { base64: tooBig, name: 'big.pptx' } }, 'source.too-large');
});

test('a PDF deck plans, compiles and inspects through the same stages, told apart by its bytes', async () => {
  const pdf = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/rebrand-pdf/editable.pdf', import.meta.url)));
  const planned = await ok({ stage: 'plan', file: { base64: b64(pdf), name: 'editable.pdf' } });
  const s = planned.structuredContent;
  assert.equal((s.source as { name: string }).name, 'editable.pdf');
  assert.ok(((s.source as { slides: number }).slides) > 0);
  assert.equal(s.flattened, undefined, 'a born-digital PDF has no page that is a picture');
  const plan = planFrom(planned);
  assert.match(plan.algorithms.reader, /^pdf-read\//);
  const compiled = await ok({ stage: 'compile', file: { base64: b64(pdf), name: 'editable.pdf' }, plan });
  assert.ok((compiled.structuredContent.outputs as Array<{ kind: string }>).some((one) => one.kind === 'lolly'));
  await ok({ stage: 'inspect', file: { base64: b64(pdf), name: 'editable.pdf' }, plan });

  // A pptx is read as a pptx whatever it is called.
  await ok({ stage: 'plan', file: { base64: b64(simple), name: 'simple.pdf' } });
});

test('a scanned PDF page keeps its picture here, and a plan made with text recognition is refused', async () => {
  const scanned = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/rebrand/flattened.pdf', import.meta.url)));
  const planned = await ok({ stage: 'plan', file: { base64: b64(scanned), name: 'flattened.pdf' } });
  const flattened = planned.structuredContent.flattened as { slides: number; rebuilt: number; ocr: boolean; note: string };
  assert.ok(flattened.slides > 0);
  assert.equal(flattened.rebuilt, 0);
  assert.equal(flattened.ocr, false);
  assert.match(flattened.note, /reads no text from pictures/);
  assert.match(String(planned.content[0]?.text), /reads no text from pictures/, 'the sentence says it too');
  const plan = planFrom(planned);
  assert.match(plan.algorithms.reader, /\+keep$/);
  await ok({ stage: 'compile', file: { base64: b64(scanned), name: 'flattened.pdf' }, plan });

  const withOcr = { ...plan, algorithms: { ...plan.algorithms, reader: `${plan.algorithms.reader.replace(/\+keep$/, '')}+rebuild/ocr:ppocr` } };
  await refused({ stage: 'compile', file: { base64: b64(scanned), name: 'flattened.pdf' }, plan: withOcr }, 'ocr.unavailable');
});

// ─── hosted limits, presets and plan checks ──────────────────────────────────

const simpleFile = { base64: b64(simple), name: 'simple.pptx' };
const VERCEL = { VERCEL: '1', LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' };

function limitsWith(over: Partial<RebrandLimitsV1>): RebrandLimitsV1 {
  return { ...REBRAND_LIMITS, ...over };
}

/** callRebrand directly, with an env and limits a transport never passes; the result still validates. */
async function direct(args: Record<string, unknown>, env: Record<string, string>, over: Partial<RebrandLimitsV1> = {}): Promise<Result> {
  const result: Result = await callRebrand(args, env, limitsWith(over));
  assertValid(result.structuredContent);
  return result;
}

function codeOf(result: Result): string | undefined {
  return result.isError ? (result.structuredContent.error as { code: string }).code : undefined;
}

/** What the old guard counted: the raw text and blob lengths, with no envelope and no escaping. */
function contentOnly(result: Result): number {
  let total = 0;
  for (const block of result.content) total += (block.text?.length ?? 0) + (block.resource?.text?.length ?? 0) + (block.resource?.blob?.length ?? 0);
  return total;
}

test('on Vercel the output guard measures the serialised response, and refuses with output.too-large', async () => {
  const raw = await callRebrand({ stage: 'plan', file: simpleFile }, VERCEL, limitsWith({ responseMaxBytes: 1e9 }));
  const roomy: Result = raw;
  assert.ok(!roomy.isError, roomy.content[0]?.text ?? '');
  const sent = responseBytes(raw);
  assert.equal(sent, Buffer.byteLength(JSON.stringify({ jsonrpc: '2.0', id: null, result: raw })));
  // The structured copy and the escaping are counted: well over what the content alone comes to.
  const margin = 2000;
  assert.ok(contentOnly(roomy) < sent - margin, `the wire count ${sent} is above the content count ${contentOnly(roomy)}`);

  const refused = await direct({ stage: 'plan', file: simpleFile }, VERCEL, { responseMaxBytes: sent - margin });
  assert.equal(codeOf(refused), 'output.too-large', refused.content[0]?.text ?? '');
  const fits = await callRebrand({ stage: 'plan', file: simpleFile }, VERCEL, limitsWith({ responseMaxBytes: sent + margin }));
  assert.ok(!fits.isError);
  assert.ok(responseBytes(fits) <= sent + margin);

  // Off Vercel there is no platform limit to guard.
  const local = await direct({ stage: 'plan', file: simpleFile }, {}, { responseMaxBytes: 10 });
  assert.ok(!local.isError, local.content[0]?.text ?? '');
});

test('a plan over the inline limit travels as a resource and still compiles', async () => {
  const result = await direct({ stage: 'plan', file: simpleFile }, {}, { planInlineBytes: 100 });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const delivery = result.structuredContent.planDelivery as { mode: string; uri?: string };
  assert.equal(delivery.mode, 'resource');
  assert.equal(result.structuredContent.plan, undefined);
  const plan = planFrom(result);
  const compiled = await ok({ stage: 'compile', file: simpleFile, plan });
  assert.equal(compiled.structuredContent.planRevision, plan.revision);
});

test('the hosted slide cap refuses before the read, and a deck the reader cut short is refused', async () => {
  const plan = planFrom(await simplePlan());
  assert.equal(slidePartCount(simple), plan.slides.length);
  assert.equal(slidePartCount(new TextEncoder().encode('not a zip file at all')), null);

  const cap = plan.slides.length - 1;
  for (const args of [
    { stage: 'plan', file: simpleFile },
    { stage: 'compile', file: simpleFile, plan },
    { stage: 'inspect', file: simpleFile, plan },
  ]) {
    const result = await direct(args, VERCEL, { hostedMaxSlides: cap });
    assert.equal(codeOf(result), 'source.too-large', `${args.stage}: ${result.content[0]?.text ?? ''}`);
  }
  // The local cap is not the hosted one.
  const local = await direct({ stage: 'plan', file: simpleFile }, {}, { hostedMaxSlides: cap });
  assert.ok(!local.isError, local.content[0]?.text ?? '');

  const { JSDOM } = await import('jsdom');
  const domParser = new new JSDOM('').window.DOMParser();
  const resolved = await resolveProfileDesignSystem();
  assert.ok(resolved);
  const read = await planDeck({ bytes: simple, name: 'simple.pptx', parseXml: (xml) => domParser.parseFromString(xml, 'application/xml'), system: resolved.system });
  const truncated = { ...read.source, warnings: [...read.source.warnings, { code: 'slides-truncated' as const, message: 'the rest were not read' }] };
  assert.throws(
    () => checkSlides(truncated, { env: {}, limits: REBRAND_LIMITS }),
    (err: unknown) => err instanceof RebrandToolError && err.code === 'source.too-large',
  );
  assert.doesNotThrow(() => checkSlides(read.source, { env: {}, limits: REBRAND_LIMITS }));
});

test('on Vercel a plan whose compile request would not fit is refused at the plan stage', async () => {
  const plan = planFrom(await simplePlan());
  const planBytes = Buffer.byteLength(JSON.stringify(plan));
  const fileB64 = b64(simple).length;
  // Room for the file alone and half the plan: the plan stage reads it, a compile could not arrive.
  const bodyMaxBytes = REQUEST_ENVELOPE_BYTES + fileB64 + Math.floor(planBytes / 2);
  const caps = await rebrandCapabilities(VERCEL, limitsWith({ bodyMaxBytes }));
  assert.ok((caps.maxInputBytes as number) >= simple.byteLength, 'the file alone is under the stated limit');
  const result = await direct({ stage: 'plan', file: simpleFile }, VERCEL, { bodyMaxBytes });
  assert.equal(codeOf(result), 'source.too-large', result.content[0]?.text ?? '');
  assert.match(result.content[0]?.text ?? '', /compile call/);
});

test('presets are checked the way the CLI checks them, and the plan records the one it used', async () => {
  const refusals: Array<[unknown, string]> = [
    ['no-such-preset-anywhere', 'preset.unknown'],
    ['./presets/tidy.json', 'preset.unknown'],
    [{ id: 'typo', action: { title: 'keep' } }, 'preset.invalid'],
    [{ id: 'bad', actions: 'x' }, 'preset.invalid'],
    [{ id: 'bad2', actions: { 'page-number': 'explode' } }, 'preset.invalid'],
    [{ id: 'bad3', actions: { 'not-a-class': 'keep' } }, 'preset.invalid'],
    [{ name: 'no id' }, 'preset.invalid'],
    [42, 'request.invalid'],
  ];
  for (const [preset, code] of refusals) {
    await refused({ stage: 'plan', file: simpleFile, preset }, code);
  }

  const result = await ok({ stage: 'plan', file: simpleFile, preset: { id: 'mcp-test', version: '2', name: 'For people only', actions: { 'page-number': 'remove' } } });
  const system = result.structuredContent.designSystem as { presetId?: string; presetVersion?: string; tokenHash: string };
  assert.equal(system.presetId, 'mcp-test');
  assert.equal(system.presetVersion, '2');
  const plan = planFrom(result);
  assert.equal(plan.designSystem.presetId, 'mcp-test');
  assert.equal(plan.designSystem.presetVersion, '2');
  // The preset does not move the tokens, so the plan compiles against the system without it.
  assert.equal(plan.designSystem.tokenHash, planFrom(await simplePlan()).designSystem.tokenHash);
  await ok({ stage: 'compile', file: simpleFile, plan });
});

test('a plan that does not fit the deck, or has malformed rows, is refused as plan.invalid', async () => {
  const plan = planFrom(await simplePlan());
  const emptied = structuredClone(plan);
  emptied.slides[0]!.objects = [];
  await refused({ stage: 'inspect', file: simpleFile, plan: emptied }, 'plan.invalid');
  await refused({ stage: 'compile', file: simpleFile, plan: emptied }, 'plan.invalid');

  // Refused by the imported schema, with or without the schema file on disk.
  const broken = JSON.parse(JSON.stringify(plan)) as { slides: Array<Record<string, unknown>> };
  broken.slides[0]!.objects = 'x';
  await refused({ stage: 'inspect', plan: broken }, 'plan.invalid');
  await refused({ stage: 'inspect', plan: broken, slide: 1 }, 'plan.invalid');
  await refused({ stage: 'compile', file: simpleFile, plan: broken }, 'plan.invalid');
  const noEvidence = JSON.parse(JSON.stringify(plan)) as { slides: Array<{ objects: Array<Record<string, unknown>> }> };
  const row = noEvidence.slides.flatMap((slide) => slide.objects)[0];
  assert.ok(row, 'the fixture has an object row');
  delete row.evidence;
  await refused({ stage: 'inspect', plan: noEvidence, slide: 1 }, 'plan.invalid');
});

// ─── autoMatch (plan 275 decision 28) ────────────────────────────────────────

const structures = new Uint8Array(readFileSync(new URL('structures.pptx', FIXTURES)));
const structuresFile = { base64: b64(structures), name: 'structures.pptx' };

test('the tool schema offers autoMatch as clear, likely or all, on the plan and compile stages, off unless given', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tool = (res.result as { tools: Array<{ name: string; inputSchema: { properties: Record<string, { enum?: string[]; description?: string }> } }> }).tools
    .find((one) => one.name === 'lolly_rebrand');
  assert.deepEqual(tool?.inputSchema.properties.autoMatch?.enum, ['clear', 'likely', 'all']);
  assert.match(tool?.inputSchema.properties.autoMatch?.description ?? '', /^plan and compile:/);
  const plain = await ok({ stage: 'plan', file: structuresFile });
  assert.equal(plain.structuredContent.autoMatched, undefined);
  assert.ok(planFrom(plain).slides.every((slide) => slide.layoutSource !== 'auto'));
  await refused({ stage: 'plan', file: structuresFile, autoMatch: 'everything' }, 'request.invalid');
});

test('plan with autoMatch changes no layout the first pass set; compile with it over plain layouts answers the plan and says so', async () => {
  // The first pass already sets every clear read on this fixture, so Auto-match has nothing to change.
  const planned = await ok({ stage: 'plan', file: structuresFile, autoMatch: 'clear' });
  assert.deepEqual(planned.structuredContent.autoMatched, { bands: 'clear', clear: 0, likely: 0, none: 0, total: 0 });
  assert.match(planned.content[0]?.text ?? '', /Auto-match set no slide\./);
  assert.equal(planFrom(planned).slides.filter((slide) => slide.layoutSource === 'auto').length, 0);

  const fresh = planFrom(await ok({ stage: 'plan', file: structuresFile }));
  const flat: RenovationPlanV1 = { ...fresh, slides: fresh.slides.map((slide) => ({ ...slide, layout: 'content' })) };
  const compiled = await ok({ stage: 'compile', file: structuresFile, plan: flat, autoMatch: 'all' });
  const s = compiled.structuredContent;
  assert.deepEqual(s.autoMatched, { bands: 'all', clear: 7, likely: 1, none: 0, total: 8 });
  assert.match(compiled.content[0]?.text ?? '', /Auto-match set 8 slides\./);
  assert.equal(s.planRevision, flat.revision + 1);
  assert.ok(s.answeredPlanDelivery, 'the answered plan comes back');
  const report = compiled.content.find((block) => block.resource?.uri.endsWith('structures.report.json'));
  const entries = (JSON.parse(report?.resource?.text ?? '{}') as { entries: Array<{ code: string }> }).entries;
  assert.equal(entries.filter((entry) => entry.code === 'layout.auto-matched').length, 8);
});

test('compile with autoMatch over a plan Auto-match already set: the sentence and the counts agree', async () => {
  const fresh = planFrom(await ok({ stage: 'plan', file: structuresFile }));
  const matched: RenovationPlanV1 = { ...fresh, slides: fresh.slides.map((slide) => ({ ...slide, layoutSource: 'auto' as const })) };
  const compiled = await ok({ stage: 'compile', file: structuresFile, plan: matched, autoMatch: 'all' });
  const total = (compiled.structuredContent.autoMatched as { total: number }).total;
  assert.equal(total, 8, 'every slide in the plan is Auto-match\'s own');
  assert.match(compiled.content[0]?.text ?? '', /Auto-match set 8 slides\./, 'the sentence counts the plan, as the facts do');
});

test('the queue a plan returns carries its layout cards with the slides they hold', async () => {
  const planned = await ok({ stage: 'plan', file: structuresFile });
  const items = (planned.structuredContent.queue as { items: Array<{ type?: string; slideIds?: string[]; layout?: { structure: string } }> }).items;
  const cards = items.filter((item) => item.type === 'layout-group');
  for (const card of cards) {
    assert.ok((card.slideIds?.length ?? 0) > 0);
    assert.ok(card.layout?.structure);
  }
});

// ─── close-out CP12: a themed plan compiles to the same bytes here as on the CLI ──

test('a plan on the Dark theme, one slide on Brand, compiles here to the rows the node pipeline gives', async () => {
  const resolved = await resolveProfileDesignSystem();
  assert.ok(resolved);
  const { input } = resolved;
  const source = { colors: input.colors, ...(input.darkColors ? { darkColors: input.darkColors } : {}), master: input.master };
  const dark = buildDeckTheme('dark', source)?.theme;
  assert.ok(dark, 'the design system offers Dark');
  const { JSDOM } = await import('jsdom');
  const domParser = new new JSDOM('').window.DOMParser();
  const read = await planDeck({ bytes: simple, name: 'simple.pptx', parseXml: (xml) => domParser.parseFromString(xml, 'application/xml'), system: resolved.system });
  const base = planFrom(await simplePlan());
  const solve = { census: read.census, source: read.source, system: source };
  const themed = setDeckTheme(base, dark, { solve }).plan;
  const slide = themed.slides.find((one) => one.include && one.layout !== 'title')?.id;
  assert.ok(slide);
  const plan = setSlideGround(themed, [slide], 'brand', { solve }).plan;
  assert.equal(plan.designSystem.theme?.id, 'dark');

  const result = await ok({ stage: 'compile', file: { base64: b64(simple), name: 'simple.pptx' }, plan });
  const outputs = result.structuredContent.outputs as Array<{ kind: string; uri: string }>;
  const lollyUri = outputs.find((one) => one.kind === 'lolly')?.uri;
  const block = result.content.find((one) => one.resource?.uri === lollyUri);
  assert.ok(block?.resource?.blob, 'the .lolly bytes are in the content');
  const session = readLollyFile(new Uint8Array(Buffer.from(block.resource.blob, 'base64'))).session;

  const again = await readDeck({ bytes: simple, name: 'simple.pptx', parseXml: (xml) => domParser.parseFromString(xml, 'application/xml'), instanceId: plan.source.instanceId });
  const { compiled } = await compileDeck({ source: again.source, census: again.census, plan, system: resolved.system, author: 'agent' });
  assert.equal(compiled.designSystem.theme?.id, 'dark', 'the compile records the theme it drew');
  const cli = designSessionFromCompiled(compiled, { label: 'x', projectId: 'x' });
  assert.equal(JSON.stringify(session.boxes), JSON.stringify(cli.values.boxes), 'the MCP tool and the CLI draw the same rows');
});
