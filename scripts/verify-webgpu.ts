// SPDX-License-Identifier: MPL-2.0
/** GPU qualification refuses missing browsers/adapters rather than accepting a skipped test. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const result = spawnSync(process.execPath, ['--import', './tests/browser-gpu.ts', '--test', 'tests/webgpu-lut.browser.test.ts'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit',
  env: { ...process.env, LOLLY_WEBGPU_REQUIRED: '1', LOLLY_WEBGPU_REPORT: process.env.LOLLY_WEBGPU_REPORT ?? 'plans/artifacts/295/webgpu-lut-report.json' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
