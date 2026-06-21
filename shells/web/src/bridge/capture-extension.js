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

/** Synchronous, zero-cost detection — the extension sets this at document_start. */
export function hasCaptureExtension() {
  return typeof window !== 'undefined' && !!window.__lollyCapture;
}

let _seq = 0;

export function createExtensionCaptureAPI() {
  return {
    page(spec) {
      return new Promise((resolve, reject) => {
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

        function onMessage(event) {
          if (event.source !== window) return;
          const m = event.data;
          if (!m || m.source !== 'lolly-capture/ext' || m.type !== 'result' || m.id !== id) return;
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
