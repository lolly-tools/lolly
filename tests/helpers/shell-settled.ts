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
 * this after a `goto` or `reload` that waited for `networkidle`.
 */
import type { Page } from 'playwright-core';

export async function shellSettled(page: Page, timeout = 60_000): Promise<void> {
  await page.waitForFunction(
    () => !!document.documentElement.dataset.webgpu && !document.querySelector('dialog.view-loading[open]'),
    undefined,
    { timeout },
  );
}
