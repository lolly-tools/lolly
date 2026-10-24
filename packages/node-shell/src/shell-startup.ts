// SPDX-License-Identifier: MPL-2.0
/**
 * Wait for the web shell's WebGPU startup check (plan 295) before waiting for a tool view.
 *
 * The shell holds every route that can run a tool behind a modal loading card until the
 * check settles, and under automation the device may take up to 30 s to arrive
 * (`AUTOMATION_BUDGET_MS` in shells/web/src/lib/webgpu/device.ts). A driver or a test
 * that waits 30 s for the tool view straight after navigating races that budget: on a
 * busy machine a slow adapter start uses up the wait while the view is still about to
 * mount, and the failure reads as a missing element. So wait for the check first, with
 * a budget longer than the device's own, and only then give the view its usual timeout.
 *
 * The signal is `<html data-webgpu>`, which shells/web/src/main.ts sets to `ready` or
 * `unsupported` when the check settles, together with no open `dialog.view-loading`.
 * Both are read in the page, so the wait holds across hash navigations, and a full
 * reload starts it again.
 */
import type { Page } from 'playwright-core';

/** Longer than the shell's own 30 s device budget under automation, so the check settles first. */
export const SHELL_STARTUP_TIMEOUT_MS = 60_000;

/** How the startup check settled: a device, or the unsupported-environment card. */
export type ShellStartup = 'ready' | 'unsupported';

/** Resolve once the startup check has settled and no loading card is open. */
export async function waitForShellStartup(page: Page, timeout = SHELL_STARTUP_TIMEOUT_MS): Promise<ShellStartup> {
  const settled = await page.waitForFunction(
    () => {
      const state = document.documentElement.dataset.webgpu;
      return state && !document.querySelector('dialog.view-loading[open]') ? state : null;
    },
    undefined,
    { timeout, polling: 100 },
  );
  return (await settled.jsonValue()) === 'ready' ? 'ready' : 'unsupported';
}
