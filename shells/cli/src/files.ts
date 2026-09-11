// SPDX-License-Identifier: MPL-2.0
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { readOperationFile, describeOperationFile, runNodeFileOperation, NODE_FILE_TARGETS } from '@lolly-tools/node-shell/file-operations';
import { fileOperationRequestSchemaV1, fileOperationReportSchemaV1 } from '@lolly-tools/core/file-operation-v1';
import { emitResult } from './envelope.ts';
import { writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';

export async function filesCli(args: string[], flags: Record<string, string>, json = false): Promise<void> {
  const [verb, path] = args;
  const emit = async (value: unknown): Promise<void> => { if (json) await emitResult(value); else await writeOut(`${JSON.stringify(value, null, 2)}\n`); };
  if (verb === 'schema') { await emit({ request: fileOperationRequestSchemaV1, report: fileOperationReportSchemaV1, targets: NODE_FILE_TARGETS }); return; }
  if (!path || !['inspect', 'convert'].includes(verb ?? '')) throw usageError('lolly files inspect <file> | files convert <file> --to=jpeg --output=<new-file> [--max-edge=1920 --quality=0.92 --target-bytes=200000] | files schema');
  const file = await readOperationFile(path);
  if (verb === 'inspect') { await emit(await describeOperationFile(file)); return; }
  if (!flags.to || !flags.output) throw usageError('Conversion needs --to=<format> and --output=<new-file>. Existing files are never overwritten.');
  const extension = extname(flags.output).slice(1).toLowerCase();
  if (extension && extension !== flags.to && !(flags.to === 'jpeg' && extension === 'jpg') && !(flags.to.startsWith('pdf-') && extension === 'pdf')) throw usageError('The output extension must match --to (JPEG also accepts .jpg; PDF utilities write .pdf).');
  const controller = new AbortController(); const cancel = (): void => controller.abort(); process.once('SIGINT', cancel);
  try {
    const outcome = await runNodeFileOperation(file, { version: 1, operation: 'convert', target: flags.to, options: { maxEdge: Number(flags['max-edge'] ?? 0), quality: Number(flags.quality ?? .92), background: flags.background ?? '#ffffff', targetBytes: Number(flags['target-bytes'] ?? 0) } }, controller.signal);
    if (outcome.output) {
      outcome.report.outputs[0]!.name = basename(flags.output);
      // Exclusive creation is also safe when output names the original or a symlink.
      const destination = await open(flags.output, 'wx', 0o600);
      try { await destination.writeFile(Buffer.from(await outcome.output.arrayBuffer())); await destination.sync(); }
      finally { await destination.close(); }
    } else process.exitCode = outcome.report.state === 'cancelled' ? 130 : 1;
    await emit(outcome.report);
  } finally { process.removeListener('SIGINT', cancel); }
}
