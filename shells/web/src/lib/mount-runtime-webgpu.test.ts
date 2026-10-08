// SPDX-License-Identifier: MPL-2.0
// The WebGPU requirement at the one place every web-shell tool runtime is created
// (plan 295, section 2). The gallery, utilities and docs paint before the startup
// check settles and start tools of their own (gallery previews, paged tiles, motion
// template cards), so the wait belongs to the runtime chokepoint, not to each caller.
//
// Its own file because the startup check is per page: once started here it stays
// started for this process, which the other mount-runtime tests must not inherit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Release = (adapter: null) => void;
let releaseAdapter: Release | undefined;
let adapterRequests = 0;
// A held adapter request, as on a machine whose software adapter takes seconds.
Object.defineProperty(globalThis.navigator, 'gpu', {
  configurable: true,
  value: { requestAdapter: () => { adapterRequests++; return new Promise<null>(resolve => { releaseAdapter = resolve; }); } },
});

const { startWebGpuCheck } = await import('./webgpu/device.ts');
const { createToolRuntime, createInteractiveToolRuntime } = await import('./mount-runtime.ts');

/** Settles to 'pending' when the promise has not settled after a few macrotask turns. */
async function state(promise: Promise<unknown>): Promise<'pending' | 'resolved' | 'rejected'> {
  let result: 'pending' | 'resolved' | 'rejected' = 'pending';
  promise.then(() => { result = 'resolved'; }, () => { result = 'rejected'; });
  for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
  return result;
}

test('no tool runtime is created before the startup check settles, and none after it fails', async () => {
  // A tool the engine would refuse at once: if either wrapper reached createRuntime
  // while the check was pending, the promise would already have rejected.
  const tool = {} as Parameters<typeof createToolRuntime>[0];
  const host = {} as Parameters<typeof createToolRuntime>[1];
  const check = startWebGpuCheck();
  check.catch(() => {});
  const offscreen = createToolRuntime(tool, host, {});
  const interactive = createInteractiveToolRuntime(tool, host, {});
  offscreen.catch(() => {});
  interactive.catch(() => {});
  assert.equal(await state(offscreen), 'pending', 'an off-screen render (gallery preview, paged tile, motion card) waits');
  assert.equal(await state(interactive), 'pending', 'the tool view waits');
  assert.equal(adapterRequests, 1);

  releaseAdapter?.(null);
  await assert.rejects(offscreen, { code: 'WEBGPU_UNAVAILABLE' });
  await assert.rejects(interactive, { code: 'WEBGPU_UNAVAILABLE' });
  // After the failure every later mount is refused with the same error, at once.
  await assert.rejects(createToolRuntime(tool, host, {}), { code: 'WEBGPU_UNAVAILABLE' });
  assert.equal(adapterRequests, 1, 'the check is not repeated');
});

test('both runtime wrappers wait for the check before installing APIs or creating the runtime', () => {
  const source = readFileSync(fileURLToPath(new URL('./mount-runtime.ts', import.meta.url)), 'utf8');
  for (const name of ['createToolRuntime', 'createInteractiveToolRuntime']) {
    const start = source.indexOf(`export const ${name}: CreateRuntime = async`);
    assert.ok(start >= 0, `${name} not found; update this test if the wrapper moved`);
    const body = source.slice(start, source.indexOf('\n};', start));
    const wait = body.indexOf('await webGpuChecked();');
    assert.ok(wait >= 0, `${name} must await webGpuChecked()`);
    assert.ok(wait < body.indexOf('installToolApis('), `${name}: the wait comes first`);
    assert.ok(wait < body.indexOf('createRuntime('), `${name}: before the runtime exists`);
  }
});
