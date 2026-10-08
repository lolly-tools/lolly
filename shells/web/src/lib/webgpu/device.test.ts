// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createWebGpuDeviceService, webGpuFailureText, WebGpuError } from './device.ts';

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

test('a page served over plain HTTP says so instead of blaming the browser', async () => {
  let asked = 0;
  const service = createWebGpuDeviceService(() => { asked++; return undefined; }, 1000, { secureContext: () => false });
  const error = await service.check().then(() => null, (failure: unknown) => failure) as WebGpuError;
  assert.equal(error.code, 'WEBGPU_INSECURE_CONTEXT');
  assert.match(error.message, /plain HTTP/);
  assert.equal(asked, 0, 'the API is not even looked for on an insecure page');
  await assert.rejects(service.get(), { code: 'WEBGPU_INSECURE_CONTEXT' });
  // The card's text goes through the shell's t(); the English key is the message itself.
  assert.equal(webGpuFailureText(error, source => source), error.message);
  assert.equal(webGpuFailureText(new WebGpuError('WEBGPU_REQUIRED', 'x'), source => source), null);
});

test('the startup check uses the default power preference and releases its device', async () => {
  const gate = fakeDevice(), compute = fakeDevice();
  const requests: Array<GPURequestAdapterOptions | undefined> = [];
  const service = createWebGpuDeviceService(() => ({ requestAdapter: async (options) => {
    requests.push(options);
    return { requestDevice: async () => requests.length === 1 ? gate.device : compute.device } as GPUAdapter;
  } }));
  await Promise.all([service.check(), service.check()]);
  await service.check();
  assert.deepEqual(requests, [{}], 'one request, with no power preference, however often boot and routes ask');
  assert.equal(gate.destroyed(), 1, 'the check holds no device afterwards');
  assert.equal(await service.get(), compute.device);
  assert.deepEqual(requests[1], { powerPreference: 'high-performance' }, 'GPU operations keep their own high-performance device');
  assert.equal(compute.destroyed(), 0);
});

test('the startup check fails the same way for an absent API, a null adapter and a refused device', async () => {
  await assert.rejects(createWebGpuDeviceService(() => undefined).check(), { code: 'WEBGPU_REQUIRED' });
  await assert.rejects(createWebGpuDeviceService(() => ({ requestAdapter: async () => null })).check(), { code: 'WEBGPU_UNAVAILABLE' });
  let deviceRequests = 0;
  const refusing = { requestDevice: async (): Promise<GPUDevice> => { deviceRequests++; throw new DOMException('denied', 'OperationError'); } } as GPUAdapter;
  const refused = await createWebGpuDeviceService(() => ({ requestAdapter: async () => refusing })).check()
    .then(() => null, (failure: unknown) => failure) as WebGpuError;
  assert.equal(refused.code, 'WEBGPU_UNAVAILABLE');
  assert.equal(deviceRequests, 1);
  assert.equal(refused.message, 'Lolly requires WebGPU. Use an up-to-date browser or app with graphics acceleration enabled.', 'the card names the requirement, not the browser\'s own error');
  assert.ok(refused.cause instanceof DOMException, 'the browser\'s error stays attached as the cause');
});

test('a failed startup check stays failed for the page', async () => {
  let asked = 0;
  const service = createWebGpuDeviceService(() => ({ requestAdapter: async () => { asked++; return null; } }));
  await assert.rejects(service.check(), { code: 'WEBGPU_UNAVAILABLE' });
  await assert.rejects(service.check(), { code: 'WEBGPU_UNAVAILABLE' });
  assert.equal(asked, 1);
});

test('the startup check releases a device that answers after the deadline', async () => {
  const late = fakeDevice();
  let finish!: (device: GPUDevice) => void;
  const adapter = { requestDevice: () => new Promise<GPUDevice>(resolve => { finish = resolve; }) } as GPUAdapter;
  const service = createWebGpuDeviceService(() => ({ requestAdapter: async () => adapter }), 5);
  await assert.rejects(service.check(), { code: 'WEBGPU_UNAVAILABLE' });
  finish(late.device); await Promise.resolve(); await Promise.resolve();
  assert.equal(late.destroyed(), 1);
});

test('every failure the card can show is translated, with the Reload label, in every catalog', async () => {
  // Produce each failure the way the shell meets one, then read the card's key for that failure.
  const refusing = { requestDevice: async (): Promise<GPUDevice> => { throw new Error('denied'); } } as GPUAdapter;
  const small = fakeDevice();
  const limited = { requestDevice: async () => ({ ...small.device, limits: { ...small.device.limits, maxStorageBuffersPerShaderStage: 1 } }) } as GPUAdapter;
  const slow = { requestDevice: () => new Promise<GPUDevice>(() => {}) } as GPUAdapter;
  const lossy = fakeDevice();
  const lossyService = createWebGpuDeviceService(() => ({ requestAdapter: async () => ({ requestDevice: async () => lossy.device }) as GPUAdapter }));
  await lossyService.get();
  lossy.lose(); await Promise.resolve();
  const failures = await Promise.all([
    createWebGpuDeviceService(() => undefined, 1000, { secureContext: () => false }).check(),
    createWebGpuDeviceService(() => undefined).check(),
    createWebGpuDeviceService(() => ({ requestAdapter: async () => null })).check(),
    createWebGpuDeviceService(() => ({ requestAdapter: async () => refusing })).check(),
    createWebGpuDeviceService(() => ({ requestAdapter: async () => limited })).check(),
    createWebGpuDeviceService(() => ({ requestAdapter: async () => slow }), 5).check(),
    lossyService.get(),
  ].map(attempt => attempt.then(() => assert.fail('expected a failure'), (failure: unknown) => failure as WebGpuError)));
  const keys = new Set<string>();
  for (const failure of failures) {
    const key = webGpuFailureText(failure, source => source);
    assert.equal(key, failure.message, `${failure.code}: the card's translation key is the message itself`);
    keys.add(key!);
  }
  assert.equal(keys.size, 5, 'insecure, required, limits, timed out and lost: the required text serves three causes');
  keys.add('WebGPU initialisation expired. Reload Lolly to try again.');
  keys.add('Reload');
  const locales = fileURLToPath(new URL('../../locales/', import.meta.url));
  const overrides = fileURLToPath(new URL('../../../../../scripts/i18n/overrides/', import.meta.url));
  const langs = readdirSync(locales).filter(name => name.endsWith('.json') && name !== 'en.json').map(name => name.slice(0, -5));
  assert.ok(langs.length >= 26, `only ${langs.length} catalogs found`);
  const missing: string[] = [];
  for (const lang of langs) {
    const catalog = JSON.parse(readFileSync(`${locales}${lang}.json`, 'utf8')) as Record<string, string>;
    const override = JSON.parse(readFileSync(`${overrides}spa.${lang}.json`, 'utf8')) as Record<string, string>;
    for (const key of keys) {
      const value = catalog[key];
      if (!value || value === key) missing.push(`${lang}: ${key}`);
      else if (override[key] !== value) missing.push(`${lang}: the spa override for "${key}" does not match the catalog`);
    }
  }
  assert.deepEqual(missing, []);
  assert.equal(webGpuFailureText(new WebGpuError('WEBGPU_UNAVAILABLE', 'something else'), source => source), null, 'an unknown message shows as written');
});
