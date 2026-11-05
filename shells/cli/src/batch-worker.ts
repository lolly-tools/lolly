// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { parseBatchCsv } from '@lolly/engine';
import { runBatchCli } from './batch.ts';
import { keepConsoleOffStdout, configureOutput, strictExitCode } from './output.ts';
import { beginCommand } from './envelope.ts';
import { closeBrowser } from '@lolly-tools/node-shell/browsers';
import { closeWebShell } from '@lolly-tools/node-shell/webshell-render';

async function close(): Promise<void> {
  await Promise.all([closeBrowser(), closeWebShell()]);
}
process.once('SIGTERM', () => {
  void close().finally(() => process.exit(143));
});
keepConsoleOffStdout();
configureOutput({ strict: process.argv.includes('--strict') });
try {
  if (process.argv[4] === '--preflight') {
    beginCommand('preflight', true);
    const row = parseBatchCsv(await readFile(process.argv[2]!, 'utf8'))[0]!;
    const flags: Record<string, string> = {
      ...row.params,
      json: '1',
      ...(process.argv.includes('--strict') ? { strict: '1' } : {}),
    };
    if (row.format) flags.export = row.format;
    for (const key of ['width', 'height', 'unit', 'dpi'] as const)
      if (row[key] !== undefined) flags[key] = String(row[key]);
    if (flags.c2pa === undefined && flags.imprint === undefined && flags.durable === undefined)
      flags['no-provenance'] = '1';
    const { preflightCli } = await import('./preflight.ts');
    process.exitCode = await preflightCli([row.toolId], flags);
  } else {
    beginCommand('batch', true);
    process.exitCode = await runBatchCli(process.argv[2]!, {
      outDir: process.argv[3]!,
      json: true,
    });
  }
  process.exitCode = strictExitCode() ?? process.exitCode;
} finally {
  await close();
}
