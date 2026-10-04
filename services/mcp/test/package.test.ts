// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_package` (plan 291 W8) driven through dispatch() as a transport would: a
 * Design document with inline pictures comes back as a `.lolly` resource and a design
 * package report, a compiled document keeps the zip the tool always wrote, and every
 * structured result validates against the tool's own outputSchema. The hosted caps
 * run through `callPackage` with the limits lowered. Synthetic documents only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import { readLollyFile } from '@lolly-tools/node-shell/lolly-file';
import { dispatch } from '../src/server.ts';
import { TOOL_DEFS } from '../src/tools.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { PACKAGE_LIMITS, PACKAGE_OUTPUT_SCHEMA, PACKAGE_TOOL_CODES, callPackage, type PackageDesignResolver } from '../src/package.ts';

const ROOT = new URL('../../../', import.meta.url);
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 5, 6, 7, 8]);
const DOC = [
  { id: 'a', kind: 'frame', name: 'One', x: 0, y: 0, w: 1280, h: 720, rot: 0, shape: 'rect', bg: '#ffffff' },
  { id: 'a-photo', kind: 'image', frame: 'a', x: 0, y: 0, w: 1280, h: 720, rot: 0, image: 'photo:hero', fit: 'cover' },
  { id: 'a-title', kind: 'text', frame: 'a', x: 40, y: 200, w: 900, h: 80, rot: 0, text: 'Hello' },
];

const ajv = new Ajv({ allErrors: true, strict: false });
const validateOutput = ajv.compile(PACKAGE_OUTPUT_SCHEMA);
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
const reportSchema = JSON.parse(readFileSync(new URL('schemas/design-package-v1.schema.json', ROOT), 'utf8'));
const validateReport = new (Ajv2020 as unknown as new (o: unknown) => { compile: (s: unknown) => Validator })({ allErrors: true, strict: false }).compile(reportSchema);

interface Result { content: Array<{ type: string; text?: string; resource?: { uri: string; mimeType: string; blob?: string } }>; structuredContent: Record<string, unknown>; isError?: boolean }

function assertValid(result: Result): void {
  assert.ok(validateOutput(result.structuredContent), `structuredContent does not match the outputSchema: ${ajv.errorsText(validateOutput.errors)}`);
  if (result.isError) return;
  assert.deepEqual(JSON.parse(result.content[1]?.text ?? ''), result.structuredContent);
}

let nextId = 29_800;
async function pack(args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_package', arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `lolly_package errored at the protocol level: ${JSON.stringify(res?.error)}`);
  const result = res.result as Result;
  assertValid(result);
  return result;
}

function refusedWith(result: Result, code: string): void {
  assert.equal(result.isError, true, `expected ${code}, got ${result.content[0]?.text}`);
  assert.equal((result.structuredContent.error as { code: string }).code, code, result.content[0]?.text ?? '');
}

const unreachable: PackageDesignResolver = async () => { throw new Error('the Design resolver was called'); };

test('the tool is listed with an output schema that offers the report, the legacy answer and the error', () => {
  const def = TOOL_DEFS.find((d) => d.name === 'lolly_package') as { outputSchema?: { oneOf: unknown[] } } | undefined;
  assert.ok(def?.outputSchema, 'lolly_package declares an outputSchema');
  assert.equal(def.outputSchema.oneOf.length, 3);
  for (const code of ['media.missing', 'reference.unknown', 'asset.too-large', 'output.too-large']) assert.ok(PACKAGE_TOOL_CODES.includes(code as never), code);
});

test('a Design document with an inline picture comes back as a .lolly that reads back', async () => {
  const result = await pack({ document: DOC, assets: [{ key: 'photo:hero', base64: b64(JPG), name: 'hero.jpg' }], label: 'Quarterly review' });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const report = result.structuredContent;
  assert.ok(validateReport(report), JSON.stringify(validateReport.errors, null, 2));
  assert.equal(report.label, 'Quarterly review');
  assert.match(result.content[0]!.text!, /^Packaged "Quarterly review" as Quarterly review\.lolly: 1 artboard, 3 layers, 1 picture carried/);
  const resource = result.content[2]!.resource!;
  assert.equal(resource.mimeType, 'application/vnd.lolly+zip');
  assert.match(resource.uri, /^lolly:\/\/package\/[0-9a-f]{12}\/Quarterly%20review\.lolly$/);
  const bytes = new Uint8Array(Buffer.from(resource.blob!, 'base64'));
  assert.equal(sha(bytes), report.sha256);
  const back = readLollyFile(bytes);
  assert.deepEqual((back.session.boxes as Array<Record<string, unknown>>)[1]!.image, { id: `user/media/${sha(JPG)}`, source: 'user' });
  assert.equal(back.session.__export_filename, 'Quarterly review');
});

test('toolId "design" with inputs packages the resolved document', async () => {
  const result = await pack({ toolId: 'design', inputs: { boxes: DOC }, assets: [{ key: 'photo:hero', base64: b64(JPG) }] });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  assert.equal(result.structuredContent.layers, 3);
});

