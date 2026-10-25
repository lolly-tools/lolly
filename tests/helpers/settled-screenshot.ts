// SPDX-License-Identifier: MPL-2.0
/**
 * Reference screenshots for the WebGPU fidelity tests, which open many short-lived pages
 * beside a long-lived SwiftShader probe page in one browser.
 *
 * Chromium answers Page.captureScreenshot with "Unable to capture screenshot" only when its
 * copy of the compositor surface comes back empty (ScreenshotCaptured in
 * content/browser/devtools/protocol/page_handler.cc): no presented frame was there to copy.
 * A clipped capture first re-emulates the viewport, resizes the view to the clip and forces a
 * redraw, so on a loaded CI runner the first capture of a freshly opened page can find no
 * frame yet. That refusal says nothing about the pixels. So a capture waits for fonts and a
 * presented frame first, and only that refusal is retried, a bounded number of times, each
 * after another presented frame. Every other error is thrown unchanged, and the callers'
 * pixel comparisons are not touched.
 */
import type { Page } from 'playwright';

type ScreenshotOptions = NonNullable<Parameters<Page['screenshot']>[0]>;

/** Captures in all, including the first; a third refusal in a row fails the test. */
export const CAPTURE_ATTEMPTS = 3;
/** Longest wait for a presented frame before capturing anyway; the capture then reports what it finds. */
const FRAME_WAIT_MS = 2_000;
const UNAVAILABLE = /Page\.captureScreenshot\): Unable to capture screenshot/;

/** True only for Chromium's empty-surface refusal. A timeout, a closed page or anything else is not retried. */
export function isUnavailableCapture(error: unknown): boolean {
  return error instanceof Error && UNAVAILABLE.test(error.message);
}

/** Resolves once the page has begun two animation frames, so a frame was presented after the call. */
export async function presentedFrame(page: Pick<Page, 'evaluate'>): Promise<void> {
  await page.evaluate(limit => new Promise<void>(resolve => {
    const timer = setTimeout(resolve, limit);
    requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(); }));
  }), FRAME_WAIT_MS);
}

/**
 * Waits for the page's fonts and a presented frame, then captures. Only Chromium's
 * "Unable to capture screenshot" protocol error is retried, at most `attempts` captures in
 * all; `onRetry` hears about each retry so the run records how often it happens.
 */
export async function settledScreenshot(
  page: Pick<Page, 'evaluate' | 'screenshot'>,
  options: ScreenshotOptions,
  { attempts = CAPTURE_ATTEMPTS, onRetry }: { attempts?: number; onRetry?: (attempt: number, error: Error) => void } = {},
): Promise<Buffer> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  for (let attempt = 1; ; attempt++) {
    await presentedFrame(page);
    try {
      return await page.screenshot(options);
    } catch (error) {
      if (!isUnavailableCapture(error) || attempt >= attempts) throw error;
      onRetry?.(attempt, error as Error);
    }
  }
}
