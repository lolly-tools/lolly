// SPDX-License-Identifier: MPL-2.0
/** The capture policy of tests/helpers/settled-screenshot.ts, against a scripted page. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPTURE_ATTEMPTS, isUnavailableCapture, settledScreenshot } from './helpers/settled-screenshot.ts';

// The message Chromium's DevTools page handler returns when its surface copy comes back empty,
// as the browser client reports it (CI runs 39929715440 and 39947902123).
const refusal = () => new Error('page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot');

/** A page whose captures follow `outcomes` in order; `calls` records what the helper asked for. */
function scriptedPage(outcomes: Array<Buffer | Error>) {
  const calls: string[] = [];
  return {
    calls,
    page: {
      evaluate: async () => { calls.push('wait'); },
      screenshot: async () => {
        calls.push('capture');
        const next = outcomes.shift();
        if (!next) throw new Error('unexpected extra capture');
        if (next instanceof Error) throw next;
        return next;
      },
    } as unknown as Parameters<typeof settledScreenshot>[0],
  };
}

test('a capture waits for fonts and a presented frame first', async () => {
  const shot = Buffer.from('png');
  const { page, calls } = scriptedPage([shot]);
  assert.equal(await settledScreenshot(page, {}), shot);
  assert.deepEqual(calls, ['wait', 'wait', 'capture'], 'fonts, then a presented frame, then the capture');
});

test('only the empty-surface refusal is retried, each time after another presented frame', async () => {
  const shot = Buffer.from('png');
  const { page, calls } = scriptedPage([refusal(), refusal(), shot]);
  const retries: number[] = [];
  assert.equal(await settledScreenshot(page, {}, { onRetry: attempt => retries.push(attempt) }), shot);
  assert.deepEqual(retries, [1, 2]);
  assert.deepEqual(calls, ['wait', 'wait', 'capture', 'wait', 'capture', 'wait', 'capture']);
});

test('the retry is bounded and then reports the refusal itself', async () => {
  const { page, calls } = scriptedPage(Array.from({ length: CAPTURE_ATTEMPTS }, refusal));
  await assert.rejects(settledScreenshot(page, {}), /Unable to capture screenshot/);
  assert.equal(calls.filter(call => call === 'capture').length, CAPTURE_ATTEMPTS);
});

test('every other failure is thrown at once, never retried', async () => {
  for (const error of [new Error('page.screenshot: Timeout 30000ms exceeded.'), new Error('Target page, context or browser has been closed'),
    new Error('Unable to capture screenshot'), new Error('expected pixels to match')]) {
    const { page, calls } = scriptedPage([error, Buffer.from('never reached')]);
    await assert.rejects(settledScreenshot(page, {}), error);
    assert.equal(calls.filter(call => call === 'capture').length, 1, error.message);
  }
});

test('the refusal is recognised only as Chromium reports it', () => {
  assert.equal(isUnavailableCapture(refusal()), true);
  for (const value of [new Error('Unable to capture screenshot'), new Error('Protocol error (Page.navigate): Unable to capture screenshot'),
    'page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot', undefined, null]) {
    assert.equal(isUnavailableCapture(value), false, String(value));
  }
});
