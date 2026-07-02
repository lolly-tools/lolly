// SPDX-License-Identifier: MPL-2.0
/**
 * CaptureAPI (web) — backed by the Lolly Chrome extension.
 *
 * A browser page can't screenshot a cross-origin URL, but the companion extension
 * can (DevTools Protocol). When installed, its MAIN-world content script sets
 * `window.__lollyCapture` so we can detect it synchronously at boot, and we route
 * `host.capture.page()` to it over window.postMessage (its isolated content script
 * relays to the background service worker that drives the capture).
 *
 * See shells/chrome-extension/.
 */

import type { CaptureAPI, AssetRef } from '../../../../engine/src/bridge/host-v1.ts';

declare global {
  interface Window {
    /** Set at document_start by the extension's MAIN-world content script. */
    __lollyCapture?: boolean;
  }
}

/** The result message the extension's content script posts back. */
interface CaptureResultMessage {
  source: 'lolly-capture/ext';
  type: 'result';
  id: string;
  ok?: boolean;
  dataUrl?: string;
  error?: string;
}

function isCaptureResult(m: unknown): m is CaptureResultMessage {
  if (!m || typeof m !== 'object') return false;
  const r = m as Record<string, unknown>;
  return r.source === 'lolly-capture/ext' && r.type === 'result' && typeof r.id === 'string';
}

/** Synchronous, zero-cost detection — the extension sets this at document_start. */
export function hasCaptureExtension(): boolean {
  return typeof window !== 'undefined' && !!window.__lollyCapture;
}

let _seq = 0;

export function createExtensionCaptureAPI(): CaptureAPI {
  return {
    page(spec) {
      return new Promise<AssetRef>((resolve, reject) => {
        const id = `cap${++_seq}`;

        const cleanup = () => {
          clearTimeout(timer);
          window.removeEventListener('message', onMessage);
        };
        // Capture is slow (a real navigation + settle), so allow a generous window.
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('Capture timed out — the Lolly extension did not respond.'));
        }, 90000);

        function onMessage(event: MessageEvent): void {
          if (event.source !== window) return;
          const m: unknown = event.data;
          if (!isCaptureResult(m) || m.id !== id) return;
          cleanup();
          if (m.ok && m.dataUrl) {
            resolve({
              source: 'remote',
              id: `capture:${spec.url}`,
              type: 'raster',
              format: 'png',
              url: m.dataUrl,
              width: spec.width,
              height: spec.height,
              meta: { capturedFrom: spec.url },
            });
          } else {
            reject(new Error(m.error || 'Page capture failed.'));
          }
        }

        window.addEventListener('message', onMessage);
        window.postMessage({ source: 'lolly-capture/page', type: 'capture', id, spec }, '*');
      });
    },
  };
}
