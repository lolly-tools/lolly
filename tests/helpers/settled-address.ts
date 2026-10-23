// SPDX-License-Identifier: MPL-2.0
/**
 * The address a tool page holds once the web shell has written every change it was
 * holding back.
 *
 * A tool writes its address once its paints go quiet (about 400 ms after the last
 * one), and the stage view 300 ms after it stops moving, so `page.url()` read straight
 * after an edit can be the address from before the edit. The DOM a test waits on is
 * drawn before that write. This helper waits on the shell's own record of waiting
 * writes, `window.__lollyAddressSettled` (lib/url-state.ts, exposed only to an
 * automated browser), and returns `location.href` from the page. It never sleeps for a
 * fixed time and never forces a write early.
 */
import type { Page } from 'playwright-core';

export async function settledUrl(page: Page, timeout = 30_000): Promise<string> {
  const href = await page.evaluate(async (ms) => {
    const hook = (window as unknown as { __lollyAddressSettled?: () => Promise<void> }).__lollyAddressSettled;
    if (!hook) return null;
    let timer = 0;
    try {
      await Promise.race([
        hook(),
        new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error(`the address was still being written after ${ms} ms`)), ms); }),
      ]);
    } finally { window.clearTimeout(timer); }
    return location.href;
  }, timeout);
  if (href === null) throw new Error('settledUrl: the page has no __lollyAddressSettled hook (not the web shell, or navigator.webdriver is off)');
  return href;
}
