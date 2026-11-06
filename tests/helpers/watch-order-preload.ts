// SPDX-License-Identifier: MPL-2.0
/**
 * Preload for tests/cli-production-batch.test.ts: records how many file watchers are
 * open each time `lolly batch --watch` says it is waiting, so the test can show that
 * the batch is already listening when the line appears. Appends one count per line to
 * the file named by LOLLY_WATCH_ORDER_LOG.
 */
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const log = process.env.LOLLY_WATCH_ORDER_LOG;
if (log) {
  let open = 0;
  const watch = fs.watch;
  fs.watch = ((...args: Parameters<typeof fs.watch>) => {
    const watcher = watch(...args);
    open += 1;
    watcher.once('close', () => { open -= 1; });
    return watcher;
  }) as typeof fs.watch;
  syncBuiltinESMExports();
  const write = process.stderr.write.bind(process.stderr) as (chunk: unknown, ...rest: unknown[]) => boolean;
  process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
    if (/Watching the CSV|Waiting for the CSV to change/.test(String(chunk))) fs.appendFileSync(log, `${open}\n`);
    return write(chunk, ...rest);
  }) as typeof process.stderr.write;
}
