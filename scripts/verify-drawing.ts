// SPDX-License-Identifier: MPL-2.0
/** Drawing operations: the compiler's own tests, the preview built on them, and fidelity against the Design renderer in Chromium. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const run = (args: string[]): boolean => {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, LOLLY_FIDELITY_REQUIRED: '1' } });
  if (result.error) throw result.error;
  return result.status === 0;
};
if (!run(['--test', 'tests/design-draw.test.ts', 'tests/frame-preview-svg.test.ts'])
  || !run(['--test', 'tests/design-draw-fidelity.browser.test.ts'])) process.exitCode = 1;
