// SPDX-License-Identifier: MPL-2.0
/**
 * Wait until the web shell has settled its WebGPU startup check and no route is still
 * waiting behind the loading card (plan 295).
 *
 * Network idleness is not that signal. The check runs alongside boot, and every route
 * that can run a tool waits for it under a modal loading card; on a software adapter
 * the check can take seconds with no network traffic at all, so `networkidle` can fire
 * first. A test that then injects markup, presses keys or scrolls is acting on a page
 * whose view has not mounted, behind a modal that makes everything else inert. Call
 * this after a `goto` or `reload` that waited for `networkidle`, and after opening a
 * tool route before a locator wait with the usual 30 s timeout: the shell's device
 * budget under automation is 30 s too, so that wait can run out while the view is still
 * about to mount.
 *
 * The wait itself is the render driver's (packages/node-shell/src/shell-startup.ts), so
 * the browser tests and the CLI's browser tier read the same signal with the same budget.
 */
import type { Page } from 'playwright-core';
import { SHELL_STARTUP_TIMEOUT_MS, waitForShellStartup } from '../../packages/node-shell/src/shell-startup.ts';

export async function shellSettled(page: Page, timeout = SHELL_STARTUP_TIMEOUT_MS): Promise<void> {
  await waitForShellStartup(page, timeout);
}
