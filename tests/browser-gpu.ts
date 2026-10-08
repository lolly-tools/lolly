// SPDX-License-Identifier: MPL-2.0
/**
 * Explicit software WebGPU for browser conformance on runners without a physical adapter.
 * Both launch routes get the flags: a test that keeps a profile across restarts calls
 * launchPersistentContext, and without an adapter the web shell shows its
 * unsupported-environment card instead of mounting any tool.
 * The flags are the shared list every shipped launcher uses
 * (packages/node-shell/src/webgpu-launch.ts). This preload adds them to launches that
 * do not already carry them, so CI passing here does not by itself show that a
 * launcher passes them; tests/webgpu-launch-args.test.ts pins that per launcher.
 */
import { SOFTWARE_WEBGPU_ARGS } from '../packages/node-shell/src/webgpu-launch.ts';

if (process.env.LOLLY_WEBGPU_TEST_ADAPTER === 'swiftshader') {
  const { chromium } = await import('playwright');
  const withGpu = (args: readonly string[] = []): string[] => [...args, ...SOFTWARE_WEBGPU_ARGS.filter(flag => !args.includes(flag))];
  const launch = chromium.launch.bind(chromium);
  chromium.launch = (options = {}) => launch({ ...options, args: withGpu(options.args) });
  const launchPersistentContext = chromium.launchPersistentContext.bind(chromium);
  chromium.launchPersistentContext = (userDataDir, options = {}) => launchPersistentContext(userDataDir, { ...options, args: withGpu(options.args) });
}
