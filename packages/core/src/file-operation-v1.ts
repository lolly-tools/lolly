// SPDX-License-Identifier: MPL-2.0
/** Shared operation boundary. Executors own codecs and storage; this owns receipts. */
import Ajv from 'ajv';
import { FILE_CONTRACT_VERSION, type FileFactsV1, type FileOperationFindingV1, type FileOperationReportV1 } from './file-v1.ts';

export interface FileOperationRequestV1 {
  version: 1;
  operation: string;
  target: string;
  options: Record<string, string | number | boolean>;
}
export interface FileOperationAdapterV1<T> {
  describe(input: T, signal?: AbortSignal): Promise<FileFactsV1>;
  execute(input: T, request: FileOperationRequestV1, signal?: AbortSignal): Promise<T>;
  effects(input: FileFactsV1, request: FileOperationRequestV1): { metadata: FileOperationReportV1['metadata']; findings: FileOperationFindingV1[] };
}
const text = { type: 'string', maxLength: 4096 };
const options = { type: 'object', maxProperties: 64, propertyNames: { maxLength: 80, pattern: '^(?!__proto__$|constructor$|prototype$)[a-zA-Z][a-zA-Z0-9_.-]*$' }, additionalProperties: { anyOf: [text, { type: 'number' }, { type: 'boolean' }] } };
const facts = { type: 'object', additionalProperties: false, required: ['name', 'format', 'mime', 'size'], properties: {
  name: text, format: { type: 'string', maxLength: 80 }, formatSource: { enum: ['detected', 'declared'] }, mime: { type: 'string', maxLength: 255 },
  size: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  width: { type: 'integer', minimum: 1 }, height: { type: 'integer', minimum: 1 }, durationMs: { type: 'number', minimum: 0 }, pages: { type: 'integer', minimum: 0 },
} };
export const fileOperationRequestSchemaV1 = {
  $id: 'https://lolly.tools/schemas/file-operation-request-v1', type: 'object', additionalProperties: false,
  required: ['version', 'operation', 'target', 'options'], properties: {
    version: { const: 1 }, operation: { type: 'string', pattern: '^[a-z][a-z0-9.-]{0,63}$' },
    target: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,31}$' }, options,
  },
} as const;
export const fileOperationReportSchemaV1 = {
  $id: 'https://lolly.tools/schemas/file-operation-report-v1', type: 'object', additionalProperties: false,
  required: ['version', 'operation', 'state', 'inputs', 'outputs', 'options', 'changes', 'findings', 'metadata', 'execution'],
  properties: { version: { const: FILE_CONTRACT_VERSION }, operation: text,
    state: { enum: ['succeeded', 'partially_succeeded', 'failed', 'cancelled'] },
    inputs: { type: 'array', maxItems: 200, items: facts }, outputs: { type: 'array', maxItems: 200, items: facts }, options: { ...options, maxProperties: 65 },
    changes: { type: 'array', maxItems: 400, items: text },
    findings: { type: 'array', maxItems: 400, items: { type: 'object', additionalProperties: false, required: ['code', 'severity', 'message'], properties: {
      code: { type: 'string', maxLength: 100 }, severity: { enum: ['info', 'warning', 'error'] }, message: text,
    } } }, metadata: { enum: ['preserved', 'removed', 'changed', 'not-checked'] }, execution: { enum: ['device', 'instance'] },
  },
} as const;
const ajv = new Ajv({ allErrors: true, strict: false, strictNumbers: true });
const requestValidator = ajv.compile(fileOperationRequestSchemaV1);
const reportValidator = ajv.compile(fileOperationReportSchemaV1);
export function assertFileOperationRequest(value: unknown): asserts value is FileOperationRequestV1 {
  if (!requestValidator(value)) throw new Error(`Invalid file operation: ${ajv.errorsText(requestValidator.errors)}`);
}
export function assertFileOperationReport(value: unknown): asserts value is FileOperationReportV1 {
  if (!reportValidator(value)) throw new Error(`Invalid file report: ${ajv.errorsText(reportValidator.errors)}`);
  const report = value as FileOperationReportV1;
  if (report.state === 'succeeded' && !report.outputs.length) throw new Error('A successful file report needs an output.');
  if (['failed', 'cancelled'].includes(report.state) && report.outputs.length) throw new Error('An unsuccessful single operation cannot claim outputs.');
}
export async function executeFileOperationV1<T>(input: T, request: FileOperationRequestV1, adapter: FileOperationAdapterV1<T>, context: { signal?: AbortSignal; execution?: 'device' | 'instance' } = {}): Promise<{ output?: T; report: FileOperationReportV1 }> {
  assertFileOperationRequest(request);
  const report: FileOperationReportV1 = { version: 1, operation: request.operation, state: 'failed', inputs: [], outputs: [], options: { ...request.options, target: request.target }, changes: [], findings: [], metadata: 'not-checked', execution: context.execution ?? 'device' };
  try {
    context.signal?.throwIfAborted();
    const original = await adapter.describe(input, context.signal); report.inputs = [original];
    Object.assign(report, adapter.effects(original, request));
    const output = await adapter.execute(input, request, context.signal);
    context.signal?.throwIfAborted();
    const produced = await adapter.describe(output, context.signal);
    context.signal?.throwIfAborted();
    report.outputs = [produced]; report.state = 'succeeded';
    report.changes = [`${original.format.toUpperCase()} → ${produced.format.toUpperCase()}`, `${original.size} → ${produced.size} bytes`];
    if (original.width && produced.width) report.changes.push(`${original.width} × ${original.height} → ${produced.width} × ${produced.height} pixels`);
    assertFileOperationReport(report);
    return { output, report };
  } catch (error) {
    report.outputs = []; report.state = context.signal?.aborted ? 'cancelled' : 'failed';
    report.findings.push({ code: report.state === 'cancelled' ? 'operation-cancelled' : 'operation-failed', severity: 'error', message: (error instanceof Error ? error.message : String(error)).slice(0, 4096) });
    // Malformed adapter facts must not escape as a supposedly validated receipt.
    try { assertFileOperationReport(report); } catch {
      report.inputs = []; report.metadata = 'not-checked'; report.changes = [];
      report.findings = [{ code: 'adapter-contract-error', severity: 'error', message: 'The adapter returned invalid facts or findings. No output has been accepted.' }];
      assertFileOperationReport(report);
    }
    return { report };
  }
}
export interface FileBatchReportV1 { version: 1; state: FileOperationReportV1['state']; results: FileOperationReportV1[]; counts: { succeeded: number; failed: number; cancelled: number } }
export function fileBatchReportV1(results: FileOperationReportV1[]): FileBatchReportV1 {
  if (results.length > 200) throw new Error('A batch report is limited to 200 operations.');
  results.forEach(assertFileOperationReport);
  const counts = { succeeded: 0, failed: 0, cancelled: 0 };
  for (const report of results) {
    if (report.state === 'succeeded') counts.succeeded++;
    else if (report.state === 'cancelled') counts.cancelled++;
    else counts.failed++;
  }
  return { version: 1, state: counts.succeeded === results.length && results.length > 0 ? 'succeeded' : counts.succeeded ? 'partially_succeeded' : counts.cancelled && !counts.failed ? 'cancelled' : 'failed', results, counts };
}