test('a compiled document keeps the zip the tool always wrote', async () => {
  const compiled = { apiVersion: 1, toolId: 'qr-code', toolVersion: '1', manifest: { id: 'qr-code' }, model: [], values: {}, tokens: {}, hydrated: {}, styles: {} };
  const result = await pack({ document: compiled });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  assert.equal(result.structuredContent.legacy, true);
  assert.equal((result.structuredContent.manifest as { tool: { id: string } }).tool.id, 'qr-code');
  assert.equal(result.content[2]?.resource?.mimeType, 'application/vnd.lolly+zip');
  refusedWith(await pack({ document: compiled, label: 'x' }), 'request.invalid');
});

test('refusals carry their codes', async () => {
  refusedWith(await pack({}), 'input.missing');
  refusedWith(await pack({ document: DOC }), 'media.missing');
  refusedWith(await pack({ document: { values: {} } }), 'input.unsupported');
  refusedWith(await pack({ document: DOC, assets: [{ key: 'photo:hero', base64: b64(new TextEncoder().encode('%PDF-1.7')) }] }), 'asset.not-image');
  refusedWith(await pack({ document: DOC, assets: [{ key: '', base64: b64(JPG) }] }), 'asset.invalid');
  refusedWith(await pack({ document: DOC, nonsense: 1 }), 'request.invalid');
  refusedWith(await pack({ toolId: 'qr-code' }), 'input.unsupported');
  refusedWith(await pack({ document: DOC, toolId: 'design' }), 'request.invalid');
  const allowed = await pack({ document: DOC, allowMissingMedia: true });
  assert.ok(!allowed.isError);
  assert.deepEqual(allowed.structuredContent.missingMedia, [{ ref: 'photo:hero', layers: ['a-photo'] }]);
});

test('a missing-picture refusal names this tool\'s arguments, never a CLI flag', async () => {
  const placeholder = await pack({ document: DOC });
  refusedWith(placeholder, 'media.missing');
  assert.match(placeholder.content[0]!.text!, /in assets as \{key, base64\}, or set allowMissingMedia to write them as references\./);
  const upload = await pack({ document: DOC.map((r) => (r.id === 'a-photo' ? { ...r, image: `user/media/${'4'.repeat(64)}` } : r)) });
  refusedWith(upload, 'media.missing');
  assert.match(upload.content[0]!.text!, /as source, or each picture in assets keyed by its user\/media ref, or set allowMissingMedia/);
  for (const result of [placeholder, upload]) assert.doesNotMatch(result.content[0]!.text!, /--|asset-dir|allow-missing-media/);
});

test('on a hosted server the pictures share one request and the file one response', async () => {
  const vercel = { VERCEL: '1' };
  const tight = { ...PACKAGE_LIMITS, bodyMaxBytes: 1024 };
  const big = new Uint8Array(4096);
  big.set(JPG);
  const tooBig = (await callPackage({ document: DOC, assets: [{ key: 'photo:hero', base64: b64(big) }] }, unreachable, vercel, tight)) as Result;
  assertValid(tooBig);
  refusedWith(tooBig, 'asset.too-large');
  const small = { ...PACKAGE_LIMITS, responseMaxBytes: 200 };
  const answer = (await callPackage({ document: DOC, assets: [{ key: 'photo:hero', base64: b64(JPG) }] }, unreachable, vercel, small, { brief: async () => null })) as Result;
  assertValid(answer);
  refusedWith(answer, 'output.too-large');
});

test('colour references are stored as the literal plus a link in the design system\'s tokens (plan 291 W4)', async () => {
  const { createTokenSet } = await import('@lolly/engine');
  const tokens = createTokenSet({ color: { $type: 'color', semantic: { surface: { $value: '#fafafa' }, text: { $value: '#101010' } } } });
  const doc = [
    { id: 'a', kind: 'frame', name: 'One', x: 0, y: 0, w: 1280, h: 720, rot: 0, shape: 'rect', bg: '{color.semantic.surface}' },
    { id: 't', kind: 'text', frame: 'a', x: 40, y: 200, w: 900, h: 80, rot: 0, fg: '{color.semantic.text}', text: 'Hi {@color.semantic.text w500|there}' },
  ];
  let asked: string | undefined = 'unset';
  const result = await callPackage({ document: doc, theme: 'light' }, unreachable, {}, PACKAGE_LIMITS, { tokens: async (theme) => { asked = theme; return tokens; } }) as unknown as Result;
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  assert.equal(asked, 'light');
  const blob = result.content.find((c) => c.resource)!.resource!.blob!;
  const rows = readLollyFile(new Uint8Array(Buffer.from(blob, 'base64'))).session.boxes as Array<Record<string, unknown>>;
  assert.equal(rows[0]!.bg, '#fafafa');
  assert.match(String(rows[0]!.tokenLinks), /color\.semantic\.surface/);
  assert.equal(rows[1]!.fg, '#101010');
  assert.equal(rows[1]!.text, 'Hi {#101010 w500|there}');
  // The profile's own tokens by default: no reference reaches the file raw.
  const viaServer = await pack({ document: doc });
  assert.ok(!viaServer.isError, viaServer.content[0]?.text ?? '');
  const served = readLollyFile(new Uint8Array(Buffer.from(viaServer.content[2]!.resource!.blob!, 'base64'))).session.boxes as Array<Record<string, unknown>>;
  assert.doesNotMatch(String(served[0]!.bg), /^\{/);
  assert.match(String(served[0]!.tokenLinks), /color\.semantic\.surface/);
});
