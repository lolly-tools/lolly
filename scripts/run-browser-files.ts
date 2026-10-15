// SPDX-License-Identifier: MPL-2.0
/** Preserve browser file order while retaining isolated, serial node:test execution. */

import path from 'node:path';
import { run } from 'node:test';
import { pathToFileURL } from 'node:url';
import skipIdentityReporter from '../tests/reporters/skip-identities.ts';

export async function main(files = process.argv.slice(2)): Promise<number> {
  if (!files.length || new Set(files).size !== files.length) throw new Error('browser execution requires distinct files');
  let failed = false;
  let completed = false;
  // The CLI sorts filenames. The API preserves this explicit order, inherits the
  // launcher preloads/environment, and emits the same events to our reporter.
  const events = run({ files, concurrency: 1, isolation: 'process', setup(stream) {
    stream.on('test:fail', () => { failed = true; });
    stream.on('test:summary', (summary) => {
      if (!summary.file) { completed = true; failed ||= !summary.success; }
    });
  } });
  for await (const line of skipIdentityReporter(events)) process.stdout.write(line);
  return completed && !failed ? 0 : 1;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = await main();
