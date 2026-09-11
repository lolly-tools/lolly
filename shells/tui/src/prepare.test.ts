// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createElement, type ComponentType } from 'react';
import { render } from 'ink-testing-library';
import { transform } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { createMockHost } from '../../../packages/core/src/mock-host.ts';
import type { TuiBridge } from './bridge.ts';
async function component(): Promise<ComponentType<{ bridge: TuiBridge; onBack: () => void }>> {
  const source = new URL('./views/Prepare.tsx', import.meta.url), fixture = new URL(`./views/.prepare-test-${randomUUID()}.mjs`, import.meta.url);
  const { code } = await transform(await readFile(source, 'utf8'), { loader: 'tsx', jsx: 'automatic', format: 'esm' });
  try { await writeFile(fixture, code); return (await import(fixture.href)).Prepare; }
  finally { await rm(fixture, { force: true }); }
}
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 30));
async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i++) { if (check()) return; await tick(); }
  assert.fail('The expected terminal state did not appear.');
}
test('terminal keyboard flow keeps findings optional and writes reviewed copies on a narrow terminal', async () => {
  const Prepare = await component();
  const directory = await mkdtemp(join(tmpdir(), 'lolly-prepare-tui-'));
  const dom = new JSDOM(), host = createMockHost();
  const bridge: TuiBridge = { host, dom, logs: [] };
  const ui = render(createElement(Prepare, { bridge, onBack: () => {} }));
  Object.defineProperty(ui.stdout, 'columns', { value: 48, configurable: true }); ui.stdout.emit('resize');
  try {
    const input = join(directory, 'source.txt'); await writeFile(input, 'password=keep-this-value');
    await tick(); ui.stdin.write(input); await tick(); ui.stdin.write('\r'); await tick(); ui.stdin.write('\r');
    await until(() => Boolean(ui.lastFrame()?.includes('occurrences')));
    assert(!ui.lastFrame()!.includes('keep-this-value'));
    ui.stdin.write('k'); await tick(); ui.stdin.write('\r');
    await until(() => Boolean(ui.lastFrame()?.includes('Copies ready')));
    ui.stdin.write('d'); await tick(); ui.stdin.write(join(directory, 'out')); await tick(); ui.stdin.write('\r');
    await until(() => Boolean(ui.lastFrame()?.includes('1/1 copies saved')));
    assert.equal(await readFile(join(directory, 'out', 'file0-source.txt'), 'utf8'), 'password=keep-this-value');
    assert.equal(host.inspect.state.size, 0); assert.equal(bridge.logs.length, 0);
  } finally { ui.unmount(); ui.cleanup(); dom.window.close(); await rm(directory, { recursive: true, force: true }); }
});
