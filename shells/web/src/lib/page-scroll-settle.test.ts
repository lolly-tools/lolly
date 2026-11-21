// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGE_SCROLL_EVENT, settlePageScroll } from './page-scroll-settle.ts';

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
const globals = globalThis as unknown as { window?: unknown; navigator?: unknown };

function withShell(userAgent: string, invoke: Invoke | null, run: (events: unknown[]) => Promise<void>): Promise<void> {
  const before = { window: globals.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const events: unknown[] = [];
  globals.window = { ...(invoke ? { __TAURI_INTERNALS__: { invoke } } : {}), dispatchEvent: (e: { detail: unknown }) => { events.push(e.detail); return true; } };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent, maxTouchPoints: 5 }, configurable: true });
  return run(events).finally(() => {
    globals.window = before.window;
    if (before.navigator) Object.defineProperty(globalThis, 'navigator', before.navigator);
  });
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) AppleWebKit/605.1.15';
const reading = { read: true, offsetY: -511, insetTop: 0, adjustedTop: 0, contentHeight: 3000, boundsHeight: 956, frameY: 0, busy: false, fixed: true };

test('the iPhone shell is asked to settle the page, and the reading is announced', async () => {
  const calls: Array<[string, unknown]> = [];
  await withShell(IPHONE, async (cmd, args) => { calls.push([cmd, args]); return reading; }, async (events) => {
    settlePageScroll('gallery');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(calls[0], ['page_scroll_settle', { fix: true }]);
    assert.deepEqual(events[0], { reason: 'gallery', ...reading });
    assert.equal(PAGE_SCROLL_EVENT, 'lolly:page-scroll');
  });
});

test('the same view is read again once laid out', async () => {
  let calls = 0;
  await withShell(IPHONE, async () => { calls++; return { ...reading, fixed: false }; }, async () => {
    settlePageScroll('docs');
    await new Promise((resolve) => setTimeout(resolve, 1300));
    assert.equal(calls, 3);
  });
});

test('a browser, a desktop shell and an older phone shell are left alone', async () => {
  await withShell(IPHONE, null, async (events) => { settlePageScroll('gallery'); assert.equal(events.length, 0); });
  let asked = 0;
  await withShell('Mozilla/5.0 (X11; Linux x86_64)', async () => { asked++; return reading; }, async () => {
    settlePageScroll('gallery');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(asked, 0);
  });
  await withShell(IPHONE, async () => { throw new Error('unknown command'); }, async (events) => {
    settlePageScroll('gallery');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(events.length, 0);
  });
});

test('the native command only moves a page that is at rest and out of place', () => {
  const rust = readFileSync(new URL('../../../tauri-mobile/src-tauri/src/page_scroll.rs', import.meta.url), 'utf8');
  assert.match(rust, /if !fix \|\| busy \{\s*return before;/);
  assert.match(rust, /offset\.y < -adjusted\.top - SLACK/);
  assert.match(readFileSync(new URL('../../../tauri-mobile/src-tauri/src/lib.rs', import.meta.url), 'utf8'), /page_scroll::page_scroll_settle/);
});
