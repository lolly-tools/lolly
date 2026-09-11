// SPDX-License-Identifier: MPL-2.0
/** One result means both conversion AND durable storage succeeded. */
import { assertFileOperationReport, type FileOperationRequestV1 } from '@lolly-tools/core/file-operation-v1';
import type { FileFactsV1, FileOperationReportV1 } from '@lolly-tools/core/file-v1';
import type { FileOperationStore } from './file-operation-store.ts';
import { declaredFileFacts, type FileBatchLink } from './file-batch-store.ts';

interface SavedOperationDeps {
  store(): Promise<Pick<FileOperationStore, 'begin' | 'finish' | 'abandon' | 'heartbeat'>>;
  describe(file: File, signal?: AbortSignal): Promise<FileFactsV1>;
  execute(file: File, request: FileOperationRequestV1, signal?: AbortSignal, name?: string): Promise<{ report: FileOperationReportV1; output?: File }>;
}
export function incompleteFileReport(file: File, request: FileOperationRequestV1, state: 'failed' | 'cancelled', code: string, message: string, input?: FileFactsV1): FileOperationReportV1 {
  const report: FileOperationReportV1 = { version: 1, operation: request.operation, state,
    inputs: [input ?? declaredFileFacts(file)],
    outputs: [], options: { ...request.options, target: request.target }, changes: [], metadata: 'not-checked', execution: 'device',
    findings: [{ code, severity: state === 'cancelled' ? 'info' : 'error', message: message.slice(0, 4096) }] };
  assertFileOperationReport(report); return report;
}

export async function runSavedFileOperation(file: File, request: FileOperationRequestV1, deps: SavedOperationDeps, signal?: AbortSignal, name?: string, batchLink?: FileBatchLink): Promise<{ report: FileOperationReportV1; output?: File }> {
  if (signal?.aborted) return { report: incompleteFileReport(file, request, 'cancelled', 'not-started', 'Cancelled before this file started. Its bytes were not read or changed.') };
  let input: FileFactsV1 | undefined;
  let store: Awaited<ReturnType<SavedOperationDeps['store']>> | undefined;
  let id: string | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let saving = false;
  try {
    input = await deps.describe(file, signal); signal?.throwIfAborted();
    store = await deps.store(); signal?.throwIfAborted();
    const record = await store.begin(input, request, undefined, batchLink); id = record.id;
    heartbeat = setInterval(() => { void store!.heartbeat(id!).catch(() => {}); }, 30_000);
    signal?.throwIfAborted();
    const executed = await deps.execute(file, request, signal, name);
    // A codec may fail its own second read before collecting input facts. Keep
    // the facts already measured for this reservation, including the digest;
    // an empty-input receipt would otherwise lose the batch's source identity.
    const outcome = executed.report.inputs.length ? executed : { ...executed, report: { ...executed.report, inputs: [input] } };
    // A cancellation arriving after encoding must not promote its bytes to saved output.
    if (signal?.aborted && outcome.output) throw signal.reason ?? new Error('Cancelled.');
    saving = true;
    await store.finish(id, outcome.report, outcome.output);
    return outcome;
  } catch (error) {
    const cancelled = !saving && Boolean(signal?.aborted);
    const report = incompleteFileReport(file, request, cancelled ? 'cancelled' : 'failed', saving ? 'result-not-saved' : cancelled ? 'operation-cancelled' : id ? 'operation-failed' : 'operation-not-started',
      error instanceof Error ? error.message : String(error), input);
    if (id && store) await store.abandon(id, report.findings[0]!.message, report).catch(() => {});
    return { report };
  } finally { if (heartbeat) clearInterval(heartbeat); }
}
