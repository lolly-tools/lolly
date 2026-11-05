#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0

/**
 * Opt-in check: write sample IMSC1.1 documents with the engine and validate them against
 * the W3C schema with xmllint. A requested run, not part of CI.
 *
 *   node scripts/validate-imsc1.ts --schema <dir-or-file>
 *
 * `--schema` is the IMSC1.1 (or TTML2) XML Schema entry point, for example `ttml2.xsd` or
 * `imsc-text.xsd` from the W3C imsc repository. This script never downloads it: fetch the
 * schema yourself, review it, and pass its path. Without `--schema` it still checks that
 * each sample is well-formed XML and reports that, so a green run is never mistaken for schema
 * validation. Exit 1 when xmllint is missing, a sample is invalid or the schema is absent.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { cuesToTtml } from '../engine/src/captions-ttml.ts';

const argv = process.argv.slice(2);
const at = argv.indexOf('--schema');
const schema = at >= 0 ? argv[at + 1] : undefined;

try {
  execFileSync('xmllint', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('xmllint is not installed. Install libxml2 and run again.');
  process.exit(1);
}
if (schema) {
  try {
    statSync(schema);
  } catch {
    console.error(`Schema not found: ${schema}`);
    process.exit(1);
  }
}

const samples: Record<string, string> = {
  plain: cuesToTtml([{ start: 0, end: 1.5, text: 'Hello' }, { start: 2, end: 4.25, text: 'Two lines\nof text' }]),
  escapes: cuesToTtml([{ start: 3661.001, end: 3662, text: 'A & B <tag> "quoted" éñ 日本' }], { lang: 'ja' }),
  untagged: cuesToTtml([{ start: 0, end: 1, text: 'No language' }], { lang: '' }),
  empty: cuesToTtml([]),
};

const dir = mkdtempSync(path.join(tmpdir(), 'imsc1-'));
let failed = 0;
try {
  for (const [name, xml] of Object.entries(samples)) {
    const file = path.join(dir, `${name}.ttml`);
    writeFileSync(file, xml);
    const args = schema ? ['--noout', '--schema', schema, file] : ['--noout', file];
    const r = spawnSync('xmllint', args, { encoding: 'utf8' });
    if (r.status === 0) console.log(`ok   ${name}${schema ? '' : ' (well-formed only)'}`);
    else {
      failed++;
      console.error(`FAIL ${name}\n${r.stderr}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (!schema) console.log('No --schema given: this was a well-formedness check, not schema validation.');
process.exit(failed ? 1 : 0);
