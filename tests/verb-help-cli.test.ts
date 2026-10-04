// SPDX-License-Identifier: MPL-2.0
/**
 * `--help` on the document verbs (plan 291 M4): `lolly read`, `lolly check`,
 * `lolly package`, `lolly measure` and `lolly run <session.lolly>` each print help of
 * their own, naming every flag the verb takes, its input forms and its exit codes, the
 * way tests/compose-cli.test.ts pins `lolly compose --help`. A flag added to a verb's
 * set without a line in its help fails here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  CHECK_BOOL_FLAGS, CHECK_VALUE_FLAGS, MEASURE_BOOL_FLAGS, MEASURE_VALUE_FLAGS, PACKAGE_BOOL_FLAGS, PACKAGE_VALUE_FLAGS, READ_BOOL_FLAGS, READ_VALUE_FLAGS,
} from '../shells/cli/src/args.ts';
import { SESSION_RUN_FLAGS } from '../shells/cli/src/design-session.ts';
import { CHECK_HELP, MEASURE_HELP, PACKAGE_HELP, READ_HELP, SESSION_RUN_HELP, verbHelp } from '../shells/cli/src/verb-help.ts';

const root = resolve(import.meta.dirname, '..');
const GLOBAL = new Set(['quiet', 'verbose', 'strict', 'json']);

const VERBS: Array<{ name: string; help: string; flags: readonly string[]; head: RegExp; argv: string[] }> = [
  { name: 'read', help: READ_HELP, flags: [...READ_VALUE_FLAGS, ...READ_BOOL_FLAGS, 'json'], head: /^lolly read: /, argv: ['read', '--help'] },
  { name: 'check', help: CHECK_HELP, flags: [...CHECK_VALUE_FLAGS, ...CHECK_BOOL_FLAGS, 'strict', 'json'], head: /^lolly check: /, argv: ['check', '--help'] },
  { name: 'package', help: PACKAGE_HELP, flags: [...PACKAGE_VALUE_FLAGS, ...PACKAGE_BOOL_FLAGS, 'json'], head: /^lolly package: /, argv: ['package', '-h'] },
  { name: 'measure', help: MEASURE_HELP, flags: [...MEASURE_VALUE_FLAGS, ...MEASURE_BOOL_FLAGS, 'json'], head: /^lolly measure: /, argv: ['measure', '--text', '--help'] },
  { name: 'run <session.lolly>', help: SESSION_RUN_HELP, flags: [...SESSION_RUN_FLAGS].filter((f) => !GLOBAL.has(f)), head: /^lolly run <session\.lolly>: /, argv: ['run', 'deck.lolly', '--help'] },
];

test('each document verb\'s help names every flag it takes, its input forms and its exit codes', () => {
  for (const verb of VERBS) {
    for (const flag of verb.flags) assert.match(verb.help, new RegExp(`--${flag}\\b`), `lolly ${verb.name} --help does not show --${flag}`);
    assert.match(verb.help, /^Usage:$/m, `lolly ${verb.name} --help has no usage`);
    assert.match(verb.help, /^Input:$/m, `lolly ${verb.name} --help does not say what it reads`);
    assert.match(verb.help, /^Exit codes:\n {2}0 /m, `lolly ${verb.name} --help does not list its exit codes`);
    assert.doesNotMatch(verb.help, /[—§]/, 'no em dash or section sign');
  }
});

test('verbHelp picks the verb from argv, and run only on a session file', () => {
  assert.equal(verbHelp(['check', '--help']), CHECK_HELP);
  assert.equal(verbHelp(['help', 'read']), READ_HELP);
  assert.equal(verbHelp(['--json', 'package', '--help']), PACKAGE_HELP);
  assert.equal(verbHelp(['run', 'x.LOLLY', '-h']), SESSION_RUN_HELP);
  assert.equal(verbHelp(['run', 'qr-code', '--help']), null);
  assert.equal(verbHelp(['--help']), null);
});

test('lolly <verb> --help prints the verb\'s own help, not the global usage (exit 0)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-verb-help-'));
  try {
    const env = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1' };
    for (const verb of VERBS) {
      const run = spawnSync(process.execPath, [join(root, 'shells/cli/bin/lolly.ts'), ...verb.argv], { env, encoding: 'utf8', cwd: dir });
      assert.equal(run.status, 0, `${verb.argv.join(' ')}: ${run.stderr}`);
      assert.match(run.stdout, verb.head, `${verb.argv.join(' ')} printed the global help`);
    }
    const global = spawnSync(process.execPath, [join(root, 'shells/cli/bin/lolly.ts'), '--help'], { env, encoding: 'utf8', cwd: dir });
    assert.match(global.stdout, /^lolly - /, 'plain --help keeps the global usage');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
