// SPDX-License-Identifier: MPL-2.0
/**
 * The wait for the web shell's WebGPU startup check (src/shell-startup.ts), which the
 * render driver and the browser tests' `shellSettled` share. It must outlast the shell's
 * own device budget under automation, or a view wait after it races that budget again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Page } from 'playwright-core';
import { SHELL_STARTUP_TIMEOUT_MS, waitForShellStartup } from '../src/shell-startup.ts';

const DEVICE = new URL('../../../shells/web/src/lib/webgpu/device.ts', import.meta.url);

test('the startup wait outlasts the shell\'s device budget under automation', () => {
  const budget = /const AUTOMATION_BUDGET_MS = (\d+);/.exec(readFileSync(DEVICE, 'utf8'));
  assert.ok(budget, 'device.ts still states its automation budget');
  assert.ok(SHELL_STARTUP_TIMEOUT_MS > Number(budget[1]), `${SHELL_STARTUP_TIMEOUT_MS} ms must exceed ${budget[1]} ms`);
});

/** A page whose `waitForFunction` runs the predicate against a document the test sets. */
function fakePage(doc: { webgpu?: string; loading: boolean }) {
  const calls: Array<{ timeout?: number }> = [];
  const page = {
    async waitForFunction(fn: () => unknown, _arg: unknown, options: { timeout?: number }) {
      calls.push(options);
      const g = globalThis as Record<string, unknown>;
      g.document = {
        documentElement: { dataset: doc.webgpu ? { webgpu: doc.webgpu } : {} },
        querySelector: (selector: string) => (selector === 'dialog.view-loading[open]' && doc.loading ? {} : null),
      };
      try {
        const value = fn();
        if (!value) throw new Error('still waiting');
        return { jsonValue: async () => value };
      } finally { delete g.document; }
    },
  };
  return { page: page as unknown as Page, calls };
}

test('the wait holds until the check settles and no loading card is open', async () => {
  await assert.rejects(waitForShellStartup(fakePage({ loading: true }).page), /still waiting/, 'no check result yet');
  await assert.rejects(waitForShellStartup(fakePage({ webgpu: 'ready', loading: true }).page), /still waiting/, 'the view is still loading');
  const ready = fakePage({ webgpu: 'ready', loading: false });
  assert.equal(await waitForShellStartup(ready.page), 'ready');
  assert.equal(ready.calls[0]!.timeout, SHELL_STARTUP_TIMEOUT_MS, 'the default budget');
  assert.equal(await waitForShellStartup(fakePage({ webgpu: 'unsupported', loading: false }).page), 'unsupported', 'a failed check is reported, not waited out');
  const custom = fakePage({ webgpu: 'ready', loading: false });
  await waitForShellStartup(custom.page, 5_000);
  assert.equal(custom.calls[0]!.timeout, 5_000);
});
