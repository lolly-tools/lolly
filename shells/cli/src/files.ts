// SPDX-License-Identifier: MPL-2.0
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { readOperationFile, describeOperationFile, runNodeFileOperation, NODE_FILE_TARGETS } from '@lolly-tools/node-shell/file-operations';
import { fileOperationRequestSchemaV1, fileOperationReportSchemaV1 } from '@lolly-tools/core/file-operation-v1';
import { emitResult } from './envelope.ts';
import { writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';
import { isOn } from './args.ts';

/** The data conversion choices, passed only when given. --sheet stays text: the
 *  engine matches a worksheet name first and reads digits that match no name as
 *  a 0-based position, so --sheet=2024 finds a sheet named 2024. */
function dataFlags(flags: Record<string, string>, allSheets: boolean): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (flags.sheet !== undefined) out.sheet = flags.sheet;
  if (allSheets) out.allSheets = true;
  for (const key of ['cells', 'delimiter', 'encoding', 'header']) if (flags[key] !== undefined) out[key] = flags[key]!;
  return out;
}

export async function filesCli(args: string[], flags: Record<string, string>, json = false): Promise<void> {
  const [verb, path] = args;
  const emit = async (value: unknown): Promise<void> => { if (json) await emitResult(value); else await writeOut(`${JSON.stringify(value, null, 2)}\n`); };
  if (verb === 'schema') { await emit({ request: fileOperationRequestSchemaV1, report: fileOperationReportSchemaV1, targets: NODE_FILE_TARGETS }); return; }
  if (!path || !['inspect', 'convert'].includes(verb ?? '')) throw usageError('lolly files inspect <file> | files convert <file> --to=jpeg --output=<new-file> [--max-edge=1920 --quality=0.92 --target-bytes=200000] [--sheet=<name|position, 0 for the first> | --all-sheets] [--cells=cached|formulas] [--delimiter=auto|comma|semicolon|tab|pipe] [--encoding=auto|utf-8|windows-1252|...] [--header=first-row|none|generate] | files schema');
  const file = await readOperationFile(path);
  if (verb === 'inspect') { await emit(await describeOperationFile(file)); return; }
  if (!flags.to || !flags.output) throw usageError('Conversion needs --to=<format> and --output=<new-file>. Existing files are never overwritten.');
  const extension = extname(flags.output).slice(1).toLowerCase();
  const allSheets = isOn(flags['all-sheets']);
  if (allSheets && extension && extension !== 'zip') throw usageError('--all-sheets writes a ZIP with one file per worksheet; name the output .zip.');
  if (extension && !allSheets && extension !== flags.to && !(flags.to === 'jpeg' && extension === 'jpg') && !(flags.to.startsWith('pdf-') && extension === 'pdf') && !(flags.to.startsWith('jxl') && extension === 'jxl') && !(flags.to === 'jpeg-original' && ['jpg', 'jpeg'].includes(extension))) throw usageError('The output extension must match --to (JPEG also accepts .jpg; PDF utilities write .pdf; JPEG XL modes write .jxl; original JPEG restoration writes .jpg).');
  const controller = new AbortController(); const cancel = (): void => controller.abort(); process.once('SIGINT', cancel);
  try {
    const outcome = await runNodeFileOperation(file, { version: 1, operation: 'convert', target: flags.to, options: { maxEdge: Number(flags['max-edge'] ?? 0), quality: Number(flags.quality ?? .92), background: flags.background ?? '#ffffff', targetBytes: Number(flags['target-bytes'] ?? 0), ...dataFlags(flags, allSheets) } }, controller.signal);
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
