// SPDX-License-Identifier: MPL-2.0
/**
 * Wait until a function run in the page returns a truthy value, when that function is
 * async: it reads IndexedDB, imports a module or reads the clipboard.
 *
 * Do not pass an async function to `page.waitForFunction`. Playwright polls the
 * predicate and stops at the first truthy return, and the promise an async predicate
 * returns is truthy, so the wait ends after one call whatever the promise resolves to.
 * The wait then checks once and moves on, and the step after it races the condition it
 * was meant to wait for. `tests/playwright-async-predicate.test.ts` refuses that form.
 *
 * This runs the function with `page.evaluate`, which does wait for the promise, and asks
 * again until the answer is truthy or the time is up.
 */
import type { Page } from 'playwright-core';

export interface PagePollOptions {
  /** How long to keep asking, in ms. Default 30 s. */
  timeout?: number;
  /** The pause between two asks, in ms. Default 100. */
  interval?: number;
  /** Shown in the timeout error, to say which condition was never met. */
  message?: string;
}

/** Ask the page until `fn(arg)` resolves truthy; returns that value. */
export async function pollPage<R, A = undefined>(
  page: Page, fn: (arg: A) => R | Promise<R>, arg?: A, opts: PagePollOptions = {},
): Promise<R> {
  const timeout = opts.timeout ?? 30_000;
  const interval = opts.interval ?? 100;
  const deadline = Date.now() + timeout;
  for (;;) {
    // Playwright types the argument as it arrives in the page (`Unboxed<A>`); here it is
    // plain data, so the function is passed as one that takes any argument.
    const value = await page.evaluate(fn as (arg: unknown) => R | Promise<R>, arg as unknown);
    if (value) return value as R;
    if (Date.now() >= deadline) throw new Error(`pollPage: ${opts.message ?? 'the page condition'} was not met within ${timeout} ms`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}
