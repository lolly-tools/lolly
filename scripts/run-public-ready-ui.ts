// SPDX-License-Identifier: MPL-2.0
/** Run the short UI regression set before the exhaustive web and browser suites. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_READY_UI_FILES = [
  'tests/chrome-tokens.test.ts',
  'shells/web/src/lib/lolly-ui-tokens.test.ts',
  'shells/web/src/lib/edge-dock.test.ts',
  'shells/web/src/primitive-guards.test.ts',
  'shells/web/src/views/design-navigator.test.ts',
] as const;

export function runPublicReadyUi(): number {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const temporary = mkdtempSync(join(tmpdir(), 'lolly-public-ready-ui-'));
  const skipReport = join(temporary, 'skips.json'), started = Date.now();
  try {
    const child = spawnSync(process.execPath, ['--import', './tests/css-stub.mjs', '--test', '--test-reporter=./tests/reporters/skip-identities.ts', ...PUBLIC_READY_UI_FILES],
      { cwd: root, stdio: 'inherit', env: { ...process.env, LOLLY_SKIP_REPORT: skipReport,
        LOLLY_TEST_COVERAGE_METADATA: '', LOLLY_TEST_COVERAGE_REPORT: '' }, timeout: 120000 });
    if (child.error) throw child.error;
    if (child.status !== 0) return child.status ?? 1;
    const skipped = JSON.parse(readFileSync(skipReport, 'utf8')) as { schemaVersion?: number; skips?: unknown[] };
    if (skipped.schemaVersion !== 1 || !Array.isArray(skipped.skips) || skipped.skips.length) throw new Error('Focused UI tests cannot skip');
    const report = { version: 1, status: 'PASSED', files: PUBLIC_READY_UI_FILES, skippedTests: 0,
      elapsedSeconds: (Date.now() - started) / 1000, browserRequired: false, fullSuiteQualified: false };
    if (process.env.LOLLY_PUBLIC_READY_UI_REPORT) {
      const output = resolve(process.env.LOLLY_PUBLIC_READY_UI_REPORT); mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    }
    console.error(`Public-ready UI checks: ${PUBLIC_READY_UI_FILES.length} files, zero skips, ${report.elapsedSeconds}s`);
    return 0;
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = runPublicReadyUi();
