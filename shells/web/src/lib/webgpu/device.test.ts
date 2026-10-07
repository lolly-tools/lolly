// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebGpuDeviceService } from './device.ts';

function fakeDevice() {
  let destroyCount = 0;
  let lose!: (info: GPUDeviceLostInfo) => void;
  const device = {
    limits: { maxStorageBuffersPerShaderStage: 8, maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupSizeX: 256, maxStorageBufferBindingSize: 128 * 1024 * 1024 } as GPUSupportedLimits,
    lost: new Promise<GPUDeviceLostInfo>(resolve => { lose = resolve; }),
    destroy() { destroyCount++; },
  } as GPUDevice;
  return { device, lose: () => lose({ reason: 'unknown', message: 'Test loss' } as GPUDeviceLostInfo), destroyed: () => destroyCount };
}

test('required WebGPU fails for absent API, absent adapter and refused device', async () => {
  await assert.rejects(createWebGpuDeviceService(() => undefined).get(), { code: 'WEBGPU_REQUIRED' });
  await assert.rejects(createWebGpuDeviceService(() => ({ requestAdapter: async () => null })).get(), { code: 'WEBGPU_UNAVAILABLE' });
  const adapter = { requestDevice: async (): Promise<GPUDevice> => { throw new Error('denied'); } } as GPUAdapter;
  await assert.rejects(createWebGpuDeviceService(() => ({ requestAdapter: async () => adapter })).get(), { code: 'WEBGPU_UNAVAILABLE' });
});

test('concurrent acquisition shares a device and loss needs an explicit reset', async () => {
  const first = fakeDevice(), second = fakeDevice();
  let attempts = 0;
  const service = createWebGpuDeviceService(() => ({ requestAdapter: async () => {
    attempts++;
    return { requestDevice: async () => attempts === 1 ? first.device : second.device } as GPUAdapter;
  } }));
  const [a, b] = await Promise.all([service.get(), service.get()]);
  assert.equal(a, b); assert.equal(attempts, 1);
  first.lose(); await Promise.resolve();
  await assert.rejects(service.get(), { code: 'WEBGPU_DEVICE_LOST' });
  assert.equal(attempts, 1);
  service.reset(); assert.equal(await service.get(), second.device);
  service.reset(); assert.equal(second.destroyed(), 1);
});

test('acquisition deadline releases a device that answers late', async () => {
  const late = fakeDevice();
  let finish!: (device: GPUDevice) => void;
  const adapter = { requestDevice: () => new Promise<GPUDevice>(resolve => { finish = resolve; }) } as GPUAdapter;
  const service = createWebGpuDeviceService(() => ({ requestAdapter: async () => adapter }), 5);
  await assert.rejects(service.get(), { code: 'WEBGPU_UNAVAILABLE' });
  finish(late.device); await Promise.resolve(); await Promise.resolve();
  assert.equal(late.destroyed(), 1);
});

test('insufficient compute limits reject and release the device', async () => {
  const small = fakeDevice();
  const adapter = { requestDevice: async () => ({ ...small.device, limits: { ...small.device.limits, maxStorageBufferBindingSize: 128 } }) } as GPUAdapter;
  await assert.rejects(createWebGpuDeviceService(() => ({ requestAdapter: async () => adapter })).get(), { code: 'WEBGPU_LIMIT' });
  assert.equal(small.destroyed(), 1);
});
