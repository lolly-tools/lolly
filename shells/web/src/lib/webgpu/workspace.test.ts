// SPDX-License-Identifier: MPL-2.0
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createLutWorkspaceCache, LUT_WORKSPACE_BUDGET } from './workspace.ts';

function setup(t: TestContext, failAt = 0) {
  const previous = globalThis.GPUBufferUsage;
  Object.assign(globalThis, { GPUBufferUsage: { STORAGE: 128, COPY_SRC: 4, COPY_DST: 8, UNIFORM: 64, MAP_READ: 1 } });
  t.after(() => { Object.assign(globalThis, { GPUBufferUsage: previous }); });
  const resources: { size: number; destroyed: boolean }[] = [];
  const device = { limits: { minUniformBufferOffsetAlignment: 256 }, createBuffer({ size }: GPUBufferDescriptor) {
    if (failAt && resources.length + 1 === failAt) throw new Error('allocation failed');
    const resource = { size, destroyed: false }; resources.push(resource);
    return { destroy() { resource.destroyed = true; } } as GPUBuffer;
  } } as GPUDevice;
  const controller = new AbortController();
  const cache = createLutWorkspaceCache(100);
  t.after(() => cache.release(device, false));
  return { device, resources, controller, cache };
}

test('workspace reuse, resize, idle and loss obey resource ownership', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { device, resources, controller, cache } = setup(t);
  const first = cache.acquire(device, 64, 24, controller.signal);
  assert.equal(first.stride, 256); assert.equal(resources.length, 4);
  cache.release(device, true); t.mock.timers.tick(90);
  assert.equal(cache.acquire(device, 4, 24, controller.signal), first);
  assert.equal(resources.length, 4);
  cache.release(device, true); t.mock.timers.tick(90);
  assert.equal(cache.stats(device).capacity, 64);
  const second = cache.acquire(device, 128, 24, controller.signal);
  assert.notEqual(second, first); assert.ok(resources.slice(0, 4).every(resource => resource.destroyed));
  cache.release(device, true); t.mock.timers.tick(100);
  assert.equal(cache.stats(device).retainedBytes, 0);
  cache.acquire(device, 64, 24, controller.signal); controller.abort();
  assert.equal(cache.stats(device).retainedBytes, 0);
  assert.ok(resources.every(resource => resource.destroyed));
});

test('aggregate memory admission and failed allocation leave no resources', t => {
  const { device, resources, controller, cache } = setup(t, 3);
  assert.throws(() => cache.acquire(device, LUT_WORKSPACE_BUDGET / 3, 0, controller.signal), { code: 'WEBGPU_LIMIT' });
  assert.equal(resources.length, 0);
  assert.throws(() => cache.acquire(device, 64, 24, controller.signal), /allocation failed/);
  assert.ok(resources.every(resource => resource.destroyed));
  assert.equal(cache.stats(device).retainedBytes, 0);
});
