/**
 * Lolly URL Screenshot — isolated-world content script (relay).
 *
 * Bridges the Lolly web page and the extension background:
 *   page  ⇄ content  via window.postMessage (crosses the isolated/main boundary)
 *   content ⇄ background via chrome.runtime messaging (extension APIs)
 *
 * The page never needs the extension id, and we avoid externally_connectable.
 */

// Origins allowed to drive the relay. Mirrors manifest.json content_scripts
// matches — defence in depth on top of `event.source === window`, so a frame
// or opener on another origin can never reach the debugger-backed capture path
// (SUSE assessment 2026-08, S1a).
const ALLOWED_ORIGINS = /^(http:\/\/localhost:5173|https:\/\/lolly\.tools|https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.lolly\.tools)$/;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!ALLOWED_ORIGINS.test(event.origin)) return;
  const msg = event.data;
  if (!msg || msg.source !== 'lolly-capture/page') return;

  if (msg.type === 'ping') {
    window.postMessage({ source: 'lolly-capture/ext', type: 'pong' }, '*');
    return;
  }

  if (msg.type === 'capture') {
    chrome.runtime.sendMessage({ type: 'lolly-capture', spec: msg.spec }, (resp) => {
      const err = chrome.runtime.lastError?.message;
      window.postMessage({
        source: 'lolly-capture/ext',
        type: 'result',
        id: msg.id,
        ok: !err && !!resp?.ok,
        dataUrl: resp?.dataUrl,
        error: err || resp?.error,
      }, '*');
    });
  }
});
