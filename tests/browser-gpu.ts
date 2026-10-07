// SPDX-License-Identifier: MPL-2.0
/** Explicit software WebGPU for browser conformance on runners without a physical adapter. */
if (process.env.LOLLY_WEBGPU_TEST_ADAPTER === 'swiftshader') {
  const { chromium } = await import('playwright');
  const launch = chromium.launch.bind(chromium);
  chromium.launch = (options = {}) => launch({
    ...options,
    args: [...(options.args ?? []), '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'],
  });
}
export {};
