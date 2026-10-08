// SPDX-License-Identifier: MPL-2.0
/** Explicit qualification targets; test-engine WebKit is never labelled Safari or WKWebView. */
import { chromium, firefox, webkit } from 'playwright';
import { localReceiverBrowser, type QualificationBrowser } from './webgpu-local-receiver.ts';

export type WebGpuBrowserEngine = 'chromium' | 'firefox' | 'webkit' | 'safari-local' | 'firefox-local' | 'tauri-macos' | 'tauri-windows' | 'tauri-linux' | 'ios-simulator' | 'android-webview';
export function webGpuBrowserEngine(value = process.env.LOLLY_WEBGPU_BROWSER): WebGpuBrowserEngine {
  if (value === undefined) return 'chromium';
  if (value === 'chromium' || value === 'firefox' || value === 'webkit' || value === 'safari-local' || value === 'firefox-local' || value === 'tauri-macos' || value === 'tauri-windows' || value === 'tauri-linux' || value === 'ios-simulator' || value === 'android-webview') return value;
  throw new Error(`Unknown WebGPU qualification browser: ${value}`);
}

export async function launchWebGpuBrowser(): Promise<QualificationBrowser> {
  const engine = webGpuBrowserEngine();
  if (engine === 'safari-local' || engine === 'firefox-local' || engine === 'tauri-macos' || engine === 'tauri-windows' || engine === 'tauri-linux' || engine === 'ios-simulator' || engine === 'android-webview') return localReceiverBrowser(engine);
  const browser = engine === 'firefox' ? await firefox.launch({ headless: true,
    args: process.env.LOLLY_WEBGPU_FIREFOX_OVERRIDE ? ['--override', process.env.LOLLY_WEBGPU_FIREFOX_OVERRIDE] : [] })
    : engine === 'webkit' ? await webkit.launch({ headless: true })
    : await chromium.launch({ headless: true,
      channel: process.env.LOLLY_WEBGPU_EXECUTABLE ? undefined : process.env.LOLLY_BROWSER_CHANNEL ?? (process.env.LOLLY_WEBGPU_BROWSER ? undefined : 'chrome'),
      ...(process.env.LOLLY_WEBGPU_EXECUTABLE ? { executablePath: process.env.LOLLY_WEBGPU_EXECUTABLE } : {}) });
  return { version: () => browser.version(), close: () => browser.close(), async newPage() {
    const page = await browser.newPage();
    return { goto: async url => { await page.goto(url); }, waitForFunction: async fn => { await page.waitForFunction(fn); },
      async evaluate<R, A = undefined>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<Awaited<R>> {
        // The qualification contract passes JSON values, never Playwright JSHandles.
        return await page.evaluate(fn as (arg: unknown) => R | Promise<R>, arg);
      },
      close: () => page.close() };
  } };
}
