// SPDX-License-Identifier: MPL-2.0
/**
 * Explicit software WebGPU for browser conformance on runners without a physical adapter.
 * Both launch routes get the flags: a test that keeps a profile across restarts calls
 * launchPersistentContext, and without an adapter the web shell stops before it boots.
 */
if (process.env.LOLLY_WEBGPU_TEST_ADAPTER === 'swiftshader') {
  const { chromium } = await import('playwright');
  const gpuArgs = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'];
  const launch = chromium.launch.bind(chromium);
  chromium.launch = (options = {}) => launch({
    ...options,
    args: [...(options.args ?? []), ...gpuArgs],
  });
  const launchPersistentContext = chromium.launchPersistentContext.bind(chromium);
  chromium.launchPersistentContext = (userDataDir, options = {}) => launchPersistentContext(userDataDir, {
    ...options,
    args: [...(options.args ?? []), ...gpuArgs],
  });
}
export {};
